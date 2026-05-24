/**
 * app/report/inbox.tsx — Annotator review inbox prototype.
 * PLANNING/PROTOTYPE ONLY (see QUESTIONNAIRE_REPORTS_PLAN.md).
 *
 * Shows the Annotator's view of weekly officer reports for the current cycle:
 *  - who has SUBMITTED (with a peek at their goal/status), and
 *  - who is MISSING (with a mock "send reminder" action).
 *
 * The current user's row reflects the live mock store snapshot; the other
 * officers are static demo data so the review/missed-report flow is visible.
 * No backend, not linked from phase-2, not wired into the alpha.
 */

import { ROLE_LABELS, type Role } from '@/lib/roles';
import { WEEKLY_OFFICER_REPORT } from '@/lib/questionnaire/mockReport';
import {
  currentCycleId,
  getSnapshots,
  useMockReportVersion,
} from '@/lib/questionnaire/mockReport';
import type { ReportSnapshot } from '@/lib/questionnaire/types';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

// Officers expected to file a weekly report (demo roster). The report's owner
// role (pro_consul) is the "you" row, driven by the live store.
const EXPECTED_OFFICERS: Role[] = ['pro_consul', 'social_chair', 'risk_manager', 'recruitment_chair'];

// Static demo submissions for the OTHER officers, so the inbox shows a realistic
// mix of submitted + missing without needing real multi-user data.
const DEMO_OTHERS: Record<string, { goal: string; status: string } | null> = {
  social_chair:      { goal: 'Lock the formal venue', status: 'On track' },
  risk_manager:      null,                                   // missing
  recruitment_chair: { goal: 'Finish rush roster',    status: 'At risk' },
};

/** Pull a short summary (goal + status label) out of a submitted snapshot. */
function summarize(snap: ReportSnapshot): { goal: string; status: string } {
  const goal = snap.answers['goal']?.text?.trim() || '(no goal)';
  const statusId = snap.answers['status']?.selected?.[0];
  const statusOpt = WEEKLY_OFFICER_REPORT.questions
    .find(q => q.id === 'status')?.options?.find(o => o.id === statusId);
  return { goal, status: statusOpt?.label ?? '—' };
}

export default function ReportInboxScreen() {
  const navigation = useNavigation();
  useMockReportVersion();

  const cycleId = currentCycleId();
  useEffect(() => { navigation.setOptions({ title: 'Reports — Review' }); }, [navigation]);

  const mySnap = getSnapshots().find(s => s.cycleId === cycleId);

  const rows = EXPECTED_OFFICERS.map(role => {
    if (role === WEEKLY_OFFICER_REPORT.ownerRole) {
      return { role, summary: mySnap ? summarize(mySnap) : null, you: true };
    }
    return { role, summary: DEMO_OTHERS[role] ?? null, you: false };
  });

  const submitted = rows.filter(r => r.summary);
  const missing   = rows.filter(r => !r.summary);

  function remind(role: Role) {
    Alert.alert('Reminder sent', `(Prototype) Nudged ${ROLE_LABELS[role]} to submit their ${cycleId} report.`);
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock data, not saved</Text></View>

      <Text style={s.heading}>Weekly Officer Reports</Text>
      <Text style={s.sub}>{cycleId}  ·  {submitted.length}/{rows.length} submitted</Text>

      <Text style={s.sectionLabel}>SUBMITTED</Text>
      {submitted.length === 0 ? (
        <View style={s.emptyRow}><Text style={s.emptyText}>No reports submitted yet</Text></View>
      ) : (
        submitted.map(r => (
          <View key={r.role} style={[s.card, s.cardSubmitted]}>
            <View style={s.stripe} />
            <View style={s.cardBody}>
              <Text style={s.role}>{ROLE_LABELS[r.role]}{r.you ? '  · you' : ''}</Text>
              <Text style={s.goal} numberOfLines={1}>{r.summary!.goal}</Text>
              <Text style={s.statusLine}>Status: {r.summary!.status}</Text>
            </View>
            <View style={s.badgeOk}><Text style={s.badgeOkText}>Submitted</Text></View>
          </View>
        ))
      )}

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>MISSING</Text>
      {missing.length === 0 ? (
        <View style={s.emptyRow}><Text style={s.emptyText}>Everyone has reported 🎉</Text></View>
      ) : (
        missing.map(r => (
          <View key={r.role} style={[s.card, s.cardMissing]}>
            <View style={[s.stripe, { backgroundColor: '#7f1d1d' }]} />
            <View style={s.cardBody}>
              <Text style={s.role}>{ROLE_LABELS[r.role]}{r.you ? '  · you' : ''}</Text>
              <Text style={s.missingText}>No report this week</Text>
            </View>
            <Text style={s.remindBtn} onPress={() => remind(r.role)}>Remind</Text>
          </View>
        ))
      )}

      <Text style={s.footNote}>
        On submit, the Annotator, Pro Consul, and Consul are notified. Missing reports
        notify the Annotator and Pro Consul at window close.
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

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  cardSubmitted: {},
  cardMissing:   { borderWidth: 1, borderColor: '#7f1d1d' },
  stripe:        { width: 4, alignSelf: 'stretch', backgroundColor: '#16a34a' },
  cardBody:      { flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 8, gap: 3 },
  role:          { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  goal:          { fontSize: 13, color: '#cbd5e1' },
  statusLine:    { fontSize: 12, color: '#64748b' },
  missingText:   { fontSize: 12, color: '#f87171' },

  badgeOk:      { backgroundColor: '#052e16', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginRight: 12, borderWidth: 1, borderColor: '#166534' },
  badgeOkText:  { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  remindBtn:    { color: '#a5b4fc', fontSize: 13, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 12 },

  emptyRow:  { paddingVertical: 14, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#475569' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 22, lineHeight: 18 },
});
