/**
 * app/setup/tree.tsx — guided "build your org tree by asking" prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md §2a).
 *
 * Instead of a grid/graph editor, the owner builds the hierarchy by answering
 * questions, top-down: "what's your role?" → "who reports to them?" → repeat down
 * the chain until each branch ends or is marked General members. The resulting
 * tree is shown at the end. Mock/local state, nothing saved. Dev-only; not linked
 * from phase-2, not wired into the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Node { id: string; name: string; parentId: string | null; isMembers?: boolean }
let _seq = 0;
const newId = () => `n${_seq++}`;

export default function TreeBuilderScreen() {
  const navigation = useNavigation();
  const router     = useRouter();

  const [phase, setPhase]   = useState<'root' | 'asking' | 'review'>('root');
  const [nodes, setNodes]   = useState<Node[]>([]);
  const [queue, setQueue]   = useState<string[]>([]);   // node ids still to ask about
  const [rootDraft, setRootDraft]   = useState('');
  const [childDraft, setChildDraft] = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Build your org' }); }, [navigation]);

  const current      = nodes.find(n => n.id === queue[0]) ?? null;
  const currentKids  = useMemo(
    () => (current ? nodes.filter(n => n.parentId === current.id) : []),
    [nodes, current],
  );

  function startRoot() {
    const name = rootDraft.trim();
    if (!name) return;
    const root: Node = { id: newId(), name, parentId: null };
    setNodes([root]);
    setQueue([root.id]);
    setPhase('asking');
  }

  function addChild(name: string, isMembers = false) {
    if (!current) return;
    const n = name.trim();
    if (!n) return;
    setNodes(prev => [...prev, { id: newId(), name: n, parentId: current.id, isMembers }]);
    setChildDraft('');
  }

  function addMembers() {
    if (currentKids.some(k => k.isMembers)) return;   // one bucket is enough
    addChild('General members', true);
  }

  function nextRole() {
    if (!current) return;
    // Enqueue this role's non-members children so we ask about them next.
    const kids = nodes.filter(n => n.parentId === current.id && !n.isMembers).map(n => n.id);
    const nextQueue = [...queue.slice(1), ...kids];
    if (nextQueue.length === 0) setPhase('review');
    else setQueue(nextQueue);
  }

  function finish() {
    Alert.alert(
      'Org tree built (prototype)',
      `${nodes.length} roles defined.\n\n(Mock — nothing saved. In the real app this becomes your editable leadership tree.)`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  // Indented outline for review.
  function renderTree(parentId: string | null, depth: number): ReactNode[] {
    return nodes
      .filter(n => n.parentId === parentId)
      .flatMap(n => [
        <View key={n.id} style={[s.treeRow, { paddingLeft: 12 + depth * 18 }]}>
          <View style={[s.bullet, n.isMembers && s.bulletMembers]} />
          <Text style={[s.treeName, n.isMembers && s.treeMembers]}>{n.name}</Text>
          {depth === 0 && <Text style={s.ownerTag}>owner</Text>}
        </View>,
        ...renderTree(n.id, depth + 1),
      ]);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock, nothing saved</Text></View>

        {/* ── Root: your role ── */}
        {phase === 'root' && (
          <View style={s.block}>
            <Text style={s.q}>What’s your role called?</Text>
            <Text style={s.help}>You’re the top of the tree. Use whatever your org calls it — President, CEO, Consul, Captain…</Text>
            <TextInput style={s.input} placeholder="e.g. President" placeholderTextColor="#475569" value={rootDraft} onChangeText={setRootDraft} autoFocus onSubmitEditing={startRoot} />
            <Pressable style={[s.primary, !rootDraft.trim() && s.primaryOff]} onPress={startRoot} disabled={!rootDraft.trim()}>
              <Text style={[s.primaryText, !rootDraft.trim() && s.primaryTextOff]}>Start building</Text>
            </Pressable>
          </View>
        )}

        {/* ── Asking: who reports to current ── */}
        {phase === 'asking' && current && (
          <View style={s.block}>
            <Text style={s.crumb}>Building under</Text>
            <Text style={s.q}>Who reports to {current.name}?</Text>
            <Text style={s.help}>Add the roles directly below {current.name}. We’ll then ask who reports to each of them.</Text>

            <View style={s.inviteRow}>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="e.g. Vice President" placeholderTextColor="#475569" value={childDraft} onChangeText={setChildDraft} onSubmitEditing={() => addChild(childDraft)} />
              <Pressable style={s.addBtn} onPress={() => addChild(childDraft)}><Text style={s.addBtnText}>Add</Text></Pressable>
            </View>

            {currentKids.length > 0 ? (
              currentKids.map(k => (
                <View key={k.id} style={s.kidItem}>
                  <View style={[s.bullet, k.isMembers && s.bulletMembers]} />
                  <Text style={[s.kidName, k.isMembers && s.treeMembers]}>{k.name}</Text>
                </View>
              ))
            ) : (
              <Text style={s.help}>No one yet. Add roles above, mark general members, or move on if no one reports to {current.name}.</Text>
            )}

            <Pressable style={s.ghost} onPress={addMembers}>
              <Text style={s.ghostText}>+ Add “General members” here</Text>
            </Pressable>

            <Pressable style={s.primary} onPress={nextRole}>
              <Text style={s.primaryText}>{currentKids.filter(k => !k.isMembers).length > 0 ? 'Next role ›' : 'No one reports to them ›'}</Text>
            </Pressable>
            <Text style={s.footHint}>Roles left to ask about after this: {Math.max(0, queue.length - 1)}</Text>
          </View>
        )}

        {/* ── Review ── */}
        {phase === 'review' && (
          <View style={s.block}>
            <Text style={s.q}>Here’s your org tree</Text>
            <Text style={s.help}>Built just by answering questions — no grid. You’ll be able to edit this anytime.</Text>
            <View style={s.treeBox}>{renderTree(null, 0)}</View>
            <Text style={s.footHint}>
              Full version: a role can “also report to” another (second manager), and you can rename or move anyone later.
            </Text>
            <Pressable style={s.primary} onPress={finish}><Text style={s.primaryText}>Looks good</Text></Pressable>
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

  block: { gap: 12 },
  crumb: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.6 },
  q:     { fontSize: 21, fontWeight: '800', color: '#f8fafc' },
  help:  { fontSize: 13, color: '#64748b', lineHeight: 18 },

  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },

  inviteRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn:     { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 16 },
  addBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },

  kidItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  kidName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },

  bullet:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' },
  bulletMembers: { backgroundColor: '#64748b' },

  ghost:     { alignSelf: 'flex-start', paddingVertical: 8 },
  ghostText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  primary:       { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryOff:    { backgroundColor: '#1e293b', borderColor: '#334155' },
  primaryText:   { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  primaryTextOff:{ color: '#475569' },
  footHint:      { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 17 },

  treeBox:    { backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 10, marginTop: 4 },
  treeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 12 },
  treeName:   { fontSize: 14, fontWeight: '600', color: '#f1f5f9', flex: 1 },
  treeMembers:{ color: '#94a3b8', fontWeight: '500' },
  ownerTag:   { fontSize: 10, fontWeight: '700', color: '#a5b4fc', backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
});
