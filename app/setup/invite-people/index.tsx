/**
 * app/setup/invite-people/index.tsx — invite people before building the tree.
 * PROTOTYPE / mock. Add people by name + email + position; they form your roster,
 * which the tree builder then places into the hierarchy. No real invites sent,
 * nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { addInvite, getInvited, removeInvite, useOrgBuildVersion } from '@/lib/orgBuild/mockOrgBuild';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function InvitePeopleScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useOrgBuildVersion();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Invite your people' }); }, [navigation]);

  const invited = getInvited();

  function add() {
    if (!name.trim()) return;
    addInvite(name, email, position);
    setName(''); setEmail(''); setPosition('');
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock invites, nothing sent</Text></View>

        <Text style={s.heading}>Invite your people first</Text>
        <Text style={s.sub}>Add the people who'll be in your org — name, email, and what their position is called. Then you'll place them into your leadership tree.</Text>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Name" placeholderTextColor="#475569" value={name} onChangeText={setName} />
          <TextInput style={s.input} placeholder="Email" placeholderTextColor="#475569" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={s.input} placeholder="Position (e.g. Vice President)" placeholderTextColor="#475569" value={position} onChangeText={setPosition} onSubmitEditing={add} />
          <Pressable style={[s.addBtn, !name.trim() && s.addBtnOff]} onPress={add} disabled={!name.trim()}>
            <Text style={[s.addBtnText, !name.trim() && s.addBtnTextOff]}>+ Add person</Text>
          </Pressable>
        </View>

        {invited.length > 0 && <Text style={s.sectionLabel}>INVITED ({invited.length})</Text>}
        {invited.map(i => (
          <View key={i.id} style={s.row}>
            <View style={s.avatar}><Text style={s.avatarText}>{i.name.split(' ').map(p => p[0]).join('').slice(0, 2)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{i.name}</Text>
              <Text style={s.meta}>{i.position}{i.email ? ` · ${i.email}` : ''}</Text>
            </View>
            <Pressable onPress={() => removeInvite(i.id)} hitSlop={8}><Text style={s.remove}>✕</Text></Pressable>
          </View>
        ))}

        <Pressable style={[s.primary, invited.length === 0 && s.primaryOff]} onPress={() => router.push('/setup/tree' as any)} disabled={invited.length === 0}>
          <Text style={[s.primaryText, invited.length === 0 && s.primaryTextOff]}>Build your leadership tree ›</Text>
        </Pressable>
        {invited.length === 0 && <Text style={s.hint}>Add at least one person to place in the tree (or skip — the tree builder also lets you add people on the fly).</Text>}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  form:  { gap: 10, marginBottom: 20 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  addBtn:     { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 12, alignItems: 'center' },
  addBtnOff:  { backgroundColor: '#1e293b', borderColor: '#334155' },
  addBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  addBtnTextOff: { color: '#475569' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  name:       { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  meta:       { fontSize: 12, color: '#64748b', marginTop: 1 },
  remove:     { fontSize: 16, color: '#475569', paddingHorizontal: 6 },

  primary:       { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryOff:    { backgroundColor: '#1e293b', borderColor: '#334155' },
  primaryText:   { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  primaryTextOff:{ color: '#475569' },
  hint:          { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 17 },
});
