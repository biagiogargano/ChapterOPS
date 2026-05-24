/**
 * app/report/weekly.tsx — weekly-report draft/submit prototype screen.
 * PLANNING/PROTOTYPE ONLY (see QUESTIONNAIRE_REPORTS_PLAN.md).
 *
 * Demonstrates the locked workflow end-to-end against the in-memory mock:
 *  - autosave on every edit (latest-write-wins),
 *  - "something must change" rule (warn before an all-"No update" submit),
 *  - submit confirmation naming the recipients (Annotator / Pro Consul / Consul),
 *  - per-cycle snapshot: once submitted, this cycle is done; later edits roll to
 *    the next cycle.
 *
 * Reachable via the /report/weekly route. Not linked from phase-2 surfaces and
 * not wired into the alpha. Navigate here manually to preview the flow.
 */

import QuestionCard from '@/components/questionnaire/QuestionCard';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import {
  WEEKLY_OFFICER_REPORT,
  SUBMIT_RECIPIENTS,
  currentCycleId,
  getLivingAnswers,
  isCycleSubmitted,
  submitReport,
  useMockReportVersion,
} from '@/lib/questionnaire/mockReport';
import { hasSubstantiveUpdate } from '@/lib/questionnaire/types';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function WeeklyReportScreen() {
  const navigation = useNavigation();
  useMockReportVersion();                       // re-render on any store change

  const def       = WEEKLY_OFFICER_REPORT;
  const cycleId   = currentCycleId();
  const submitted = isCycleSubmitted(cycleId);
  const canSubmit = hasSubstantiveUpdate(def.questions, getLivingAnswers());

  useEffect(() => { navigation.setOptions({ title: def.title }); }, [navigation, def.title]);

  const recipientLabels = SUBMIT_RECIPIENTS
    .map(r => ROLE_LABELS[r as Role] ?? r)
    .join(', ');

  function doSubmit() {
    const res = submitReport(def, cycleId);
    if (res.ok) {
      Alert.alert(
        'Report submitted',
        `Your ${def.title} for ${cycleId} was submitted and locked.\n\nNotified: ${recipientLabels}.`,
      );
    } else if (res.reason === 'already_submitted') {
      Alert.alert('Already submitted', 'This cycle’s report is already in and locked.');
    } else {
      Alert.alert('Nothing to submit', 'Add at least one real update — an all “No update” report can’t be submitted.');
    }
  }

  function onPressSubmit() {
    if (submitted) return;                        // locked — no-op
    if (!canSubmit) {
      // "Something must change" — WARN, not a hard block (per v1 direction).
      Alert.alert(
        'Nothing has changed',
        'Every prompt is empty or marked “No update.” Add at least one real update before submitting.',
        [{ text: 'Keep editing' }],
      );
      return;
    }
    // Confirmation naming the recipients; submitting LOCKS the response (v1).
    Alert.alert(
      'Submit weekly report?',
      `On submit, the following will be notified:\n\n${recipientLabels}\n\nYour answers will be locked for this cycle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'default', onPress: doSubmit },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock data, not saved</Text></View>

        <Text style={s.heading}>{def.title}</Text>
        <Text style={s.sub}>
          {cycleId}{submitted ? '  ·  submitted' : '  ·  draft (autosaves as you type)'}
        </Text>

        {submitted && (
          <View style={s.submittedBanner}>
            <Text style={s.submittedText}>
              ✓ Submitted &amp; locked for {cycleId}. Your next report opens next cycle.
            </Text>
          </View>
        )}

        <View style={s.questions}>
          {def.questions.map(q => <QuestionCard key={q.id} q={q} locked={submitted} />)}
        </View>

        <Pressable
          style={[s.submitBtn, (!canSubmit && !submitted) && s.submitBtnDisabled]}
          onPress={onPressSubmit}
        >
          <Text style={[s.submitText, (!canSubmit && !submitted) && s.submitTextDisabled]}>
            {submitted ? 'Submitted ✓' : 'Submit report'}
          </Text>
        </Pressable>
        <Text style={s.footNote}>Notifies: {recipientLabels}</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },

  submittedBanner: { backgroundColor: '#052e16', borderRadius: 10, borderWidth: 1, borderColor: '#166534', padding: 12, marginBottom: 16 },
  submittedText:   { color: '#4ade80', fontSize: 13, fontWeight: '600' },

  questions: { marginTop: 4 },

  submitBtn:         { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#1e293b', borderColor: '#334155' },
  submitText:        { fontSize: 15, fontWeight: '700', color: '#60a5fa' },
  submitTextDisabled:{ color: '#475569' },
  footNote:          { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 10 },
});
