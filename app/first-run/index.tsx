/**
 * app/first-run/index.tsx — first-time experience prototype.
 * PROTOTYPE / mock. Logging into an EMPTY chapter: a friendly empty state that
 * routes into the SAME real flows used everywhere — "Create your first event"
 * opens the actual event-create screen (so the first event creation looks
 * exactly like every later one), and a 1-minute tour. No bespoke mock form.
 * Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function FirstRunScreen() {
  const navigation = useNavigation();
  const router     = useRouter();

  useEffect(() => { navigation.setOptions({ title: 'Welcome' }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · first-run experience</Text></View>

      <View style={s.emptyIcon}><Text style={{ fontSize: 40 }}>🌱</Text></View>
      <Text style={s.h1}>Welcome to your chapter</Text>
      <Text style={s.body}>
        It’s empty right now — that’s normal. Add your first event or task to get
        going. The app suggests sensible defaults; you stay in control.
      </Text>

      <Pressable style={s.primary} onPress={() => router.push('/event/create' as any)}>
        <Text style={s.primaryText}>Create your first event</Text>
      </Pressable>
      <Pressable style={s.secondary} onPress={() => router.push('/task/create' as any)}>
        <Text style={s.secondaryText}>…or create a task</Text>
      </Pressable>

      <Pressable style={s.ghost} onPress={() => router.push('/tutorial' as any)}>
        <Text style={s.ghostText}>Take the 1-minute tour ›</Text>
      </Pressable>

      <Text style={s.hint}>
        Tip: creating an event here uses the exact same screen you’ll always use —
        no special first-time form. Event creation includes a “Generate agenda”
        option for meetings.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 14 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  emptyIcon: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  h1:   { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body: { fontSize: 14, color: '#94a3b8', lineHeight: 20, textAlign: 'center' },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 6 },

  primary:     { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  secondary:    { alignItems: 'center', paddingVertical: 8 },
  secondaryText:{ color: '#818cf8', fontSize: 14, fontWeight: '600' },
  ghost:       { alignSelf: 'center', paddingVertical: 6 },
  ghostText:   { color: '#818cf8', fontSize: 14, fontWeight: '600' },
});
