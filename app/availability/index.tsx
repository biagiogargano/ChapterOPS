/**
 * app/availability/index.tsx — generated time-slot picker prototype.
 * PROTOTYPE ONLY (the reusable scheduler from QUESTIONNAIRE_REPORTS_PLAN.md §3).
 *
 * Generates selectable slots from a start/end + interval and lets you mark which
 * you're free — reusable for availability, interviews, sign-ups. Local mock
 * state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const START_HOUR = 16;   // 4 PM
const END_HOUR   = 20;   // 8 PM
const INTERVAL   = 60;   // minutes

function genSlots(): string[] {
  const slots: string[] = [];
  for (let m = START_HOUR * 60; m < END_HOUR * 60; m += INTERVAL) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    slots.push(`${h12}:${String(mm).padStart(2, '0')} ${ampm}`);
  }
  return slots;
}

export default function AvailabilityScreen() {
  const navigation = useNavigation();
  const slots = useMemo(genSlots, []);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => { navigation.setOptions({ title: 'Availability' }); }, [navigation]);

  function toggle(key: string) {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · generated slots, nothing saved</Text></View>

      <Text style={s.heading}>When are you free?</Text>
      <Text style={s.sub}>Slots auto-generated from 4–8 PM, {INTERVAL}-min. Tap the times that work.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={s.row}>
            <View style={s.timeCol} />
            {DAYS.map(d => <View key={d} style={s.dayHead}><Text style={s.dayText}>{d}</Text></View>)}
          </View>
          {slots.map(slot => (
            <View key={slot} style={s.row}>
              <View style={s.timeCol}><Text style={s.timeText}>{slot}</Text></View>
              {DAYS.map(d => {
                const key = `${d} ${slot}`;
                const on = picked.has(key);
                return (
                  <Pressable key={key} style={[s.cell, on && s.cellOn]} onPress={() => toggle(key)}>
                    {on && <Text style={s.cellTick}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={s.count}>{picked.size} slot{picked.size === 1 ? '' : 's'} selected</Text>
      <Text style={s.footNote}>
        Same generated-slot component the questionnaire engine reuses for
        availability, interview sign-ups, and scheduling.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const CELL = 52;

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  row:     { flexDirection: 'row', alignItems: 'center' },
  timeCol: { width: 72, paddingRight: 8, alignItems: 'flex-end' },
  timeText:{ fontSize: 12, color: '#64748b' },
  dayHead: { width: CELL, alignItems: 'center', paddingBottom: 8 },
  dayText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  cell:    { width: CELL - 6, height: CELL - 14, marginHorizontal: 3, marginBottom: 6, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  cellOn:  { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  cellTick:{ color: '#fff', fontWeight: '800', fontSize: 14 },

  count:    { fontSize: 13, color: '#a5b4fc', fontWeight: '600', marginTop: 12 },
  footNote: { fontSize: 12, color: '#475569', marginTop: 12, lineHeight: 18 },
});
