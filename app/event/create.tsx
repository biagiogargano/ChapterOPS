import { useDevRole } from '@/lib/devRoleStore';
import { insertEvent } from '@/lib/eventService';
import {
  RECURRENCE_LABELS,
  ROLE_ALLOWED_KINDS,
  addUserEvent,
  type RecurrenceType,
} from '@/lib/eventStore';
import {
  KIND_BG,
  KIND_COLORS,
  KIND_LABELS,
  type EventAudience,
  type EventKind,
} from '@/lib/mockEvents';
import { isOfficer } from '@/lib/roles';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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

  const allowedKinds = ROLE_ALLOWED_KINDS[role] ?? [];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title,       setTitle      ] = useState('');
  const [kind,        setKind       ] = useState<EventKind>(() => allowedKinds[0] ?? 'chapter');
  const [dateString,  setDateString ] = useState('');
  const [hour,        setHour       ] = useState(8);
  const [minute,      setMinute     ] = useState('00');
  const [ampm,        setAmpm       ] = useState<'AM' | 'PM'>('PM');
  const [location,    setLocation   ] = useState('');
  const [audience,    setAudience   ] = useState<EventAudience | ''>('');
  const [description, setDescription] = useState('');
  const [recurrence,  setRecurrence ] = useState<RecurrenceType>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [errors,      setErrors     ] = useState<string[]>([]);

  // Reset kind when role changes to one that disallows it
  useEffect(() => {
    const allowed = ROLE_ALLOWED_KINDS[role] ?? [];
    if (!allowed.includes(kind)) setKind(allowed[0] ?? 'chapter');
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: non-officers should never land here
  useEffect(() => {
    if (!isOfficer(role)) router.back();
  }, [role]);

  // Header cancel button
  useEffect(() => {
    navigation.setOptions({
      title: 'Create Event',
      headerLeft: () => (
        <Pressable onPress={() => router.back()} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const canSubmit =
    title.trim().length > 0 &&
    dateString !== '' &&
    audience !== '' &&
    (recurrence === 'none' || repeatUntil !== '');

  function handleCreate() {
    const errs: string[] = [];
    if (!title.trim())                          errs.push('Event name is required.');
    if (!dateString)                            errs.push('Please pick a date.');
    if (!audience)                              errs.push('Please select attendance type.');
    if (recurrence !== 'none' && !repeatUntil) errs.push('Please set a repeat-until date.');
    if (errs.length > 0) { setErrors(errs); return; }

    const timeStr  = `${hour}:${minute} ${ampm}`;
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
    });

    // Persist each instance to Supabase (fire-and-forget; no-ops if unconfigured,
    // preserving the local-only fallback). Same UUIDs are used in both places.
    created.forEach(e => { void insertEvent(e); });

    router.replace(`/event/${created[0].id}` as any);
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

        {/* ── Recurrence ── */}
        <View style={s.field}>
          <FieldLabel text="REPEATS" />
          <RecurrencePicker
            value={recurrence}
            onChange={r => { setRecurrence(r); setRepeatUntil(''); }}
          />
        </View>

        {/* ── Repeat Until (shown only when recurrence is active) ── */}
        {recurrence !== 'none' && (
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
          onPress={handleCreate}
          disabled={!canSubmit}
        >
          <Text style={[s.createBtnText, !canSubmit && s.createBtnTextDisabled]}>
            Create Event
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
