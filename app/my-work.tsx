/**
 * app/my-work.tsx — "My Work" hub (officer/member-facing).
 *
 * The assignee-facing counterpart to the Leadership Review Inbox: one place to see what the
 * CURRENT role needs to do — overdue / due-soon tasks, this week's goal update (open /
 * not-open / in-review / returned), the goals I own, and my notices. Real data only (live
 * task store + the same goal/notice services other screens use); aggregation is the pure
 * lib/myWork. Available to everyone (focused on the viewer's own role).
 */

import {
  myOverdueTasks, myDueSoonTasks, myGoalUpdateTasks, myInReviewUpdates, myReturnedUpdates,
  myNotOpenTasks, myWorkCounts,
} from '@/lib/myWork';
import { isGoalUpdateTask } from '@/lib/reviewInbox';
import { getAllTasks, type MockTask } from '@/lib/mockTasks';
import { getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { taskWindowView } from '@/lib/taskWindow';
import { listMyGoalsResult } from '@/lib/goalService';
import { goalDisplay } from '@/lib/goalHelpers';
import { goalsNeedingAttention } from '@/lib/agendaGoals';
import type { Goal } from '@/lib/goals';
import {
  getNoticesForRole, acknowledgeNotice, partitionNoticesByPriority, useUpdateNoticesVersion,
  type UpdateNotice,
} from '@/lib/updateNoticeStore';
import { useDevRole } from '@/lib/devRoleStore';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function MyWorkScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const { role }   = useDevRole();
  const orgId      = useActiveDataOrgId();

  useTaskStateVersion();
  useUpdateNoticesVersion();
  useEffect(() => { navigation.setOptions({ title: 'My Work' }); }, [navigation]);

  // ── Live (sync) task buckets ──
  const now = new Date();
  const stateOf = (t: MockTask) => getStoredState(t.id, t.state);
  const tasks = getAllTasks();

  // Needs-action tasks that are NOT weekly goal updates (those have their own section).
  const overdue  = myOverdueTasks(tasks, role, stateOf, now).filter(t => !isGoalUpdateTask(t));
  const dueSoon  = myDueSoonTasks(tasks, role, stateOf, now).filter(t => !isGoalUpdateTask(t));
  // Weekly goal-update status.
  const openUpdates = myGoalUpdateTasks(tasks, role, stateOf, now);
  const inReview    = myInReviewUpdates(tasks, role, stateOf);
  const returned    = myReturnedUpdates(tasks, role, stateOf);
  const notOpen     = myNotOpenTasks(tasks, role, stateOf, now).filter(isGoalUpdateTask);

  // Notices for my role, attention (critical/moderate) first, then FYI.
  const _notices = getNoticesForRole(role);
  const _parts = partitionNoticesByPriority(_notices);
  const notices = [..._parts.attention, ..._parts.fyi];

  // ── Async: my goals ──
  const [goals, setGoals]   = useState<Goal[]>([]);
  const [attnIds, setAttn]  = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [goalsError, setGoalsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setGoalsError(false);
    if (!orgId) { setGoals([]); setLoading(false); return; }
    const res = await listMyGoalsResult(orgId);
    if (res.ok) {
      const active = res.goals.filter(g => g.status === 'active');
      setGoals(active);
      setAttn(new Set(goalsNeedingAttention(active).map(g => g.goalId)));
    } else {
      setGoals([]); setGoalsError(true);
    }
    setLoading(false);
  }, [orgId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = myWorkCounts({
    overdue: overdue.length, dueSoon: dueSoon.length, returned: returned.length,
    openUpdates: openUpdates.length, inReview: inReview.length, notOpen: notOpen.length,
  });

  function openTask(t: MockTask) { router.push(`/task/${t.id}` as any); }
  function openNotice(n: UpdateNotice) {
    acknowledgeNotice(n.id, role);
    if (n.entityType === 'task')  router.push(`/task/${n.entityId}` as any);
    else if (n.entityType === 'event') router.push(`/event/${n.entityId}` as any);
    else if (n.entityType === 'goal')  router.push('/(tabs)/goals' as any);
  }
  function opensLabel(t: MockTask): string {
    const w = taskWindowView(t.availableAt, t.dueAt, now);
    return w.label || 'Opens later this week';
  }

  const nothing =
    counts.actionNow === 0 && inReview.length === 0 && notOpen.length === 0 &&
    goals.length === 0 && notices.length === 0 && !loading;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.intro}>Your tasks, weekly update, goals, and notices.</Text>

      <View style={s.summaryRow}>
        <Stat n={counts.actionNow} label="To do" />
        <Stat n={openUpdates.length + notOpen.length + returned.length} label="Update" />
        <Stat n={goals.length} label="Goals" />
        <Stat n={notices.length} label="Notices" />
      </View>

      {nothing && (
        <View style={s.center}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTitle}>You’re caught up</Text>
          <Text style={s.emptyText}>Nothing needs your attention right now.</Text>
        </View>
      )}

      {/* Needs action now */}
      {(overdue.length > 0 || dueSoon.length > 0 || returned.length > 0) && (
        <Section title="Needs action now" count={overdue.length + dueSoon.length + returned.length}>
          {returned.map(t => (
            <Row key={t.id} title="Weekly goal update returned" meta="Revise the flagged items and resubmit" tone="warn" onPress={() => openTask(t)} />
          ))}
          {overdue.map(t => (
            <Row key={t.id} title={t.title} meta="Overdue" tone="warn" onPress={() => openTask(t)} />
          ))}
          {dueSoon.map(t => (
            <Row key={t.id} title={t.title} meta="Due soon" onPress={() => openTask(t)} />
          ))}
        </Section>
      )}

      {/* Weekly update */}
      {(openUpdates.length > 0 || notOpen.length > 0 || inReview.length > 0) && (
        <Section title="Weekly update" count={openUpdates.length + notOpen.length + inReview.length}>
          {openUpdates.map(t => (
            <Row key={t.id} title="Submit your weekly goal update" meta="Open now — update your goals + check-in" onPress={() => openTask(t)} />
          ))}
          {notOpen.map(t => (
            <Row key={t.id} title="Weekly goal update" meta={opensLabel(t)} onPress={() => openTask(t)} />
          ))}
          {inReview.map(t => (
            <Row key={t.id} title="Weekly goal update submitted" meta="In review — waiting for leadership" onPress={() => openTask(t)} />
          ))}
        </Section>
      )}

      {/* My goals */}
      {loading && goals.length === 0 ? (
        <View style={s.loadingRow}><ActivityIndicator color="#6366f1" /><Text style={s.loadingText}>Loading your goals…</Text></View>
      ) : goalsError ? (
        <Section title="My goals" count={0}>
          <Row title="Couldn’t load your goals" meta="Tap to retry" onPress={() => void load()} tone="warn" />
        </Section>
      ) : goals.length > 0 ? (
        <Section title="My goals" count={goals.length}>
          {goals.map(g => {
            const d = goalDisplay(g);
            const attn = attnIds.has(g.id);
            return (
              <Row key={g.id} title={g.title}
                   meta={`${d.valueLine || 'No value yet'}${attn ? '  ·  needs attention' : ''}`}
                   tone={attn ? 'warn' : undefined}
                   onPress={() => router.push('/(tabs)/goals' as any)} />
            );
          })}
        </Section>
      ) : null}

      {/* My notices */}
      {notices.length > 0 && (
        <Section title="My notices" count={notices.length}>
          {notices.slice(0, 8).map(n => (
            <Row key={n.id} title={n.summary} meta="Tap to open · dismisses" onPress={() => openNotice(n)} />
          ))}
        </Section>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statNum, n > 0 && s.statNumActive]}>{n}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
        <View style={s.countBadge}><Text style={s.countText}>{count}</Text></View>
      </View>
      {children}
    </View>
  );
}
function Row({ title, meta, onPress, tone }: { title: string; meta: string; onPress: () => void; tone?: 'warn' }) {
  return (
    <Pressable style={[s.row, tone === 'warn' && s.rowWarn]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
        <Text style={[s.rowMeta, tone === 'warn' && s.rowMetaWarn]} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  intro:   { fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 18 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat:       { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingVertical: 12, alignItems: 'center' },
  statNum:    { fontSize: 22, fontWeight: '800', color: '#64748b' },
  statNumActive: { color: '#f8fafc' },
  statLabel:  { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  loadingText: { fontSize: 13, color: '#64748b' },

  section:       { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  countBadge:    { backgroundColor: '#334155', borderRadius: 9, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  countText:     { fontSize: 11, color: '#e2e8f0', fontWeight: '700' },

  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, gap: 8 },
  rowWarn:    { borderWidth: 1, borderColor: '#7c2d12' },
  rowTitle:   { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  rowMeta:    { fontSize: 12, color: '#64748b', marginTop: 1 },
  rowMetaWarn:{ color: '#fbbf24' },
  chevron:    { fontSize: 18, color: '#475569' },

  center:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
  emptyIcon:  { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#cbd5e1' },
  emptyText:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19 },
});
