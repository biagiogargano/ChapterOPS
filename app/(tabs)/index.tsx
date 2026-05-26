import { getStoredState, loadTaskState, refreshTaskStates, saveTaskState, useTaskStateVersion } from '@/lib/devTaskStore';
import { DEMO_CHAPTER, DEMO_USER } from '@/lib/demoUser';
import { useDevRole } from '@/lib/devRoleStore';
import { useIdentity } from '@/lib/identityStore';
import { AUTH_ENABLED } from '@/lib/flags';
import { fetchAllEvents } from '@/lib/eventService';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { getAllEvents, resolveEventId, setSupabaseEventCache, type MockEvent } from '@/lib/eventStore';
import { DAY_LABELS } from '@/lib/mockEvents';
import {
  DISPLAY_STATE_LABEL,
  STATE_BG,
  STATE_COLOR,
  STATE_STRIPE,
  dueLabelOf,
  getResponsibilityGroups,
  isOverdue,
  setSupabaseTaskCache,
  urgencyOf,
  type MockTask,
  type TaskState,
} from '@/lib/mockTasks';
import {
  getNoticesForRole,
  hydrateUpdateNotices,
  useUpdateNoticesVersion,
} from '@/lib/updateNoticeStore';
import {
  getRsvpEntry,
  hydrateRsvpsFromSupabase,
  refreshRsvpsFromSupabase,
  setRsvpEntry,
  useRsvpEntry,
  useRsvpVersion,
  type RsvpStatus,
} from '@/lib/rsvpStore';
import {
  deriveReminders,
  type Reminder,
  type ReminderKind,
  type ReminderSeverity,
} from '@/lib/reminders';
import { ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleGroup(role: Role) {
  if (role === 'brother')    return 'brother';
  if (role === 'president')  return 'president';
  if (role === 'pro_consul') return 'leadership';
  if (role === 'annotator')  return 'annotator';
  return 'officer'; // risk_manager, social_chair, recruitment_chair
}

// ─── Reminders (derived signals on existing cards — Phase C) ──────────────────
// A reminder is looked up by entity id and shown as a small badge on the card
// that already renders that entity (no separate feed). Provided via context so
// the many card call-sites don't need new props.

const ReminderCtx = createContext<Map<string, Reminder>>(new Map());

const REMINDER_LABEL: Record<ReminderKind, string> = {
  rsvp_needed:     'RSVP needed',
  event_today:     'Today',
  task_due_today:  'Due today',
  task_overdue:    'Overdue',
  review_pending:  'Review',
  resubmit_needed: 'Resubmit',
  escalation_alert:'Overdue',
};

const REMINDER_BADGE: Record<ReminderSeverity, { color: string; bg: string }> = {
  critical: { color: '#fca5a5', bg: '#450a0a' },
  moderate: { color: '#fbbf24', bg: '#1c1407' },
  low:      { color: '#94a3b8', bg: '#1e293b' },
};

function ReminderBadge({ reminder }: { reminder?: Reminder }) {
  if (!reminder) return null;
  const cfg = REMINDER_BADGE[reminder.severity];
  return (
    <View style={[s.remBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.remBadgeText, { color: cfg.color }]}>{REMINDER_LABEL[reminder.kind]}</Text>
    </View>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SLabel({ text, count, urgent }: { text: string; count?: number; urgent?: boolean }) {
  return (
    <View style={s.slRow}>
      <Text style={[s.slText, urgent && s.slTextUrgent]}>{text}</Text>
      {count !== undefined && (
        <View style={[s.slBadge, urgent && s.slBadgeUrgent]}>
          <Text style={[s.slBadgeText, urgent && s.slBadgeTextUrgent]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

// ─── Inline quick-action cards — each kind is its own component (Rules of Hooks) ─

/** RSVP task — backed by rsvpStore, never permanently locked. */
function RsvpCard({ task, role }: { task: MockTask; role: Role }) {
  const router        = useRouter();
  // Use the unique event instance ID as the RSVP key so recurring occurrences
  // don't share state.  Fall back to title only for legacy tasks without an ID.
  const eventId       = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');
  const eventTitle    = task.linkedEvent   ?? '';
  const mandatory     = task.linkedEventMandatory ?? false;
  const needsCovering = task.requiresCovering    ?? false;
  const needsDetail   = mandatory || needsCovering;
  const isUrgent      = task.urgency === 'overdue';

  /** Route to the event detail screen (same destination as tapping the event card). */
  function openEventDetail() {
    const ev = task.linkedEventId
      ? getAllEvents().find(e => e.id === resolveEventId(task.linkedEventId!))
      : getAllEvents().find(e => e.title === eventTitle);
    if (ev) router.push(`/event/${ev.id}` as any);
  }

  // Reactive: re-renders on any setRsvpEntry call. No local status copy.
  const entry  = useRsvpEntry(eventId, role);
  const status = entry.status;

  function markAttending() {
    setRsvpEntry(eventId, role, { status: 'attending', excuse: '', covering: '' });
    // _notify() fires inside setRsvpEntry — no setStatus needed
  }
  function clearAttending() {
    setRsvpEntry(eventId, role, { status: 'no_response' });
  }

  // Tapping the title/meta opens the full Event Detail hub (quick buttons stay).
  const header = (
    <Pressable onPress={openEventDetail}>
      <Text style={s.qaTitle}>{task.title}</Text>
      <Text style={[s.qaDue, isUrgent && s.qaDueUrgent]}>
        {task.dueLabel}{eventTitle ? `  ·  ${eventTitle}` : ''}
      </Text>
    </Pressable>
  );

  if (status === 'attending') {
    return (
      <View style={[s.qaCard, s.qaCardDone, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: '#16a34a' }]} />
        <View style={s.qaBody}>
          {header}
          <View style={s.qaAttendingRow}>
            <Text style={s.qaAttendingText}>✓  Saved: Attending</Text>
            <Pressable style={s.qaChangeBtn} onPress={clearAttending}>
              <Text style={s.qaChangeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (status === 'not_attending') {
    return (
      <View style={[s.qaCard, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: '#d97706' }]} />
        <View style={s.qaBody}>
          {header}
          <View style={s.qaAttendingRow}>
            <Text style={[s.qaAttendingText, { color: '#fbbf24' }]}>Saved: Not attending</Text>
            <Pressable style={s.qaChangeBtn} onPress={openEventDetail}>
              <Text style={s.qaChangeBtnText}>Edit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // no_response — show buttons
  return (
    <View style={[s.qaCard, isUrgent && s.qaCardUrgent]}>
      <View style={[s.qaStripe, { backgroundColor: isUrgent ? '#dc2626' : '#334155' }]} />
      <View style={s.qaBody}>
        {header}
        <View style={s.qaBtnRow}>
          <Pressable style={s.qaBtnYes} onPress={markAttending}>
            <Text style={s.qaBtnYesText}>✓  Attending</Text>
          </Pressable>
          <Pressable
            style={s.qaBtnNo}
            onPress={() => {
              if (needsDetail) {
                openEventDetail();
              } else {
                setRsvpEntry(eventId, role, { status: 'not_attending' });
                // _notify() re-renders this component automatically
              }
            }}
          >
            <Text style={s.qaBtnNoText}>Not Attending</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Name submission — backed by rsvpStore.
 *
 * Uses a separate `draft` (local buffer) and `saved` (committed) state so
 * the user can type a full name before it is recorded.  Only the Save button
 * writes to rsvpStore; typing alone never triggers a commit.
 */
function NameCard({ task, role }: { task: MockTask; role: Role }) {
  const router   = useRouter();
  const eventId  = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');
  const isUrgent = task.urgency === 'overdue';

  /** Route to the full Event Detail hub (same destination as the event card). */
  function openEventDetail() {
    const ev = getAllEvents().find(e => e.id === eventId);
    if (ev) router.push(`/event/${ev.id}` as any);
  }

  // Reactive entry: re-renders whenever setRsvpEntry fires on any screen.
  const entry = useRsvpEntry(eventId, role);
  // Local buffer for the text input — smooth typing without re-init on each store write.
  const [draft,   setDraft  ] = useState(() => getRsvpEntry(eventId, role).dateName);
  // editing=true means the user pressed "Edit" to revise without clearing the committed name.
  const [editing, setEditing] = useState(false);
  // isSaved derives from the store (reactive), not from a copied boolean.
  const isSaved = entry.dateName.trim().length > 0 && !editing;

  // Keep the local draft in sync with the store when the user is NOT actively
  // editing. This clears stale draft text after a Clear performed on another
  // surface (e.g. Event Detail). While editing, the draft is left untouched so
  // we never overwrite text the user is typing. The effect only fires on actual
  // store writes (Save / Clear) — typing alone never changes entry.dateName.
  useEffect(() => {
    if (!editing) setDraft(entry.dateName);
  }, [entry.dateName, editing]);

  function handleSave() {
    const name = draft.trim();
    if (!name) return;
    setRsvpEntry(eventId, role, { dateName: name, status: 'attending' });
    setEditing(false);
    // _notify() fires → isSaved becomes true on next render
  }

  function handleEdit() {
    setEditing(true);
    // draft still has the committed name so user can correct rather than retype
  }

  function handleClear() {
    setDraft('');
    setEditing(false);
    setRsvpEntry(eventId, role, { dateName: '', status: 'no_response' });
  }

  const header = (
    <Pressable onPress={openEventDetail}>
      <Text style={s.qaTitle}>{task.title}</Text>
      <Text style={[s.qaDue, isUrgent && s.qaDueUrgent]}>
        {task.dueLabel}{task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
      </Text>
    </Pressable>
  );

  // ── Saved state: show confirmed name + Edit / Clear actions ──────────────
  if (isSaved) {
    return (
      <View style={[s.qaCard, s.qaCardDone, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: '#16a34a' }]} />
        <View style={s.qaBody}>
          {header}
          <View style={s.qaAttendingRow}>
            <Text style={s.qaAttendingText}>✓  {draft.trim()}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable style={s.qaChangeBtn} onPress={handleEdit}>
                <Text style={s.qaChangeBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={[s.qaChangeBtn, { backgroundColor: '#1a0505' }]} onPress={handleClear}>
                <Text style={[s.qaChangeBtnText, { color: '#f87171' }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Draft state: text input + explicit Save button ────────────────────────
  return (
    <View style={[s.qaCard, isUrgent && s.qaCardUrgent]}>
      <View style={[s.qaStripe, { backgroundColor: isUrgent ? '#dc2626' : '#334155' }]} />
      <View style={s.qaBody}>
        {header}
        <View style={s.qaInputRow}>
          <TextInput
            style={s.qaInput}
            placeholder="Date's full name…"
            placeholderTextColor="#475569"
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          style={[s.qaSaveBtn, !draft.trim() && s.qaSaveBtnDisabled]}
          onPress={handleSave}
          disabled={!draft.trim()}
        >
          <Text style={[s.qaSaveBtnText, !draft.trim() && s.qaSaveBtnTextDisabled]}>
            Save Name
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Acknowledgment / Yes-No — backed by devTaskStore. */
function OtherLightweightCard({ task }: { task: MockTask }) {
  const stored  = loadTaskState(task.id, { state: task.state });
  const [state, setState] = useState<TaskState>(stored.state);
  const [proof, setProof] = useState(stored.proofContent);

  const isDone   = state === 'approved' || state === 'submitted';
  const isUrgent = task.urgency === 'overdue';
  const stripe   = isDone ? '#16a34a' : (isUrgent ? '#dc2626' : '#334155');

  function complete(newState: TaskState, content = '') {
    saveTaskState(task.id, { state: newState, proofContent: content });
    setState(newState);
    setProof(content);
  }

  const header = (
    <View>
      <Text style={s.qaTitle}>{task.title}</Text>
      <Text style={[s.qaDue, isUrgent && s.qaDueUrgent]}>
        {task.dueLabel}{task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
      </Text>
    </View>
  );

  if (isDone) {
    const choiceLabel =
      proof === 'yes'          ? '✓  Yes'          :
      proof === 'no'           ? '✓  No'           :
      proof === 'acknowledged' ? '✓  Acknowledged' :
      state  === 'submitted'   ? '⏳  Submitted'   : '✓  Done';
    const choiceColor = state === 'submitted' ? '#fbbf24' : '#4ade80';
    return (
      <View style={[s.qaCard, s.qaCardDone, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: stripe }]} />
        <View style={s.qaBody}>
          {header}
          <Text style={[s.qaChoice, { color: choiceColor }]}>{choiceLabel}</Text>
        </View>
      </View>
    );
  }

  if (task.lightweightKind === 'acknowledgment') {
    return (
      <View style={[s.qaCard, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: stripe }]} />
        <View style={s.qaBody}>
          {header}
          <Pressable style={s.qaAckBtn} onPress={() => complete('approved', 'acknowledged')}>
            <Text style={s.qaAckBtnText}>I Acknowledge</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (task.lightweightKind === 'yes_no') {
    return (
      <View style={[s.qaCard, isUrgent && s.qaCardUrgent]}>
        <View style={[s.qaStripe, { backgroundColor: stripe }]} />
        <View style={s.qaBody}>
          {header}
          <View style={s.qaBtnRow}>
            <Pressable style={s.qaBtnYes} onPress={() => complete('approved', 'yes')}>
              <Text style={s.qaBtnYesText}>Yes</Text>
            </Pressable>
            <Pressable style={s.qaBtnNo} onPress={() => complete('approved', 'no')}>
              <Text style={s.qaBtnNoText}>No</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

/** Dispatcher — picks the right card type, each with its own hooks. */
function QuickActionCard({ task, role }: { task: MockTask; role: Role }) {
  if (task.lightweightKind === 'rsvp')            return <RsvpCard  task={task} role={role} />;
  if (task.lightweightKind === 'name_submission') return <NameCard  task={task} role={role} />;
  return <OtherLightweightCard task={task} />;
}

// ─── Structured task card (today, compact) ────────────────────────────────────

function TodayTaskCard({
  task,
  showAssignee,
  onPress,
}: {
  task:         MockTask;
  showAssignee: boolean;
  onPress:      () => void;
}) {
  // Use the LIVE state so an approved/submitted task is clearly marked here, not
  // shown with a stale "Assigned" badge that looks like an action item.
  const state      = getStoredState(task.id, task.state);
  const stripe     = STATE_STRIPE[state];
  const stateColor = STATE_COLOR[state];
  const stateBg    = STATE_BG[state];
  // Overdue is date-driven (computed from dueAt) and never true once done.
  const isUrgent   = isOverdue(task.dueAt, state) || state === 'escalated';
  const reminder   = useContext(ReminderCtx).get(task.id);

  return (
    <Pressable style={[s.taskCard, isUrgent && s.taskCardUrgent]} onPress={onPress}>
      <View style={[s.taskStripe, { backgroundColor: stripe }]} />
      <View style={s.taskBody}>
        <View style={s.taskTitleRow}>
          <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
          <View style={[s.taskStateBadge, { backgroundColor: stateBg }]}>
            {state === 'escalated' && <Text style={s.flame}>⚡</Text>}
            <Text style={[s.taskStateText, { color: stateColor }]}>
              {DISPLAY_STATE_LABEL[state]}
            </Text>
          </View>
        </View>
        <View style={s.taskMetaRow}>
          {/* When urgent, the red state badge + styling already say "Overdue"/
              "Escalated" — skip the reminder badge to avoid a duplicate signal.
              On calm cards the reminder still adds info (Due today / Review …). */}
          {!isUrgent && <ReminderBadge reminder={reminder} />}
          {showAssignee && (
            <>
              <Text style={s.taskAssignee}>{task.assignedTo}</Text>
              <Text style={s.dot}>·</Text>
            </>
          )}
          <Text style={[s.taskDue, isUrgent && s.taskDueUrgent]}>{dueLabelOf(task)}</Text>
          {task.linkedEvent && (
            <>
              <Text style={s.dot}>·</Text>
              <Text style={s.taskEvent} numberOfLines={1}>{task.linkedEvent}</Text>
            </>
          )}
        </View>
      </View>
      <Text style={s.taskChevron}>›</Text>
    </Pressable>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ task, onPress }: { task: MockTask; onPress: () => void }) {
  const isEscalated = task.state === 'escalated';
  // The red alert card + ⚠️/⚡ icon already signal urgency, so no reminder badge.
  return (
    <Pressable style={s.alertCard} onPress={onPress}>
      <Text style={s.alertIcon}>{isEscalated ? '⚡' : '⚠️'}</Text>
      <View style={s.alertBody}>
        <Text style={s.alertTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={s.alertMeta}>{task.assignedTo} · {dueLabelOf(task)}</Text>
      </View>
      <Text style={s.alertChevron}>›</Text>
    </Pressable>
  );
}

// ─── Event card — taps navigate to event detail ──────────────────────────────

function EventCard({
  event,
  isBrother,
  onPress,
}: {
  event:     MockEvent;
  isBrother: boolean;
  onPress:   () => void;
}) {
  const officersOnly = event.audience === 'officers';
  const mandatory    = event.audience === 'all';
  if (officersOnly && isBrother) return null;
  return (
    <Pressable style={s.eventCard} onPress={onPress}>
      <View style={s.eventAccent} />
      <View style={s.eventBody}>
        <View style={s.eventTitleRow}>
          <Text style={s.eventTitle}>{event.title}</Text>
          {mandatory && (
            <View style={s.mandatoryBadge}><Text style={s.mandatoryText}>Mandatory</Text></View>
          )}
          {officersOnly && !isBrother && (
            <View style={s.officerBadge}><Text style={s.officerText}>Officers</Text></View>
          )}
        </View>
        <Text style={s.eventMeta}>{event.time} · {event.location}</Text>
      </View>
      <Text style={s.eventChevron}>›</Text>
    </Pressable>
  );
}

function UpcomingRow({ label, meta }: { label: string; meta: string }) {
  return (
    <View style={s.upcomingRow}>
      <View style={s.upcomingDot} />
      <View>
        <Text style={s.upcomingLabel}>{label}</Text>
        <Text style={s.upcomingMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function AllClearRow() {
  return (
    <View style={s.allClear}>
      <Text style={s.allClearIcon}>✓</Text>
      <Text style={s.allClearText}>You're all caught up for today</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }  = useDevRole();
  const identity  = useIdentity();
  // Real identity when auth is on; demo values in the flag-off sandbox.
  const fullName  = AUTH_ENABLED ? (identity.member?.fullName ?? '') : DEMO_USER.full_name;
  const firstName = fullName ? fullName.split(' ')[0] : 'there';
  const orgName   = (AUTH_ENABLED ? identity.organization?.name : DEMO_CHAPTER.name) ?? '';
  const roleGroup = getRoleGroup(role);
  const isBrother  = roleGroup === 'brother';
  const isOfficerRole = isOfficer(role);

  // Update/change notices for this role (reactive). Notices now live behind a
  // header bell (Today-only for v1) instead of an inline body section; here we
  // only need the unread count for the badge.
  useUpdateNoticesVersion();
  const notices     = getNoticesForRole(role);
  const unreadCount = notices.length;

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/notifications' as any)} style={s.bellBtn} hitSlop={8}>
          <Bell color="#cbd5e1" size={22} />
          {unreadCount > 0 && (
            <View style={s.bellBadge}>
              <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      ),
    });
  }, [navigation, unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived reminders (compute-on-read). Subscribe to BOTH stores so the count
  // and card badges recompute immediately on an RSVP response or a task
  // submit/approve/reject/resubmit — same live sources the badges read.
  useRsvpVersion();
  useTaskStateVersion();
  const reminders    = deriveReminders(role);
  const reminderById = new Map(reminders.map(r => [r.entityId, r]));
  const topSeverity  = reminders[0]?.severity ?? 'low';

  // Live state (devTaskStore) so review routing reflects in-session changes.
  const { mine, review, alert } = getResponsibilityGroups(
    role,
    t => getStoredState(t.id, t.state),
  );

  // Urgency is computed from real due dates at read time (falls back to the
  // stored urgency when a task has no dueAt).
  const urgentMine = mine.filter(t => { const u = urgencyOf(t); return u === 'overdue' || u === 'today'; });
  const weekMine   = mine.filter(t => urgencyOf(t) === 'week');

  // ── Live event lists — refresh whenever screen gains focus ──────────────────
  // Org id for data scoping (DEMO_CHAPTER_ID while ORG_SCOPED_DATA is false).
  const dataOrgId = useActiveDataOrgId();
  const [allEvents, setAllEvents] = useState<MockEvent[]>(() => getAllEvents());

  // On an ACTUAL active-org change (not first mount), clear this screen's local
  // event list synchronously BEFORE paint so a kept-alive tab can't render the
  // previous org's events for a frame. The focus effect below then refetches the
  // new org. First-mount guard avoids clearing the initial seed. Inert flag-off
  // (dataOrgId constant). Does not fetch here — focus refresh is unchanged.
  const prevOrg = useRef(dataOrgId);
  useLayoutEffect(() => {
    if (prevOrg.current !== dataOrgId) {
      setAllEvents([]);
      prevOrg.current = dataOrgId;
    }
  }, [dataOrgId]);

  // Refetch events from Supabase + re-hydrate RSVP state for each. Shared by the
  // focus effect and pull-to-refresh so a manual pull picks up another user's
  // newly-created/edited events and RSVP changes without leaving the screen.
  const loadEvents = useCallback(async () => {
    const remote = await fetchAllEvents(dataOrgId);
    setSupabaseEventCache(remote);
    const all = getAllEvents();
    setAllEvents(all);
    // Hydrate RSVP state for each displayed event so RSVP cards reflect the
    // saved Supabase status (not the seeded mock 'e1' entry). No-ops on non-UUID
    // ids and fires _notify(), which re-renders the reactive RSVP cards.
    all.forEach(ev => { void hydrateRsvpsFromSupabase(ev.id); });
  }, [dataOrgId]);

  // Manual pull-to-refresh: SERVER-WINS across the board so another user's changes
  // in the same org appear. Refetches events, RSVPs/date submissions (overwrite),
  // tasks, task states (overwrite), and notices — reusing the same fetchers
  // DataBootstrap uses. Distinct from the focus effect (loadEvents), which stays
  // local-wins so a just-made optimistic write isn't clobbered before it persists.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const remoteEvents = await fetchAllEvents(dataOrgId);
      setSupabaseEventCache(remoteEvents);
      const all = getAllEvents();
      setAllEvents(all);
      // RSVP / date submissions — server-wins for each displayed event.
      await Promise.all(all.map(ev => refreshRsvpsFromSupabase(ev.id)));
      // Tasks + task states + notices — same fetchers as DataBootstrap.
      const [remoteTasks, remoteStates] = await Promise.all([
        fetchAllTasks(dataOrgId),
        fetchTaskStates(dataOrgId),
      ]);
      setSupabaseTaskCache(remoteTasks);
      refreshTaskStates(remoteStates);
      await hydrateUpdateNotices(dataOrgId);
    } finally {
      setRefreshing(false);
    }
  }, [dataOrgId]);

  useFocusEffect(
    useCallback(() => {
      // Show whatever is cached immediately, then refresh from Supabase so the
      // shared cache (and this screen's event ids) are Supabase UUIDs.
      setAllEvents(getAllEvents());
      void loadEvents();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataOrgId]),
  );

  // Offset of today within the Mon-based week (0=Mon … 6=Sun)
  const todayOffset   = (new Date().getDay() + 6) % 7;
  const todayEvents   = allEvents.filter(e => e.dayOffset === todayOffset);
  const comingUpEvs   = allEvents.filter(e => e.dayOffset > todayOffset && e.dayOffset <= 6);

  /** All task taps open Task Detail — the task detail screen surfaces the linked event. */
  function navTask(task: MockTask) {
    router.push(`/task/${task.id}` as any);
  }

  function renderMineTask(task: MockTask) {
    if (task.type === 'lightweight') {
      return <QuickActionCard key={task.id} task={task} role={role} />;
    }
    return (
      <TodayTaskCard
        key={task.id}
        task={task}
        showAssignee={false}
        onPress={() => navTask(task)}
      />
    );
  }

  const hasUrgentContent = urgentMine.length > 0 || review.length > 0 || alert.length > 0;

  // Whether the active role branch renders <AllClearRow/> (the officer branch
  // also requires an empty week). Used to suppress the redundant "No events
  // scheduled today" placeholder when we've already said the user is caught up.
  const showAllClear = roleGroup === 'officer'
    ? (!hasUrgentContent && weekMine.length === 0)
    : !hasUrgentContent;

  return (
    <ReminderCtx.Provider value={reminderById}>
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />
        }
      >
        {/* Dev badge — only meaningful while auth is bypassed (flag-off) */}
        {!AUTH_ENABLED && (
          <View style={s.devBadge}>
            <Text style={s.devText}>DEV MODE · auth bypassed</Text>
          </View>
        )}

        {/* Header */}
        <Text style={s.greeting}>Welcome, {firstName}</Text>
        <Text style={s.chapter}>
          {orgName} · {ROLE_LABELS[role].toUpperCase()}
        </Text>

        {/* ── Needs Attention summary — informational caption (NOT a button).
            Count only; the items themselves are in the sections below. ── */}
        {reminders.length > 0 && (
          <View style={s.needsAttn}>
            <View style={[s.needsAttnDot, { backgroundColor: REMINDER_BADGE[topSeverity].color }]} />
            <Text style={s.needsAttnText}>
              {reminders.length} {reminders.length === 1 ? 'item needs' : 'items need'} your attention
            </Text>
          </View>
        )}

        {/* ── BROTHER ── */}
        {roleGroup === 'brother' && (
          <>
            {urgentMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="MY TASKS" count={urgentMine.length} />
                {urgentMine.map(renderMineTask)}
              </View>
            )}
            {!hasUrgentContent && <AllClearRow />}
          </>
        )}

        {/* ── OFFICER ── */}
        {roleGroup === 'officer' && (
          <>
            {urgentMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="MY TASKS" count={urgentMine.length} />
                {urgentMine.map(renderMineTask)}
              </View>
            )}
            {!hasUrgentContent && weekMine.length === 0 && <AllClearRow />}
          </>
        )}

        {/* ── ANNOTATOR ── */}
        {roleGroup === 'annotator' && (
          <>
            {urgentMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="MY TASKS" count={urgentMine.length} />
                {urgentMine.map(renderMineTask)}
              </View>
            )}
            {alert.length > 0 && (
              <View style={s.section}>
                <SLabel text="CHAPTER ALERTS" count={alert.length} urgent />
                {alert.map(t => <AlertCard key={t.id} task={t} onPress={() => navTask(t)} />)}
              </View>
            )}
            {!hasUrgentContent && <AllClearRow />}
          </>
        )}

        {/* ── LEADERSHIP (pro_consul) ── */}
        {roleGroup === 'leadership' && (
          <>
            {alert.length > 0 && (
              <View style={s.section}>
                <SLabel text="CHAPTER ALERTS" count={alert.length} urgent />
                {alert.map(t => <AlertCard key={t.id} task={t} onPress={() => navTask(t)} />)}
              </View>
            )}
            {urgentMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="MY TASKS" count={urgentMine.length} />
                {urgentMine.map(renderMineTask)}
              </View>
            )}
            {review.length > 0 && (
              <View style={s.section}>
                <SLabel text="NEEDS MY REVIEW" count={review.length} />
                {review.map(t => (
                  <TodayTaskCard key={t.id} task={t} showAssignee onPress={() => navTask(t)} />
                ))}
              </View>
            )}
            {!hasUrgentContent && <AllClearRow />}
          </>
        )}

        {/* ── PRESIDENT ── */}
        {roleGroup === 'president' && (
          <>
            {urgentMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="MY TASKS" count={urgentMine.length} />
                {urgentMine.map(renderMineTask)}
              </View>
            )}
            {review.length > 0 && (
              <View style={s.section}>
                <SLabel text="NEEDS FINAL APPROVAL" count={review.length} />
                {review.map(t => (
                  <TodayTaskCard key={t.id} task={t} showAssignee onPress={() => navTask(t)} />
                ))}
              </View>
            )}
            {alert.length > 0 && (
              <View style={s.section}>
                <SLabel text="CHAPTER ALERTS" count={alert.length} urgent />
                {alert.map(t => <AlertCard key={t.id} task={t} onPress={() => navTask(t)} />)}
              </View>
            )}
            {!hasUrgentContent && <AllClearRow />}
          </>
        )}

        {/* ── TODAY'S EVENTS (all roles) ── */}
        <Divider />
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <SLabel text="TODAY'S EVENTS" />
            {isOfficerRole && (
              <Pressable
                onPress={() => router.push('/event/create' as any)}
                style={s.createEventBtn}
              >
                <Text style={s.createEventText}>+ Create</Text>
              </Pressable>
            )}
          </View>
          {todayEvents.length === 0 ? (
            // Suppress this placeholder when AllClearRow already told the user
            // they're caught up — avoids two stacked empty-state messages.
            showAllClear ? null : (
              <View style={s.noEvents}>
                <Text style={s.noEventsText}>No events scheduled today</Text>
              </View>
            )
          ) : (
            todayEvents.map(ev => (
              <EventCard
                key={ev.id}
                event={ev}
                isBrother={isBrother}
                onPress={() => router.push(`/event/${ev.id}` as any)}
              />
            ))
          )}
        </View>

        {/* ── COMING UP ── */}
        {(weekMine.length > 0 || comingUpEvs.length > 0) && (
          <View style={s.section}>
            <SLabel text="COMING UP" />
            <View style={s.upcomingBlock}>
              {weekMine.map(t => (
                <Pressable key={t.id} onPress={() => navTask(t)}>
                  <UpcomingRow label={t.title} meta={t.dueLabel} />
                </Pressable>
              ))}
              {comingUpEvs.map(ev => (
                <Pressable key={ev.id} onPress={() => router.push(`/event/${ev.id}` as any)}>
                  <UpcomingRow
                    label={ev.title}
                    meta={`${DAY_LABELS[ev.dayOffset] ?? ''} · ${ev.time} · ${ev.location}`}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    </ReminderCtx.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },

  devBadge: {
    alignSelf: 'flex-start', backgroundColor: '#422006',
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 20, borderWidth: 1, borderColor: '#92400e',
  },
  devText: { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  // Header notification bell (Today-only for v1)
  bellBtn:       { paddingHorizontal: 14, paddingVertical: 4 },
  bellBadge:     { position: 'absolute', top: -3, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  greeting: { fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
  chapter:  { fontSize: 12, color: '#6366f1', fontWeight: '700', letterSpacing: 0.5, marginBottom: 28 },

  section: { marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#1e293b', marginBottom: 20 },

  slRow:             { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  slText:            { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  slTextUrgent:      { color: '#f87171' },
  slBadge:           { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  slBadgeUrgent:     { backgroundColor: '#450a0a' },
  slBadgeText:       { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  slBadgeTextUrgent: { color: '#f87171' },

  // ── Quick-action card ────────────────────────────────────────────────────────
  qaCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#1e293b', borderRadius: 14,
    marginBottom: 10, overflow: 'hidden',
  },
  qaCardDone:   { opacity: 0.85 },
  qaCardUrgent: { borderWidth: 1, borderColor: '#7f1d1d' },
  qaStripe:     { width: 4 },
  qaBody:       { flex: 1, padding: 14, gap: 10 },
  qaTitle:      { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  qaDue:        { fontSize: 12, color: '#64748b' },
  qaDueUrgent:  { color: '#f87171', fontWeight: '600' },
  qaChoice:     { fontSize: 13, fontWeight: '600' },

  // Attending state row (with change button)
  qaAttendingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qaAttendingText: { fontSize: 14, fontWeight: '700', color: '#4ade80' },
  qaChangeBtn:     { backgroundColor: '#0f172a', borderRadius: 7, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' },
  qaChangeBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  // Buttons
  qaBtnRow: { flexDirection: 'row', gap: 8 },
  qaBtnYes: {
    flex: 1, paddingVertical: 10, borderRadius: 9,
    backgroundColor: '#052e16', borderWidth: 1, borderColor: '#166534',
    alignItems: 'center',
  },
  qaBtnYesText: { fontSize: 14, fontWeight: '700', color: '#4ade80' },
  qaBtnNo: {
    flex: 1, paddingVertical: 10, borderRadius: 9,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    alignItems: 'center',
  },
  qaBtnNoText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  // Inline input
  qaInputRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qaInput: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 9,
    borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 14, paddingHorizontal: 12, paddingVertical: 9,
  },
  qaAckBtn:     { backgroundColor: '#1e1b4b', borderRadius: 9, borderWidth: 1, borderColor: '#4f46e5', paddingVertical: 12, alignItems: 'center' },
  qaAckBtnText: { fontSize: 15, fontWeight: '700', color: '#818cf8' },

  // Save button for name submission
  qaSaveBtn:            { backgroundColor: '#1e3a5f', borderRadius: 9, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  qaSaveBtnDisabled:    { backgroundColor: '#1e293b', borderColor: '#334155' },
  qaSaveBtnText:        { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  qaSaveBtnTextDisabled:{ color: '#475569' },

  // ── Structured task card ───────────────────────────────────────────────────
  taskCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  taskCardUrgent: { borderWidth: 1, borderColor: '#7f1d1d' },
  taskStripe:     { width: 4, alignSelf: 'stretch' },
  taskBody:       { flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 6, gap: 4 },
  taskTitleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taskTitle:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#f1f5f9', lineHeight: 19 },
  taskStateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  flame:          { fontSize: 10, lineHeight: 14 },
  taskStateText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  taskMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  taskAssignee:   { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  dot:            { fontSize: 11, color: '#334155' },
  taskDue:        { fontSize: 11, color: '#64748b' },
  taskDueUrgent:  { color: '#f87171', fontWeight: '600' },
  taskEvent:      { fontSize: 11, color: '#6366f1', fontWeight: '500', flexShrink: 1 },
  taskChevron:    { fontSize: 20, color: '#334155', paddingHorizontal: 12, lineHeight: 24 },

  // ── Alert card ────────────────────────────────────────────────────────────
  alertCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a0505', borderRadius: 12, borderWidth: 1, borderColor: '#7f1d1d', padding: 14, gap: 12, marginBottom: 8 },
  alertIcon:    { fontSize: 18 },
  alertBody:    { flex: 1, gap: 2 },
  alertTitle:   { fontSize: 14, fontWeight: '700', color: '#fca5a5', flexShrink: 1 },
  alertMeta:    { fontSize: 12, color: '#f87171', opacity: 0.7 },
  alertChevron: { fontSize: 20, color: '#7f1d1d' },

  // ── Reminders: needs-attention caption (informational, not a button) ────────
  needsAttn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16, paddingHorizontal: 2 },
  needsAttnDot:  { width: 7, height: 7, borderRadius: 4 },
  needsAttnText: { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  remBadge:      { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  remBadgeText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Update notice card ──────────────────────────────────────────────────────
  noticeCard:   { flexDirection: 'row', alignItems: 'stretch', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  noticeStripe: { width: 4 },
  noticeBody:   { flex: 1, paddingVertical: 11, paddingHorizontal: 12, gap: 3 },
  noticeText:   { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  noticeHint:   { fontSize: 11, color: '#64748b' },

  // ── All-clear ─────────────────────────────────────────────────────────────
  allClear:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0a1628', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#1e293b' },
  allClearIcon: { fontSize: 16, color: '#22c55e' },
  allClearText: { fontSize: 14, color: '#475569', fontWeight: '500' },

  // ── Event card ────────────────────────────────────────────────────────────
  eventCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  eventAccent:   { width: 4, backgroundColor: '#6366f1', alignSelf: 'stretch' },
  eventBody:     { flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 8, gap: 4 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eventTitle:    { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  eventChevron:  { fontSize: 20, color: '#334155', paddingHorizontal: 12 },
  mandatoryBadge:{ backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mandatoryText: { color: '#a5b4fc', fontSize: 10, fontWeight: '700' },
  officerBadge:  { backgroundColor: '#1a2535', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#334155' },
  officerText:   { color: '#64748b', fontSize: 10, fontWeight: '600' },
  eventMeta:     { fontSize: 12, color: '#64748b' },

  // Section header row with space-between (TODAY'S EVENTS + Create button)
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  createEventBtn:   { paddingHorizontal: 8, paddingVertical: 2 },
  createEventText:  { fontSize: 12, fontWeight: '600', color: '#818cf8' },

  // No events placeholder
  noEvents:     { paddingVertical: 16, alignItems: 'center' },
  noEventsText: { fontSize: 13, color: '#475569' },

  // ── Upcoming ──────────────────────────────────────────────────────────────
  upcomingBlock: { backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden' },
  upcomingRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  upcomingDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#334155', flexShrink: 0 },
  upcomingLabel: { fontSize: 14, fontWeight: '600', color: '#cbd5e1', marginBottom: 1 },
  upcomingMeta:  { fontSize: 12, color: '#64748b' },
});
