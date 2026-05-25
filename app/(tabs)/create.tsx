/**
 * app/(tabs)/create.tsx — the "Create" tab (prototype).
 * One place to add anything: events, tasks, polls, announcements, groups. Routes
 * to the real create screens where they exist (events/tasks) and to prototype
 * screens for the rest. Officer-gated. UI/mock; feature branch (not in alpha).
 */

import { useDevRole } from '@/lib/devRoleStore';
import { isOfficer } from '@/lib/roles';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface CreateOption { icon: string; title: string; sub: string; route: string; experiment?: boolean }

const OPTIONS: CreateOption[] = [
  { icon: '📅', title: 'Event',              sub: 'Meeting, social, philanthropy — with auto-agenda/RSVP options', route: '/event/create' },
  { icon: '✅', title: 'Task',               sub: 'Assign work to a role or member',                               route: '/task/create' },
  { icon: '📣', title: 'Announcement',       sub: 'Chapter-wide notice',                  route: '/announcements', experiment: true },
  { icon: '📊', title: 'Poll',               sub: 'Quick chapter vote',                   route: '/poll',          experiment: true },
  { icon: '👥', title: 'Group / committee',  sub: 'A committee with its own members',     route: '/committee',     experiment: true },
];

export default function CreateScreen() {
  const router   = useRouter();
  const { role } = useDevRole();
  const officer  = isOfficer(role);

  if (!officer) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.emptyIcon}>＋</Text>
        <Text style={s.emptyTitle}>Officers create things</Text>
        <Text style={s.emptyText}>Events, tasks, and notices are created by officers. Ask an officer if you need something added.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.heading}>Create</Text>
      <Text style={s.sub}>Everything in ChapterOPS is an event or a task — start here.</Text>

      <Text style={s.sectionLabel}>CORE</Text>
      {OPTIONS.filter(o => !o.experiment).map(o => (
        <Pressable key={o.route} style={s.card} onPress={() => router.push(o.route as any)}>
          <Text style={s.icon}>{o.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{o.title}</Text>
            <Text style={s.cardSub}>{o.sub}</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ))}

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>MORE (PROTOTYPE)</Text>
      {OPTIONS.filter(o => o.experiment).map(o => (
        <Pressable key={o.route} style={s.card} onPress={() => router.push(o.route as any)}>
          <Text style={s.icon}>{o.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{o.title}</Text>
            <Text style={s.cardSub}>{o.sub}</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ))}

      <Text style={s.footNote}>Polls / announcements / groups are early prototypes; events & tasks are the real, core flows.</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  center:  { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },

  heading: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  icon:      { fontSize: 22 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  cardSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  chev:      { fontSize: 22, color: '#475569' },

  emptyIcon:  { fontSize: 40, color: '#334155' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptyText:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
