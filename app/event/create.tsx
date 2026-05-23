import { useDevRole } from '@/lib/devRoleStore';
import { insertEvent, updateEvent, updateEventSeries } from '@/lib/eventService';
import {
  RECURRENCE_LABELS,
  ROLE_ALLOWED_KINDS,
  addUserEvent,
  canManageEvent,
  findEventById,
  updateUserEvent,
  updateUserEventSeries,
  type RecurrenceType,
  type UpdateEventInput,
} from '@/lib/eventStore';
import {
  KIND_BG,
  KIND_COLORS,
  KIND_LABELS,
  getEventDate,
  type EventAudience,
  type EventKind,
  type MockEvent,
} from '@/lib/mockEvents';
import { OFFICER_ROLES, ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { buildRsvpReviewTask } from '@/lib/generatedTasks';
import { NO_TEMPLATE } from '@/lib/eventTemplates';
import { buildTasksForTemplateId, getTemplateById, mergedTemplateOptions, useCustomTemplatesVersion } from '@/lib/customTemplatesStore';
import { addGeneratedTask, PROOF_LABEL } from '@/lib/mockTasks';
import { insertTask } from '@/lib/taskService';
import { emitUpdateNotice, type UpdateSeverity } from '@/lib/updateNoticeStore';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Build an ISO date string (YYYY-MM-DD) from year + 0-based month + day. */
function isoDateFromParts(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayIso(): string {
  const t = new Date();
  return isoDateFromParts(t.getFullYear(), t.getMonth(), t.getDate());
}

// Upper bound for date pickers: 12 months from today
const _now      = new Date();
const _maxDate  = new Date(_now.getFullYear(), _now.getMonth() + 12, _now.getDate());
const MAX_ISO   = isoDateFromParts(_maxDate.getFullYear(), _maxDate.getMonth(), _maxDate.getDate());

// ─── Edit-mode helpers ─────────────────────────────────────────────────────────

/** Parse a stored time string ("8:00 PM") back into the picker fields. */
function parseTime(t: string): { hour: number; minute: string; ampm: 'AM' | 'PM' } {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return { hour: 8, minute: '00', ampm: 'PM' };
  const minute = ['00', '15', '30', '45'].includes(m[2]) ? m[2] : '00';
  return { hour: parseInt(m[1], 10), minute, ampm: m[3].toUpperCase() as 'AM' | 'PM' };
}

/** A MockEvent stores dayOffset; reconstruct its ISO date for edit prefill. */
function isoFromDayOffset(dayOffset: number): string {
  const d = getEventDate(dayOffset);
  return isoDateFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Natural-language join: ['time','location'] → "time and location". */
function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Build a coalesced update notice from an event edit diff (null if no
 * notify-worthy change). Reassures recipients their RSVP is preserved.
 * `includeDate` is false for series edits (date isn't applied to the series).
 */
function buildEventEditNotice(
  before: MockEvent,
  input: UpdateEventInput,
  includeDate: boolean,
): { summary: string; severity: UpdateSeverity; audience: Role[] } | null {
  const changes: { label: string; sev: UpdateSeverity }[] = [];
  if (before.title !== input.title)                                        changes.push({ label: 'title',      sev: 'moderate' });
  if (includeDate && isoFromDayOffset(before.dayOffset) !== input.dateString) changes.push({ label: 'date',       sev: 'critical' });
  if (before.time !== input.time)                                          changes.push({ label: 'time',       sev: 'critical' });
  if (before.location !== input.location)                                  changes.push({ label: 'location',   sev: 'critical' });
  if (before.audience !== input.audience)                                  changes.push({ label: 'attendance', sev: 'critical' });
  if (changes.length === 0) return null;

  const severity: UpdateSeverity = changes.some(c => c.sev === 'critical') ? 'critical' : 'moderate';
  const summary  =
    `${input.title} was updated: ${joinNatural(changes.map(c => c.label))} changed. ` +
    `Your RSVP is still saved, but please review the update and change your response if needed.`;
  const audience = input.audience === 'officers' ? [...OFFICER_ROLES] : [...OFFICER_ROLES, 'brother' as Role];
  return { summary, severity, audience };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAL_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES    = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];
const MINUTE_CHIPS: string[] = ['00', '15', '30', '45'];

const AUDIENCE_OPTIONS: { value: EventAudience; label: string; sub: string }[] = [
  { value: 'all',      label: 'Mandatory',    sub: 'All active members required' },
  { value: 'officers', label: 'Officers Only', sub: 'E-Board and officers'        },
  { value: 'optional', label: 'Optional',      sub: 'Open to all — not required'  },
];

const RECURRENCE_OPTS: RecurrenceType[] = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];

// Human label for a template task's due offset (negative = before the event).
function dueOffsetLabel(n: number): string {
  if (n === 0) return 'On event day';
  const d = Math.abs(n);
  return `${d} day${d === 1 ? '' : 's'} ${n < 0 ? 'before' : 'after'}`;
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={s.fieldLabelRow}>
      <Text style={s.fieldLabel}>{text}</Text>
      {required && <Text style={s.fieldRequired}>required</Text>}
    </View>
  );
}

// ─── KindSelector ─────────────────────────────────────────────────────────────

function KindSelector({
  selected, onSelect, allowedKinds,
}: {
  selected:     EventKind;
  onSelect:     (k: EventKind) => void;
  allowedKinds: EventKind[];
}) {
  return (
    <View style={s.kindGrid}>
      {allowedKinds.map(value => {
        const color = KIND_COLORS[value];
        const bg    = KIND_BG[value];
        const isOn  = selected === value;
        return (
          <Pressable
            key={value}
            style={[s.kindChip, isOn && { backgroundColor: bg, borderColor: color }]}
            onPress={() => onSelect(value)}
          >
            <View style={[s.kindDot, { backgroundColor: isOn ? color : '#475569' }]} />
            <Text style={[s.kindChipText, isOn && { color }]}>{KIND_LABELS[value]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── CalendarPicker ───────────────────────────────────────────────────────────

function CalendarPicker({
  selected, onSelect, minIso, maxIso,
}: {
  selected: string;         // ISO date string or ''
  onSelect: (iso: string) => void;
  minIso?:  string;         // inclusive lower bound (defaults to today)
  maxIso?:  string;         // inclusive upper bound (defaults to MAX_ISO)
}) {
  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();

  const initYear  = selected ? parseInt(selected.slice(0, 4))     : todayY;
  const initMonth = selected ? parseInt(selected.slice(5, 7)) - 1 : todayM;

  const [viewYear,  setViewYear ] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const effectiveMin = minIso ?? todayIso();
  const effectiveMax = maxIso ?? MAX_ISO;

  // Previous month navigation bound
  const prevY           = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevM           = viewMonth === 0 ? 11            : viewMonth - 1;
  const lastDayOfPrev   = new Date(viewYear, viewMonth, 0).getDate();
  const prevLastIso     = isoDateFromParts(prevY, prevM, lastDayOfPrev);
  const canGoPrev       = prevLastIso >= effectiveMin;

  // Next month navigation bound
  const nextY       = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextM       = viewMonth === 11 ? 0             : viewMonth + 1;
  const nextFirstIso = isoDateFromParts(nextY, nextM, 1);
  const canGoNext   = nextFirstIso <= effectiveMax;

  function goPrev() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else                 { setViewMonth(m => m - 1); }
  }
  function goNext() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else                  { setViewMonth(m => m + 1); }
  }

  // Build grid
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const firstOffset  = (firstWeekday + 6) % 7;                   // 0=Mon … 6=Sun

  const cells: (number | null)[] = Array(firstOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const todayStr = todayIso();

  return (
    <View style={s.cal}>
      {/* Month header */}
      <View style={s.calHeader}>
        <Pressable
          onPress={goPrev}
          disabled={!canGoPrev}
          style={[s.calNavBtn, !canGoPrev && s.calNavBtnOff]}
        >
          <Text style={[s.calNavText, !canGoPrev && s.calNavTextOff]}>‹</Text>
        </Pressable>
        <Text style={s.calMonthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable
          onPress={goNext}
          disabled={!canGoNext}
          style={[s.calNavBtn, !canGoNext && s.calNavBtnOff]}
        >
          <Text style={[s.calNavText, !canGoNext && s.calNavTextOff]}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={s.calRow}>
        {CAL_DAY_LABELS.map(h => (
          <Text key={h} style={s.calDayHead}>{h}</Text>
        ))}
      </View>

      {/* Day cells */}
      {rows.map((row, ri) => (
        <View key={ri} style={s.calRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={s.calCell} />;
            const iso      = isoDateFromParts(viewYear, viewMonth, day);
            const isSel    = iso === selected;
            const isToday  = iso === todayStr;
            const disabled = iso < effectiveMin || iso > effectiveMax;
            return (
              <Pressable
                key={ci}
                style={[
                  s.calCell,
                  isSel    && s.calCellSel,
                  isToday  && !isSel && s.calCellToday,
                  disabled && s.calCellOff,
                ]}
                onPress={() => !disabled && onSelect(iso)}
                disabled={disabled}
              >
                <Text style={[
                  s.calCellText,
                  isSel    && s.calCellTextSel,
                  isToday  && !isSel && s.calCellTextToday,
                  disabled && s.calCellTextOff,
                ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({
  hour, minute, ampm, onHour, onMinute, onAmpm,
}: {
  hour:    number;
  minute:  string;
  ampm:    'AM' | 'PM';
  onHour:  (h: number) => void;
  onMinute:(m: string) => void;
  onAmpm:  (a: 'AM' | 'PM') => void;
}) {
  return (
    <View style={s.timePicker}>
      {/* Row 1: Hour arrows + AM/PM */}
      <View style={s.timeRow1}>
        <Pressable
          style={s.timeArrow}
          onPress={() => onHour(hour === 1 ? 12 : hour - 1)}
        >
          <Text style={s.timeArrowText}>‹</Text>
        </Pressable>
        <Text style={s.timeHourNum}>{hour}</Text>
        <Pressable
          style={s.timeArrow}
          onPress={() => onHour(hour === 12 ? 1 : hour + 1)}
        >
          <Text style={s.timeArrowText}>›</Text>
        </Pressable>

        <Text style={s.timeColon}>h</Text>
        <View style={{ flex: 1 }} />

        {(['AM', 'PM'] as const).map(a => (
          <Pressable
            key={a}
            style={[s.timeAmpmBtn, ampm === a && s.timeAmpmBtnOn]}
            onPress={() => onAmpm(a)}
          >
            <Text style={[s.timeAmpmText, ampm === a && s.timeAmpmTextOn]}>{a}</Text>
          </Pressable>
        ))}
      </View>

      {/* Row 2: Minute chips */}
      <View style={s.timeRow2}>
        {MINUTE_CHIPS.map(m => (
          <Pressable
            key={m}
            style={[s.timeMinChip, minute === m && s.timeMinChipOn]}
            onPress={() => onMinute(m)}
          >
            <Text style={[s.timeMinText, minute === m && s.timeMinTextOn]}>:{m}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── RecurrencePicker ─────────────────────────────────────────────────────────

function RecurrencePicker({
  value, onChange,
}: {
  value:    RecurrenceType;
  onChange: (r: RecurrenceType) => void;
}) {
  return (
    <View style={s.recWrap}>
      {RECURRENCE_OPTS.map(opt => (
        <Pressable
          key={opt}
          style={[s.recChip, value === opt && s.recChipOn]}
          onPress={() => onChange(opt)}
        >
          <Text style={[s.recChipText, value === opt && s.recChipTextOn]}>
            {RECURRENCE_LABELS[opt]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── AudiencePicker ───────────────────────────────────────────────────────────

function AudiencePicker({
  selected, onSelect,
}: {
  selected: EventAudience | '';
  onSelect: (a: EventAudience) => void;
}) {
  return (
    <View style={s.audienceList}>
      {AUDIENCE_OPTIONS.map(({ value, label, sub }) => {
        const isOn = selected === value;
        return (
          <Pressable
            key={value}
            style={[s.audienceRow, isOn && s.audienceRowOn]}
            onPress={() => onSelect(value)}
          >
            <View style={[s.radioOuter, isOn && s.radioOuterOn]}>
              {isOn && <View style={s.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.audienceLabel, isOn && s.audienceLabelOn]}>{label}</Text>
              <Text style={s.audienceSub}>{sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }   = useDevRole();
  const params     = useLocalSearchParams<{ eventId?: string }>();

  // Edit mode when an eventId is supplied.
  const editing     = !!params.eventId;
  const existing    = useMemo(() => (params.eventId ? findEventById(params.eventId) : undefined), [params.eventId]);
  const prefillTime = useMemo(() => (existing ? parseTime(existing.time) : { hour: 8, minute: '00', ampm: 'PM' as const }), [existing]);

  const allowedKinds = ROLE_ALLOWED_KINDS[role] ?? [];

  // ── Form state (prefilled from `existing` in edit mode) ──────────────────────
  const [title,       setTitle      ] = useState(existing?.title ?? '');
  const [kind,        setKind       ] = useState<EventKind>(() => (existing?.kind as EventKind) ?? allowedKinds[0] ?? 'chapter');
  const [dateString,  setDateString ] = useState(existing ? isoFromDayOffset(existing.dayOffset) : '');
  const [hour,        setHour       ] = useState(prefillTime.hour);
  const [minute,      setMinute     ] = useState(prefillTime.minute);
  const [ampm,        setAmpm       ] = useState<'AM' | 'PM'>(prefillTime.ampm);
  const [location,    setLocation   ] = useState(existing?.location ?? '');
  const [audience,    setAudience   ] = useState<EventAudience | ''>(existing?.audience ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [recurrence,  setRecurrence ] = useState<RecurrenceType>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [requiresDateNames, setRequiresDateNames] = useState(existing?.requiresDateNames ?? false);
  const [templateId,  setTemplateId ] = useState<string>(NO_TEMPLATE);
  const [errors,      setErrors     ] = useState<string[]>([]);

  // Merged built-in + custom templates for the picker (reactive to edits).
  useCustomTemplatesVersion();
  const templateOptions = mergedTemplateOptions();
  // Specs of the selected template, for the preview (read-only; same data the
  // generator uses, so the preview can't drift from what gets created).
  const previewSpecs = templateId !== NO_TEMPLATE
    ? (getTemplateById(templateId)?.taskSpecs ?? [])
    : [];

  // Reset kind when role changes to one that disallows it (create mode only —
  // never mutate the kind of an event being edited).
  useEffect(() => {
    if (editing) return;
    const allowed = ROLE_ALLOWED_KINDS[role] ?? [];
    if (!allowed.includes(kind)) setKind(allowed[0] ?? 'chapter');
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: non-officers, or non-managers of this event in edit mode.
  useEffect(() => {
    if (!isOfficer(role)) { router.back(); return; }
    if (editing && (!existing || !canManageEvent(existing, role))) router.back();
  }, [role, editing, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Header cancel button + title
  useEffect(() => {
    navigation.setOptions({
      title: editing ? 'Edit Event' : 'Create Event',
      headerLeft: () => (
        <Pressable onPress={() => router.back()} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </Pressable>
      ),
    });
  }, [navigation, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    title.trim().length > 0 &&
    dateString !== '' &&
    audience !== '' &&
    (editing || recurrence === 'none' || repeatUntil !== '');

  function handleSubmit() {
    const errs: string[] = [];
    if (!title.trim())                                     errs.push('Event name is required.');
    if (!dateString)                                       errs.push('Please pick a date.');
    if (!audience)                                         errs.push('Please select attendance type.');
    if (!editing && recurrence !== 'none' && !repeatUntil) errs.push('Please set a repeat-until date.');
    if (errs.length > 0) { setErrors(errs); return; }

    const timeStr = `${hour}:${minute} ${ampm}`;

    // ── Edit existing event (recurrence rule preserved, not edited) ────────────
    if (editing && existing) {
      const input: UpdateEventInput = {
        title:       title.trim(),
        kind,
        audience:    audience as EventAudience,
        dateString,
        time:        timeStr,
        location:    location.trim() || 'TBD',
        description: description.trim(),
      };

      // Emit one update notice (RSVP is preserved; never reset).
      function emitEditNotice(includeDate: boolean) {
        const notice = buildEventEditNotice(existing!, input, includeDate);
        if (notice) {
          emitUpdateNotice({
            entityType:    'event',
            entityId:      existing!.id,
            summary:       notice.summary,
            severity:      notice.severity,
            audienceRoles: notice.audience,
            changedByRole: role,
          });
        }
      }

      function applySingle() {
        const updated = updateUserEvent(existing!.id, input);
        if (updated) {
          void updateEvent(updated);   // persist editable fields (incl. date)
          emitEditNotice(true);
        }
        // Pop back to the Event Detail already in the stack (it re-reads the
        // updated event on focus) — avoids pushing a duplicate detail screen.
        router.back();
      }

      function applySeries() {
        const sid = existing!.seriesId!;
        updateUserEventSeries(sid, input);           // local + cache (date NOT applied)
        void updateEventSeries(sid, {                // persist shared fields across the series
          title: input.title, kind: input.kind, audience: input.audience,
          time: input.time, location: input.location, description: input.description,
        });
        emitEditNotice(false);                       // date excluded for series
        // Pop back to the existing Event Detail (refreshes on focus) — no duplicate.
        router.back();
      }

      // Recurring → ask the edit scope; otherwise edit the single event.
      // seriesId is the authoritative "part of a series" marker.
      if (existing.seriesId) {
        Alert.alert(
          'Edit Recurring Event',
          `"${existing.title}" is part of a recurring series.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'This Event Only', onPress: applySingle },
            { text: 'Entire Series',   onPress: applySeries },
          ],
        );
      } else {
        applySingle();
      }
      return;
    }

    // ── Create new event ───────────────────────────────────────────────────────
    // Local optimistic write (also generates RSVP tasks). Returns all instances
    // (recurring series → one per date), each with a client-generated UUID id.
    const created = addUserEvent({
      title:        title.trim(),
      kind,
      audience:     audience as EventAudience,
      dateString,
      time:         timeStr,
      location:     location.trim() || 'TBD',
      description:  description.trim(),
      createdByRole: role,
      recurrence,
      repeatUntil:  recurrence !== 'none' ? repeatUntil : undefined,
      requiresDateNames: kind === 'social' ? requiresDateNames : false,
    });

    // Persist each instance to Supabase (fire-and-forget; no-ops if unconfigured,
    // preserving the local-only fallback). Same UUIDs are used in both places.
    created.forEach(e => { void insertEvent(e); });

    // MVP P3: when RSVP is enabled (audience !== 'optional'), generate ONE
    // "Review RSVP list for [event name]" task for the PRIMARY created event
    // only (no per-recurrence fan-out). Deterministic id makes generation
    // idempotent; addGeneratedTask returns undefined if it already exists or was
    // deleted this session. Persistence is fire-and-forget (no-op when
    // unconfigured) and never blocks event creation. Optional events generate
    // nothing.
    const primary = created[0];
    if (primary.audience !== 'optional') {
      const reviewTask = addGeneratedTask(buildRsvpReviewTask({
        id:            primary.id,
        title:         primary.title,
        dateString:    primary.dateString,
        createdByRole: role,   // Role of the creating officer (same value on the event)
      }));
      if (reviewTask) void insertTask(reviewTask);
    }

    // Apply an event-task template (deterministic + idempotent). Create-only and
    // for the PRIMARY created event only (no per-recurrence fan-out), mirroring
    // the RSVP-review generation above. "None" generates nothing.
    if (templateId !== NO_TEMPLATE) {
      buildTasksForTemplateId(templateId, {
        id:            primary.id,
        title:         primary.title,
        dateString:    primary.dateString,
        createdByRole: role,
      }).forEach(t => {
        const added = addGeneratedTask(t);
        if (added) void insertTask(added);
      });
    }

    router.replace(`/event/${primary.id}` as any);
  }

  // Repeat-until lower bound is the chosen event date (or today if none yet)
  const repeatUntilMin = dateString || todayIso();

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Event Name ── */}
        <View style={s.field}>
          <FieldLabel text="EVENT NAME" required />
          <TextInput
            style={[s.textInput, errors.includes('Event name is required.') && s.inputError]}
            placeholder="e.g. Philanthropy Night"
            placeholderTextColor="#475569"
            value={title}
            onChangeText={v => { setTitle(v); setErrors([]); }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* ── Event Type ── */}
        {allowedKinds.length > 0 && (
          <View style={s.field}>
            <FieldLabel text="EVENT TYPE" />
            <KindSelector
              selected={kind}
              onSelect={setKind}
              allowedKinds={allowedKinds}
            />
          </View>
        )}

        {/* ── Date ── */}
        <View style={s.field}>
          <FieldLabel text="DATE" required />
          {errors.includes('Please pick a date.') && (
            <Text style={s.errorMsg}>Please pick a date.</Text>
          )}
          <CalendarPicker
            selected={dateString}
            onSelect={d => {
              setDateString(d);
              setRepeatUntil('');   // reset repeat-until when base date changes
              setErrors([]);
            }}
            maxIso={MAX_ISO}
          />
        </View>

        {/* ── Time ── */}
        <View style={s.field}>
          <FieldLabel text="TIME" />
          <TimePicker
            hour={hour}
            minute={minute}
            ampm={ampm}
            onHour={setHour}
            onMinute={setMinute}
            onAmpm={setAmpm}
          />
        </View>

        {/* ── Location ── */}
        <View style={s.field}>
          <FieldLabel text="LOCATION" />
          <TextInput
            style={s.textInput}
            placeholder="e.g. Chapter Room, Library 204…"
            placeholderTextColor="#475569"
            value={location}
            onChangeText={setLocation}
            returnKeyType="next"
          />
        </View>

        {/* ── Attendance ── */}
        <View style={s.field}>
          <FieldLabel text="ATTENDANCE" required />
          {errors.includes('Please select attendance type.') && (
            <Text style={s.errorMsg}>Please select attendance type.</Text>
          )}
          <AudiencePicker
            selected={audience}
            onSelect={a => { setAudience(a); setErrors([]); }}
          />
        </View>

        {/* ── Collect date names (date-style social events only) ── */}
        {!editing && kind === 'social' && (
          <View style={s.field}>
            <Pressable
              style={s.dateToggleRow}
              onPress={() => setRequiresDateNames(v => !v)}
            >
              <View style={[s.dateToggleBox, requiresDateNames && s.dateToggleBoxOn]}>
                {requiresDateNames && <Text style={s.dateToggleCheck}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.dateToggleLabel}>Collect date names</Text>
                <Text style={s.dateToggleSub}>
                  Adds a date-name submission section for date parties / formals. Leave off for regular socials.
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* ── Apply task template (create only) ── */}
        {!editing && (
          <View style={s.field}>
            <FieldLabel text="APPLY TEMPLATE" />
            <View style={s.recWrap}>
              {templateOptions.map(opt => (
                <Pressable
                  key={opt.id}
                  style={[s.recChip, templateId === opt.id && s.recChipOn]}
                  onPress={() => setTemplateId(opt.id)}
                >
                  <Text style={[s.recChipText, templateId === opt.id && s.recChipTextOn]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {templateId !== NO_TEMPLATE && (
              <Text style={s.templateHint}>Auto-creates a set of prep tasks for this event when you create it.</Text>
            )}
            <Pressable onPress={() => router.push('/templates' as any)}>
              <Text style={s.manageTemplatesLink}>Manage templates →</Text>
            </Pressable>
          </View>
        )}

        {/* ── Template preview: tasks that will be generated (create only) ── */}
        {!editing && previewSpecs.length > 0 && (
          <View style={s.field}>
            <FieldLabel text="TASKS THIS TEMPLATE CREATES" />
            <View style={s.previewBlock}>
              {previewSpecs.map((spec, idx) => (
                <View key={idx} style={[s.previewRow, idx > 0 && s.previewRowBorder]}>
                  <Text style={s.previewTitle} numberOfLines={2}>
                    {spec.title.replace(/\{event\}/g, title.trim() || 'this event')}
                  </Text>
                  <Text style={s.previewMeta}>
                    {ROLE_LABELS[spec.assignedRole]} · {dueOffsetLabel(spec.dueOffsetDays)}
                    {spec.requiresApproval ? `  ·  Approval: ${ROLE_LABELS[spec.reviewerRole ?? 'pro_consul']}` : ''}
                    {spec.requiresProof ? `  ·  Proof: ${PROOF_LABEL[spec.proofType ?? 'text']}` : ''}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.previewFootnote}>
              {previewSpecs.length} task{previewSpecs.length === 1 ? '' : 's'} will be created when you create this event.
            </Text>
          </View>
        )}

        {/* ── Recurrence (create only — recurring rule isn't edited) ── */}
        {!editing && (
        <View style={s.field}>
          <FieldLabel text="REPEATS" />
          <RecurrencePicker
            value={recurrence}
            onChange={r => { setRecurrence(r); setRepeatUntil(''); }}
          />
        </View>
        )}

        {/* ── Repeat Until (shown only when recurrence is active) ── */}
        {!editing && recurrence !== 'none' && (
          <View style={s.field}>
            <FieldLabel text="REPEAT UNTIL" required />
            {errors.includes('Please set a repeat-until date.') && (
              <Text style={s.errorMsg}>Please set a repeat-until date.</Text>
            )}
            <CalendarPicker
              selected={repeatUntil}
              onSelect={d => { setRepeatUntil(d); setErrors([]); }}
              minIso={repeatUntilMin}
              maxIso={MAX_ISO}
            />
          </View>
        )}

        {/* ── Description ── */}
        <View style={s.field}>
          <FieldLabel text="DESCRIPTION" />
          <TextInput
            style={[s.textInput, s.textArea]}
            placeholder="Details, dress code, reminders for members…"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Submit ── */}
        <Pressable
          style={[s.createBtn, !canSubmit && s.createBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={[s.createBtnText, !canSubmit && s.createBtnTextDisabled]}>
            {editing ? 'Save Changes' : 'Create Event'}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  // Header cancel
  cancelBtn:     { paddingHorizontal: 4 },
  cancelBtnText: { color: '#94a3b8', fontSize: 15 },

  // Field wrapper
  field:         { marginBottom: 28 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  templateHint:  { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 17 },
  manageTemplatesLink: { fontSize: 13, fontWeight: '600', color: '#818cf8', marginTop: 10 },

  // Template preview
  previewBlock:     { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  previewRow:       { paddingHorizontal: 14, paddingVertical: 11, gap: 3 },
  previewRowBorder: { borderTopWidth: 1, borderTopColor: '#0f172a' },
  previewTitle:     { fontSize: 14, fontWeight: '600', color: '#f1f5f9', lineHeight: 19 },
  previewMeta:      { fontSize: 12, color: '#64748b' },
  previewFootnote:  { fontSize: 12, color: '#64748b', marginTop: 8 },
  fieldRequired: { fontSize: 10, color: '#475569', fontWeight: '500' },
  errorMsg:      { color: '#f87171', fontSize: 12, marginBottom: 8, marginLeft: 2 },

  // Text inputs
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea:   { minHeight: 96, paddingTop: 12 },
  inputError: { borderColor: '#f87171' },

  // Kind selector
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: '46%',
    flexGrow: 1,
  },
  kindDot:      { width: 8, height: 8, borderRadius: 4 },
  kindChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  // Calendar
  cal: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  calNavBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calNavBtnOff: { opacity: 0.3 },
  calNavText:   { fontSize: 22, color: '#94a3b8', lineHeight: 26 },
  calNavTextOff:{ color: '#475569' },
  calMonthLabel:{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  calRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  calDayHead: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2,
    paddingVertical: 6,
  },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
    borderRadius: 6,
  },
  calCellSel:       { backgroundColor: '#4f46e5' },
  calCellToday:     { backgroundColor: '#1e1b4b' },
  calCellOff:       { opacity: 0.25 },
  calCellText:      { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  calCellTextSel:   { color: '#fff', fontWeight: '700' },
  calCellTextToday: { color: '#a5b4fc', fontWeight: '700' },
  calCellTextOff:   { color: '#334155' },

  // Time picker
  timePicker: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  timeRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeArrowText: { fontSize: 18, color: '#94a3b8', lineHeight: 22 },
  timeHourNum: {
    width: 32,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  timeColon: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 2,
  },
  timeAmpmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  timeAmpmBtnOn:  { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  timeAmpmText:   { fontSize: 13, fontWeight: '700', color: '#64748b' },
  timeAmpmTextOn: { color: '#a5b4fc' },
  timeRow2: {
    flexDirection: 'row',
    gap: 6,
  },
  timeMinChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeMinChipOn:  { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  timeMinText:    { fontSize: 14, fontWeight: '600', color: '#64748b' },
  timeMinTextOn:  { color: '#a5b4fc' },

  // Recurrence
  recWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recChipOn:     { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  recChipText:   { fontSize: 13, fontWeight: '600', color: '#64748b' },
  recChipTextOn: { color: '#a5b4fc' },

  // Date-names toggle
  dateToggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateToggleBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  dateToggleBoxOn: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
  dateToggleCheck: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  dateToggleLabel: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  dateToggleSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Audience
  audienceList: { gap: 8 },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  audienceRowOn:   { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: { borderColor: '#6366f1' },
  radioInner:   { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6366f1' },
  audienceLabel:   { fontSize: 14, fontWeight: '600', color: '#64748b' },
  audienceLabelOn: { color: '#a5b4fc' },
  audienceSub:     { fontSize: 12, color: '#475569', marginTop: 1 },

  // Submit
  createBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnDisabled:     { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  createBtnText:         { fontSize: 16, fontWeight: '700', color: '#fff' },
  createBtnTextDisabled: { color: '#475569' },
});
