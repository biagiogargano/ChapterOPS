/**
 * app/attendance/index.tsx — Annotator's attendance tasks (prototype).
 * PROTOTYPE. Shows attendance as TASKS tied to mandatory meetings (not a
 * standalone mode): each qualifying event yields an Annotator task that opens
 * when the event starts and is due ~1h after it ends. Open ones launch the
 * check-in roster. Read-only derivation from mock events; nothing saved.
 */

import { getAllEvents } from '@/lib/eventStore';
import {
  ATTENDANCE_OWNER_ROLE,
  deriveAttendanceTasks,
  type AttendanceStatus,
} from '@/lib/attendance/mockAttendanceTasks';
import { ROLE_LABELS } from '@/lib/roles';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; fg: string; label: string }> = {
  open:      { bg: '#052e16', fg: '#4ade80', label: 'Open' },
  scheduled: { bg: '#0f172a', fg: '#94a3b8', label: 'Scheduled' },
  overdue:   { bg: '#1a0505', fg: '#f87171', label: 'Overdue' },
};

export default function AttendanceTasksScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useEffect(() => { navigation.setOptions({ title: 'Attendance tasks' }); }, [navigation]);

  const todayOffset = (new Date().getDay() + 6) % 7;
  const tasks = deriveAttendanceTasks(getAllEvents(), todayOffset);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · attendance-as-tasks, derived from events</Text></View>

      <Text style={s.heading}>Attendance</Text>
      <Text style={s.sub}>
        Owned by the {ROLE_LABELS[ATTENDANCE_OWNER_ROLE]}. One task per mandatory
        meeting — opens when it starts, due ~1h after it ends.
      </Text>

      {tasks.length === 0 ? (
        <View style={s.emptyBox}><Text style={s.emptyText}>No mandatory meetings this week.</Text></View>
      ) : (
        tasks.map(t => {
          const cfg = STATUS_STYLE[t.status];
          const tappable = t.status !== 'scheduled';
          return (
            <Pressable
              key={t.id}
              style={[s.card, t.status === 'open' && s.cardOpen, t.status === 'overdue' && s.cardOverdue]}
              onPress={() => tappable && router.push('/checkin' as any)}
              disabled={!tappable}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Take attendance — {t.eventTitle}</Text>
                <Text style={s.window}>{t.windowLabel}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                <Text style={[s.badgeText, { color: cfg.fg }]}>{cfg.label}{tappable ? ' ›' : ''}</Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={s.footNote}>
        These would appear on the Annotator's Today/Tasks like any prep task — same
        engine, just event-driven open/due timing. Real generation comes with the
        task-engine phase.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  emptyBox:  { backgroundColor: '#0a1628', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 16 },
  emptyText: { fontSize: 13, color: '#64748b' },

  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  cardOpen:    { borderColor: '#166534' },
  cardOverdue: { borderColor: '#7f1d1d' },
  title:       { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  window:      { fontSize: 12, color: '#64748b', marginTop: 3 },
  badge:       { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '700' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
