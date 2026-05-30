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
import { LEADERSHIP_ROLES, ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { getAssigneeRoleOptions } from '@/lib/taskAssignment';
import { canManageEventTasks } from '@/lib/eventTaskPermissions';
import SearchablePicker from '@/components/SearchablePicker';
import { insertTask, updateTask } from '@/lib/taskService';
import { sendActionPush } from '@/lib/pushTokens';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { emitUpdateNotice, emitTaskActionNotice, type UpdateSeverity } from '@/lib/updateNoticeStore';
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
/** Friendly label for the collapsed due-date summary row. */
function formatDueLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
const _now     = new Date();
const _maxDate = new Date(_now.getFullYear(), _now.getMonth() + 12, _now.getDate());
const MAX_ISO  = isoDateFromParts(_maxDate.getFullYear(), _maxDate.getMonth(), _maxDate.getDate());

const CAL_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES    = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  const minute = /^[0-5]\d$/.test(rawMin) ? rawMin : '00';
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

// Sentinel option id meaning "not linked to any event" in the event picker.
const STANDALONE_OPTION = '__standalone__';

// Alpha exposes ONLY the proof types that actually work end-to-end: Text and
// Link. Document/Image/Screenshot require file upload + private Storage (Proof
// v1, not built), and would otherwise render a dead "Upload" button + fake
// "Binary file attached" state in Task Detail. They return when Proof v1 ships.
const PROOF_OPTIONS: { value: ProofType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'link', label: 'Link' },
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

// ─── TypedTimeInput (typed hh:mm + AM/PM) ─────────────────────────────────────
// Replaces the old arrow-stepper picker with a simple typed field. Accepts
// "h:mm" / "hh:mm" (and bare "h"/"hmm"); writes a validated hour(1-12)+minute
// back to the parent. Invalid keystrokes are kept in the local buffer (so the
// user can finish typing) but don't propagate until they parse.

function TypedTimeInput({
  hour, minute, ampm, onChange, onAmpm,
}: {
  hour: number; minute: string; ampm: 'AM' | 'PM';
  onChange: (hour: number, minute: string) => void;
  onAmpm: (a: 'AM' | 'PM') => void;
}) {
  const [text, setText] = useState(`${hour}:${minute}`);

  function commit(raw: string) {
    // Allow only digits and a single colon while typing.
    const cleaned = raw.replace(/[^\d:]/g, '').slice(0, 5);
    setText(cleaned);

    const m = cleaned.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!m) return;
    const h = parseInt(m[1], 10);
    if (Number.isNaN(h) || h < 1 || h > 12) return;
    let mm = m[2] ?? '';
    if (mm === '') mm = '00';
    if (mm.length === 1) mm = `0${mm}`;
    const mi = parseInt(mm, 10);
    if (Number.isNaN(mi) || mi > 59) return;
    onChange(h, String(mi).padStart(2, '0'));
  }

  // On blur, normalize the buffer to the last valid hour:minute.
  function normalize() {
    setText(`${hour}:${minute}`);
  }

  return (
    <View style={s.timeRow}>
      <TextInput
        style={s.timeTextInput}
        value={text}
        onChangeText={commit}
        onBlur={normalize}
        placeholder="h:mm"
        placeholderTextColor="#475569"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <View style={s.timeAmpmGroup}>
        {(['AM', 'PM'] as const).map(a => (
          <Pressable key={a} style={[s.timeAmpmBtn, ampm === a && s.timeAmpmBtnOn]} onPress={() => onAmpm(a)}>
            <Text style={[s.timeAmpmText, ampm === a && s.timeAmpmTextOn]}>{a}</Text>
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
  const pushOrgId  = useActiveDataOrgId();   // org scope for action push (Push v1)
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

  // Assignable roles come from the org-level rule via the pure
  // getAssigneeRoleOptions helper (lib/taskAssignment): the acting role may
  // assign DOWNWARD plus any alpha exception, always itself (self-assignment),
  // returned in canonical display order. In edit mode the task's CURRENT
  // assignee is always kept selectable so it can't be silently dropped on save.
  const assignableRoles = useMemo<Role[]>(
    () => getAssigneeRoleOptions(role, {
      currentAssignee: editing ? (existing?.assignedRole as Role | 'all' | undefined) : undefined,
    }),
    [role, editing, existing],
  );
  // Whether this role can assign to anyone beyond itself (drives the multi-select
  // hint text). Previously canAssignBroadly.
  const canAssignBroadly = assignableRoles.length > 1;

  // ── Form state (prefilled from `existing` in edit mode) ──────────────────────
  const [title,        setTitle       ] = useState(existing?.title ?? '');
  // Multi-role assignee. Edit mode is single (one existing task); create mode
  // defaults to the CREATOR'S OWN role (so e.g. Social Chair → Social Chair, not
  // always Consul just because it's first in the list). Broad assigners can still
  // change it. `role` is always a valid option in assignableRoles.
  const [assignedRoles, setAssignedRoles] = useState<Role[]>(
    () => (existing?.assignedRole ? [existing.assignedRole as Role] : [role]),
  );
  const [dateString,   setDateString  ] = useState(prefillDue.dateString);
  const [includeTime,  setIncludeTime ] = useState(prefillDue.includeTime);
  const [hour,         setHour        ] = useState(prefillDue.hour);
  const [minute,       setMinute      ] = useState(prefillDue.minute);
  const [ampm,         setAmpm        ] = useState<'AM' | 'PM'>(prefillDue.ampm);
  const [linkedEventId, setLinkedEventId] = useState<string | undefined>(existing?.linkedEventId ?? params.eventId);
  const [requiresProof, setRequiresProof] = useState(existing?.requiresProof ?? false);
  const [proofType,    setProofType   ] = useState<ProofType>(
    existing?.proofType === 'link' ? 'link' : 'text',
  );
  // Review defaults ON for new officer-created tasks; on edit, preserve as stored.
  const [requiresApproval, setRequiresApproval] = useState(
    editing ? (existing?.requiresApproval ?? false) : true,
  );
  const [reviewerRole, setReviewerRole] = useState<Role | undefined>(existing?.reviewerRole);
  const [description,  setDescription ] = useState(existing?.description ?? '');
  const [errors,       setErrors      ] = useState<string[]>([]);

  // UI-only collapse state for the event picker + due-date calendar.
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(() => !editing && !prefillDue.dateString);

  const events = useMemo(() => getAllEvents(), []);

  // Picker options (soonest first) + a "standalone" sentinel.
  const eventPickerOptions = useMemo(() => [
    { id: STANDALONE_OPTION, label: 'None — standalone task' },
    ...[...events]
      .filter(e => canManageEventTasks(role, e.kind))
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .map(e => ({
        id:       e.id,
        label:    e.title,
        sublabel: `${getEventDate(e.dayOffset).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${e.time}`,
      })),
  ], [events, role]);

  // Launched from Event Detail ("+ Add Task") → the linked event is fixed.
  const lockedToEvent    = !editing && !!params.eventId;
  const lockedEventTitle = lockedToEvent
    ? (events.find(e => e.id === params.eventId)?.title ?? 'this event')
    : '';

  const selectedEventTitle = linkedEventId
    ? (events.find(e => e.id === linkedEventId)?.title ?? 'Selected event')
    : 'None — standalone task';

  // Event-task permission gate (creation only).
  const linkedEventObj = linkedEventId ? events.find(e => e.id === linkedEventId) : undefined;
  const blockedByEventKind = !editing && !!linkedEventObj && !canManageEventTasks(role, linkedEventObj.kind);

  // Reviewer options = leadership roles, excluding any selected assignee (a task
  // Reviewer picker = the full leadership set. We intentionally do NOT remove a
  // leadership role just because it's one of several assignees: each cloned task
  // independently drops self-review in buildInput (reviewer !== that clone's
  // assignee), so e.g. assigning to Consul + Brother still offers Consul + Pro
  // Consul as reviewers — the Brother's copy can be reviewed by Consul, and the
  // Consul copy just won't carry Consul-as-its-own-reviewer. Avoids the bug where
  // a mixed assignment shrank the Brother group's reviewer options.
  const reviewerOptions = useMemo<Role[]>(() => [...LEADERSHIP_ROLES], []);
  useEffect(() => {
    // Auto-pick a default reviewer only when none is chosen yet. Do NOT clear a
    // valid choice just because it coincides with one assignee (self-review is
    // handled per-clone at create time).
    if (!reviewLocked && requiresApproval && !reviewerRole) {
      setReviewerRole(reviewerOptions[0]);
    }
  }, [requiresApproval, reviewerRole, reviewerOptions, reviewLocked]);

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

  // Toggle an assignee chip. Edit mode = single-select (replace). Create mode =
  // multi-select; the last selected role CAN be deselected (so switching the
  // assignee doesn't require selecting a second role first). Creation is still
  // gated on >=1 assignee by canSubmit / the missing-fields hint.
  function toggleAssignee(r: Role) {
    if (reviewLocked) return;
    if (editing) { setAssignedRoles([r]); return; }
    setAssignedRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r],
    );
  }

  // A reviewer is required when approval is on. We do NOT treat "reviewer is also
  // one of the assignees" as invalid here — each cloned task drops self-review
  // independently at create time (buildInput). Blocking on overlap would wrongly
  // reject e.g. Consul+Brother reviewed-by-Consul (valid for the Brother copy).
  const reviewerInvalid = requiresApproval && !reviewerRole;

  const canSubmit =
    !blockedByEventKind &&
    assignedRoles.length > 0 &&
    title.trim().length > 0 &&
    dateString !== '' &&
    (!requiresProof || !!proofType) &&
    !reviewerInvalid;

  // Reactive "what's missing" hint.
  const missing: string[] = [];
  if (!title.trim())                    missing.push('a title');
  if (!dateString)                      missing.push('a due date');
  if (assignedRoles.length === 0)       missing.push('an assignee');
  if (requiresProof && !proofType)      missing.push('a proof type');
  if (reviewerInvalid)                  missing.push('a reviewer');
  const missingHint = missing.length === 0
    ? ''
    : `Add ${missing.length === 1
        ? missing[0]
        : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`} to ${editing ? 'save' : 'create'} this task.`;

  function handleSubmit() {
    if (blockedByEventKind) {
      setErrors(['Your role can’t manage tasks for this event’s type.']);
      return;
    }
    const errs: string[] = [];
    if (!title.trim())              errs.push('Task title is required.');
    if (!dateString)                errs.push('Please pick a due date.');
    if (assignedRoles.length === 0) errs.push('Choose at least one assignee.');
    if (reviewerInvalid)            errs.push('Choose a reviewer.');
    if (errs.length > 0) { setErrors(errs); return; }

    const linkedEvent = linkedEventId
      ? events.find(e => e.id === linkedEventId)?.title
      : undefined;

    const time = includeTime ? `${hour}:${minute} ${ampm}` : undefined;
    const dueAt = buildDueAt(dateString, includeTime, hour, minute, ampm);

    function buildInput(assignedRole: Role, reviewer: Role | undefined): CreateTaskInput {
      return {
        title:            title.trim(),
        assignedRole,
        dateString,
        time,
        dueAt,
        linkedEvent,
        linkedEventId,
        requiresProof,
        proofType:        requiresProof ? proofType : undefined,
        requiresApproval,
        // Reviewer must differ from THIS clone's assignee; if it collides, drop
        // approval for that clone rather than letting it review itself.
        reviewerRole:     requiresApproval && reviewer !== assignedRole ? reviewer : undefined,
        description:      description.trim(),
        createdByRole:    role,
      };
    }

    if (editing && existing) {
      const assignedRole = assignedRoles[0];
      const input = buildInput(assignedRole, reviewerRole);

      // Safety: if review has started, force workflow-critical fields back.
      if (reviewLocked) {
        input.assignedRole     = existing.assignedRole as Role;
        input.requiresProof    = existing.requiresProof ?? false;
        input.proofType        = existing.proofType;
        input.requiresApproval = existing.requiresApproval ?? false;
        input.reviewerRole     = existing.reviewerRole;
      }

      const updated = updateUserTask(existing.id, input);
      if (updated) {
        void updateTask(updated);
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
      router.back();
      return;
    }

    // Create mode: one INDEPENDENT cloned task per selected role.
    const created: MockTask[] = [];
    for (const assignedRole of assignedRoles) {
      const input = buildInput(assignedRole, reviewerRole);
      const task  = addUserTask(input);
      void insertTask(task);
      created.push(task);

      // Push v1 #1 — "Task assigned": notify ONLY this clone's assigned role.
      // assignedRole is always a concrete Role here (create never assigns 'all');
      // the helper also strips 'all'/actor defensively. Actor excluded server-
      // side. Fire-and-forget — never blocks the create.
      void sendActionPush({
        orgId:         pushOrgId,
        entityType:    'task',
        entityId:      task.id,
        audienceRoles: [assignedRole],
        title:         'New task assigned',
        body:          task.title,
        actorRole:     role,
      });
      // Mirror the push as an in-app notice (same audience; never blocks create).
      emitTaskActionNotice('assigned', { taskId: task.id, taskTitle: task.title, audienceRole: assignedRole, actorRole: role });
    }

    if (params.eventId) {
      // Launched from Event Detail → return to it (focus effect re-reads tasks).
      router.back();
    } else if (created.length === 1) {
      // Single standalone create → open the new task's detail (unchanged).
      router.replace(`/task/${created[0].id}` as any);
    } else {
      // Multiple clones → no single detail to open; go back to the list.
      router.back();
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

        {/* Permission block — linked to an event the role can't manage. */}
        {blockedByEventKind && (
          <View style={s.blockedNote}>
            <Text style={s.blockedNoteText}>
              Your role can’t manage tasks for this event’s type. Link a different event or create a standalone task.
            </Text>
          </View>
        )}

        {/* Locked notice — workflow fields are read-only once review has begun */}
        {reviewLocked && (
          <View style={s.lockedNote}>
            <Text style={s.lockedNoteText}>
              This task is already in review. Assignee, proof, and approval are locked to preserve
              the review workflow. You can still edit the title, due date, linked event, and description.
            </Text>
          </View>
        )}

        {/* Assignee role(s) */}
        <View style={[s.field, reviewLocked && s.lockedField]}>
          <FieldLabel text="ASSIGN TO" required />
          {!editing && (
            <Text style={s.assignHint}>
              {canAssignBroadly
                ? 'You can assign based on your role. Pick one or more — each gets its own copy to complete independently.'
                : 'Based on your role, you can only assign this to yourself.'}
            </Text>
          )}
          <View style={s.chipWrap}>
            {assignableRoles.map(r => {
              const on = assignedRoles.includes(r);
              return (
                <Pressable
                  key={r}
                  style={[s.chip, on && s.chipOn]}
                  disabled={reviewLocked}
                  onPress={() => toggleAssignee(r)}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Due date — collapses to a summary row so the calendar doesn't dominate */}
        <View style={s.field}>
          <FieldLabel text="DUE DATE" required />
          {errors.includes('Please pick a due date.') && (
            <Text style={s.errorMsg}>Please pick a due date.</Text>
          )}
          <Pressable style={s.eventSelectRow} onPress={() => setDateOpen(o => !o)}>
            <Text style={[s.eventSelectValue, !dateString && s.eventSelectPlaceholder]} numberOfLines={1}>
              {dateString ? formatDueLabel(dateString) : 'Pick a due date'}
            </Text>
            <Text style={s.eventSelectChevron}>{dateOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {dateOpen && (
            <View style={{ marginTop: 12 }}>
              <CalendarPicker
                selected={dateString}
                onSelect={d => { setDateString(d); setErrors([]); setDateOpen(false); }}
                maxIso={MAX_ISO}
              />
            </View>
          )}
        </View>

        {/* Due time — typed hh:mm + AM/PM, right next to the date. Optional. */}
        <View style={s.field}>
          <FieldLabel text="DUE TIME" />
          <Pressable style={s.toggleRow} onPress={() => setIncludeTime(v => !v)}>
            <View style={[s.toggleBox, includeTime && s.toggleBoxOn]}>
              {includeTime && <Text style={s.toggleCheck}>✓</Text>}
            </View>
            <Text style={s.toggleLabel}>Add a specific due time</Text>
          </Pressable>
          {includeTime && (
            <View style={{ marginTop: 12 }}>
              <TypedTimeInput
                hour={hour}
                minute={minute}
                ampm={ampm}
                onChange={(h, m) => { setHour(h); setMinute(m); }}
                onAmpm={setAmpm}
              />
            </View>
          )}
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
            <Pressable style={s.eventSelectRow} onPress={() => setEventPickerOpen(true)}>
              <Text style={s.eventSelectValue} numberOfLines={1}>{selectedEventTitle}</Text>
              <Text style={s.eventSelectChevron}>▾</Text>
            </Pressable>
          )}
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

        {/* Submission & Review — one section combining review + proof. */}
        <View style={[s.field, reviewLocked && s.lockedField]}>
          <FieldLabel text="SUBMISSION & REVIEW" />

          {/* Review choice (defaults to "Needs review" for new tasks). */}
          <View style={s.chipWrap}>
            <Pressable style={[s.chip, requiresApproval && s.chipOn]} disabled={reviewLocked} onPress={() => setRequiresApproval(true)}>
              <Text style={[s.chipText, requiresApproval && s.chipTextOn]}>Needs review</Text>
            </Pressable>
            <Pressable style={[s.chip, !requiresApproval && s.chipOn]} disabled={reviewLocked} onPress={() => setRequiresApproval(false)}>
              <Text style={[s.chipText, !requiresApproval && s.chipTextOn]}>No review — just mark complete</Text>
            </Pressable>
          </View>

          {requiresApproval && (
            <>
              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 8 }]}>REVIEWED BY</Text>
              {errors.includes('Choose a reviewer.') && (
                <Text style={s.errorMsg}>Choose a reviewer.</Text>
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

          {/* Proof requirement — an option inside Submission & Review. */}
          <View style={{ marginTop: 18 }}>
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

          <Text style={s.subFootHint}>
            Review decides whether a reviewer approves the result. Proof is an optional record of
            completion (text or link) — the two are separate choices.
          </Text>
        </View>

        {/* Submit */}
        {missingHint !== '' && (
          <Text style={s.missingHint}>{missingHint}</Text>
        )}
        <Pressable style={[s.createBtn, !canSubmit && s.createBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          <Text style={[s.createBtnText, !canSubmit && s.createBtnTextDisabled]}>
            {editing
              ? 'Save Changes'
              : assignedRoles.length > 1
                ? `Create ${assignedRoles.length} Tasks`
                : 'Create Task'}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      <SearchablePicker
        visible={eventPickerOpen}
        title="Link to event"
        searchPlaceholder="Filter events…"
        options={eventPickerOptions}
        selectedId={linkedEventId ?? STANDALONE_OPTION}
        onSelect={(id) => { setLinkedEventId(id === STANDALONE_OPTION ? undefined : id); setEventPickerOpen(false); }}
        onClose={() => setEventPickerOpen(false)}
      />
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
  blockedNote:     { backgroundColor: '#2a0a0a', borderRadius: 10, borderWidth: 1, borderColor: '#7f1d1d', padding: 12, marginBottom: 24 },
  blockedNoteText: { fontSize: 12, color: '#f87171', lineHeight: 18 },
  lockedField:    { opacity: 0.5 },

  field:         { marginBottom: 28 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  fieldRequired: { fontSize: 10, color: '#475569', fontWeight: '500' },
  missingHint:   { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 10 },
  errorMsg:      { color: '#f87171', fontSize: 12, marginBottom: 8, marginLeft: 2 },
  assignHint:    { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 10, marginTop: -2 },

  textInput: {
    backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },
  textArea:   { minHeight: 96, paddingTop: 12 },
  inputError: { borderColor: '#f87171' },

  // Chips (assignee / proof / reviewer / review)
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  chipOn:     { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextOn: { color: '#a5b4fc' },

  // Locked linked-event summary (Task Create launched from an event)
  lockedEventRow:   { backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  lockedEventLabel: { fontSize: 10, fontWeight: '700', color: '#6366f1', letterSpacing: 0.6 },
  lockedEventTitle: { fontSize: 14, fontWeight: '600', color: '#a5b4fc' },

  // Collapsed selector rows (date summary + standalone event selector)
  eventSelectRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  eventSelectValue:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  eventSelectPlaceholder: { color: '#64748b', fontWeight: '500' },
  eventSelectChevron:     { fontSize: 13, color: '#64748b', marginLeft: 8 },

  // Submission & Review footnote
  subFootHint:    { fontSize: 12, color: '#475569', lineHeight: 17, marginTop: 14 },

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

  // Typed time input
  timeRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeTextInput:  {
    width: 110, backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 18, fontWeight: '700', textAlign: 'center', paddingVertical: 12,
  },
  timeAmpmGroup:  { flexDirection: 'row', gap: 6 },
  timeAmpmBtn:    { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  timeAmpmBtnOn:  { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  timeAmpmText:   { fontSize: 14, fontWeight: '700', color: '#64748b' },
  timeAmpmTextOn: { color: '#a5b4fc' },

  // Submit
  createBtn:             { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  createBtnDisabled:     { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  createBtnText:         { fontSize: 16, fontWeight: '700', color: '#fff' },
  createBtnTextDisabled: { color: '#475569' },
});
