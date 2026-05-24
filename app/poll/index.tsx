/**
 * app/poll/index.tsx — quick chapter poll prototype.
 * PROTOTYPE ONLY. A lightweight vote (one of the questionnaire use cases): tap an
 * option, see live tallies. Local mock state, nothing saved. Dev-only; not in
 * phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const QUESTION = 'Where should we hold Formal this year?';
const OPTIONS = [
  { id: 'vue',    label: 'The Vue Rooftop',     base: 14 },
  { id: 'harbor', label: 'Harbor Ballroom',     base: 9  },
  { id: 'lodge',  label: 'Mountain Lodge',      base: 6  },
];

export default function PollScreen() {
  const navigation = useNavigation();
  const [vote, setVote] = useState<string | null>(null);

  useEffect(() => { navigation.setOptions({ title: 'Poll' }); }, [navigation]);

  const tallies = OPTIONS.map(o => ({ ...o, count: o.base + (vote === o.id ? 1 : 0) }));
  const total   = tallies.reduce((sum, o) => sum + o.count, 0);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · sample poll, nothing saved</Text></View>

      <Text style={s.heading}>Quick poll</Text>
      <Text style={s.question}>{QUESTION}</Text>

      {tallies.map(o => {
        const pct = total ? Math.round((o.count / total) * 100) : 0;
        const chosen = vote === o.id;
        return (
          <Pressable key={o.id} style={[s.option, chosen && s.optionChosen]} onPress={() => setVote(o.id)}>
            <View style={[s.bar, { width: `${pct}%` }, chosen && s.barChosen]} />
            <View style={s.optionRow}>
              <Text style={[s.optionLabel, chosen && s.optionLabelChosen]}>{o.label}{chosen ? '  ✓' : ''}</Text>
              {vote && <Text style={s.pct}>{pct}%</Text>}
            </View>
          </Pressable>
        );
      })}

      <Text style={s.total}>{vote ? `${total} votes · thanks for voting` : 'Tap to vote'}</Text>

      <Text style={s.footNote}>
        Polls reuse the questionnaire engine — anonymous or named, single or
        multi-select. Real tallies + live updates come with the data model.
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

  heading:  { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  question: { fontSize: 17, fontWeight: '600', color: '#cbd5e1', marginTop: 8, marginBottom: 20, lineHeight: 23 },

  option:       { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  optionChosen: { borderColor: '#6366f1' },
  bar:          { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1e1b4b' },
  barChosen:    { backgroundColor: '#312e81' },
  optionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16 },
  optionLabel:  { fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  optionLabelChosen: { color: '#f1f5f9', fontWeight: '700' },
  pct:          { fontSize: 14, fontWeight: '700', color: '#a5b4fc' },

  total:    { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6 },
  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
