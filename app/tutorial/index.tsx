/**
 * app/tutorial/index.tsx — annotated click-through walkthrough prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md §6).
 *
 * A guided tour that actually shows how the app works: each step renders a mock of
 * a real screen (Today / Calendar / Tasks / Create / Me) with a HIGHLIGHT ring, an
 * ARROW, and an annotation callout pointing at the key element. Advance with Next
 * or by tapping the highlighted element. Mock-only (no "seen" flag persisted).
 * Dev-only; not linked from phase-2, not wired into the alpha.
 */

import { KIND_COLORS } from '@/lib/mockEvents';
import { ENTITY_COLORS } from '@/lib/ui/entityColors';
import { tierColor } from '@/lib/orgTemplates/tiers';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const TASK_YELLOW = ENTITY_COLORS.task;

// ─── Small building blocks ────────────────────────────────────────────────────

/** Annotation bubble with a triangle arrow pointing down at the element below it. */
function Callout({ text }: { text: string }) {
  return (
    <View style={s.calloutWrap}>
      <View style={s.callout}><Text style={s.calloutText}>{text}</Text></View>
      <View style={s.arrowDown} />
    </View>
  );
}

/** A faux phone-screen frame that holds a step's mock UI. */
function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <View style={s.device}>
      <View style={s.deviceBar}><Text style={s.deviceBarText}>{name}</Text></View>
      <View style={s.deviceBody}>{children}</View>
    </View>
  );
}

// ─── Steps ──────────────────────────────────────────────────────────────────

interface Step { title: string; render: (onTapTarget: () => void) => ReactNode }

