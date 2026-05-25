/**
 * app/(tabs)/create.tsx — the "Create" tab (prototype).
 * One place to add anything. Four core quadrants (Event, Task, Poll,
 * Announcement) shown as a 2×2 grid rather than a list. Poll is just a
 * structured-response task to all brothers (see PRODUCT_DIRECTION.md). Routes to
 * the real create screens where they exist (events/tasks) and to prototype
 * screens for the rest. Officer-gated. UI/mock; feature branch (not in alpha).
 */

import { useDevRole } from '@/lib/devRoleStore';
import { isOfficer } from '@/lib/roles';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface CreateTile { icon: string; title: string; sub: string; route: string; accent: string; experiment?: boolean }

// Four quadrants — the things an officer creates. Poll = a question to all
// brothers (a structured-response task), not a separate module.
const TILES: CreateTile[] = [
  { icon: '📅', title: 'Event',        sub: 'Meeting, social, philanthropy — with agenda/RSVP options', route: '/event/create', accent: '#6366f1' },
  { icon: '✅', title: 'Task',         sub: 'Assign work to a role or member',                          route: '/task/create',  accent: '#22c55e' },
  { icon: '📊', title: 'Poll',         sub: 'Ask all brothers one question',                            route: '/poll',         accent: '#0ea5e9', experiment: true },
  { icon: '📣', title: 'Announcement', sub: 'Chapter-wide notice',                                      route: '/announcements',accent: '#f59e0b', experiment: true },
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

      {/* 2×2 quadrant grid */}
      <View style={s.grid}>
        {TILES.map(t => (
          <Pressable key={t.route} style={s.tile} onPress={() => router.push(t.route as any)}>
            <View style={[s.tileAccent, { backgroundColor: t.accent }]} />
            <Text style={s.tileIcon}>{t.icon}</Text>
            <Text style={s.tileTitle}>{t.title}</Text>
            <Text style={s.tileSub}>{t.sub}</Text>
            {t.experiment && <Text style={s.tileProto}>PROTOTYPE</Text>}
          </Pressable>
        ))}
      </View>

      <Pressable style={s.moreLink} onPress={() => router.push('/committee' as any)}>
        <Text style={s.moreLinkText}>Group / committee  ›</Text>
      </Pressable>

      <Text style={s.footNote}>Polls / announcements / groups are early prototypes; events & tasks are the real, core flows. A poll is just a task that asks every brother one question.</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  center:  { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },

  heading: { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 22 },

  // 2×2 grid
  grid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: {
    width: '48%', minHeight: 132, backgroundColor: '#1e293b', borderRadius: 16,
    padding: 16, overflow: 'hidden', justifyContent: 'flex-start',
  },
  tileAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  tileIcon:   { fontSize: 28, marginTop: 6, marginBottom: 10 },
  tileTitle:  { fontSize: 17, fontWeight: '800', color: '#f1f5f9' },
  tileSub:    { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 },
  tileProto:  { fontSize: 9, fontWeight: '700', color: '#fbbf24', letterSpacing: 0.5, marginTop: 8 },

  moreLink:     { marginTop: 18, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  moreLinkText: { fontSize: 14, fontWeight: '600', color: '#818cf8' },

  emptyIcon:  { fontSize: 40, color: '#334155' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptyText:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
