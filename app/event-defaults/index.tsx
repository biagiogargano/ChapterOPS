/**
 * app/event-defaults/index.tsx — per-event-type automation defaults (prototype).
 * PROTOTYPE / mock. Owner sets, per event type, what auto-generates (agenda +
 * template sections, attendance, RSVP). The persistent "set the rules once"
 * companion to the first-run per-event prompts. In-memory; dev-only; not in
 * phase-2 / the alpha.
 */

import {
  AGENDA_SECTIONS,
  EVENT_TYPES,
  getDefaults,
  setDefault,
  summarize,
  toggleSection,
  useEventDefaultsVersion,
} from '@/lib/eventDefaults/mockEventDefaults';
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function EventDefaultsScreen() {
  const navigation = useNavigation();
  useEventDefaultsVersion();
  const [typeId, setTypeId] = useState('chapter');

  useEffect(() => { navigation.setOptions({ title: 'Event automation' }); }, [navigation]);

  const d = getDefaults(typeId);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · defaults, in-memory only</Text></View>

      <Text style={s.heading}>Event automation</Text>
      <Text style={s.sub}>Set what each type of event sets up by default. The app suggests; you decide. Event creation pre-fills these (and you can still tweak per event).</Text>

      {/* Type selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={s.chips}>
          {EVENT_TYPES.map(t => (
            <Pressable key={t.id} style={[s.chip, typeId === t.id && s.chipOn]} onPress={() => setTypeId(t.id)}>
              <Text style={[s.chipText, typeId === t.id && s.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={s.summary}>{EVENT_TYPES.find(t => t.id === typeId)?.label}: {summarize(typeId)}</Text>

      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Auto-populate agenda</Text></View>
          <Switch value={d.autoAgenda} onValueChange={(v) => setDefault(typeId, 'autoAgenda', v)} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
        {d.autoAgenda && (
          <View style={s.picker}>
            <Text style={s.pickLabel}>Agenda template — include:</Text>
            {AGENDA_SECTIONS.map(sx => {
              const on = d.agendaSections.includes(sx);
              return (
                <Pressable key={sx} style={s.checkRow} onPress={() => toggleSection(typeId, sx)}>
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
          <View style={{ flex: 1 }}><Text style={s.toggleTitle}>Attendance task</Text><Text style={s.toggleHint}>Annotator · opens at start, due ~1h after</Text></View>
          <Switch value={d.autoAttendance} onValueChange={(v) => setDefault(typeId, 'autoAttendance', v)} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
        <View style={s.divider} />
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}><Text style={s.toggleTitle}>RSVP / head count</Text></View>
          <Switch value={d.autoRsvp} onValueChange={(v) => setDefault(typeId, 'autoRsvp', v)} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
      </View>

      <Text style={s.footNote}>These defaults would pre-fill the event-create screen; real persistence + applying them to generated tasks comes with the task-engine/schema phase.</Text>
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  chips:    { flexDirection: 'row', gap: 8 },
  chip:     { backgroundColor: '#1e293b', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: '#334155' },
  chipOn:   { backgroundColor: '#1e1b4b', borderColor: '#6366f1' },
  chipText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  chipTextOn:{ color: '#a5b4fc' },

  summary: { fontSize: 13, color: '#818cf8', fontWeight: '600', marginBottom: 12 },

  card:       { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle:{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  toggleHint: { fontSize: 12, color: '#64748b', marginTop: 2 },
  divider:    { height: 1, backgroundColor: '#0f172a', marginVertical: 12 },

  picker:    { marginTop: 14, gap: 4 },
  pickLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  check:     { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  checkOn:   { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tick:      { color: '#fff', fontWeight: '800', fontSize: 11 },
  checkText: { fontSize: 14, color: '#94a3b8' },
  checkTextOn:{ color: '#f1f5f9', fontWeight: '500' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 18 },
});
