/**
 * app/invite/index.tsx — invitation accept/decline prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md).
 *
 * ⚠️ MOCK / NON-FUNCTIONAL. Shows what an invited person sees: who invited them,
 * to what role/committee, and what accepting unlocks. No real invite/membership
 * writes, no auth. Dev-only; not linked from phase-2, not wired into the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// A sample invite (in the real app this comes from a link/code or notification).
const INVITE = {
  org:      'Sigma Chi — Beta Chapter',
  fromName: 'Peter (Consul)',
  role:     'Social Chair',
  committee:'Social Committee',
  perks: [
    'See your committee’s events, tasks, and reports',
    'Get tasks delegated to you by your committee lead',
    'Invite members to your own committee once you’re in',
  ],
};

type State = 'pending' | 'accepted' | 'declined';

export default function InviteScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [state, setState] = useState<State>('pending');

  useEffect(() => { navigation.setOptions({ title: 'Invitation' }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock invite, nothing saved</Text></View>

      <View style={s.envelope}><Text style={s.envelopeIcon}>✉️</Text></View>

      <Text style={s.heading}>You’re invited</Text>
      <Text style={s.line}>
        <Text style={s.bold}>{INVITE.fromName}</Text> invited you to join{'\n'}
        <Text style={s.bold}>{INVITE.org}</Text>
      </Text>

      <View style={s.roleCard}>
        <Text style={s.roleLabel}>ROLE</Text>
        <Text style={s.roleName}>{INVITE.role}</Text>
        <Text style={s.committee}>{INVITE.committee}</Text>
      </View>

      <Text style={s.perksLabel}>WHAT YOU’LL GET</Text>
      {INVITE.perks.map((p, i) => (
        <View key={i} style={s.perkRow}>
          <Text style={s.perkTick}>✓</Text>
          <Text style={s.perkText}>{p}</Text>
        </View>
      ))}

      {state === 'pending' && (
        <View style={s.actions}>
          <Pressable style={s.declineBtn} onPress={() => setState('declined')}>
            <Text style={s.declineText}>Decline</Text>
          </Pressable>
          <Pressable style={s.acceptBtn} onPress={() => setState('accepted')}>
            <Text style={s.acceptText}>Accept & join</Text>
          </Pressable>
        </View>
      )}

      {state === 'accepted' && (
        <View style={[s.result, s.resultOk]}>
          <Text style={s.resultOkText}>
            🎉 You’ve joined {INVITE.org} as {INVITE.role}. Your committee’s stuff now
            shows up across the app. (Prototype — nothing saved.)
          </Text>
          <Pressable style={s.doneBtn} onPress={() => router.back()}><Text style={s.doneText}>Done</Text></Pressable>
        </View>
      )}

      {state === 'declined' && (
        <View style={[s.result, s.resultNo]}>
          <Text style={s.resultNoText}>Invitation declined. (Prototype — nothing saved.)</Text>
          <Pressable style={s.doneBtn} onPress={() => setState('pending')}><Text style={s.doneText}>Undo</Text></Pressable>
        </View>
      )}

      <Text style={s.footNote}>
        In the real app this opens from an invite link/code or a notification, and
        accepting wires up your role + committee visibility in one step.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 20, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  envelope:     { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  envelopeIcon: { fontSize: 30 },

  heading: { fontSize: 26, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  line:    { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginTop: 8, marginBottom: 20 },
  bold:    { fontWeight: '700', color: '#f1f5f9' },

  roleCard:  { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 22, borderWidth: 1, borderColor: '#312e81' },
  roleLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  roleName:  { fontSize: 20, fontWeight: '800', color: '#a5b4fc', marginTop: 4 },
  committee: { fontSize: 13, color: '#64748b', marginTop: 2 },

  perksLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },
  perkRow:    { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  perkTick:   { color: '#4ade80', fontSize: 14, fontWeight: '800', marginTop: 1 },
  perkText:   { flex: 1, fontSize: 14, color: '#cbd5e1', lineHeight: 19 },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 22 },
  declineBtn: { flex: 1, backgroundColor: '#1e293b', borderRadius: 11, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  declineText:{ color: '#94a3b8', fontWeight: '600', fontSize: 15 },
  acceptBtn:  { flex: 2, backgroundColor: '#052e16', borderRadius: 11, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#166534' },
  acceptText: { color: '#4ade80', fontWeight: '700', fontSize: 15 },

  result:      { marginTop: 22, borderRadius: 12, padding: 16, gap: 12 },
  resultOk:    { backgroundColor: '#052e16', borderWidth: 1, borderColor: '#166534' },
  resultOkText:{ color: '#86efac', fontSize: 14, lineHeight: 20 },
  resultNo:    { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  resultNoText:{ color: '#94a3b8', fontSize: 14 },
  doneBtn:     { alignSelf: 'flex-start', backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155' },
  doneText:    { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
