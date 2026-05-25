/**
 * app/setup/tree.tsx — OPTIONAL detailed structure editor (reporting lines).
 * PROTOTYPE / mock. This is the ADVANCED, opt-in "who reports to whom" view —
 * NOT part of required onboarding. Setup is roles-first (app/setup/index.tsx);
 * committees and reporting lines are an optional follow-up reached from
 * Settings → Roles & structure. Build the hierarchy by placing invited people;
 * local state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { getInvited, useOrgBuildVersion, type Invitee } from '@/lib/orgBuild/mockOrgBuild';
import { getActiveTemplate } from '@/lib/orgTemplates/activeOrgTemplate';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Node { id: string; name: string; position?: string; parentId: string | null; isMembers?: boolean; inviteeId?: string }
let _seq = 0;
const newId = () => `t${_seq++}`;

export default function TreeBuilderScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useOrgBuildVersion();

  // Owner's title comes from the chosen org template (Consul / President / Captain…).
  const [nodes, setNodes] = useState<Node[]>(() => [{ id: 'root', name: 'You', position: getActiveTemplate().leaderTitle, parentId: null }]);
  const [queue, setQueue] = useState<string[]>(['root']);
  const [phase, setPhase] = useState<'asking' | 'review'>('asking');
  const [manual, setManual] = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Build your org' }); }, [navigation]);

  const invited = getInvited();
  const current = nodes.find(n => n.id === queue[0]) ?? null;
  const placedInviteeIds = new Set(nodes.map(n => n.inviteeId).filter(Boolean) as string[]);
  const unplaced = invited.filter(i => !placedInviteeIds.has(i.id));
  const currentKids = current ? nodes.filter(n => n.parentId === current.id) : [];

  function placeInvitee(inv: Invitee) {
    if (!current) return;
    setNodes(prev => [...prev, { id: newId(), name: inv.name, position: inv.position, parentId: current.id, inviteeId: inv.id }]);
  }
  function addManual() {
    if (!current || !manual.trim()) return;
    setNodes(prev => [...prev, { id: newId(), name: manual.trim(), parentId: current.id }]);
    setManual('');
  }
  function addMembers() {
    if (!current || currentKids.some(k => k.isMembers)) return;
    setNodes(prev => [...prev, { id: newId(), name: 'General members', parentId: current.id, isMembers: true }]);
  }
  function nextRole() {
    if (!current) return;
    const kids = nodes.filter(n => n.parentId === current.id && !n.isMembers).map(n => n.id);
    const nextQueue = [...queue.slice(1), ...kids];
    if (nextQueue.length === 0) setPhase('review');
    else setQueue(nextQueue);
  }

  function renderTree(parentId: string | null, depth: number): ReactNode[] {
    return nodes
      .filter(n => n.parentId === parentId)
      .flatMap(n => [
        <View key={n.id} style={[s.treeRow, { paddingLeft: 12 + depth * 18 }]}>
          <View style={[s.bullet, n.isMembers && s.bulletMembers]} />
          <Text style={[s.treeName, n.isMembers && s.treeMembers]}>
            {n.name}{n.position ? <Text style={s.treePos}>  · {n.position}</Text> : null}
          </Text>
          {depth === 0 && <Text style={s.ownerTag}>owner</Text>}
        </View>,
        ...renderTree(n.id, depth + 1),
      ]);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock, nothing saved</Text></View>

        {/* This screen is the optional, advanced structure editor — setup does not
            require it. Make that explicit so it never feels like a mandatory chart. */}
        <View style={s.optionalNote}>
          <Text style={s.optionalNoteText}>
            Optional — you don’t need this to finish setup. Structure is primarily a few
            tiers (Leadership · Executives · Officers · Members) set in setup; detailed
            reporting lines and committees are an advanced add-on most orgs can skip.
          </Text>
        </View>

        {phase === 'asking' && current && (
          <View style={s.block}>
            <Text style={s.crumb}>Building under</Text>
            <Text style={s.q}>Who reports to {current.name}?</Text>
            <Text style={s.help}>Pick people from your roster. We'll then ask who reports to each of them.</Text>

            {/* Already placed under current */}
            {currentKids.map(k => (
              <View key={k.id} style={s.kidItem}>
                <View style={[s.bullet, k.isMembers && s.bulletMembers]} />
                <Text style={[s.kidName, k.isMembers && s.treeMembers]}>{k.name}{k.position ? `  · ${k.position}` : ''}</Text>
              </View>
            ))}

            {/* Unplaced roster people to pick */}
            {unplaced.length > 0 ? (
              <>
                <Text style={s.pickLabel}>From your roster:</Text>
                <View style={s.chips}>
                  {unplaced.map(inv => (
                    <Pressable key={inv.id} style={s.personChip} onPress={() => placeInvitee(inv)}>
                      <Text style={s.personChipName}>{inv.name}</Text>
                      <Text style={s.personChipPos}>{inv.position}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              invited.length === 0 && (
                <View style={s.manualRow}>
                  <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Add a role/person…" placeholderTextColor="#475569" value={manual} onChangeText={setManual} onSubmitEditing={addManual} />
                  <Pressable style={s.addBtn} onPress={addManual}><Text style={s.addBtnText}>Add</Text></Pressable>
                </View>
              )
            )}

            <Pressable style={s.ghost} onPress={addMembers}><Text style={s.ghostText}>+ Add "General members" here</Text></Pressable>
            {invited.length > 0 && unplaced.length === 0 && (
              <Text style={s.help}>Everyone you invited has been placed. You can still add general members, or move on.</Text>
            )}

            <Pressable style={s.primary} onPress={nextRole}>
              <Text style={s.primaryText}>{currentKids.filter(k => !k.isMembers).length > 0 ? 'Next role ›' : 'No one reports to them ›'}</Text>
            </Pressable>
            <Text style={s.footHint}>Roles left to ask about after this: {Math.max(0, queue.length - 1)}{invited.length > 0 ? ` · ${unplaced.length} people unplaced` : ''}</Text>
            <Pressable style={s.back} onPress={() => router.push('/setup/invite-people' as any)}><Text style={s.backText}>← Invite more people</Text></Pressable>
          </View>
        )}

        {phase === 'review' && (
          <View style={s.block}>
            <Text style={s.q}>Here's your org tree</Text>
            <Text style={s.help}>Built from the people you invited — no grid. Editable anytime.</Text>
            <View style={s.treeBox}>{renderTree(null, 0)}</View>
            <Text style={s.footHint}>Full version: a person can "also report to" another, and you can move anyone later.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 18, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  optionalNote:     { backgroundColor: '#0a1628', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', padding: 12, marginBottom: 18 },
  optionalNoteText: { fontSize: 12, color: '#64748b', lineHeight: 18 },

  block: { gap: 12 },
  crumb: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.6 },
  q:     { fontSize: 21, fontWeight: '800', color: '#f8fafc' },
  help:  { fontSize: 13, color: '#64748b', lineHeight: 18 },

  pickLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginTop: 4 },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip:    { backgroundColor: '#1e1b4b', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: '#4f46e5' },
  personChipName:{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  personChipPos: { fontSize: 11, color: '#a5b4fc', marginTop: 1 },

  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  manualRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn:     { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 16 },
  addBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },

  kidItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  kidName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },

  bullet:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' },
  bulletMembers: { backgroundColor: '#64748b' },

  ghost:     { alignSelf: 'flex-start', paddingVertical: 8 },
  ghostText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  primary:     { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  footHint:    { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 17 },
  back:        { alignSelf: 'center', paddingVertical: 8 },
  backText:    { color: '#64748b', fontSize: 13, fontWeight: '600' },

  treeBox:    { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 10, marginTop: 4 },
  treeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 12 },
  treeName:   { fontSize: 14, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  treePos:    { fontSize: 12, color: '#818cf8', fontWeight: '500' },
  treeMembers:{ color: '#94a3b8', fontWeight: '500' },
  ownerTag:   { fontSize: 10, fontWeight: '700', color: '#a5b4fc', backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
});
