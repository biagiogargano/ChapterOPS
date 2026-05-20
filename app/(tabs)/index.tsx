import { getStoredState, loadTaskState, saveTaskState } from '@/lib/devTaskStore';
import { DEMO_CHAPTER, DEMO_USER } from '@/lib/demoUser';
import { useDevRole } from '@/lib/devRoleStore';
import { fetchAllEvents } from '@/lib/eventService';
import { findEventById, getAllEvents, resolveEventId, setSupabaseEventCache, type MockEvent } from '@/lib/eventStore';
import { DAY_LABELS } from '@/lib/mockEvents';
import {
  STATE_BG,
  STATE_COLOR,
  STATE_LABEL,
  STATE_STRIPE,
  findTaskById,
  getResponsibilityGroups,
  type MockTask,
  type TaskState,
} from '@/lib/mockTasks';
import {
  acknowledgeNotice,
  getNoticesForRole,
  useUpdateNoticesVersion,
  type UpdateNotice,
  type UpdateSeverity,
} from '@/lib/updateNoticeStore';
import {
  getRsvpEntry,
  hydrateRsvpsFromSupabase,
  setRsvpEntry,
  useRsvpEntry,
  type RsvpStatus,
} from '@/lib/rsvpStore';
import { ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

// ─── Mock excuse data (for pre-populated review cards) ────────────────────────

type ExcuseStatus = 'pending' | 'approved' | 'denied' | 'jboard';

interface MockExcuse {
  id:              string;
  memberName:      string;
  roleName:        string;
  eventTitle:      string;
  excuse:          string;
  coveringPerson?: string;
}

const MOCK_EXCUSES: MockExcuse[] = [
  {
    id:          'exc1',
    memberName:  'Alex Johnson',
    roleName:    'Risk Manager',
    eventTitle:  'Chapter Meeting',
    excuse:      'Class conflict — CHEM 301 midterm',
  },
  {
    id:           'exc2',
    memberName:   'Marcus Davis',
    roleName:     'Social Chair',
    eventTitle:   'E-Board Meeting',
    excuse:       'Out of town — family obligation',
    coveringPerson: 'Tyler Reed (Recruitment Chair)',
  },
];

const _excuseStore: Record<string, ExcuseStatus> = {};
function getExcuseStatus(id: string): ExcuseStatus  { return _excuseStore[id] ?? 'pending'; }
function setExcuseStatus(id: string, s: ExcuseStatus) { _excuseStore[id] = s; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleGroup(role: Role) {
  if (role === 'brother')    return 'brother';
  if (role === 'president')  return 'president';
  if (role === 'pro_consul') return 'leadership';
  if (role === 'annotator')  return 'annotator';
  return 'officer'; // risk_manager, social_chair, recruitment_chair
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

  const header = (
    <View>
      <Text style={s.qaTitle}>{task.title}</Text>
      <Text style={[s.qaDue, isUrgent && s.qaDueUrgent]}>
        {task.dueLabel}{eventTitle ? `  ·  ${eventTitle}` : ''}
      </Text>
    </View>
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
  const eventId  = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');
  const isUrgent = task.urgency === 'overdue';

  // Reactive entry: re-renders whenever setRsvpEntry fires on any screen.
  const entry = useRsvpEntry(eventId, role);
  // Local buffer for the text input — smooth typing without re-init on each store write.
  const [draft,   setDraft  ] = useState(() => getRsvpEntry(eventId, role).dateName);
  // editing=true means the user pressed "Edit" to revise without clearing the committed name.
  const [editing, setEditing] = useState(false);
  // isSaved derives from the store (reactive), not from a copied boolean.
  const isSaved = entry.dateName.trim().length > 0 && !editing;

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
    <View>
      <Text style={s.qaTitle}>{task.title}</Text>
      <Text style={[s.qaDue, isUrgent && s.qaDueUrgent]}>
        {task.dueLabel}{task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
      </Text>
    </View>
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
  const isUrgent   = state === 'overdue' || state === 'escalated';

  return (
    <Pressable style={[s.taskCard, isUrgent && s.taskCardUrgent]} onPress={onPress}>
      <View style={[s.taskStripe, { backgroundColor: stripe }]} />
      <View style={s.taskBody}>
        <View style={s.taskTitleRow}>
          <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
          <View style={[s.taskStateBadge, { backgroundColor: stateBg }]}>
            {state === 'escalated' && <Text style={s.flame}>⚡</Text>}
            <Text style={[s.taskStateText, { color: stateColor }]}>
              {STATE_LABEL[state]}
            </Text>
          </View>
        </View>
        <View style={s.taskMetaRow}>
          {showAssignee && (
            <>
              <Text style={s.taskAssignee}>{task.assignedTo}</Text>
              <Text style={s.dot}>·</Text>
            </>
          )}
          <Text style={[s.taskDue, isUrgent && s.taskDueUrgent]}>{task.dueLabel}</Text>
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
  return (
    <Pressable style={s.alertCard} onPress={onPress}>
      <Text style={s.alertIcon}>{isEscalated ? '⚡' : '⚠️'}</Text>
      <View style={s.alertBody}>
        <Text style={s.alertTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={s.alertMeta}>{task.assignedTo} · {task.dueLabel}</Text>
      </View>
      <Text style={s.alertChevron}>›</Text>
    </Pressable>
  );
}

// ─── Excuse review card ────────────────────────────────────────────────────────

function ExcuseReviewCard({ excuse }: { excuse: MockExcuse }) {
  const [status, setStatus] = useState<ExcuseStatus>(getExcuseStatus(excuse.id));

  function act(s: ExcuseStatus) {
    setExcuseStatus(excuse.id, s);
    setStatus(s);
  }

  const statusConfig = {
    approved: { label: 'Approved',           color: '#4ade80', bg: '#052e16' },
    denied:   { label: 'Denied',             color: '#f87171', bg: '#1a0505' },
    jboard:   { label: 'Flagged — J-Board',  color: '#fb923c', bg: '#1a0800' },
    pending:  { label: '',                   color: '',        bg: ''        },
  };

  if (status !== 'pending') {
    const cfg = statusConfig[status];
    return (
      <View style={[s.excuseCard, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
        <View style={s.excuseHeader}>
          <Text style={s.excuseMember}>{excuse.memberName}</Text>
          <View style={[s.excuseStatusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.excuseStatusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={s.excuseEvent}>{excuse.eventTitle}</Text>
        {status === 'jboard' && (
          <Text style={s.jboardNote}>Flagged for Standards Committee review at next meeting.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={s.excuseCard}>
      <View style={s.excuseHeader}>
        <View>
          <Text style={s.excuseMember}>{excuse.memberName}</Text>
          <Text style={s.excuseRole}>{excuse.roleName}</Text>
        </View>
        <Text style={s.excuseEventBadge}>{excuse.eventTitle}</Text>
      </View>
      <Text style={s.excuseText}>"{excuse.excuse}"</Text>
      {excuse.coveringPerson && (
        <Text style={s.excuseCovering}>Covering: {excuse.coveringPerson}</Text>
      )}
      <View style={s.excuseActions}>
        <Pressable style={s.excuseApprove}  onPress={() => act('approved')}>
          <Text style={s.excuseApproveText}>Approve</Text>
        </Pressable>
        <Pressable style={s.excuseDeny}     onPress={() => act('denied')}>
          <Text style={s.excuseDenyText}>Deny</Text>
        </Pressable>
        <Pressable style={s.excuseJboard}   onPress={() => act('jboard')}>
          <Text style={s.excuseJboardText}>J-Board</Text>
        </Pressable>
      </View>
    </View>
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

// ─── Update notice card ─────────────────────────────────────────────────────

const NOTICE_CFG: Record<UpdateSeverity, { color: string; bg: string; stripe: string }> = {
  critical: { color: '#fca5a5', bg: '#1a0505', stripe: '#dc2626' },
  moderate: { color: '#fbbf24', bg: '#1c1407', stripe: '#d97706' },
  low:      { color: '#94a3b8', bg: '#1e293b', stripe: '#334155' },
};

function UpdateNoticeCard({ notice, onPress }: { notice: UpdateNotice; onPress: () => void }) {
  const cfg = NOTICE_CFG[notice.severity];
  return (
    <Pressable style={[s.noticeCard, { backgroundColor: cfg.bg }]} onPress={onPress}>
      <View style={[s.noticeStripe, { backgroundColor: cfg.stripe }]} />
      <View style={s.noticeBody}>
        <Text style={[s.noticeText, { color: cfg.color }]} numberOfLines={2}>{notice.summary}</Text>
        <Text style={s.noticeHint}>Tap to view · dismisses</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const router    = useRouter();
  const { role }  = useDevRole();
  const firstName = DEMO_USER.full_name.split(' ')[0];
  const roleGroup = getRoleGroup(role);
  const isBrother  = roleGroup === 'brother';
  const isOfficerRole = isOfficer(role);

  // Update/change notices for this role (reactive).
  useUpdateNoticesVersion();
  const notices = getNoticesForRole(role);

  function handleNoticePress(n: UpdateNotice) {
    acknowledgeNotice(n.id, role);   // dismiss for this role
    if (n.entityType === 'task' && findTaskById(n.entityId)) {
      router.push(`/task/${n.entityId}` as any);
    } else if (n.entityType === 'event' && findEventById(n.entityId)) {
      router.push(`/event/${n.entityId}` as any);
    }
    // entity gone (cancelled) → just dismissed
  }

  // Live state (devTaskStore) so review routing reflects in-session changes.
  const { mine, review, alert } = getResponsibilityGroups(
    role,
    t => getStoredState(t.id, t.state),
  );

  const urgentMine = mine.filter(t => t.urgency === 'overdue' || t.urgency === 'today');
  const weekMine   = mine.filter(t => t.urgency === 'week');

  const pendingExcuses = MOCK_EXCUSES.filter(e => getExcuseStatus(e.id) === 'pending');

  // ── Live event lists — refresh whenever screen gains focus ──────────────────
  const [allEvents, setAllEvents] = useState<MockEvent[]>(() => getAllEvents());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Show whatever is cached immediately, then refresh from Supabase so the
      // shared cache (and this screen's event ids) are Supabase UUIDs.
      setAllEvents(getAllEvents());
      fetchAllEvents().then(remote => {
        if (cancelled) return;
        setSupabaseEventCache(remote);
        const all = getAllEvents();
        setAllEvents(all);
        // Hydrate RSVP state for each displayed event so RSVP cards reflect the
        // saved Supabase status on startup (not the seeded mock 'e1' entry).
        // hydrateRsvpsFromSupabase no-ops on non-UUID ids and fires _notify(),
        // which re-renders the reactive RSVP cards.
        all.forEach(ev => { void hydrateRsvpsFromSupabase(ev.id); });
      });
      return () => { cancelled = true; };
    }, []),
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

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dev badge */}
        <View style={s.devBadge}>
          <Text style={s.devText}>DEV MODE · auth bypassed</Text>
        </View>

        {/* Header */}
        <Text style={s.greeting}>Good morning, {firstName}</Text>
        <Text style={s.chapter}>
          {DEMO_CHAPTER.name} · {ROLE_LABELS[role].toUpperCase()}
        </Text>

        {/* ── UPDATES (change notices for this role) ── */}
        {notices.length > 0 && (
          <View style={s.section}>
            <SLabel text="UPDATES" count={notices.length} />
            {notices.map(n => (
              <UpdateNoticeCard key={n.id} notice={n} onPress={() => handleNoticePress(n)} />
            ))}
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
            {weekMine.length > 0 && (
              <View style={s.section}>
                <SLabel text="COMING UP" count={weekMine.length} />
                {weekMine.map(t => (
                  <TodayTaskCard key={t.id} task={t} showAssignee={false} onPress={() => navTask(t)} />
                ))}
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
            {pendingExcuses.length > 0 && (
              <View style={s.section}>
                <SLabel text="EXCUSES TO REVIEW" count={pendingExcuses.length} />
                {MOCK_EXCUSES.map(e => <ExcuseReviewCard key={e.id} excuse={e} />)}
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
            {pendingExcuses.length > 0 && (
              <View style={s.section}>
                <SLabel text="EXCUSES TO REVIEW" count={pendingExcuses.length} />
                {MOCK_EXCUSES.map(e => <ExcuseReviewCard key={e.id} excuse={e} />)}
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
            <View style={s.noEvents}>
              <Text style={s.noEventsText}>No events scheduled today</Text>
            </View>
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
              {(roleGroup === 'brother' || roleGroup === 'annotator' || roleGroup === 'leadership') &&
                weekMine.map(t => (
                  <Pressable key={t.id} onPress={() => navTask(t)}>
                    <UpcomingRow label={t.title} meta={t.dueLabel} />
                  </Pressable>
                ))
              }
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
  alertTitle:   { fontSize: 14, fontWeight: '700', color: '#fca5a5' },
  alertMeta:    { fontSize: 12, color: '#f87171', opacity: 0.7 },
  alertChevron: { fontSize: 20, color: '#7f1d1d' },

  // ── Excuse review ─────────────────────────────────────────────────────────
  excuseCard:       { backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', padding: 14, gap: 8, marginBottom: 10 },
  excuseHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  excuseMember:     { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  excuseRole:       { fontSize: 12, color: '#64748b', marginTop: 1 },
  excuseEventBadge: { fontSize: 11, fontWeight: '600', color: '#818cf8', backgroundColor: '#1e1b4b', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  excuseEvent:      { fontSize: 12, color: '#64748b' },
  excuseText:       { fontSize: 14, color: '#cbd5e1', lineHeight: 20, fontStyle: 'italic' },
  excuseCovering:   { fontSize: 12, color: '#4ade80', fontWeight: '500' },
  excuseActions:    { flexDirection: 'row', gap: 8, paddingTop: 4 },
  excuseApprove:    { flex: 1, backgroundColor: '#052e16', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#166534' },
  excuseApproveText:{ fontSize: 13, fontWeight: '700', color: '#4ade80' },
  excuseDeny:       { flex: 1, backgroundColor: '#1a0505', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#7f1d1d' },
  excuseDenyText:   { fontSize: 13, fontWeight: '700', color: '#f87171' },
  excuseJboard:     { flex: 1, backgroundColor: '#1a0800', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#9a3412' },
  excuseJboardText: { fontSize: 13, fontWeight: '700', color: '#fb923c' },
  excuseStatusBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  excuseStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  jboardNote:       { fontSize: 12, color: '#fb923c', fontStyle: 'italic', lineHeight: 17 },

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
