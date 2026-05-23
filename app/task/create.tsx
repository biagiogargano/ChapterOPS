import { getStoredState } from '@/lib/devTaskStore';
import { useDevRole } from '@/lib/devRoleStore';
import { getAllEvents } from '@/lib/eventStore';
import { getEventDate } from '@/lib/mockEvents';
import {
  addUserTask,
  canManageTask,
  findTaskById,
  updateUserTask,
  type CreateTaskInput,
  type MockTask,
  type ProofType,
} from '@/lib/mockTasks';
import { OFFICER_ROLES, ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { insertTask, updateTask } from '@/lib/taskService';
import { emitUpdateNotice, type UpdateSeverity } from '@/lib/updateNoticeStore';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

// ─── Date utilities (mirrors event/create.tsx) ────────────────────────────────

function isoDateFromParts(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayIso(): string {
  const t = new Date();
  return isoDateFromParts(t.getFullYear(), t.getMonth(), t.getDate());
}
const _now     = new Date();
const _maxDate = new Date(_now.getFullYear(), _now.getMonth() + 12, _now.getDate());
const MAX_ISO  = isoDateFromParts(_maxDate.getFullYear(), _maxDate.getMonth(), _maxDate.getDate());

const CAL_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES    = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MINUTE_CHIPS = ['00', '15', '30', '45'];

// ─── dueAt round-trip (date+time ↔ ISO timestamp) ─────────────────────────────

/** Build an ISO timestamp from the form fields (midnight when no time set). */
function buildDueAt(dateString: string, includeTime: boolean, hour: number, minute: string, ampm: 'AM' | 'PM'): string {
  if (!dateString) return '';
  if (!includeTime) return `${dateString}T00:00:00`;
  let h = hour % 12;
  if (ampm === 'PM') h += 12;
  return `${dateString}T${String(h).padStart(2, '0')}:${minute}:00`;
}

/** Parse a stored dueAt back into form fields for edit prefill (string-sliced — tz-safe). */
function parseDueAt(dueAt?: string): { dateString: string; includeTime: boolean; hour: number; minute: string; ampm: 'AM' | 'PM' } {
  const fallback = { dateString: '', includeTime: false, hour: 8, minute: '00', ampm: 'PM' as const };
  if (!dueAt) return fallback;
  const dateString = dueAt.slice(0, 10);
  const hhmm = dueAt.slice(11, 16);                 // 'HH:MM'
  if (!hhmm || hhmm === '00:00') return { ...fallback, dateString };
  let h = parseInt(hhmm.slice(0, 2), 10);
  const rawMin = hhmm.slice(3, 5);
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const minute = MINUTE_CHIPS.includes(rawMin) ? rawMin : '00';
  return { dateString, includeTime: true, hour: h, minute, ampm };
}

// Build a coalesced update notice from a task edit diff (null if nothing changed).
function buildTaskEditNotice(
  before: MockTask,
  after: MockTask,
): { summary: string; severity: UpdateSeverity; audience: Role[] } | null {
  const changes: { label: string; sev: UpdateSeverity }[] = [];
  if (before.title !== after.title) changes.push({ label: 'title', sev: 'moderate' });
  if ((before.dueAt ?? '') !== (after.dueAt ?? '') || before.dueLabel !== after.dueLabel) changes.push({ label: 'due date', sev: 'critical' });
  if (before.assignedRole !== after.assignedRole) changes.push({ label: 'assignee', sev: 'critical' });
  if ((before.reviewerRole ?? '') !== (after.reviewerRole ?? '')) changes.push({ label: 'reviewer', sev: 'critical' });
  if ((before.linkedEventId ?? '') !== (after.linkedEventId ?? '')) changes.push({ label: 'linked event', sev: 'critical' });
  if ((before.requiresProof ?? false) !== (after.requiresProof ?? false) || (before.proofType ?? '') !== (after.proofType ?? '')) changes.push({ label: 'proof requirement', sev: 'moderate' });
  if ((before.requiresApproval ?? false) !== (after.requiresApproval ?? false)) changes.push({ label: 'approval requirement', sev: 'moderate' });
  if ((before.description ?? '') !== (after.description ?? '')) changes.push({ label: 'details', sev: 'low' });
  if (changes.length === 0) return null;

  const severity: UpdateSeverity =
    changes.some(c => c.sev === 'critical') ? 'critical' :
    changes.some(c => c.sev === 'moderate') ? 'moderate' : 'low';
  const summary = `${after.title} updated: ${changes.map(c => c.label).join(', ')}`;

  const audience = new Set<Role>();
  for (const r of [before.assignedRole, after.assignedRole, before.reviewerRole, after.reviewerRole, after.supervisorRole]) {
    if (r && r !== 'all') audience.add(r as Role);
  }
  return { summary, severity, audience: Array.from(audience) };
}

const PROOF_OPTIONS: { value: ProofType; label: string }[] = [
  { value: 'text',       label: 'Text' },
  { value: 'link',       label: 'Link' },
  { value: 'document',   label: 'Document' },
  { value: 'image',      label: 'Image' },
  { value: 'screenshot', label: 'Screenshot' },
];

// ─── FieldLabel ───────────────────────────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={s.fieldLabelRow}>
      <Text style={s.fieldLabel}>{text}</Text>
      {required && <Text style={s.fieldRequired}>required</Text>}
    </View>
  );
}

