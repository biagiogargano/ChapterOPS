/**
 * app/prototypes/index.tsx — central hub for all dev-only feature prototypes.
 * PROTOTYPE ONLY. One tidy place to open every mock prototype built on the
 * feature branch, grouped by theme. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Item { title: string; sub: string; route: string }
interface Group { label: string; items: Item[] }

const GROUPS: Group[] = [
  {
    // ONE intro experience — the guided tour flows into the setup wizard
    // (org type → roles & tiers → invite). The individual steps below are reached
    // inside that flow, not as separate competing prototypes.
    label: 'GET STARTED',
    items: [
      { title: '🚀 Full intro & setup', sub: 'Guided click-through tour → org type → roles & tiers → invite. The whole first-run in one flow.', route: '/tutorial' },
    ],
  },
  {
    label: 'PEOPLE & STRUCTURE',
    items: [
      { title: 'Org structure (tiers)', sub: 'Tap members by tier; owner edits reporting lines', route: '/setup/tree' },
      { title: 'My committee',     sub: "Your group's members, events, and tasks",     route: '/committee' },
      { title: 'Members roster',   sub: 'Browse/search people · assign positions',     route: '/roster' },
    ],
  },
  {
    label: 'REPORTS & MEETINGS',
    items: [
      { title: 'Weekly report',     sub: 'Fill out & submit a questionnaire report', route: '/report/weekly' },
      { title: 'Reports review',    sub: 'Annotator view: who submitted / missing',  route: '/report/inbox' },
      { title: 'Report detail',     sub: 'Read a submitted report (read-only)',       route: '/report/detail' },
      { title: 'Meeting agenda',    sub: "Auto-drafted from this week's events/tasks", route: '/agenda' },
    ],
  },
  {
    label: 'EVENTS',
    items: [
      { title: 'Event automation defaults', sub: 'Per-type: agenda/attendance/RSVP rules', route: '/event-defaults' },
      { title: 'RSVP settings',    sub: 'Required RSVP on optional events (decoupled)', route: '/rsvp-optional' },
      { title: 'Attendance (as tasks)', sub: 'Annotator tasks tied to mandatory meetings', route: '/attendance' },
      { title: 'Attendance check-in', sub: "Mark who's present at an event",            route: '/checkin' },
      { title: 'Availability picker', sub: 'Generated time-slots for scheduling',        route: '/availability' },
    ],
  },
  {
    // Per triage: NOT on the near-term roadmap. Kept as experiments only so we
    // don't lose the idea — they don't fit the core events/tasks model.
    label: 'EXPERIMENTS · deferred (not roadmap)',
    items: [
      { title: 'Announcements',        sub: 'Chapter notices feed + post',          route: '/announcements' },
      { title: 'Quick poll',           sub: 'Lightweight chapter vote',             route: '/poll' },
      { title: 'Points & leaderboard', sub: 'Participation points and rankings',    route: '/points' },
      { title: 'Pinned tab',           sub: 'Customizable quick-access shortcuts',  route: '/pinned' },
    ],
  },
];

export default function PrototypesHub() {
  const navigation = useNavigation();
  const router     = useRouter();
  useEffect(() => { navigation.setOptions({ title: 'Prototypes' }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>DEV · feature-branch prototypes (mock, not in alpha)</Text></View>
      <Text style={s.heading}>Prototypes</Text>
      <Text style={s.sub}>Early looks at where the app is headed. All mock data — nothing here is saved or live.</Text>

      {GROUPS.map(g => (
        <View key={g.label} style={s.group}>
          <Text style={s.groupLabel}>{g.label}</Text>
          {g.items.map(it => (
            <Pressable key={it.route} style={s.card} onPress={() => router.push(it.route as any)}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{it.title}</Text>
                <Text style={s.cardSub}>{it.sub}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 26, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20, lineHeight: 18 },

  group:      { marginBottom: 18 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },

  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  chevron:   { fontSize: 22, color: '#475569' },
});
