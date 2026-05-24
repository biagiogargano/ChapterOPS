/**
 * app/points/index.tsx — engagement / points leaderboard prototype.
 * PROTOTYPE ONLY. Tracks participation points (attendance, tasks done, RSVPs) and
 * ranks members — a common chapter "involvement" incentive. Static mock data,
 * nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const BOARD = [
  { name: 'Alex Rivera',   pts: 142, you: false },
  { name: 'Tyler Banks',   pts: 128, you: false },
  { name: 'You',           pts: 119, you: true },
  { name: 'Jordan Pike',   pts: 113, you: false },
  { name: 'Devin Cole',    pts: 97,  you: false },
  { name: 'Omar Haddad',   pts: 88,  you: false },
  { name: 'Sam Diaz',      pts: 74,  you: false },
];

const BREAKDOWN = [
  { label: 'Events attended', value: '11', pts: '+55' },
  { label: 'Tasks completed', value: '9',  pts: '+45' },
  { label: 'RSVPs on time',   value: '13', pts: '+19' },
];

const MEDAL = ['🥇', '🥈', '🥉'];

export default function PointsScreen() {
  const navigation = useNavigation();
  useEffect(() => { navigation.setOptions({ title: 'Engagement' }); }, [navigation]);

  const sorted = [...BOARD].sort((a, b) => b.pts - a.pts);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · sample points, nothing saved</Text></View>

      <Text style={s.heading}>Engagement</Text>
      <Text style={s.sub}>Points for showing up, finishing tasks, and RSVPing on time.</Text>

      <Text style={s.sectionLabel}>YOUR POINTS THIS SEMESTER</Text>
      <View style={s.myCard}>
        <Text style={s.myPts}>119</Text>
        <View style={{ flex: 1 }}>
          {BREAKDOWN.map((b, i) => (
            <View key={i} style={s.breakRow}>
              <Text style={s.breakLabel}>{b.label}</Text>
              <Text style={s.breakVal}>{b.value}</Text>
              <Text style={s.breakPts}>{b.pts}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>LEADERBOARD</Text>
      {sorted.map((m, i) => (
        <View key={m.name} style={[s.row, m.you && s.rowYou]}>
          <Text style={s.rank}>{i < 3 ? MEDAL[i] : `${i + 1}`}</Text>
          <Text style={[s.name, m.you && s.nameYou]}>{m.name}</Text>
          <Text style={[s.pts, m.you && s.ptsYou]}>{m.pts}</Text>
        </View>
      ))}

      <Text style={s.footNote}>
        Point rules would be org-customizable (what counts, how much). Drives
        involvement without manual tracking.
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

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  myCard:    { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1e1b4b', borderRadius: 14, padding: 16 },
  myPts:     { fontSize: 38, fontWeight: '800', color: '#a5b4fc' },
  breakRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  breakLabel:{ flex: 1, fontSize: 13, color: '#c7d2fe' },
  breakVal:  { fontSize: 13, color: '#818cf8', fontWeight: '700' },
  breakPts:  { fontSize: 13, color: '#86efac', fontWeight: '700', width: 40, textAlign: 'right' },

  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 8 },
  rowYou:  { borderWidth: 1, borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  rank:    { fontSize: 16, fontWeight: '800', color: '#94a3b8', width: 28, textAlign: 'center' },
  name:    { flex: 1, fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  nameYou: { color: '#f1f5f9', fontWeight: '700' },
  pts:     { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  ptsYou:  { color: '#a5b4fc' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
