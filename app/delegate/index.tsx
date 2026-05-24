/**
 * app/delegate/index.tsx — "delegate a task" prototype.
 * PROTOTYPE ONLY. Demonstrates the leadership tree driving delegation: a sample
 * task assigned to the viewer can be reassigned only to roles BELOW them
 * (delegableRoles from hierarchy.ts). Mock/local state, no real task writes, no
 * schema. Dev-only screen; not linked from phase-2, not wired into the alpha.
 */

import { useDevRole } from '@/lib/devRoleStore';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { delegableRoles } from '@/lib/leadership/hierarchy';
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SAMPLE_TASK = 'Reserve the venue for Formal';

export default function DelegateScreen() {
  const navigation = useNavigation();
  const { role }   = useDevRole();

  useEffect(() => { navigation.setOptions({ title: 'Delegate task' }); }, [navigation]);

  // Current assignee starts as the viewer; delegating reassigns it (local only).
  const [assignee, setAssignee] = useState<Role>(role);
  const targets = delegableRoles(role);

  function delegate(to: Role) {
    Alert.alert(
      'Delegate task?',
      `Reassign “${SAMPLE_TASK}” to ${ROLE_LABELS[to]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delegate',
          onPress: () => {
            setAssignee(to);
            Alert.alert('Delegated', `“${SAMPLE_TASK}” is now assigned to ${ROLE_LABELS[to]}. (Prototype — not saved.)`);
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock task, not saved</Text></View>

      <Text style={s.heading}>Delegate a task</Text>
      <Text style={s.sub}>You can only delegate to roles below you in the leadership tree.</Text>

      {/* The task card */}
      <View style={s.taskCard}>
        <View style={s.taskStripe} />
        <View style={s.taskBody}>
          <Text style={s.taskTitle}>{SAMPLE_TASK}</Text>
          <Text style={s.taskMeta}>
            Currently assigned to <Text style={s.bold}>{ROLE_LABELS[assignee]}</Text>
            {assignee === role ? ' (you)' : ''}
          </Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>DELEGATE TO</Text>
      {targets.length === 0 ? (
        <View style={s.emptyRow}>
          <Text style={s.emptyText}>
            As {ROLE_LABELS[role]} you’re at the bottom of the tree — no one to delegate to.
            You’d handle this task yourself.
          </Text>
        </View>
      ) : (
        targets.map(r => {
          const current = r === assignee;
          return (
            <Pressable
              key={r}
              style={[s.target, current && s.targetCurrent]}
              onPress={() => !current && delegate(r)}
              disabled={current}
            >
              <View style={s.targetBody}>
                <Text style={s.targetRole}>{ROLE_LABELS[r]}</Text>
                {current && <Text style={s.targetCurrentTag}>current assignee</Text>}
              </View>
              {!current && <Text style={s.targetAction}>Delegate ›</Text>}
            </Pressable>
          );
        })
      )}

      <Text style={s.footNote}>
        Delegation flows downward by authority level — the same rule shown on the
        Leadership tree. Member-level delegation (to a specific brother) comes with
        member-level assignment.
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20, lineHeight: 18 },

  taskCard:   { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 22 },
  taskStripe: { width: 4, backgroundColor: '#6366f1' },
  taskBody:   { flex: 1, padding: 14, gap: 4 },
  taskTitle:  { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  taskMeta:   { fontSize: 13, color: '#94a3b8' },
  bold:       { fontWeight: '700', color: '#f1f5f9' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  target:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  targetCurrent: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  targetBody:    { flex: 1, gap: 2 },
  targetRole:    { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  targetCurrentTag: { fontSize: 11, color: '#a5b4fc', fontWeight: '600' },
  targetAction:  { fontSize: 13, color: '#86efac', fontWeight: '700' },

  emptyRow:  { padding: 16, backgroundColor: '#0a1628', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  emptyText: { fontSize: 13, color: '#64748b', lineHeight: 19 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
