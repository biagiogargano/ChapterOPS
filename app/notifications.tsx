import { useDevRole } from '@/lib/devRoleStore';
import { findEventById } from '@/lib/eventStore';
import { findTaskById } from '@/lib/mockTasks';
import {
  acknowledgeNotice,
  getNoticesForRole,
  useUpdateNoticesVersion,
  type UpdateNotice,
  type UpdateSeverity,
} from '@/lib/updateNoticeStore';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// ─── Notice card (moved here from the Today body) ─────────────────────────────

const NOTICE_CFG: Record<UpdateSeverity, { color: string; bg: string; stripe: string }> = {
  critical: { color: '#fca5a5', bg: '#1a0505', stripe: '#dc2626' },
  moderate: { color: '#fbbf24', bg: '#1c1407', stripe: '#d97706' },
  low:      { color: '#94a3b8', bg: '#1e293b', stripe: '#334155' },
};

function NoticeCard({ notice, onPress }: { notice: UpdateNotice; onPress: () => void }) {
  const cfg = NOTICE_CFG[notice.severity];
  return (
    <Pressable style={[s.card, { backgroundColor: cfg.bg }]} onPress={onPress}>
      <View style={[s.stripe, { backgroundColor: cfg.stripe }]} />
      <View style={s.body}>
        <Text style={[s.text, { color: cfg.color }]} numberOfLines={3}>{notice.summary}</Text>
        <Text style={s.hint}>Tap to view · dismisses</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }   = useDevRole();

  // Reactive: re-render whenever any notice changes (emit / acknowledge / expiry).
  useUpdateNoticesVersion();
  const notices = getNoticesForRole(role);

  useEffect(() => {
    navigation.setOptions({ title: 'Notifications' });
  }, [navigation]);

  // Same behavior the Today UPDATES section used: acknowledge (dismiss for this
  // role), then navigate to the related entity when it still exists. If the
  // entity is gone (cancelled), the acknowledgement drops the card reactively.
  function handlePress(n: UpdateNotice) {
    acknowledgeNotice(n.id, role);
    if (n.entityType === 'task' && findTaskById(n.entityId)) {
      router.push(`/task/${n.entityId}` as any);
    } else if (n.entityType === 'event' && findEventById(n.entityId)) {
      router.push(`/event/${n.entityId}` as any);
    } else if (n.entityType === 'goal') {
      // No per-goal detail route yet — open the Goals tab (safe; the goal is listed
      // there). Dismissal already happened above.
      router.push('/(tabs)/goals' as any);
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {notices.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✓</Text>
          <Text style={s.emptyTitle}>No notifications</Text>
          <Text style={s.emptyText}>You're all caught up.</Text>
        </View>
      ) : (
        notices.map(n => <NoticeCard key={n.id} notice={n} onPress={() => handlePress(n)} />)
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  card:    { flexDirection: 'row', alignItems: 'stretch', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  stripe:  { width: 4 },
  body:    { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  text:    { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  hint:    { fontSize: 11, color: '#64748b' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon:  { fontSize: 28, color: '#22c55e' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#cbd5e1' },
  emptyText:  { fontSize: 13, color: '#64748b' },
});
