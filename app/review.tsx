/**
 * app/review.tsx — Leadership Review Inbox / Command Center.
 *
 * One leadership-only place that aggregates REAL, actionable items from existing data:
 *   • weekly goal updates pending review (+ other tasks needing this viewer's review)
 *   • updates returned for changes
 *   • goals needing attention
 *   • meeting agendas to generate / finalize
 *   • recent important notices
 * No fake data: tasks/notices come from the live stores (reactive); goals/agendas from the
 * same services the other screens use. Aggregation is the pure lib/reviewInbox. Access is
 * leadership (Consul/Pro Consul) + Annotator; anyone else sees a harmless empty state.
 */

import {
  canAccessReviewInbox, pendingReviewTasks, returnedUpdateTasks, isGoalUpdateTask,
  agendaActionStatus, agendaNeedsAction, agendaActionLabel, reviewInboxCounts,
  type AgendaActionStatus,
} from '@/lib/reviewInbox';
import { getAllTasks, type MockTask } from '@/lib/mockTasks';
import { getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { getAllEvents } from '@/lib/eventStore';
import { getEventDate } from '@/lib/mockEvents';
import { listGoalsForOrgResult } from '@/lib/goalService';
import { goalsNeedingAttention, agendaGoalReasonLabel, type AgendaGoalItem } from '@/lib/agendaGoals';
import { getAgendaDocument } from '@/lib/agendaDocumentService';
import { getNoticesForRole, acknowledgeNotice, useUpdateNoticesVersion, type UpdateNotice } from '@/lib/updateNoticeStore';
import { ROLE_LABELS } from '@/lib/roles';
import { useDevRole } from '@/lib/devRoleStore';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface AgendaActionItem { eventId: string; title: string; status: AgendaActionStatus; }

export default function ReviewInboxScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const { role }   = useDevRole();
  const orgId      = useActiveDataOrgId();

  // Reactive: re-render on any task-state or notice change so counts stay live.
  useTaskStateVersion();
  useUpdateNoticesVersion();

  useEffect(() => { navigation.setOptions({ title: 'Review Inbox' }); }, [navigation]);

  const hasAccess = canAccessReviewInbox(role);

  // ── Live (sync) data ──
  const stateOf = (t: MockTask) => getStoredState(t.id, t.state);
  const allTasks = hasAccess ? getAllTasks() : [];
  const pending  = pendingReviewTasks(allTasks, role, stateOf);
  const updateReviews = pending.filter(isGoalUpdateTask);
  const otherReviews  = pending.filter(t => !isGoalUpdateTask(t));
  const returned = returnedUpdateTasks(allTasks, role, stateOf);
  const notices  = hasAccess ? getNoticesForRole(role) : [];

  // ── Async data (goals + agendas) ──
  const [goalsAttn, setGoalsAttn] = useState<AgendaGoalItem[]>([]);
  const [agendas, setAgendas]     = useState<AgendaActionItem[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!hasAccess) { setLoading(false); return; }
    setLoading(true);

    // Goals needing attention (leadership-readable org goals).
    let attn: AgendaGoalItem[] = [];
    if (orgId) {
      const gr = await listGoalsForOrgResult(orgId);
      if (gr.ok) attn = goalsNeedingAttention(gr.goals);
    }

    // Meeting agendas that still need action (generate or finalize).
    const meetings = getAllEvents().filter(e => e.kind === 'chapter' || e.kind === 'eboard');
    const docs = await Promise.all(meetings.map(async m => {
      const res = await getAgendaDocument(m.id);
      return { eventId: m.id, title: m.title, status: agendaActionStatus(res.document) };
    }));
    const needAction = docs.filter(d => agendaNeedsAction(d.status));

    setGoalsAttn(attn);
    setAgendas(needAction);
    setLoading(false);
  }, [hasAccess, orgId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = reviewInboxCounts({
    pendingReview:         pending.length,
    returnedUpdates:       returned.length,
    goalsNeedingAttention: goalsAttn.length,
    agendasToPrepare:      agendas.length,
    recentNotices:         notices.length,
  });

  function openTask(t: MockTask) { router.push(`/task/${t.id}` as any); }
  function openNotice(n: UpdateNotice) {
    acknowledgeNotice(n.id, role);
    if (n.entityType === 'task')  router.push(`/task/${n.entityId}` as any);
    else if (n.entityType === 'event') router.push(`/event/${n.entityId}` as any);
    else if (n.entityType === 'goal')  router.push('/(tabs)/goals' as any);
  }

  if (!hasAccess) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>🔒</Text>
        <Text style={s.emptyTitle}>No leadership actions</Text>
        <Text style={s.emptyText}>The Review Inbox is for Consul, Pro Consul, and the Annotator.</Text>
      </View>
    );
  }

  const nothingActionable = counts.actionable === 0 && notices.length === 0;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.intro}>Everything that needs leadership attention, in one place.</Text>

      {/* Summary counts */}
      <View style={s.summaryRow}>
        <Stat n={counts.pendingReview} label="To review" />
        <Stat n={counts.goalsNeedingAttention} label="Goals" />
        <Stat n={counts.agendasToPrepare} label="Agendas" />
        <Stat n={counts.returnedUpdates} label="Returned" />
      </View>

      {loading && agendas.length === 0 && goalsAttn.length === 0 ? (
        <View style={s.loadingRow}><ActivityIndicator color="#6366f1" /><Text style={s.loadingText}>Loading…</Text></View>
      ) : null}

      {nothingActionable && !loading ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTitle}>All clear</Text>
          <Text style={s.emptyText}>Nothing needs your attention right now.</Text>
        </View>
      ) : null}

      {/* Updates pending review */}
      {updateReviews.length > 0 && (
        <Section title="Updates pending review" count={updateReviews.length}>
          {updateReviews.map(t => (
            <Row key={t.id} title={t.assignedTo || ROLE_LABELS[t.assignedRole as keyof typeof ROLE_LABELS] || 'Officer'}
                 meta="Weekly goal update — tap to review" onPress={() => openTask(t)} />
          ))}
        </Section>
      )}

      {/* Other tasks needing review */}
      {otherReviews.length > 0 && (
        <Section title="Tasks needing review" count={otherReviews.length}>
          {otherReviews.map(t => (
            <Row key={t.id} title={t.title} meta={`${t.assignedTo || ''} — tap to review`} onPress={() => openTask(t)} />
          ))}
        </Section>
      )}

      {/* Returned updates */}
      {returned.length > 0 && (
        <Section title="Returned for changes" count={returned.length}>
          {returned.map(t => (
            <Row key={t.id} title={t.assignedTo || 'Officer'} meta="Awaiting the officer's revision" onPress={() => openTask(t)} />
          ))}
        </Section>
      )}

      {/* Goals needing attention */}
      {goalsAttn.length > 0 && (
        <Section title="Goals needing attention" count={goalsAttn.length}>
          {goalsAttn.map(g => (
            <Row key={g.goalId} title={g.title}
                 meta={`${agendaGoalReasonLabel(g.reason)}${g.ownerRole ? ' · ' + (ROLE_LABELS[g.ownerRole as keyof typeof ROLE_LABELS] ?? g.ownerRole) : ''}`}
                 onPress={() => router.push('/(tabs)/goals' as any)} />
          ))}
        </Section>
      )}

      {/* Agendas to prepare / finalize */}
      {agendas.length > 0 && (
        <Section title="Meeting agendas" count={agendas.length}>
          {agendas.map(a => (
            <Row key={a.eventId} title={a.title} meta={agendaActionLabel(a.status)}
                 onPress={() => router.push(`/agenda/${a.eventId}` as any)} />
          ))}
        </Section>
      )}

      {/* Recent notices */}
      {notices.length > 0 && (
        <Section title="Recent notices" count={notices.length}>
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

function Row({ title, meta, onPress }: { title: string; meta: string; onPress: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text>
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

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  rowMeta:  { fontSize: 12, color: '#64748b', marginTop: 1 },
  chevron:  { fontSize: 18, color: '#475569' },

  center:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 8 },
  emptyIcon:  { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#cbd5e1' },
  emptyText:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19 },
});
