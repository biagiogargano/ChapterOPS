import { useDevRole } from '@/lib/devRoleStore';
import { getStoredState } from '@/lib/devTaskStore';
import { getAllEvents, resolveEventId } from '@/lib/eventStore';
import {
  PROOF_ICON,
  STATE_BG,
  STATE_COLOR,
  STATE_LABEL,
  STATE_STRIPE,
  dueLabelOf,
  getResponsibilityGroups,
  isOverdue,
  type MockTask,
  type TaskState,
} from '@/lib/mockTasks';
import { getRsvpEntry, useRsvpEntry, useRsvpVersion, type RsvpStatus } from '@/lib/rsvpStore';
import { ROLE_LABELS, isOfficer } from '@/lib/roles';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// ─── Summary bar helpers ──────────────────────────────────────────────────────

function computeSummary(tasks: MockTask[], role: string): { done: number; reviewing: number; todo: number } {
  let done = 0, reviewing = 0, todo = 0;
  for (const t of tasks) {
    if (t.lightweightKind === 'rsvp' && t.linkedEvent) {
      // RSVP tasks: key by instance ID so recurring events don't share state
      const status = getRsvpEntry(resolveEventId(t.linkedEventId ?? t.linkedEvent), role).status;
      if (status === 'attending')     done++;
      else if (status === 'not_attending') reviewing++;
      else                            todo++;
    } else {
      const eff = getStoredState(t.id, t.state);
      if (eff === 'approved')         done++;
      else if (eff === 'submitted')   reviewing++;
      else                            todo++;
    }
  }
  return { done, reviewing, todo };
}

