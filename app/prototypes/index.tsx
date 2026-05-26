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

// Prototypes are tiered by product direction, not just theme:
//   CORE  = the real direction (events/tasks model)
//   LATER = planned, not built yet
//   EXPERIMENTS = deferred; kept to explore, must be reframed to fit the model
//   ARCHIVE = cut / not building soon (off the events-and-tasks path)
const GROUPS: Group[] = [
  {
    label: 'CORE · onboarding & structure',
    items: [
      { title: '🚀 Welcome tour',       sub: 'Annotated click-through → flows into setup',             route: '/tutorial' },
      { title: 'Org setup wizard',      sub: 'Roles-first: org type → roles & tiers → invite',         route: '/setup' },
      { title: 'Org type / templates',  sub: 'Pick org type → default roles/events/report',            route: '/setup/org-type' },
      { title: 'Invite link + join form', sub: 'Invite-link-first; configure join questions',           route: '/setup/invite-link' },
      { title: 'Join via link (joiner)', sub: 'The self-join form people fill out',                     route: '/join' },
      { title: 'Add people manually (fallback)', sub: 'Type a few people in by hand',                  route: '/setup/invite-people' },
      { title: 'Invitation (invitee)',  sub: 'What someone sees when invited',                          route: '/invite' },
      { title: 'Org structure (tiers)', sub: 'Members by tier · selectable · owner edits lines',        route: '/setup/tree' },
      { title: 'Members roster',        sub: 'Browse/search · assign positions',                        route: '/roster' },
      { title: 'Org settings',          sub: 'Rename · transfer ownership · configure',                 route: '/org-settings' },
    ],
  },
  {
    label: 'CORE · events, tasks & reports',
    items: [
      { title: 'Event automation defaults', sub: 'Per-type: what an event auto-creates',    route: '/event-defaults' },
      { title: 'RSVP settings',    sub: 'Required RSVP on optional events (event-linked)',   route: '/rsvp-optional' },
      { title: 'Attendance (as tasks)', sub: 'Event-linked attendance tasks',                route: '/attendance' },
      { title: 'Attendance check-in', sub: "Mark who's present at an event",                 route: '/checkin' },
      { title: 'Availability picker', sub: 'Generated time-slots for scheduling',            route: '/availability' },
      { title: 'Weekly report',     sub: 'Structured-response task (Weekly Officer Report)', route: '/report/weekly' },
      { title: 'Reports review',    sub: 'Who submitted / who is missing',                   route: '/report/inbox' },
      { title: 'Report detail',     sub: 'Read a submitted report (read-only)',              route: '/report/detail' },
      { title: 'Meeting agenda',    sub: "Derived from this week's events/tasks",            route: '/agenda' },
    ],
  },
  {
    // Planned and on-model, but the real version needs the schema phase.
    label: 'LATER ROADMAP (planned, not built)',
    items: [
      { title: 'Teams / committees', sub: 'Lightweight group under a role for assignment & visibility (backlog #11)', route: '/committee' },
      { title: 'Delegate a task',    sub: 'Reassign down to a team member',                  route: '/delegate' },
    ],
  },
  {
    // Deferred; kept to explore. Each must be reframed to fit events/tasks before
    // it could become core (see copy).
    label: 'EXPERIMENTS · deferred',
    items: [
      { title: 'Announcements',  sub: 'FUTURE: action-linked notice tied to an event/task — NOT a chat feed', route: '/announcements' },
      { title: 'Quick poll',     sub: 'A poll = a one-question task template, not a standalone feature',       route: '/poll' },
    ],
  },
  {
    // Off the events-and-tasks path. Not building soon — listed so the ideas
    // aren't lost. (No-screen cut ideas noted below the list.)
    label: 'ARCHIVE · cut / not building soon',
    items: [
      { title: 'Points & leaderboard', sub: 'Gamification — not core',           route: '/points' },
      { title: 'Pinned tab',           sub: 'Custom quick-access tab — deferred', route: '/pinned' },
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
      <Text style={s.sub}>Tiered by direction: CORE (the real model) · LATER (planned) · EXPERIMENTS (deferred) · ARCHIVE (cut). All mock — nothing is saved or live.</Text>

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

      <Text style={s.archiveNote}>
        Also archived (no screen — ideas kept, not building soon): full permissions
        grid · full org-tree builder (superseded by tiers) · general chat / messaging
        (comms are action-linked only) · generic surveys/quizzes as a standalone
        system · AI · complex per-committee customization.
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

  heading: { fontSize: 26, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20, lineHeight: 18 },

  group:      { marginBottom: 18 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },

  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  chevron:   { fontSize: 22, color: '#475569' },

  archiveNote: { fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 6 },
});
