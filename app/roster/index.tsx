/**
 * app/roster/index.tsx — roster + positions editor (core area, mock-backed).
 * UI-first. Browse/search members, change a member's position (role), add/remove.
 * Reads/writes the shared mockRoster store so changes are reflected app-wide this
 * session. No schema/RLS/auth yet — real persistence comes in the schema phase.
 */

import {
  ASSIGNABLE_ROLES,
  addMember,
  getMembers,
  removeMember,
  roleLabel,
  setMemberRole,
  useRosterVersion,
} from '@/lib/roster/mockRoster';
import { isOfficer, type Role } from '@/lib/roles';
import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function RosterScreen() {
  const navigation = useNavigation();
  useRosterVersion();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Members & positions' }); }, [navigation]);

  const members = getMembers();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => m.name.toLowerCase().includes(q) || roleLabel(m.role).toLowerCase().includes(q));
  }, [members, query]);

  const officers = filtered.filter(m => isOfficer(m.role));
  const brothers = filtered.filter(m => !isOfficer(m.role));

  function changeRole(id: string, name: string) {
    Alert.alert(
      `Position for ${name}`,
      'Assign a position',
      [
        ...ASSIGNABLE_ROLES.map(r => ({ text: roleLabel(r), onPress: () => setMemberRole(id, r) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  function confirmRemove(id: string, name: string) {
    Alert.alert('Remove member', `Remove ${name} from the roster?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(id) },
    ]);
  }

  function Row({ id, name, role }: { id: string; name: string; role: Role }) {
    return (
      <View style={s.row}>
        <View style={s.avatar}><Text style={s.avatarText}>{name.split(' ').map(p => p[0]).join('').slice(0, 2)}</Text></View>
        <View style={s.body}>
          <Text style={s.name}>{name}</Text>
          <Pressable onPress={() => changeRole(id, name)}>
            <Text style={s.roleBtn}>{roleLabel(role)}  ▾</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => confirmRemove(id, name)} hitSlop={8}><Text style={s.remove}>✕</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.protoBadge}><Text style={s.protoText}>UI PREVIEW · positions editable, not yet saved</Text></View>

      <Text style={s.heading}>Members & positions</Text>
      <Text style={s.sub}>{members.length} people · tap a position to reassign</Text>

      <TextInput style={s.search} placeholder="Search name or position…" placeholderTextColor="#475569" value={query} onChangeText={setQuery} />

      {officers.length > 0 && <Text style={s.sectionLabel}>OFFICERS</Text>}
      {officers.map(m => <Row key={m.id} id={m.id} name={m.name} role={m.role} />)}

      {brothers.length > 0 && <Text style={[s.sectionLabel, { marginTop: 18 }]}>MEMBERS</Text>}
      {brothers.map(m => <Row key={m.id} id={m.id} name={m.name} role={m.role} />)}

      <View style={s.addRow}>
        <TextInput style={[s.search, { flex: 1, marginBottom: 0 }]} placeholder="Add a member by name…" placeholderTextColor="#475569" value={draft} onChangeText={setDraft} onSubmitEditing={() => { addMember(draft); setDraft(''); }} />
        <Pressable style={s.addBtn} onPress={() => { addMember(draft); setDraft(''); }}><Text style={s.addBtnText}>Add</Text></Pressable>
      </View>

      <Text style={s.footNote}>
        Changes persist this session only. Real positions are backed by the
        members/positions tables in the schema phase (owner/officer-gated).
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },

  search: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  body:       { flex: 1 },
  name:       { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  roleBtn:    { fontSize: 12, color: '#818cf8', fontWeight: '600', marginTop: 3 },
  remove:     { fontSize: 16, color: '#475569', paddingHorizontal: 6 },

  addRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  addBtn:     { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 11, paddingHorizontal: 16 },
  addBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
