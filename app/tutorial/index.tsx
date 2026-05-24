/**
 * app/tutorial/index.tsx — first-use welcome walkthrough prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md §6).
 *
 * A short, skippable intro shown on first run / first login: a few friendly
 * slides explaining the core surfaces. Goal: understand the app without reading
 * docs. Mock (no "seen" flag persisted). Dev-only; not linked from phase-2, not
 * wired into the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Slide { icon: string; title: string; body: string }

const SLIDES: Slide[] = [
  { icon: '👋', title: 'Welcome to ChapterOPS', body: 'Run your chapter in one place — events, tasks, reports, and who’s responsible for what.' },
  { icon: '🏠', title: 'Today', body: 'Your home base. See what needs your attention now: tasks due, RSVPs, and today’s events — tuned to your role.' },
  { icon: '📅', title: 'Calendar', body: 'A month view of everything. Tap any day to see its events and tasks due.' },
  { icon: '✅', title: 'Tasks', body: 'What you owe and (for officers) what you’re reviewing. Submit work, RSVP, and approve — all here.' },
  { icon: '➕', title: 'Create & delegate', body: 'Officers create events and tasks, apply templates, and delegate down the leadership tree to their committee.' },
  { icon: '🧭', title: 'You’re set', body: 'You can reopen this walkthrough anytime from the Me tab. Let’s go!' },
];

export default function TutorialScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [i, setI]  = useState(0);

  useEffect(() => { navigation.setOptions({ title: 'Welcome', headerBackVisible: false }); }, [navigation]);

  const last  = SLIDES.length - 1;
  const slide = SLIDES[i];

  function finish() { router.back(); }

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE</Text></View>
        {i < last && (
          <Pressable onPress={finish} hitSlop={8}><Text style={s.skip}>Skip</Text></Pressable>
        )}
      </View>

      <View style={s.body}>
        <View style={s.iconCircle}><Text style={s.icon}>{slide.icon}</Text></View>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.text}>{slide.body}</Text>
      </View>

      {/* Progress dots */}
      <View style={s.dots}>
        {SLIDES.map((_, idx) => (
          <View key={idx} style={[s.dot, idx === i && s.dotActive]} />
        ))}
      </View>

      <View style={s.nav}>
        {i > 0 ? (
          <Pressable style={s.backBtn} onPress={() => setI(i - 1)}><Text style={s.backText}>Back</Text></Pressable>
        ) : <View style={s.backBtn} />}
        <Pressable style={s.nextBtn} onPress={() => (i < last ? setI(i + 1) : finish())}>
          <Text style={s.nextText}>{i < last ? 'Next' : 'Get started'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },

  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  protoBadge: { backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  skip:       { color: '#64748b', fontSize: 15, fontWeight: '600' },

  body:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center' },
  icon:       { fontSize: 44 },
  title:      { fontSize: 26, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  text:       { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, paddingHorizontal: 8 },

  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e293b' },
  dotActive: { backgroundColor: '#6366f1', width: 22 },

  nav:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:  { width: 72, paddingVertical: 14 },
  backText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  nextBtn:  { flex: 1, backgroundColor: '#1e3a5f', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  nextText: { color: '#60a5fa', fontSize: 16, fontWeight: '700' },
});
