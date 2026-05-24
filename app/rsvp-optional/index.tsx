/**
 * app/rsvp-optional/index.tsx — "required RSVP on optional events" demo.
 * PROTOTYPE ONLY (see SPEC_REQUIRED_RSVP_OPTIONAL_EVENTS.md).
 *
 * Shows the proposed decoupling: "attendance required" and "RSVP required" become
 * two independent switches, and a live preview explains the resulting behavior.
 * Mock only — does not create events or change the real RSVP-generation rule.
 * Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function RsvpOptionalScreen() {
  const navigation = useNavigation();
  const [attendance, setAttendance] = useState(false); // mandatory attendance
  const [rsvp, setRsvp]             = useState(true);   // require a head-count RSVP

  useEffect(() => { navigation.setOptions({ title: 'RSVP settings' }); }, [navigation]);

  const summary =
    attendance && rsvp   ? 'Mandatory event. Members must attend and RSVP — today’s mandatory behavior.' :
    !attendance && rsvp  ? 'Optional event with a required RSVP. Attendance isn’t required, but everyone must say yes/no so you get a head count. (This is the NEW capability.)' :
    attendance && !rsvp  ? 'Mandatory attendance, no RSVP asked. Unusual — you’d expect a head count.' :
                           'Fully optional. No attendance obligation and no RSVP requested.';

  const isNew = !attendance && rsvp;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · settings preview, nothing saved</Text></View>

      <Text style={s.heading}>Event response settings</Text>
      <Text style={s.sub}>Today these are tied together. The proposal: make them two independent switches.</Text>

      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={s.toggleBody}>
            <Text style={s.toggleTitle}>Attendance required</Text>
            <Text style={s.toggleHint}>Members are expected to show up.</Text>
          </View>
          <Switch value={attendance} onValueChange={setAttendance} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
        <View style={s.divider} />
        <View style={s.toggleRow}>
          <View style={s.toggleBody}>
            <Text style={s.toggleTitle}>RSVP required</Text>
            <Text style={s.toggleHint}>Members must respond yes/no for a head count.</Text>
          </View>
          <Switch value={rsvp} onValueChange={setRsvp} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
      </View>

      <View style={[s.preview, isNew && s.previewNew]}>
        <Text style={s.previewLabel}>{isNew ? 'NEW CAPABILITY' : 'RESULT'}</Text>
        <Text style={s.previewText}>{summary}</Text>
      </View>

      <Text style={s.footNote}>
        Real version adds one boolean to the event model + tweaks the RSVP-task rule
        (currently audience-driven). Small, self-contained — slots in at the
        schema phase.
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

  card:      { backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  toggleBody:{ flex: 1 },
  toggleTitle:{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  toggleHint:{ fontSize: 12, color: '#64748b', marginTop: 2 },
  divider:   { height: 1, backgroundColor: '#0f172a' },

  preview:    { marginTop: 18, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', padding: 16 },
  previewNew: { borderColor: '#166534', backgroundColor: '#052e16' },
  previewLabel:{ fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 6 },
  previewText:{ fontSize: 14, color: '#cbd5e1', lineHeight: 20 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
