/**
 * app/report/detail.tsx — submitted weekly-report detail (read-only) prototype.
 * PROTOTYPE ONLY (see QUESTIONNAIRE_REPORTS_PLAN.md).
 *
 * Renders the current cycle's submitted snapshot (the live mock store) as a
 * read-only report — what the Annotator sees when they open a submission. Mock,
 * nothing saved. Dev-only; not linked from phase-2, not wired into the alpha.
 */

import {
  WEEKLY_OFFICER_REPORT,
  currentCycleId,
  getSnapshots,
  useMockReportVersion,
} from '@/lib/questionnaire/mockReport';
import type { Answer, QuestionDef } from '@/lib/questionnaire/types';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/** Human-readable rendering of one answer for a given question. */
function formatAnswer(q: QuestionDef, a: Answer | undefined): { text: string; muted: boolean } {
  if (!a || a.noUpdate) return { text: 'No update', muted: true };
  if (q.type === 'current_value') {
    return a.value != null
      ? { text: `${a.value}${q.unit ? ' ' + q.unit : ''}${q.target != null ? `  (target ${q.target})` : ''}`, muted: false }
      : { text: '—', muted: true };
  }
  if (q.type === 'percentage') {
    return a.value != null ? { text: `${a.value}%`, muted: false } : { text: '—', muted: true };
  }
  if (q.type === 'single_select' || q.type === 'multi_select') {
    const labels = (a.selected ?? []).map(id => q.options?.find(o => o.id === id)?.label ?? id);
    return labels.length ? { text: labels.join(', '), muted: false } : { text: '—', muted: true };
  }
  return a.text?.trim() ? { text: a.text.trim(), muted: false } : { text: '—', muted: true };
}

export default function ReportDetailScreen() {
  const navigation = useNavigation();
  useMockReportVersion();

  const cycleId = currentCycleId();
  const snap    = getSnapshots().find(s => s.cycleId === cycleId);

  useEffect(() => { navigation.setOptions({ title: 'Report detail' }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · read-only snapshot</Text></View>

      <Text style={s.heading}>{WEEKLY_OFFICER_REPORT.title}</Text>
      <Text style={s.sub}>
        {cycleId}{snap ? `  ·  submitted ${new Date(snap.submittedAt).toLocaleString()}` : '  ·  not submitted yet'}
      </Text>

      {!snap ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>
            No submission for {cycleId} yet. Fill out and submit the Weekly report
            prototype first, then come back here.
          </Text>
        </View>
      ) : (
        WEEKLY_OFFICER_REPORT.questions.map(q => {
          const { text, muted } = formatAnswer(q, snap.answers[q.id]);
          return (
            <View key={q.id} style={s.qBlock}>
              <Text style={s.prompt}>{q.prompt}</Text>
              <Text style={[s.answer, muted && s.answerMuted]}>{text}</Text>
            </View>
          );
        })
      )}

      {snap && (
        <Text style={s.footNote}>
          Notified on submit: {snap.recipients.map(r => r).join(', ')}.
        </Text>
      )}
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

  emptyBox:  { backgroundColor: '#0a1628', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 16 },
  emptyText: { fontSize: 13, color: '#64748b', lineHeight: 19 },

  qBlock:     { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10 },
  prompt:     { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  answer:     { fontSize: 15, color: '#f1f5f9', lineHeight: 21 },
  answerMuted:{ color: '#475569', fontStyle: 'italic' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 12, lineHeight: 18 },
});
