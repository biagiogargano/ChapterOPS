/**
 * app/committee/index.tsx — "My committee" group-home prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md — the "see your group's
 * relevant info" payoff of joining a committee).
 *
 * Shows what a committee member sees once they've joined: who's on the committee,
 * the group's upcoming events/tasks, and a quick "invite to my committee" action
 * (mock). Static demo data, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const COMMITTEE = {
  name: 'Social Committee',
  lead: 'Social Chair',
  members: [
    { name: 'Alex R.',  role: 'Social Chair', lead: true },
    { name: 'Jordan P.', role: 'Member' },
    { name: 'Sam D.',    role: 'Member' },
    { name: 'Chris L.',  role: 'Member' },
  ],
  events: [
    { title: 'Formal venue walkthrough', meta: 'Fri · 4:00 PM · The Vue' },
    { title: 'Mixer planning sync',      meta: 'Sun · 7:00 PM · Chapter room' },
  ],
  tasks: [
    { title: 'Confirm catering headcount', meta: 'Due Thu' },
    { title: 'Collect formal deposits',    meta: 'Due Sat' },
  ],
};

export default function CommitteeScreen() {
  const navigation = useNavigation();
  useEffect(() => { navigation.setOptions({ title: COMMITTEE.name }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · sample committee</Text></View>

      <Text style={s.heading}>{COMMITTEE.name}</Text>
      <Text style={s.sub}>Led by {COMMITTEE.lead} · {COMMITTEE.members.length} members</Text>

      <Text style={s.sectionLabel}>MEMBERS</Text>
      {COMMITTEE.members.map((m, i) => (
        <View key={i} style={s.memberRow}>
          <View style={s.avatar}><Text style={s.avatarText}>{m.name.split(' ').map(p => p[0]).join('')}</Text></View>
          <View style={s.memberBody}>
            <Text style={s.memberName}>{m.name}</Text>
            <Text style={s.memberRole}>{m.role}</Text>
          </View>
          {m.lead && <View style={s.leadBadge}><Text style={s.leadText}>Lead</Text></View>}
        </View>
      ))}

      <Pressable style={s.inviteBtn} onPress={() => Alert.alert('Invite (prototype)', 'You’d invite someone to the Social Committee here. They accept, then you can delegate to them.')}>
        <Text style={s.inviteText}>+ Invite to my committee</Text>
      </Pressable>

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>COMMITTEE EVENTS</Text>
      {COMMITTEE.events.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={[s.dot, { backgroundColor: '#818cf8' }]} />
          <View style={s.itemBody}><Text style={s.itemTitle}>{e.title}</Text><Text style={s.itemMeta}>{e.meta}</Text></View>
        </View>
      ))}

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>COMMITTEE TASKS</Text>
      {COMMITTEE.tasks.map((t, i) => (
        <View key={i} style={s.item}>
          <View style={[s.dot, { backgroundColor: '#fbbf24' }]} />
          <View style={s.itemBody}><Text style={s.itemTitle}>{t.title}</Text><Text style={s.itemMeta}>{t.meta}</Text></View>
        </View>
      ))}

      <Text style={s.footNote}>
        This is the "see your group's relevant info" payoff of joining a committee —
        scoped to your group. Real data + membership comes with the auth/schema phase.
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 22 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  memberRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  memberBody: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  memberRole: { fontSize: 12, color: '#64748b' },
  leadBadge:  { backgroundColor: '#312e81', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  leadText:   { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },

  inviteBtn:  { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#1e3a5f', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3b82f6' },
  inviteText: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },

  item:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8 },
  dot:       { width: 7, height: 7, borderRadius: 4 },
  itemBody:  { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  itemMeta:  { fontSize: 12, color: '#64748b', marginTop: 1 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