function SummaryBar({ tasks, role }: { tasks: MockTask[]; role: string }) {
  useRsvpVersion(); // re-render whenever any RSVP changes so counts stay accurate
  const { done, reviewing, todo } = computeSummary(tasks, role);
  if (tasks.length === 0) return null;

  return (
    <View style={s.summaryBar}>
      {done > 0 && (
        <View style={s.summaryChip}>
          <View style={[s.summaryDot, { backgroundColor: '#22c55e' }]} />
          <Text style={s.summaryText}>{done} done</Text>
        </View>
      )}
      {reviewing > 0 && (
        <View style={s.summaryChip}>
          <View style={[s.summaryDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={s.summaryText}>{reviewing} in review</Text>
        </View>
      )}
      {todo > 0 && (
        <View style={s.summaryChip}>
          <View style={[s.summaryDot, { backgroundColor: '#64748b' }]} />
          <Text style={s.summaryText}>{todo} to do</Text>
        </View>
      )}
    </View>
  );
}

// ─── Task cards ───────────────────────────────────────────────────────────────

/** Simple card for lightweight tasks — shows status badge only when not 'assigned'. */
function LightweightCard({
  task,
  effectiveState,
  onPress,
}: {
  task:           MockTask;
  effectiveState: TaskState;
  onPress:        () => void;
}) {
  const isUrgent    = effectiveState === 'overdue' || effectiveState === 'escalated';
  const showBadge   = effectiveState !== 'assigned';
  const stateColor  = STATE_COLOR[effectiveState];
  const stateBg     = STATE_BG[effectiveState];
  const stripeColor = showBadge ? STATE_STRIPE[effectiveState] : (isUrgent ? '#dc2626' : '#334155');

  return (
    <Pressable
      style={[s.card, isUrgent && s.cardUrgent]}
      onPress={onPress}
    >
      <View style={[s.stripe, { backgroundColor: stripeColor }]} />
      <View style={s.cardBody}>
        <View style={s.titleRow}>
          <Text style={s.cardTitle} numberOfLines={2}>{task.title}</Text>
          {showBadge && (
            <View style={[s.stateBadge, { backgroundColor: stateBg }]}>
              <Text style={[s.stateText, { color: stateColor }]}>
                {STATE_LABEL[effectiveState]}
              </Text>
            </View>
          )}
        </View>
        <Text style={[s.cardDue, isUrgent && s.cardDueUrgent]}>
          {task.dueLabel}
          {task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
        </Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

/** Detailed card for structured tasks — state badge, assignee/reviewer, proof icon. */
function StructuredCard({
  task,
  effectiveState,
  showAssignee,
  reviewerLabel,
  onPress,
}: {
  task:           MockTask;
  effectiveState: TaskState;
  showAssignee:   boolean;   // true for review/alert — shows who submitted
  reviewerLabel?: string;    // truthy for mine — shows who will review my work
  onPress:        () => void;
}) {
  const isUrgent   = isOverdue(task.dueAt, effectiveState) || effectiveState === 'escalated';
  const stripe     = STATE_STRIPE[effectiveState];
  const stateColor = STATE_COLOR[effectiveState];
  const stateBg    = STATE_BG[effectiveState];

  // Derive a human-readable rejection cue
  const isRejected = effectiveState === 'rejected';

  return (
    <Pressable
      style={[s.card, isUrgent && s.cardUrgent]}
      onPress={onPress}
    >
      <View style={[s.stripe, { backgroundColor: stripe }]} />
      <View style={s.cardBody}>
        {/* Title + state badge */}
        <View style={s.titleRow}>
          <Text style={s.cardTitle} numberOfLines={2}>{task.title}</Text>
          <View style={[s.stateBadge, { backgroundColor: stateBg }]}>
            {effectiveState === 'escalated' && <Text style={s.flame}>⚡</Text>}
            <Text style={[s.stateText, { color: stateColor }]}>
              {STATE_LABEL[effectiveState]}
            </Text>
          </View>
        </View>

        {/* Assignee — for review/alert cards (who submitted this to me) */}
        {showAssignee && (
          <Text style={s.assigneeText}>{task.assignedTo}</Text>
        )}

        {/* Reviewer — for mine cards (who will review my submission) */}
        {reviewerLabel && !isRejected && (
          <Text style={s.reviewerText}>→ {reviewerLabel}</Text>
        )}
        {isRejected && !showAssignee && (
          <Text style={s.rejectedCue}>Tap to revise and resubmit</Text>
        )}

        {/* Due + proof icon + event */}
        <View style={s.metaRow}>
          <Text style={[s.cardDue, isUrgent && s.cardDueUrgent]}>{dueLabelOf(task)}</Text>
          {task.requiresProof && task.proofType && (
            <>
              <Text style={s.dot}>·</Text>
              <Text style={s.proofIcon}>{PROOF_ICON[task.proofType]}</Text>
            </>
          )}
          {task.linkedEvent && (
            <>
              <Text style={s.dot}>·</Text>
              <Text style={s.eventText} numberOfLines={1}>{task.linkedEvent}</Text>
            </>
          )}
        </View>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

// ─── RSVP-specific card (reads rsvpStore, never locked) ──────────────────────

const RSVP_CARD_CONFIG: Record<RsvpStatus, { label: string; color: string; bg: string; stripe: string }> = {
  no_response:   { label: '',             color: '#64748b', bg: '#1e293b', stripe: '#334155' },
  attending:     { label: 'Attending',    color: '#4ade80', bg: '#052e16', stripe: '#16a34a' },
  not_attending: { label: 'Not Attending',color: '#fbbf24', bg: '#1c1407', stripe: '#d97706' },
};

function RsvpTaskCard({
  task,
  role,
  onPress,
}: {
  task:    MockTask;
  role:    string;
  onPress: () => void;
}) {
  // Reactive hook: re-renders this card whenever the RSVP status changes anywhere.
  const entry  = useRsvpEntry(resolveEventId(task.linkedEventId ?? task.linkedEvent!), role);
  const cfg    = RSVP_CARD_CONFIG[entry.status];
  const showBadge = entry.status !== 'no_response';

  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={[s.stripe, { backgroundColor: cfg.stripe }]} />
      <View style={s.cardBody}>
        <View style={s.titleRow}>
          <Text style={s.cardTitle} numberOfLines={2}>{task.title}</Text>
          {showBadge && (
            <View style={[s.stateBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[s.stateText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          )}
        </View>
        <Text style={s.cardDue}>
          {task.dueLabel}
          {task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
        </Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

function TaskCard({
  task,
  role,
  showAssignee,
  onPress,
}: {
  task:         MockTask;
  role:         string;
  showAssignee: boolean;
  onPress:      () => void;
}) {
  // RSVP tasks always use rsvpStore — bypass devTaskStore
  if (task.lightweightKind === 'rsvp' && task.linkedEvent) {
    return <RsvpTaskCard task={task} role={role} onPress={onPress} />;
  }

  const effectiveState = getStoredState(task.id, task.state);

  if (task.type === 'lightweight') {
    return <LightweightCard task={task} effectiveState={effectiveState} onPress={onPress} />;
  }

  // For MY TASKS (showAssignee=false), show who reviews the work
  const reviewerLabel =
    !showAssignee && task.requiresApproval && task.reviewerRole
      ? `Reviewed by ${ROLE_LABELS[task.reviewerRole]}`
      : undefined;

  return (
    <StructuredCard
      task={task}
      effectiveState={effectiveState}
      showAssignee={showAssignee}
      reviewerLabel={reviewerLabel}
      onPress={onPress}
    />
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  urgent,
}: {
  label:   string;
  count:   number;
  urgent?: boolean;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionLabel, urgent && s.sectionLabelUrgent]}>{label}</Text>
      <View style={[s.countBadge, urgent && s.countBadgeUrgent]}>
        <Text style={[s.countText, urgent && s.countTextUrgent]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }   = useDevRole();
  const roleLabel  = ROLE_LABELS[role];
  const officer    = isOfficer(role);

  // Recompute task buckets whenever this tab regains focus, so a task created on
  // another screen (pushed into the non-reactive _userTasks store) appears here
  // without a reload. Mirrors the focus-refresh Today already uses. The callback
  // is stable (useCallback []), so it fires only on focus — no render loop.
  const [, _bumpFocus] = useState(0);
  useFocusEffect(useCallback(() => { _bumpFocus(n => n + 1); }, []));

  // Officer-only "+ Create" task button in the tab header.
  useEffect(() => {
    navigation.setOptions({
      headerRight: officer
        ? () => (
            <Pressable style={s.createHdrBtn} onPress={() => router.push('/task/create' as any)}>
              <Text style={s.createHdrText}>+ Create</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [officer, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use LIVE state (devTaskStore) so submit/approve/reject re-route the review
  // queue to the correct reviewer immediately, without requiring a reload.
  const { mine, review, alert, reviewed } = getResponsibilityGroups(
    role,
    t => getStoredState(t.id, t.state),
  );

  const hasAny = mine.length + review.length + alert.length + reviewed.length > 0;

  /**
   * Events are the action hub. Event-tied lightweight RSVP / date-name tasks
   * route to Event Detail (full context + all event actions in one place).
   * Everything else (structured tasks, acknowledgments, yes/no) → Task Detail.
   */
  function nav(task: MockTask) {
    const isEventAction =
      (task.lightweightKind === 'rsvp' || task.lightweightKind === 'name_submission') &&
      !!(task.linkedEventId ?? task.linkedEvent);
    if (isEventAction) {
      const eid = resolveEventId(task.linkedEventId ?? task.linkedEvent!);
      const ev  = getAllEvents().find(e => e.id === eid);
      if (ev) {
        router.push(`/event/${ev.id}` as any);
        return;
      }
    }
    router.push(`/task/${task.id}` as any);
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Role indicator */}
      <View style={s.roleBar}>
        <View style={s.roleDot} />
        <Text style={s.roleBarText}>Filtered for {roleLabel}</Text>
      </View>

      {/* Summary bar — only shown when there are personal tasks */}
      {mine.length > 0 && <SummaryBar tasks={mine} role={role} />}

      {!hasAny ? (
        <View style={s.emptyFull}>
          <Text style={s.emptyIcon}>✓</Text>
          <Text style={s.emptyTitle}>All clear</Text>
          <Text style={s.emptyText}>No tasks assigned to {roleLabel}</Text>
        </View>
      ) : (
        <>
          {/* Chapter Alerts — overdue/escalated tasks not mine */}
          {alert.length > 0 && (
            <View style={s.section}>
              <SectionHeader label="CHAPTER ALERTS" count={alert.length} urgent />
              {alert.map(t => (
                <TaskCard key={t.id} task={t} role={role} showAssignee onPress={() => nav(t)} />
              ))}
            </View>
          )}

          {/* My Tasks — personal responsibility */}
          {mine.length > 0 && (
            <View style={s.section}>
              <SectionHeader label="MY TASKS" count={mine.length} />
              {mine.map(t => (
                <TaskCard key={t.id} task={t} role={role} showAssignee={false} onPress={() => nav(t)} />
              ))}
            </View>
          )}

          {/* Needs My Review — submitted, awaiting my approval */}
          {review.length > 0 && (
            <View style={s.section}>
              <SectionHeader label="NEEDS MY REVIEW" count={review.length} />
              {review.map(t => (
                <TaskCard key={t.id} task={t} role={role} showAssignee onPress={() => nav(t)} />
              ))}
            </View>
          )}

          {/* Recently Reviewed — tasks I already approved/rejected (kept visible
              so reviewed/rejected items don't vanish after reload) */}
          {reviewed.length > 0 && (
            <View style={s.section}>
              <SectionHeader label="RECENTLY REVIEWED" count={reviewed.length} />
              {reviewed.map(t => (
                <TaskCard key={t.id} task={t} role={role} showAssignee onPress={() => nav(t)} />
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  // Header create button
  createHdrBtn:  { paddingHorizontal: 12, paddingVertical: 4 },
  createHdrText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  // Role bar
  roleBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 12, paddingHorizontal: 4,
  },
  roleDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366f1' },
  roleBarText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // Summary bar
  summaryBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 20, paddingHorizontal: 4,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1e293b', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryDot:  { width: 6, height: 6, borderRadius: 3 },
  summaryText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // Section
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 4, paddingHorizontal: 4,
  },
  sectionLabel:       { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  sectionLabelUrgent: { color: '#f87171' },
  countBadge:       { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  countBadgeUrgent: { backgroundColor: '#450a0a' },
  countText:        { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  countTextUrgent:  { color: '#f87171' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 12,
    marginBottom: 8, overflow: 'hidden',
  },
  cardUrgent: { borderWidth: 1, borderColor: '#7f1d1d' },
  stripe:     { width: 4, alignSelf: 'stretch' },
  cardBody:   { flex: 1, paddingVertical: 13, paddingLeft: 12, paddingRight: 6, gap: 5 },

  // Title row
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#f1f5f9', lineHeight: 20 },

  // State badge
  stateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0,
  },
  flame:     { fontSize: 10, lineHeight: 14 },
  stateText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  assigneeText:  { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  reviewerText:  { fontSize: 11, fontWeight: '500', color: '#6366f1' },
  rejectedCue:   { fontSize: 11, fontWeight: '500', color: '#f87171' },

  // Meta row
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardDue:      { fontSize: 12, color: '#64748b', fontWeight: '500' },
  cardDueUrgent:{ color: '#f87171', fontWeight: '600' },
  dot:          { fontSize: 11, color: '#334155' },
  proofIcon:    { fontSize: 12 },
  eventText:    { fontSize: 11, color: '#6366f1', fontWeight: '500', flexShrink: 1 },

  chevron: { fontSize: 22, color: '#334155', paddingHorizontal: 14, lineHeight: 28 },

  // Empty
  emptyFull:  { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptyText:  { fontSize: 14, color: '#475569' },
});
