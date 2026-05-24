/**
 * app/roster/index.tsx — member roster prototype.
 * PROTOTYPE ONLY. Browse/search the org's people, see role + committee, and
 * (mock) add a member. Part of "build out your org with people." Static + local
 * state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Member { name: string; role: string; committee?: string }

const SEED: Member[] = [
  { name: 'Peter Gargano', role: 'Consul' },
  { name: 'Marcus Lee',    role: 'Pro Consul' },
  { name: 'Alex Rivera',   role: 'Social Chair',      committee: 'Social' },
  { name: 'Jordan Pike',   role: 'Risk Manager',      committee: 'Risk' },
  { name: 'Sam Diaz',      role: 'Recruitment Chair', committee: 'Recruitment' },
  { name: 'Chris Long',    role: 'Annotator' },
  { name: 'Tyler Banks',   role: 'Brother' },
  { name: 'Devin Cole',    role: 'Brother' },
  { name: 'Omar Haddad',   role: 'Brother' },
];

export default function RosterScreen() {
  const navigation = useNavigation();
  const [members, setMembers] = useState<Member[]>(SEED);
  const [query, setQuery]     = useState('');
  const [draft, setDraft]     = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Members' }); }, [navigation]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [members, query]);

  function addMember() {
    const n = draft.trim();
    if (!n) return;
    setMembers(prev => [...prev, { name: n, role: 'Brother' }]);
    setDraft('');
  }

  const officers = filtered.filter(m => m.role !== 'Brother');
  const brothers = filtered.filter(m => m.role === 'Brother');

  function Row({ m }: { m: Member }) {
    return (
      <View style={s.row}>
        <View style={s.avatar}><Text style={s.avatarText}>{m.name.split(' ').map(p => p[0]).join('').slice(0, 2)}</Text></View>
        <View style={s.body}>
          <Text style={s.name}>{m.name}</Text>
          <Text style={s.role}>{m.role}{m.committee ? ` · ${m.committee} committee` : ''}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · sample roster, nothing saved</Text></View>

      <Text style={s.heading}>Members</Text>
      <Text style={s.sub}>{members.length} people</Text>

      <TextInput style={s.search} placeholder="Search name or role…" placeholderTextColor="#475569" value={query} onChangeText={setQuery} />

      {officers.length > 0 && <Text style={s.sectionLabel}>OFFICERS</Text>}
      {officers.map((m, i) => <Row key={`o${i}`} m={m} />)}

      {brothers.length > 0 && <Text style={[s.sectionLabel, { marginTop: 18 }]}>MEMBERS</Text>}
      {brothers.map((m, i) => <Row key={`b${i}`} m={m} />)}

      <View style={s.addRow}>
        <TextInput style={[s.search, { flex: 1, marginBottom: 0 }]} placeholder="Add a member by name…" placeholderTextColor="#475569" value={draft} onChangeText={setDraft} onSubmitEditing={addMember} />
        <Pressable style={s.addBtn} onPress={addMember}><Text style={s.addBtnText}>Add</Text></Pressable>
      </View>

      <Text style={s.footNote}>Real roster comes from members the owner/leaders invite (auth/schema phase).</Text>
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },

  search: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  body:       { flex: 1 },
  name:       { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  role:       { fontSize: 12, color: '#64748b', marginTop: 1 },

  addRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  addBtn:     { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 11, paddingHorizontal: 16 },
  addBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