const STEPS: Step[] = [
  // 0 — Welcome (no mock)
  {
    title: 'Welcome to ChapterOPS',
    render: () => (
      <View style={s.welcome}>
        <View style={s.welcomeIcon}><Text style={{ fontSize: 46 }}>👋</Text></View>
        <Text style={s.welcomeTitle}>Run your chapter in one place</Text>
        <Text style={s.welcomeBody}>
          Everything is an <Text style={s.b}>event</Text> or a <Text style={s.b}>task</Text>. This
          quick tour shows where things live — tap <Text style={s.b}>Next</Text>, or tap the
          highlighted spot on each screen.
        </Text>
      </View>
    ),
  },

  // 1 — Today
  {
    title: 'Today',
    render: (tap) => (
      <Screen name="Today">
        <Text style={s.mGreeting}>Good morning, Biagio</Text>
        <Text style={s.mChapter}>SIGMA CHI · PRESIDENT</Text>
        <Callout text="Today shows your tasks due, today's events, and what's coming up — tuned to your role." />
        <Pressable onPress={tap} style={[s.mSection, s.ring]}>
          <Text style={s.mLabel}>TODAY'S TASKS</Text>
          <View style={s.mCard}><View style={[s.mStripe, { backgroundColor: TASK_YELLOW }]} /><Text style={s.mCardText}>Submit budget report</Text></View>
          <View style={s.mCard}><View style={[s.mStripe, { backgroundColor: TASK_YELLOW }]} /><Text style={s.mCardText}>Approve flyer · REVIEW</Text></View>
        </Pressable>
        <Text style={s.mLabel}>TODAY'S EVENTS</Text>
        <View style={s.mCard}><View style={[s.mStripe, { backgroundColor: KIND_COLORS.chapter }]} /><Text style={s.mCardText}>Chapter Meeting · 8:00 PM</Text></View>
      </Screen>
    ),
  },

  // 2 — Calendar
  {
    title: 'Calendar',
    render: (tap) => (
      <Screen name="Calendar">
        <Text style={s.mMonth}>October 2026</Text>
        <Callout text="Tap any day to see its events and tasks. Dots are color-coded by type." />
        <View style={s.calGrid}>
          {Array.from({ length: 21 }).map((_, i) => {
            const isTarget = i === 10;
            const dots = i === 10 ? [KIND_COLORS.chapter, KIND_COLORS.social, TASK_YELLOW]
                      : i === 4 ? [KIND_COLORS.eboard]
                      : i === 15 ? [KIND_COLORS.recruitment, TASK_YELLOW]
                      : [];
            return (
              <Pressable key={i} onPress={isTarget ? tap : undefined} style={[s.calCell, isTarget && s.ringTight]}>
                <Text style={s.calNum}>{i + 1}</Text>
                <View style={s.calDots}>{dots.map((c, di) => <View key={di} style={[s.calDot, { backgroundColor: c }]} />)}</View>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    ),
  },

  // 3 — Tasks
  {
    title: 'Tasks',
    render: (tap) => (
      <Screen name="Tasks">
        <Text style={s.mLabel}>MY TASKS</Text>
        <Callout text="All your tasks in one list. Filter, sort, and check them off — completed ones hide automatically." />
        <Pressable onPress={tap} style={[s.mFilterRow, s.ring]}>
          <Text style={s.mFilterChip}>Status ▾</Text>
          <Text style={s.mFilterChip}>Sort: Due ▾</Text>
          <Text style={s.mFilterToggle}>☐ Show completed</Text>
        </Pressable>
        <View style={s.mCard}><View style={[s.mStripe, { backgroundColor: TASK_YELLOW }]} /><Text style={s.mCardText}>Collect dues receipts</Text></View>
        <View style={s.mCard}><View style={[s.mStripe, { backgroundColor: TASK_YELLOW }]} /><Text style={s.mCardText}>Reserve venue · REVIEW</Text></View>
      </Screen>
    ),
  },

  // 4 — Create
  {
    title: 'Create',
    render: (tap) => (
      <Screen name="Create">
        <Text style={s.mGreeting}>Create</Text>
        <Callout text="Officers add an Event or a Task here. A poll is just a one-question task; announcements & groups come later." />
        <View style={s.createGrid}>
          <Pressable onPress={tap} style={[s.createTile, s.ring, { borderTopColor: ENTITY_COLORS.event }]}>
            <Text style={{ fontSize: 22 }}>📅</Text><Text style={s.createTileText}>Event</Text>
          </Pressable>
          <View style={[s.createTile, { borderTopColor: ENTITY_COLORS.task }]}>
            <Text style={{ fontSize: 22 }}>✅</Text><Text style={s.createTileText}>Task</Text>
          </View>
          <View style={[s.createTile, s.createTileDim]}>
            <Text style={{ fontSize: 22 }}>📣</Text><Text style={s.createTileText}>Announcement</Text>
          </View>
          <View style={[s.createTile, s.createTileDim]}>
            <Text style={{ fontSize: 22 }}>👥</Text><Text style={s.createTileText}>Group</Text>
          </View>
        </View>
      </Screen>
    ),
  },

  // 5 — Me / structure
  {
    title: 'You & your role',
    render: (tap) => (
      <Screen name="Me">
        <View style={s.meCard}>
          <View style={s.meAvatar}><Text style={s.meAvatarText}>BG</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.meName}>Biagio Gargano</Text>
            <Text style={s.meOrg}>Sigma Chi</Text>
            <Pressable onPress={tap} style={[s.mePill, s.ringTight, { backgroundColor: tierColor('lead') + '33', borderColor: tierColor('lead') }]}>
              <Text style={[s.mePillText, { color: tierColor('lead') }]}>President ›</Text>
            </Pressable>
          </View>
        </View>
        <Callout text="Tap your role to see the org structure — tiers, your teammates, and who does what." />
        <View style={s.meRow}><Text style={s.meRowText}>Settings</Text><Text style={s.meChevron}>›</Text></View>
      </Screen>
    ),
  },

  // 6 — Done
  {
    title: "You're set",
    render: () => (
      <View style={s.welcome}>
        <View style={s.welcomeIcon}><Text style={{ fontSize: 46 }}>🧭</Text></View>
        <Text style={s.welcomeTitle}>That's the tour</Text>
        <Text style={s.welcomeBody}>
          Reopen this anytime from the <Text style={s.b}>Me</Text> tab. Next, set up your
          organization — choose a type, pick your roles, and invite people.
        </Text>
      </View>
    ),
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TutorialScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [i, setI]  = useState(0);

  useEffect(() => { navigation.setOptions({ title: 'How it works', headerBackVisible: false }); }, [navigation]);

  const last = STEPS.length - 1;
  const step = STEPS[i];

  function next()   { i < last ? setI(i + 1) : finish(); }
  function finish() { router.back(); }
  function setup()  { router.replace('/setup' as any); }

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · walkthrough</Text></View>
        {i < last && <Pressable onPress={finish} hitSlop={8}><Text style={s.skip}>Skip</Text></Pressable>}
      </View>

      <Text style={s.stepTitle}>{step.title}</Text>

      <ScrollView contentContainerStyle={s.stage} showsVerticalScrollIndicator={false}>
        {step.render(next)}
      </ScrollView>

      <View style={s.dots}>
        {STEPS.map((_, idx) => <View key={idx} style={[s.dot, idx === i && s.dotActive]} />)}
      </View>

      <View style={s.nav}>
        {i > 0 ? (
          <Pressable style={s.backBtn} onPress={() => setI(i - 1)}><Text style={s.backText}>Back</Text></Pressable>
        ) : <View style={s.backBtn} />}
        {i < last ? (
          <Pressable style={s.nextBtn} onPress={next}><Text style={s.nextText}>Next</Text></Pressable>
        ) : (
          <Pressable style={s.nextBtn} onPress={setup}><Text style={s.nextText}>Set up my org ›</Text></Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },

  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  protoBadge: { backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  skip:       { color: '#64748b', fontSize: 15, fontWeight: '600' },

  stepTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginTop: 14, marginBottom: 8 },
  stage:     { paddingVertical: 6, gap: 8 },

  // Welcome / done
  welcome:     { alignItems: 'center', gap: 14, paddingVertical: 30 },
  welcomeIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center' },
  welcomeTitle:{ fontSize: 22, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  welcomeBody: { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, paddingHorizontal: 6 },
  b:           { color: '#e2e8f0', fontWeight: '700' },

  // Device frame
  device:        { borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', backgroundColor: '#0b1322', overflow: 'hidden' },
  deviceBar:     { backgroundColor: '#020617', paddingVertical: 8, alignItems: 'center' },
  deviceBarText: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  deviceBody:    { padding: 14, gap: 8 },

  // Callout + arrow
  calloutWrap:  { alignItems: 'center', marginVertical: 4 },
  callout:      { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  calloutText:  { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  arrowDown:    { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#4f46e5' },

  // Highlight ring (the "look here" coach-mark)
  ring:      { borderWidth: 2, borderColor: '#fbbf24', borderRadius: 12, padding: 8 },
  ringTight: { borderWidth: 2, borderColor: '#fbbf24', borderRadius: 10 },

  // Generic mock bits
  mGreeting: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  mChapter:  { fontSize: 10, fontWeight: '700', color: '#6366f1', letterSpacing: 0.5, marginBottom: 4 },
  mMonth:    { fontSize: 15, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 4 },
  mSection:  { gap: 6 },
  mLabel:    { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.6, marginTop: 4 },
  mCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 9, overflow: 'hidden' },
  mStripe:   { width: 4, alignSelf: 'stretch' },
  mCardText: { flex: 1, fontSize: 13, color: '#e2e8f0', fontWeight: '600', padding: 10 },

  // Calendar mock
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  calNum:  { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  calDots: { flexDirection: 'row', gap: 2, height: 6 },
  calDot:  { width: 5, height: 5, borderRadius: 3 },

  // Tasks mock
  mFilterRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mFilterChip:   { fontSize: 12, color: '#a5b4fc', fontWeight: '600', backgroundColor: '#1e1b4b', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  mFilterToggle: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // Create mock
  createGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  createTile: { width: '48%', backgroundColor: '#1e293b', borderRadius: 12, borderTopWidth: 3, borderTopColor: '#334155', paddingVertical: 14, alignItems: 'center', gap: 6 },
  createTileText: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
  createTileDim:  { opacity: 0.5, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155', borderTopWidth: 1 },

  // Me mock
  meCard:      { flexDirection: 'row', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 12 },
  meAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  meAvatarText:{ color: '#fff', fontWeight: '800' },
  meName:      { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
  meOrg:       { fontSize: 12, color: '#64748b' },
  mePill:      { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, marginTop: 5 },
  mePillText:  { fontSize: 12, fontWeight: '700' },
  meRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  meRowText:   { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  meChevron:   { fontSize: 18, color: '#475569' },

  // Progress + nav
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 7, marginVertical: 16 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1e293b' },
  dotActive: { backgroundColor: '#6366f1', width: 20 },
  nav:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:  { width: 72, paddingVertical: 14 },
  backText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  nextBtn:  { flex: 1, backgroundColor: '#1e3a5f', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f6' },
  nextText: { color: '#60a5fa', fontSize: 16, fontWeight: '700' },
});
