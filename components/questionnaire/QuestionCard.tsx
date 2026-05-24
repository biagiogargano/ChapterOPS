/**
 * QuestionCard.tsx — per-type prompt renderer for the weekly-report prototype.
 * PLANNING/PROTOTYPE ONLY (see QUESTIONNAIRE_REPORTS_PLAN.md).
 *
 * Dispatches by question type (mirrors the QuickActionCard pattern in Today),
 * reads/writes the in-memory mockReport store, and supports a per-prompt
 * "No update" toggle. Dark-theme styling matches the rest of the app. Not wired
 * into phase-2 / the alpha.
 */

import { getAnswer, setAnswer } from '@/lib/questionnaire/mockReport';
import type { QuestionDef } from '@/lib/questionnaire/types';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function QuestionCard({ q }: { q: QuestionDef }) {
  const a        = getAnswer(q.id);
  const noUpdate = !!a.noUpdate;

  const answered =
    !noUpdate &&
    (q.type === 'current_value' ? typeof a.value === 'number' : !!a.text?.trim());

  return (
    <View style={[s.card, answered && s.cardAnswered, noUpdate && s.cardMuted]}>
      <View style={s.headerRow}>
        <Text style={s.prompt}>{q.prompt}</Text>
        {q.allowNoUpdate && (
          <Pressable
            style={[s.noUpdateBtn, noUpdate && s.noUpdateBtnActive]}
            onPress={() => setAnswer(q.id, { noUpdate: !noUpdate })}
          >
            <Text style={[s.noUpdateText, noUpdate && s.noUpdateTextActive]}>
              {noUpdate ? '✓ No update' : 'No update'}
            </Text>
          </Pressable>
        )}
      </View>

      {!noUpdate && (
        q.type === 'current_value' ? (
          <View style={s.valueRow}>
            <TextInput
              style={[s.input, s.valueInput]}
              placeholder="0"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              value={a.value != null ? String(a.value) : ''}
              onChangeText={(t) => {
                const n = t.replace(/[^0-9.]/g, '');
                setAnswer(q.id, { value: n === '' ? null : Number(n) });
              }}
            />
            {(q.unit || q.target != null) && (
              <Text style={s.valueMeta}>
                {q.unit ?? ''}{q.target != null ? `  ·  target ${q.target}${q.unit ? ' ' + q.unit : ''}` : ''}
              </Text>
            )}
          </View>
        ) : (
          <TextInput
            style={[s.input, q.type === 'long_text' && s.inputMultiline]}
            placeholder={q.hint ?? 'Type your answer…'}
            placeholderTextColor="#475569"
            value={a.text ?? ''}
            onChangeText={(t) => setAnswer(q.id, { text: t })}
            multiline={q.type === 'long_text'}
            autoCapitalize="sentences"
          />
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:         { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b', gap: 10 },
  cardAnswered: { borderColor: '#166534' },
  cardMuted:    { opacity: 0.7 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  prompt:       { flex: 1, fontSize: 15, fontWeight: '700', color: '#f1f5f9' },

  noUpdateBtn:       { backgroundColor: '#0f172a', borderRadius: 7, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#334155' },
  noUpdateBtnActive: { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  noUpdateText:      { fontSize: 12, fontWeight: '600', color: '#64748b' },
  noUpdateTextActive:{ color: '#a5b4fc' },

  input:         { backgroundColor: '#0f172a', borderRadius: 9, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  inputMultiline:{ minHeight: 72, textAlignVertical: 'top' },

  valueRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  valueInput: { width: 100 },
  valueMeta:  { fontSize: 12, color: '#64748b', flexShrink: 1 },
});
