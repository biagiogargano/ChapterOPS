/**
 * app/first-run/index.tsx — first-time user experience prototype.
 * PROTOTYPE / mock. Simulates logging into an EMPTY chapter and being guided:
 * empty state → create your first event → customize what that event sets up
 * (auto-agenda + template, attendance, RSVP) → see what it created. Embodies
 * "all the power is the user's, but the app shows them how to use it." Nothing
 * saved; dev-only; not in phase-2 / the alpha.
 */

import { ROLE_LABELS } from '@/lib/roles';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Phase = 'welcome' | 'event' | 'customize' | 'result';

const KINDS = [
  { id: 'chapter', label: 'Chapter meeting', meeting: true },
  { id: 'eboard',  label: 'E-board meeting', meeting: true },
  { id: 'social',  label: 'Social',          meeting: false },
  { id: 'philanthropy', label: 'Philanthropy', meeting: false },
  { id: 'other',   label: 'Other',           meeting: false },
];
const AGENDA_SECTIONS = ['Old business', 'New business', 'Officer announcements', 'Help needed', 'Unresolved items'];

export default function FirstRunScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [phase, setPhase] = useState<Phase>('welcome');

  const [title, setTitle] = useState('Chapter Meeting');
  const [kind, setKind]   = useState('chapter');
  const isMeeting = KINDS.find(k => k.id === kind)?.meeting ?? false;

  const [autoAgenda, setAutoAgenda]     = useState(true);
  const [sections, setSections]         = useState<string[]>(AGENDA_SECTIONS.slice(0, 4));
  const [autoAttendance, setAutoAttend] = useState(true);
  const [autoRsvp, setAutoRsvp]         = useState(true);

  useEffect(() => { navigation.setOptions({ title: 'Welcome' }); }, [navigation]);
  // Sensible defaults flip with the event type (the app suggests; user decides).
  useEffect(() => { setAutoAgenda(isMeeting); setAutoAttend(isMeeting); }, [isMeeting]);

  function toggleSection(sx: string) {
    setSections(prev => prev.includes(sx) ? prev.filter(x => x !== sx) : [...prev, sx]);
  }

  const created: string[] = [];
  if (autoAgenda)     created.push(`Auto-agenda (${sections.length} sections)`);
  if (autoAttendance) created.push(`Attendance task → ${ROLE_LABELS.annotator}`);
  if (autoRsvp)       created.push('RSVP / head-count task → all members');

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · first-run experience, nothing saved</Text></View>

        {/* ── Welcome / empty state ── */}
        {phase === 'welcome' && (
          <View style={s.block}>
            <View style={s.emptyIcon}><Text style={{ fontSize: 40 }}>🌱</Text></View>
            <Text style={s.h1}>Welcome to your chapter</Text>
            <Text style={s.body}>
              It’s empty right now — that’s normal. The app will walk you through
              everything, and you stay in control of how it all works.
            </Text>
            <Pressable style={s.ghost} onPress={() => router.push('/tutorial' as any)}>
              <Text style={s.ghostText}>Take the 1-minute tour ›</Text>
            </Pressable>
            <Pressable style={s.primary} onPress={() => setPhase('event')}>
              <Text style={s.primaryText}>Create your first event</Text>
            </Pressable>
            <Text style={s.hint}>Tip: most things in the app are customizable — the app just suggests sensible defaults.</Text>
          </View>
        )}

        {/* ── Event basics ── */}
        {phase === 'event' && (
          <View style={s.block}>
            <Text style={s.h2}>Your first event</Text>
            <Text style={s.label}>NAME</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Event name" placeholderTextColor="#475569" />
            <Text style={s.label}>TYPE</Text>
            <View style={s.chips}>
              {KINDS.map(k => (
                <Pressable key={k.id} style={[s.chip, kind === k.id && s.chipOn]} onPress={() => setKind(k.id)}>
                  <Text style={[s.chipText, kind === k.id && s.chipTextOn]}>{k.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.primary} onPress={() => setPhase('customize')}><Text style={s.primaryText}>Next</Text></Pressable>
            <Pressable style={s.back} onPress={() => setPhase('welcome')}><Text style={s.backText}>Back</Text></Pressable>
          </View>
        )}

        {/* ── Customize what the event sets up (the key idea) ── */}
        {phase === 'customize' && (
          <View style={s.block}>
            <Text style={s.h2}>What should this event set up?</Text>
            <Text style={s.body}>The app suggests defaults for a {KINDS.find(k => k.id === kind)?.label.toLowerCase()}. Change anything — it’s your call.</Text>

            <View style={s.card}>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Auto-populate an agenda</Text>
                  <Text style={s.toggleHint}>Draft a meeting agenda from chapter data.</Text>
                </View>
                <Switch value={autoAgenda} onValueChange={setAutoAgenda} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
              </View>

              {autoAgenda && (
                <View style={s.sectionPicker}>
                  <Text style={s.pickLabel}>Agenda template — include:</Text>
                  {AGENDA_SECTIONS.map(sx => {
                    const on = sections.includes(sx);
                    return (
                      <Pressable key={sx} style={s.checkRow} onPress={() => toggleSection(sx)}>
                        <View style={[s.check, on && s.checkOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
                        <Text style={[s.checkText, on && s.checkTextOn]}>{sx}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={s.card}>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Attendance task</Text>
                  <Text style={s.toggleHint}>An {ROLE_LABELS.annotator} task that opens when it starts.</Text>
                </View>
                <Switch value={autoAttendance} onValueChange={setAutoAttend} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
              </View>
              <View style={s.divider} />
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>RSVP / head count</Text>
                  <Text style={s.toggleHint}>Ask members to respond yes/no.</Text>
                </View>
                <Switch value={autoRsvp} onValueChange={setAutoRsvp} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
              </View>
            </View>

            <Pressable style={s.primary} onPress={() => setPhase('result')}><Text style={s.primaryText}>Create event</Text></Pressable>
            <Pressable style={s.back} onPress={() => setPhase('event')}><Text style={s.backText}>Back</Text></Pressable>
            <Text style={s.hint}>You can change these defaults for every event type later in Settings.</Text>
          </View>
        )}

        {/* ── Result ── */}
        {phase === 'result' && (
          <View style={s.block}>
            <Text style={s.h1}>🎉 “{title}” is set up</Text>
            <Text style={s.body}>Here’s what the app created for you automatically — because you chose to:</Text>
            {created.length === 0 ? (
              <Text style={s.hint}>Just the event itself — no extras. That’s fine too.</Text>
            ) : (
              created.map((c, i) => (
                <View key={i} style={s.createdRow}><Text style={s.createdTick}>✓</Text><Text style={s.createdText}>{c}</Text></View>
              ))
            )}
            <Text style={s.hint}>This is the whole idea: the app does the busywork, you decide the rules. Everything here is customizable.</Text>
            <Pressable style={s.primary} onPress={() => router.back()}><Text style={s.primaryText}>Got it</Text></Pressable>
            <Pressable style={s.back} onPress={() => setPhase('welcome')}><Text style={s.backText}>Start over</Text></Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 18, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  block: { gap: 12 },
  emptyIcon: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  h1:   { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  h2:   { fontSize: 21, fontWeight: '800', color: '#f8fafc' },
  body: { fontSize: 14, color: '#94a3b8', lineHeight: 20, textAlign: 'left' },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 4 },

  label: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginTop: 8 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { backgroundColor: '#1e293b', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: '#334155' },
  chipOn:   { backgroundColor: '#1e1b4b', borderColor: '#6366f1' },
  chipText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  chipTextOn:{ color: '#a5b4fc' },

  card:       { backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle:{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  toggleHint: { fontSize: 12, color: '#64748b', marginTop: 2 },
  divider:    { height: 1, backgroundColor: '#0f172a', marginVertical: 12 },

  sectionPicker: { marginTop: 14, gap: 4 },
  pickLabel:  { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  check:      { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  checkOn:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tick:       { color: '#fff', fontWeight: '800', fontSize: 11 },
  checkText:  { fontSize: 14, color: '#94a3b8' },
  checkTextOn:{ color: '#f1f5f9', fontWeight: '500' },

  createdRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#052e16', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#166534' },
  createdTick: { color: '#4ade80', fontWeight: '800', fontSize: 14 },
  createdText: { color: '#86efac', fontSize: 14, fontWeight: '600', flex: 1 },

  primary:     { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  ghost:       { alignSelf: 'center', paddingVertical: 6 },
  ghostText:   { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  back:        { alignSelf: 'center', paddingVertical: 10 },
  backText:    { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
