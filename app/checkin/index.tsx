/**
 * app/checkin/index.tsx — event attendance check-in prototype.
 * PROTOTYPE ONLY. An officer marks who's present at an event; live present count.
 * Local mock state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const EVENT = 'Chapter Meeting · Sun 8:00 PM';
const ROSTER = ['Peter Gargano', 'Marcus Lee', 'Alex Rivera', 'Jordan Pike', 'Sam Diaz', 'Chris Long', 'Tyler Banks', 'Devin Cole', 'Omar Haddad'];

export default function CheckinScreen() {
  const navigation = useNavigation();
  const [present, setPresent] = useState<Record<string, boolean>>({});

  useEffect(() => { navigation.setOptions({ title: 'Check-in' }); }, [navigation]);

  const count = Object.values(present).filter(Boolean).length;

  function toggle(name: string) {
    setPresent(prev => ({ ...prev, [name]: !prev[name] }));
  }
  function allPresent() {
    setPresent(Object.fromEntries(ROSTER.map(n => [n, true])));
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · attendance, nothing saved</Text></View>

      <Text style={s.heading}>Attendance</Text>
      <Text style={s.sub}>{EVENT}</Text>

      <View style={s.counter}>
        <Text style={s.countNum}>{count}/{ROSTER.length}</Text>
        <Text style={s.countLabel}>present</Text>
        <Pressable style={s.allBtn} onPress={allPresent}><Text style={s.allText}>Mark all</Text></Pressable>
      </View>

      {ROSTER.map(name => {
        const here = !!present[name];
        return (
          <Pressable key={name} style={[s.row, here && s.rowHere]} onPress={() => toggle(name)}>
            <View style={[s.check, here && s.checkOn]}>{here && <Text style={s.tick}>✓</Text>}</View>
            <Text style={[s.name, here && s.nameHere]}>{name}</Text>
            <Text style={[s.status, here ? s.statusHere : s.statusAbsent]}>{here ? 'Present' : 'Absent'}</Text>
          </Pressable>
        );
      })}

      <Text style={s.footNote}>Real check-in ties to the event + RSVP data and feeds attendance history.</Text>
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18 },

  counter:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16, marginBottom: 18 },
  countNum:  { fontSize: 24, fontWeight: '800', color: '#a5b4fc' },
  countLabel:{ fontSize: 13, color: '#818cf8', flex: 1 },
  allBtn:    { backgroundColor: '#312e81', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  allText:   { color: '#c7d2fe', fontWeight: '700', fontSize: 13 },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  rowHere:    { borderColor: '#166534' },
  check:      { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  checkOn:    { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  tick:       { color: '#fff', fontWeight: '800', fontSize: 13 },
  name:       { flex: 1, fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  nameHere:   { color: '#f1f5f9' },
  status:     { fontSize: 12, fontWeight: '600' },
  statusHere: { color: '#4ade80' },
  statusAbsent:{ color: '#64748b' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
