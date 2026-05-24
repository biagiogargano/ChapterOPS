/**
 * QuestionCard.tsx — v1 prompt renderer for the structured-response prototype.
 * PROTOTYPE ONLY (see WEEKLY_REPORT_V1_PLAN.md).
 *
 * v1 input types only: short_text, long_text, number (with `config.mode:'progress'`
 * for current-vs-target). Plus a per-prompt "No update" toggle. `locked` renders
 * the answer read-only (after final submit). Not wired into phase-2 / the alpha.
 */

import { getAnswer, setAnswer } from '@/lib/questionnaire/mockReport';
import type { QuestionDef } from '@/lib/questionnaire/types';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function QuestionCard({ q, locked = false }: { q: QuestionDef; locked?: boolean }) {
  const a        = getAnswer(q.id);
  const noUpdate = !!a.noUpdate;
  const isNumber = q.type === 'number';

  const answered = !noUpdate && (isNumber ? typeof a.value === 'number' : !!a.text?.trim());

  return (
    <View style={[s.card, answered && s.cardAnswered, noUpdate && s.cardMuted]}>
      <View style={s.headerRow}>
        <Text style={s.prompt}>{q.prompt}</Text>
        {q.allowNoUpdate && !locked && (
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

      {/* No-update: show a muted note instead of an input */}
      {noUpdate && <Text style={s.noUpdateNote}>No update this week</Text>}

      {/* Number (incl. progress / current-vs-target via config) */}
      {!noUpdate && isNumber && (
        <View style={s.valueRow}>
          <TextInput
            style={[s.input, s.valueInput, locked && s.inputLocked]}
            placeholder="0"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            editable={!locked}
            value={a.value != null ? String(a.value) : ''}
            onChangeText={(t) => {
              const n = t.replace(/[^0-9.]/g, '');
              setAnswer(q.id, { value: n === '' ? null : Number(n) });
            }}
          />
          {(q.config?.unit || q.config?.target != null) && (
            <Text style={s.valueMeta}>
              {q.config?.unit ?? ''}
              {q.config?.target != null ? `  ·  target ${q.config.target}${q.config?.unit ? ' ' + q.config.unit : ''}` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Short / long text */}
      {!noUpdate && !isNumber && (
        <TextInput
          style={[s.input, q.type === 'long_text' && s.inputMultiline, locked && s.inputLocked]}
          placeholder={q.hint ?? 'Type your answer…'}
          placeholderTextColor="#475569"
          editable={!locked}
          value={a.text ?? ''}
          onChangeText={(t) => setAnswer(q.id, { text: t })}
          multiline={q.type === 'long_text'}
          autoCapitalize="sentences"
        />
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
  noUpdateNote:      { fontSize: 13, color: '#64748b', fontStyle: 'italic' },

  input:         { backgroundColor: '#0f172a', borderRadius: 9, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  inputMultiline:{ minHeight: 72, textAlignVertical: 'top' },
  inputLocked:   { opacity: 0.6 },

  valueRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  valueInput: { width: 100 },
  valueMeta:  { fontSize: 12, color: '#64748b', flexShrink: 1 },
});
