/**
 * app/leadership/index.tsx — Leadership tree prototype.
 * PROTOTYPE ONLY. Renders the chapter reporting hierarchy top-to-bottom and
 * makes delegation explicit: highlights the viewer's current role, shows who
 * they report to, and who they can delegate to. Role-level (not member-level)
 * for now. Dev-only screen; not linked from phase-2, not wired into the alpha.
 */

import { useDevRole } from '@/lib/devRoleStore';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import {
  LEADERSHIP_LEVEL,
  delegableRoles,
  reportsTo,
  rolesByLevel,
} from '@/lib/leadership/hierarchy';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const LEVEL_TITLES: Record<number, string> = {
  0: 'Chapter lead',
  1: 'Executive',
  2: 'Committee chairs',
  3: 'Membership',
};

export default function LeadershipScreen() {
  const navigation = useNavigation();
  const { role }   = useDevRole();

  useEffect(() => { navigation.setOptions({ title: 'Leadership' }); }, [navigation]);

  const groups   = rolesByLevel();
  const boss     = reportsTo(role);
  const canDel   = delegableRoles(role);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · role-level structure</Text></View>

      <Text style={s.heading}>Leadership tree</Text>
      <Text style={s.sub}>Who reports to whom · who can delegate down</Text>

      {/* The tree, top → bottom by authority level */}
      {groups.map((g, gi) => (
        <View key={g.level} style={s.levelBlock}>
          <Text style={s.levelTitle}>{LEVEL_TITLES[g.level] ?? `Level ${g.level}`}</Text>
          <View style={[s.levelRow, { paddingLeft: g.level * 14 }]}>
            {g.roles.map(r => {
              const me   = r === role;
              const dele = canDel.includes(r);
              return (
                <View key={r} style={[s.node, me && s.nodeMe, dele && !me && s.nodeDelegable]}>
                  <Text style={[s.nodeText, me && s.nodeTextMe]}>{ROLE_LABELS[r]}</Text>
                  {me && <Text style={s.youTag}>you</Text>}
                </View>
              );
            })}
          </View>
          {gi < groups.length - 1 && <Text style={s.connector}>↓</Text>}
        </View>
      ))}

      {/* Delegation summary for the viewer */}
      <View style={s.summary}>
        <Text style={s.summaryLabel}>YOUR PLACE</Text>
        <Text style={s.summaryLine}>
          You are <Text style={s.bold}>{ROLE_LABELS[role]}</Text>
          {boss ? <> · you report to <Text style={s.bold}>{ROLE_LABELS[boss]}</Text></> : <> · top of the chapter</>}
        </Text>
        <Text style={[s.summaryLabel, { marginTop: 14 }]}>YOU CAN DELEGATE TO</Text>
        {canDel.length === 0 ? (
          <Text style={s.summaryLine}>No one below you — you act on your own tasks.</Text>
        ) : (
          <View style={s.chipRow}>
            {canDel.map(r => (
              <View key={r} style={s.chip}><Text style={s.chipText}>{ROLE_LABELS[r]}</Text></View>
            ))}
          </View>
        )}
      </View>

      <Text style={s.footNote}>
        Role-level for now. Member-level delegation (assigning a specific brother on
        your committee) arrives with member-level assignment.
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },

  levelBlock: { alignItems: 'center', marginBottom: 4 },
  levelTitle: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  levelRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  connector:  { color: '#334155', fontSize: 18, marginVertical: 4 },

  node:          { backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 },
  nodeMe:        { backgroundColor: '#1e1b4b', borderColor: '#6366f1' },
  nodeDelegable: { borderColor: '#166534' },
  nodeText:      { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  nodeTextMe:    { color: '#f1f5f9', fontWeight: '700' },
  youTag:        { fontSize: 10, fontWeight: '700', color: '#a5b4fc', backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },

  summary:      { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginTop: 18 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  summaryLine:  { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  bold:         { fontWeight: '700', color: '#f1f5f9' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:         { backgroundColor: '#0f172a', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#166534' },
  chipText:     { fontSize: 13, color: '#86efac', fontWeight: '600' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