// ─── CalendarPicker (self-contained copy) ─────────────────────────────────────

function CalendarPicker({
  selected, onSelect, minIso, maxIso,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  minIso?:  string;
  maxIso?:  string;
}) {
  const today  = new Date();
  const initY  = selected ? parseInt(selected.slice(0, 4))     : today.getFullYear();
  const initM  = selected ? parseInt(selected.slice(5, 7)) - 1 : today.getMonth();
  const [viewYear,  setViewYear ] = useState(initY);
  const [viewMonth, setViewMonth] = useState(initM);

  const effectiveMin = minIso ?? todayIso();
  const effectiveMax = maxIso ?? MAX_ISO;

  const prevY         = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevM         = viewMonth === 0 ? 11           : viewMonth - 1;
  const lastDayOfPrev = new Date(viewYear, viewMonth, 0).getDate();
  const canGoPrev     = isoDateFromParts(prevY, prevM, lastDayOfPrev) >= effectiveMin;

  const nextY     = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextM     = viewMonth === 11 ? 0            : viewMonth + 1;
  const canGoNext = isoDateFromParts(nextY, nextM, 1) <= effectiveMax;

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

  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const firstOffset  = (firstWeekday + 6) % 7;

  const cells: (number | null)[] = Array(firstOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const todayStr = todayIso();

  return (
    <View style={s.cal}>
      <View style={s.calHeader}>
        <Pressable onPress={goPrev} disabled={!canGoPrev} style={[s.calNavBtn, !canGoPrev && s.calNavBtnOff]}>
          <Text style={[s.calNavText, !canGoPrev && s.calNavTextOff]}>‹</Text>
        </Pressable>
        <Text style={s.calMonthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNext} disabled={!canGoNext} style={[s.calNavBtn, !canGoNext && s.calNavBtnOff]}>
          <Text style={[s.calNavText, !canGoNext && s.calNavTextOff]}>›</Text>
        </Pressable>
      </View>

      <View style={s.calRow}>
        {CAL_DAY_LABELS.map(h => <Text key={h} style={s.calDayHead}>{h}</Text>)}
      </View>

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
                style={[s.calCell, isSel && s.calCellSel, isToday && !isSel && s.calCellToday, disabled && s.calCellOff]}
                onPress={() => !disabled && onSelect(iso)}
                disabled={disabled}
              >
                <Text style={[s.calCellText, isSel && s.calCellTextSel, isToday && !isSel && s.calCellTextToday, disabled && s.calCellTextOff]}>
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

// ─── TimePicker (self-contained copy) ─────────────────────────────────────────

function TimePicker({
  hour, minute, ampm, onHour, onMinute, onAmpm,
}: {
  hour: number; minute: string; ampm: 'AM' | 'PM';
  onHour: (h: number) => void; onMinute: (m: string) => void; onAmpm: (a: 'AM' | 'PM') => void;
}) {
  return (
    <View style={s.timePicker}>
      <View style={s.timeRow1}>
        <Pressable style={s.timeArrow} onPress={() => onHour(hour === 1 ? 12 : hour - 1)}>
          <Text style={s.timeArrowText}>‹</Text>
        </Pressable>
        <Text style={s.timeHourNum}>{hour}</Text>
        <Pressable style={s.timeArrow} onPress={() => onHour(hour === 12 ? 1 : hour + 1)}>
          <Text style={s.timeArrowText}>›</Text>
        </Pressable>
        <Text style={s.timeColon}>h</Text>
        <View style={{ flex: 1 }} />
        {(['AM', 'PM'] as const).map(a => (
          <Pressable key={a} style={[s.timeAmpmBtn, ampm === a && s.timeAmpmBtnOn]} onPress={() => onAmpm(a)}>
            <Text style={[s.timeAmpmText, ampm === a && s.timeAmpmTextOn]}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.timeRow2}>
        {MINUTE_CHIPS.map(m => (
          <Pressable key={m} style={[s.timeMinChip, minute === m && s.timeMinChipOn]} onPress={() => onMinute(m)}>
            <Text style={[s.timeMinText, minute === m && s.timeMinTextOn]}>:{m}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateTaskScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }   = useDevRole();
  const params     = useLocalSearchParams<{ eventId?: string; eventTitle?: string; taskId?: string }>();

  // Edit mode when a taskId is supplied.
  const editing  = !!params.taskId;
  const existing = useMemo(
    () => (params.taskId ? findTaskById(params.taskId) : undefined),
    [params.taskId],
  );
  const prefillDue = useMemo(() => parseDueAt(existing?.dueAt), [existing]);

  // Once submitted/reviewed, workflow-critical fields are locked to preserve the
  // review routing/history. Title/description/due/event stay editable.
  const effState     = existing ? getStoredState(existing.id, existing.state) : 'assigned';
  const reviewLocked = editing && (effState === 'submitted' || effState === 'approved' || effState === 'rejected');

  // BROAD officers can assign to any officer role; others only to themselves.
  const isBroad         = role === 'president' || role === 'pro_consul';
  const assignableRoles = useMemo<Role[]>(
    () => (isBroad ? OFFICER_ROLES : [role]),
    [isBroad, role],
  );

  // ── Form state (prefilled from `existing` in edit mode) ──────────────────────
  const [title,        setTitle       ] = useState(existing?.title ?? '');
  const [assignedRole, setAssignedRole] = useState<Role>(
    () => (existing?.assignedRole as Role) ?? assignableRoles[0] ?? role,
  );
  const [dateString,   setDateString  ] = useState(prefillDue.dateString);
  const [includeTime,  setIncludeTime ] = useState(prefillDue.includeTime);
  const [hour,         setHour        ] = useState(prefillDue.hour);
  const [minute,       setMinute      ] = useState(prefillDue.minute);
  const [ampm,         setAmpm        ] = useState<'AM' | 'PM'>(prefillDue.ampm);
  const [linkedEventId, setLinkedEventId] = useState<string | undefined>(existing?.linkedEventId ?? params.eventId);
  const [requiresProof, setRequiresProof] = useState(existing?.requiresProof ?? false);
  const [proofType,    setProofType   ] = useState<ProofType>(existing?.proofType ?? 'text');
  const [requiresApproval, setRequiresApproval] = useState(existing?.requiresApproval ?? false);
  const [reviewerRole, setReviewerRole] = useState<Role | undefined>(existing?.reviewerRole);
  const [description,  setDescription ] = useState(existing?.description ?? '');
  const [errors,       setErrors      ] = useState<string[]>([]);

  // UI-only collapse state (presentation only; no effect on what gets submitted).
  // Event picker is collapsed by default; advanced options open only when an
  // edited task already uses them (so nothing configured is hidden on edit).
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    () => editing && (!!existing?.requiresProof || !!existing?.requiresApproval || prefillDue.includeTime),
  );

  const events = useMemo(() => getAllEvents(), []);

  // Launched from Event Detail ("+ Add Task") → the linked event is fixed to that
  // event; show a read-only summary instead of the full picker. Editing an
  // existing task (taskId) keeps the normal picker. Standalone create unchanged.
  const lockedToEvent    = !editing && !!params.eventId;
  const lockedEventTitle = lockedToEvent
    ? (events.find(e => e.id === params.eventId)?.title ?? 'this event')
    : '';

  // Current selection label for the collapsed standalone event picker.
  const selectedEventTitle = linkedEventId
    ? (events.find(e => e.id === linkedEventId)?.title ?? 'Selected event')
    : 'None — standalone task';

  // Reviewer options = leadership roles, excluding the assignee (a task can't
  // review itself). Recompute + reset when assignee changes (skip while locked).
  const reviewerOptions = useMemo<Role[]>(
    () => (['president', 'pro_consul'] as Role[]).filter(r => r !== assignedRole),
    [assignedRole],
  );
  useEffect(() => {
    if (!reviewLocked && requiresApproval && (!reviewerRole || reviewerRole === assignedRole)) {
      setReviewerRole(reviewerOptions[0]);
    }
  }, [assignedRole, requiresApproval, reviewerRole, reviewerOptions, reviewLocked]);

  // Guard: non-officers (or non-managers of this task) should never be here.
  useEffect(() => {
    if (!isOfficer(role)) { router.back(); return; }
    if (editing && (!existing || !canManageTask(existing, role))) router.back();
  }, [role, editing, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navigation.setOptions({
      title: editing ? 'Edit Task' : 'Create Task',
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
    (!requiresProof    || !!proofType) &&
    (!requiresApproval || (!!reviewerRole && reviewerRole !== assignedRole));

  // Reactive "what's missing" hint so the disabled Create button explains itself.
  const missing: string[] = [];
  if (!title.trim())                                                          missing.push('a title');
  if (!dateString)                                                            missing.push('a due date');
  if (requiresProof && !proofType)                                            missing.push('a proof type');
  if (requiresApproval && (!reviewerRole || reviewerRole === assignedRole))   missing.push('a reviewer');
  const missingHint = missing.length === 0
    ? ''
    : `Add ${missing.length === 1
        ? missing[0]
        : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`} to ${editing ? 'save' : 'create'} this task.`;

  function handleSubmit() {
    const errs: string[] = [];
    if (!title.trim())  errs.push('Task title is required.');
    if (!dateString)    errs.push('Please pick a due date.');
    if (requiresApproval && (!reviewerRole || reviewerRole === assignedRole)) {
      errs.push('Choose a reviewer different from the assignee.');
    }
    if (errs.length > 0) { setErrors(errs); return; }

    const linkedEvent = linkedEventId
      ? events.find(e => e.id === linkedEventId)?.title
      : undefined;

    const input: CreateTaskInput = {
      title:            title.trim(),
      assignedRole,
      dateString,
      time:             includeTime ? `${hour}:${minute} ${ampm}` : undefined,
      dueAt:            buildDueAt(dateString, includeTime, hour, minute, ampm),
      linkedEvent,
      linkedEventId:    linkedEventId,
      requiresProof,
      proofType:        requiresProof ? proofType : undefined,
      requiresApproval,
      reviewerRole:     requiresApproval ? reviewerRole : undefined,
      description:      description.trim(),
      createdByRole:    role,   // used on create; preserved (ignored) on edit
    };

    // Safety: if review has started, force workflow-critical fields back to the
    // existing values so they can never be altered (UI also locks them).
    if (reviewLocked && existing) {
      input.assignedRole     = existing.assignedRole as Role;
      input.requiresProof    = existing.requiresProof ?? false;
      input.proofType        = existing.proofType;
      input.requiresApproval = existing.requiresApproval ?? false;
      input.reviewerRole     = existing.reviewerRole;
    }

    if (editing && existing) {
      const updated = updateUserTask(existing.id, input);
      if (updated) {
        void updateTask(updated);   // persist (no-op in mock fallback)
        // Emit an in-app update notice for affected roles (diff-gated, coalesced).
        const notice = buildTaskEditNotice(existing, updated);
        if (notice) {
          emitUpdateNotice({
            entityType:    'task',
            entityId:      updated.id,
            summary:       notice.summary,
            severity:      notice.severity,
            audienceRoles: notice.audience,
            changedByRole: role,
          });
        }
      }
      router.replace(`/task/${existing.id}` as any);
    } else {
      const task = addUserTask(input);
      void insertTask(task);
      if (params.eventId) {
        // Launched from Event Detail ("+ Add Task"): return to the existing Event
        // Detail underneath rather than pushing a duplicate. Its focus effect
        // re-reads related tasks, so the new task appears there.
        router.back();
      } else {
        // Standalone create → open the new task's detail (unchanged).
        router.replace(`/task/${task.id}` as any);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <View style={s.field}>
          <FieldLabel text="TASK TITLE" required />
          <TextInput
            style={[s.textInput, errors.includes('Task title is required.') && s.inputError]}
            placeholder="e.g. Draft budget report"
            placeholderTextColor="#475569"
            value={title}
            onChangeText={v => { setTitle(v); setErrors([]); }}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        </View>

        {/* Locked notice — workflow fields are read-only once review has begun */}
        {reviewLocked && (
          <View style={s.lockedNote}>
            <Text style={s.lockedNoteText}>
              This task is already in review. Assignee, proof, and approval are locked to preserve
              the review workflow. You can still edit the title, due date, linked event, and description.
            </Text>
          </View>
        )}

        {/* Assignee role */}
        <View style={[s.field, reviewLocked && s.lockedField]}>
          <FieldLabel text="ASSIGN TO" required />
          <View style={s.chipWrap}>
            {assignableRoles.map(r => {
              const on = assignedRole === r;
              return (
                <Pressable
                  key={r}
                  style={[s.chip, on && s.chipOn]}
                  disabled={reviewLocked}
                  onPress={() => setAssignedRole(r)}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Linked event — locked summary when launched from an event, else picker */}
        <View style={s.field}>
          <FieldLabel text="LINK TO EVENT" />
          {lockedToEvent ? (
            <View style={s.lockedEventRow}>
              <Text style={s.lockedEventLabel}>LINKED TO</Text>
              <Text style={s.lockedEventTitle} numberOfLines={1}>{lockedEventTitle}</Text>
            </View>
          ) : (
            <View>
              {/* Collapsed summary row — shows current choice; tap to change. */}
              <Pressable style={s.eventSelectRow} onPress={() => setEventPickerOpen(o => !o)}>
                <Text style={s.eventSelectValue} numberOfLines={1}>{selectedEventTitle}</Text>
                <Text style={s.eventSelectChevron}>{eventPickerOpen ? '▴' : '▾'}</Text>
              </Pressable>

              {eventPickerOpen && (
                <View style={[s.eventList, { marginTop: 8 }]}>
                  <Pressable
                    style={[s.eventRow, !linkedEventId && s.eventRowOn]}
                    onPress={() => { setLinkedEventId(undefined); setEventPickerOpen(false); }}
                  >
                    <Text style={[s.eventRowTitle, !linkedEventId && s.eventRowTitleOn]}>None — standalone task</Text>
                  </Pressable>
                  {events.map(e => {
                    const on   = linkedEventId === e.id;
                    const date = getEventDate(e.dayOffset);
                    const sub  = `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${e.time}`;
                    return (
                      <Pressable key={e.id} style={[s.eventRow, on && s.eventRowOn]} onPress={() => { setLinkedEventId(e.id); setEventPickerOpen(false); }}>
                        <Text style={[s.eventRowTitle, on && s.eventRowTitleOn]} numberOfLines={1}>{e.title}</Text>
                        <Text style={s.eventRowSub} numberOfLines={1}>{sub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Due date */}
        <View style={s.field}>
          <FieldLabel text="DUE DATE" required />
          {errors.includes('Please pick a due date.') && (
            <Text style={s.errorMsg}>Please pick a due date.</Text>
          )}
          <CalendarPicker
            selected={dateString}
            onSelect={d => { setDateString(d); setErrors([]); }}
            maxIso={MAX_ISO}
          />
        </View>

        {/* Description */}
        <View style={s.field}>
          <FieldLabel text="DESCRIPTION" />
          <TextInput
            style={[s.textInput, s.textArea]}
            placeholder="Details, expectations, links to templates…"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Advanced options (time / proof / approval) — collapsed by default to
            keep the common path short. Same controls, just grouped lower. */}
        <View style={s.field}>
          <Pressable style={s.advancedHeader} onPress={() => setAdvancedOpen(o => !o)}>
            <Text style={s.advancedHeaderText}>ADVANCED OPTIONS</Text>
            <Text style={s.advancedChevron}>{advancedOpen ? '▴' : '▾'}</Text>
          </Pressable>

          {advancedOpen && (
            <View style={{ marginTop: 16 }}>
              {/* Optional time */}
              <View style={s.field}>
                <Pressable style={s.toggleRow} onPress={() => setIncludeTime(v => !v)}>
                  <View style={[s.toggleBox, includeTime && s.toggleBoxOn]}>
                    {includeTime && <Text style={s.toggleCheck}>✓</Text>}
                  </View>
                  <Text style={s.toggleLabel}>Add a specific due time</Text>
                </Pressable>
                {includeTime && (
                  <View style={{ marginTop: 12 }}>
                    <TimePicker hour={hour} minute={minute} ampm={ampm} onHour={setHour} onMinute={setMinute} onAmpm={setAmpm} />
                  </View>
                )}
              </View>

              {/* Requires proof */}
              <View style={[s.field, reviewLocked && s.lockedField]}>
                <Pressable style={s.toggleRow} disabled={reviewLocked} onPress={() => setRequiresProof(v => !v)}>
                  <View style={[s.toggleBox, requiresProof && s.toggleBoxOn]}>
                    {requiresProof && <Text style={s.toggleCheck}>✓</Text>}
                  </View>
                  <Text style={s.toggleLabel}>Requires proof of completion</Text>
                </Pressable>
                {requiresProof && (
                  <View style={[s.chipWrap, { marginTop: 12 }]}>
                    {PROOF_OPTIONS.map(({ value, label }) => {
                      const on = proofType === value;
                      return (
                        <Pressable key={value} style={[s.chip, on && s.chipOn]} disabled={reviewLocked} onPress={() => setProofType(value)}>
                          <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Requires approval */}
              <View style={[s.field, reviewLocked && s.lockedField]}>
                <Pressable style={s.toggleRow} disabled={reviewLocked} onPress={() => setRequiresApproval(v => !v)}>
                  <View style={[s.toggleBox, requiresApproval && s.toggleBoxOn]}>
                    {requiresApproval && <Text style={s.toggleCheck}>✓</Text>}
                  </View>
                  <Text style={s.toggleLabel}>Requires approval</Text>
                </Pressable>
                {requiresApproval && (
                  <>
                    <Text style={[s.fieldLabel, { marginTop: 12, marginBottom: 8 }]}>REVIEWED BY</Text>
                    {errors.includes('Choose a reviewer different from the assignee.') && (
                      <Text style={s.errorMsg}>Choose a reviewer different from the assignee.</Text>
                    )}
                    <View style={s.chipWrap}>
                      {reviewerOptions.map(r => {
                        const on = reviewerRole === r;
                        return (
                          <Pressable key={r} style={[s.chip, on && s.chipOn]} disabled={reviewLocked} onPress={() => setReviewerRole(r)}>
                            <Text style={[s.chipText, on && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Submit */}
        {missingHint !== '' && (
          <Text style={s.missingHint}>{missingHint}</Text>
        )}
        <Pressable style={[s.createBtn, !canSubmit && s.createBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          <Text style={[s.createBtnText, !canSubmit && s.createBtnTextDisabled]}>
            {editing ? 'Save Changes' : 'Create Task'}
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

  cancelBtn:     { paddingHorizontal: 4 },
  cancelBtnText: { color: '#94a3b8', fontSize: 15 },

  lockedNote:     { backgroundColor: '#1c1407', borderRadius: 10, borderWidth: 1, borderColor: '#854d0e', padding: 12, marginBottom: 24 },
  lockedNoteText: { fontSize: 12, color: '#fbbf24', lineHeight: 18 },
  lockedField:    { opacity: 0.5 },

  field:         { marginBottom: 28 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  fieldRequired: { fontSize: 10, color: '#475569', fontWeight: '500' },
  missingHint:   { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 10 },
  errorMsg:      { color: '#f87171', fontSize: 12, marginBottom: 8, marginLeft: 2 },

  textInput: {
    backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },
  textArea:   { minHeight: 96, paddingTop: 12 },
  inputError: { borderColor: '#f87171' },

  // Chips (assignee / proof / reviewer)
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  chipOn:     { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextOn: { color: '#a5b4fc' },

  // Event picker
  eventList: { gap: 8 },
  eventRow: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, gap: 2,
  },
  eventRowOn:      { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  eventRowTitle:   { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  eventRowTitleOn: { color: '#a5b4fc' },
  eventRowSub:     { fontSize: 12, color: '#64748b' },

  // Locked linked-event summary (Task Create launched from an event)
  lockedEventRow:   { backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  lockedEventLabel: { fontSize: 10, fontWeight: '700', color: '#6366f1', letterSpacing: 0.6 },
  lockedEventTitle: { fontSize: 14, fontWeight: '600', color: '#a5b4fc' },

  // Collapsed standalone event selector (summary row + chevron)
  eventSelectRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  eventSelectValue:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  eventSelectChevron: { fontSize: 13, color: '#64748b', marginLeft: 8 },

  // Advanced options disclosure header
  advancedHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  advancedHeaderText: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  advancedChevron:    { fontSize: 13, color: '#64748b' },

  // Toggle
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxOn:  { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  toggleCheck:  { fontSize: 13, color: '#a5b4fc', fontWeight: '700', lineHeight: 16 },
  toggleLabel:  { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },

  // Calendar
  cal: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  calNavBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calNavBtnOff: { opacity: 0.3 },
  calNavText:   { fontSize: 22, color: '#94a3b8', lineHeight: 26 },
  calNavTextOff:{ color: '#475569' },
  calMonthLabel:{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  calRow:       { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 1 },
  calDayHead:   { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.2, paddingVertical: 6 },
  calCell:      { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 1, borderRadius: 6 },
  calCellSel:       { backgroundColor: '#4f46e5' },
  calCellToday:     { backgroundColor: '#1e1b4b' },
  calCellOff:       { opacity: 0.25 },
  calCellText:      { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  calCellTextSel:   { color: '#fff', fontWeight: '700' },
  calCellTextToday: { color: '#a5b4fc', fontWeight: '700' },
  calCellTextOff:   { color: '#334155' },

  // Time picker
  timePicker: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 10,
  },
  timeRow1:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeArrow:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  timeArrowText: { fontSize: 18, color: '#94a3b8', lineHeight: 22 },
  timeHourNum: { width: 32, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  timeColon:   { fontSize: 12, fontWeight: '600', color: '#475569', marginLeft: 2 },
  timeAmpmBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  timeAmpmBtnOn:  { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  timeAmpmText:   { fontSize: 13, fontWeight: '700', color: '#64748b' },
  timeAmpmTextOn: { color: '#a5b4fc' },
  timeRow2:    { flexDirection: 'row', gap: 6 },
  timeMinChip: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  timeMinChipOn:  { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  timeMinText:    { fontSize: 14, fontWeight: '600', color: '#64748b' },
  timeMinTextOn:  { color: '#a5b4fc' },

  // Submit
  createBtn:             { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  createBtnDisabled:     { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  createBtnText:         { fontSize: 16, fontWeight: '700', color: '#fff' },
  createBtnTextDisabled: { color: '#475569' },
});
