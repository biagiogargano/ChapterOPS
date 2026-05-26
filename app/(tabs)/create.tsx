/**
 * app/(tabs)/create.tsx — the "Create" tab (prototype).
 * Two tiers: CORE (Event, Task) are the real, primary actions and get full-
 * strength tiles; "Coming later" (Announcement, Group) are lighter, dimmed
 * prototype tiles so they read as future/secondary. (A poll isn't its own thing —
 * it's just a task template, a one-question task; create it from the Task flow.)
 * Officer-gated. UI/mock; feature branch (not in alpha).
 */

import { useDevRole } from '@/lib/devRoleStore';
import { isOfficer } from '@/lib/roles';
import { ENTITY_COLORS } from '@/lib/ui/entityColors';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface CreateTile { icon: string; title: string; sub: string; route: string; accent: string }

// CORE — the real, primary things an officer creates.
const CORE_TILES: CreateTile[] = [
  { icon: '📅', title: 'Event', sub: 'Meeting, social, philanthropy — with agenda/RSVP options', route: '/event/create', accent: ENTITY_COLORS.event },
  { icon: '✅', title: 'Task',  sub: 'Assign work to a role or member',                          route: '/task/create',  accent: ENTITY_COLORS.task },
];

// COMING LATER — lighter prototype concepts, deliberately de-emphasized. Note:
// there is no standalone "Announcements" feature — comms are action-linked. A
// "Notice" is an update tied to an event/task, or an org notice only when it
// truly belongs to neither (see backlog #9).
const LATER_TILES: CreateTile[] = [
  { icon: '📣', title: 'Notice / Update', sub: 'An update on an event or task — or an org-wide notice. Not a feed or chat.', route: '/announcements', accent: ENTITY_COLORS.announcement },
  { icon: '👥', title: 'Group',           sub: 'Loosely group members (early — not a full org system)',                    route: '/committee',     accent: ENTITY_COLORS.group },
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

      {/* CORE — full-strength primary tiles */}
      <View style={s.grid}>
        {CORE_TILES.map(t => (
          <Pressable key={t.route} style={s.tile} onPress={() => router.push(t.route as any)}>
            <View style={[s.tileAccent, { backgroundColor: t.accent }]} />
            <Text style={s.tileIcon}>{t.icon}</Text>
            <Text style={s.tileTitle}>{t.title}</Text>
            <Text style={s.tileSub}>{t.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* COMING LATER — dimmed, dashed prototype tiles */}
      <Text style={s.laterLabel}>COMING LATER</Text>
      <View style={s.grid}>
        {LATER_TILES.map(t => (
          <Pressable key={t.route} style={[s.tile, s.tileLater]} onPress={() => router.push(t.route as any)}>
            <Text style={[s.tileIcon, s.tileIconLater]}>{t.icon}</Text>
            <Text style={[s.tileTitle, s.tileTitleLater]}>{t.title}</Text>
            <Text style={s.tileSub}>{t.sub}</Text>
            <Text style={s.tileProto}>PROTOTYPE</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.footNote}>Event and Task are the real, core flows. Notices/updates and Groups are early prototypes coming later — there's no standalone announcements feed; comms are tied to an event, task, or org notice. A poll is just a task template — make one from Task.</Text>
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

  // 2×2 grid (rendered as two 2-up rows)
  grid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: {
    width: '48%', minHeight: 132, backgroundColor: '#1e293b', borderRadius: 16,
    padding: 16, overflow: 'hidden', justifyContent: 'flex-start',
  },
  tileAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  tileIcon:   { fontSize: 28, marginTop: 6, marginBottom: 10 },
  tileTitle:  { fontSize: 17, fontWeight: '800', color: '#f1f5f9' },
  tileSub:    { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 },

  // "Coming later" treatment — dimmer fill, dashed border, no accent bar, muted text
  laterLabel:    { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 0.8, marginTop: 26, marginBottom: 12 },
  tileLater:     { backgroundColor: '#15202e', borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', minHeight: 120, opacity: 0.92 },
  tileIconLater: { opacity: 0.65 },
  tileTitleLater:{ color: '#cbd5e1', fontWeight: '700' },
  tileProto:     { fontSize: 9, fontWeight: '700', color: '#64748b', letterSpacing: 0.6, marginTop: 8 },

  emptyIcon:  { fontSize: 40, color: '#334155' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  emptyText:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
