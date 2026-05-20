import { useDevRole } from '@/lib/devRoleStore';
import { fetchAllEvents } from '@/lib/eventService';
import { getAllEvents, setSupabaseEventCache } from '@/lib/eventStore';
import {
  AUDIENCE_LABEL,
  DAY_LABELS,
  KIND_BG,
  KIND_COLORS,
  KIND_LABELS,
  getEventDate,
  type MockEvent,
} from '@/lib/mockEvents';
import { isOfficer } from '@/lib/roles';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// ─── Week navigation header ────────────────────────────────────────────────────

function WeekNavBar({
  weekOffset,
  onPrev,
  onNext,
}: {
  weekOffset: number;
  onPrev:     () => void;
  onNext:     () => void;
}) {
  const startDate = getEventDate(weekOffset * 7);
  const endDate   = getEventDate(weekOffset * 7 + 6);

  function fmt(d: Date): string {
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  }

  const label =
    weekOffset === 0  ? 'This Week'  :
    weekOffset === 1  ? 'Next Week'  :
    weekOffset === -1 ? 'Last Week'  :
    `${fmt(startDate)} – ${fmt(endDate)}`;

  const canGoPrev = weekOffset > -4;
  const canGoNext = weekOffset < 52;

  return (
    <View style={s.weekNav}>
      <Pressable
        style={[s.weekNavBtn, !canGoPrev && s.weekNavBtnDisabled]}
        onPress={onPrev}
        disabled={!canGoPrev}
      >
        <Text style={[s.weekNavArrow, !canGoPrev && s.weekNavArrowDisabled]}>‹</Text>
      </Pressable>

      <Text style={s.weekNavLabel}>{label}</Text>

      <Pressable
        style={[s.weekNavBtn, !canGoNext && s.weekNavBtnDisabled]}
        onPress={onNext}
        disabled={!canGoNext}
      >
        <Text style={[s.weekNavArrow, !canGoNext && s.weekNavArrowDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  selected,
  weekOffset,
  events,
  onSelect,
}: {
  selected:    number | null;   // absolute dayOffset (weekOffset*7 + 0..6), or null
  weekOffset:  number;
  events:      MockEvent[];
  onSelect:    (absOffset: number | null) => void;
}) {
  const today       = new Date();
  const todayOffset = (today.getDay() + 6) % 7; // 0=Mon … 6=Sun (within current week)

  return (
    <View style={s.weekStrip}>
      {DAY_LABELS.map((label, i) => {
        const absOffset = weekOffset * 7 + i;
        const date      = getEventDate(absOffset);
        const isToday   = weekOffset === 0 && i === todayOffset;
        const isSel     = selected === absOffset;
        const hasEvent  = events.some(e => e.dayOffset === absOffset);

        return (
          <Pressable
            key={label}
            style={[s.dayCell, isSel && s.dayCellSelected]}
            onPress={() => onSelect(isSel ? null : absOffset)}
          >
            <Text style={[s.dayLabel, isToday && s.dayLabelToday, isSel && s.dayLabelSelected]}>
              {label}
            </Text>
            <Text style={[s.dayNum, isToday && s.dayNumToday, isSel && s.dayNumSelected]}>
              {date.getDate()}
            </Text>
            {hasEvent && <View style={[s.dot, isSel && s.dotSelected]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, onPress }: { event: MockEvent; onPress: () => void }) {
  const date    = getEventDate(event.dayOffset);
  const dayIdx  = ((event.dayOffset % 7) + 7) % 7; // 0=Mon…6=Sun, handles negatives
  const dayStr  = DAY_LABELS[dayIdx] ?? '?';
  const dateStr = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
  const color   = KIND_COLORS[event.kind];
  const bg      = KIND_BG[event.kind];

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Date column */}
      <View style={s.dateCol}>
        <Text style={s.dateDay}>{dayStr}</Text>
        <Text style={s.dateNum}>{dateStr}</Text>
      </View>

      {/* Accent bar */}
      <View style={[s.accent, { backgroundColor: color }]} />

      {/* Content */}
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle}>{event.title}</Text>
          <View style={[s.kindBadge, { backgroundColor: bg }]}>
            <Text style={[s.kindText, { color }]}>{KIND_LABELS[event.kind]}</Text>
          </View>
          {event.isRecurring && (
            <View style={s.recurringBadge}>
              <Text style={s.recurringText}>↻</Text>
            </View>
          )}
        </View>
        <Text style={s.cardMeta}>{event.time} · {event.location}</Text>
        <View style={s.audienceBadge}>
          <Text style={s.audienceText}>{AUDIENCE_LABEL[event.audience]}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { role }   = useDevRole();
  const officer    = isOfficer(role);

  const [weekOffset,  setWeekOffset ] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Seed with local mock data immediately so the list is never blank,
  // then overwrite with Supabase data on every focus (with mock fallback).
  const [events, setEvents] = useState<MockEvent[]>(() => getAllEvents());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      fetchAllEvents().then(remote => {
        if (cancelled) return;

        // Push into the shared cache so Today / Tasks / Event Detail all use the
        // same Supabase UUID events. setSupabaseEventCache no-ops on empty input,
        // so getAllEvents() then returns the mock fallback automatically.
        setSupabaseEventCache(remote);
        setEvents(getAllEvents());
      });

      return () => { cancelled = true; };
    }, []),
  );

  // ── "+" button in header — officers only ────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: officer
        ? () => (
            <Pressable
              style={s.createBtn}
              onPress={() => router.push('/event/create' as any)}
            >
              <Text style={s.createBtnText}>+ Create</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [officer, navigation]);

  function goToWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    setSelectedDay(null); // deselect when changing weeks
  }

  // Events visible for the current week view
  const weekStart = weekOffset * 7;
  const weekEnd   = weekOffset * 7 + 6;
  const weekEvents = events.filter(e => e.dayOffset >= weekStart && e.dayOffset <= weekEnd);

  // If a day is selected, show only that day's events; otherwise show whole week
  const filtered = selectedDay === null
    ? weekEvents
    : events.filter(e => e.dayOffset === selectedDay);

  // Heading text for the list section
  function listHeading(): string {
    if (selectedDay !== null) {
      const d       = getEventDate(selectedDay);
      const dayIdx  = selectedDay - weekOffset * 7;  // 0–6
      const dayName = DAY_LABELS[dayIdx] ?? '';
      const dateStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
      return `${dayName}  ·  ${dateStr}`;
    }
    if (weekOffset === 0)  return 'This Week';
    if (weekOffset === 1)  return 'Next Week';
    if (weekOffset === -1) return 'Last Week';
    const s = getEventDate(weekStart);
    const e = getEventDate(weekEnd);
    const fmt = (d: Date) => `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
    return `${fmt(s)} – ${fmt(e)}`;
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Week navigation ‹ label › */}
      <WeekNavBar
        weekOffset={weekOffset}
        onPrev={() => goToWeek(-1)}
        onNext={() => goToWeek(+1)}
      />

      <WeekStrip
        selected={selectedDay}
        weekOffset={weekOffset}
        events={events}
        onSelect={setSelectedDay}
      />

      <View style={s.listHeader}>
        <Text style={s.listHeading}>{listHeading()}</Text>
        <Text style={s.listCount}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No events this {selectedDay !== null ? 'day' : 'week'}</Text>
          {officer && (
            <Pressable
              style={s.emptyCreateBtn}
              onPress={() => router.push('/event/create' as any)}
            >
              <Text style={s.emptyCreateText}>+ Create one</Text>
            </Pressable>
          )}
        </View>
      ) : (
        filtered.map(event => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => router.push(`/event/${event.id}` as any)}
          />
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 24 },

  // Header create button
  createBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  createBtnText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  // Week navigation bar
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  weekNavBtn:          { padding: 8 },
  weekNavBtnDisabled:  { opacity: 0.3 },
  weekNavArrow:        { fontSize: 22, color: '#818cf8', fontWeight: '700', lineHeight: 26 },
  weekNavArrowDisabled:{ color: '#475569' },
  weekNavLabel:        { fontSize: 15, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', flex: 1 },

  // Week strip
  weekStrip: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  dayCell:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, gap: 4 },
  dayCellSelected:  { backgroundColor: '#6366f1' },
  dayLabel:         { fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 0.3 },
  dayLabelToday:    { color: '#6366f1' },
  dayLabelSelected: { color: '#fff' },
  dayNum:           { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  dayNumToday:      { color: '#6366f1' },
  dayNumSelected:   { color: '#fff' },
  dot:              { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6366f1' },
  dotSelected:      { backgroundColor: '#fff' },

  // List header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  listHeading: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  listCount:   { fontSize: 13, color: '#475569' },

  // Empty state
  empty:           { alignItems: 'center', paddingVertical: 48 },
  emptyText:       { color: '#475569', fontSize: 15 },
  emptyCreateBtn:  { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1e1b4b', borderRadius: 8 },
  emptyCreateText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dateCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingLeft: 4,
  },
  dateDay: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.3 },
  dateNum: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  accent:  {
    width: 3, alignSelf: 'stretch',
    marginVertical: 10, borderRadius: 2, marginRight: 12,
  },
  cardBody:  { flex: 1, paddingVertical: 12, paddingRight: 14, gap: 4 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', flexShrink: 1 },
  kindBadge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  kindText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardMeta:  { fontSize: 13, color: '#64748b' },
  audienceBadge: { alignSelf: 'flex-start', marginTop: 2 },
  audienceText:  { fontSize: 11, color: '#94a3b8', fontWeight: '500' },

  // Recurring badge
  recurringBadge: {
    backgroundColor: '#1e1b4b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recurringText: { fontSize: 11, color: '#818cf8', fontWeight: '700' },
});
