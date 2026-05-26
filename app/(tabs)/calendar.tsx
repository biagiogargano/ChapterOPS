import { useDevRole } from '@/lib/devRoleStore';
import { getStoredState, refreshTaskStates, useTaskStateVersion } from '@/lib/devTaskStore';
import { fetchAllEvents } from '@/lib/eventService';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { getAllEvents, setSupabaseEventCache } from '@/lib/eventStore';
import { hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import {
  AUDIENCE_LABEL,
  KIND_BG,
  KIND_COLORS,
  KIND_LABELS,
  getEventDate,
  type EventKind,
  type MockEvent,
} from '@/lib/mockEvents';
import {
  DISPLAY_STATE_LABEL,
  STATE_BG,
  STATE_COLOR,
  dueLabelOf,
  filterTasksForRole,
  setSupabaseTaskCache,
  type MockTask,
} from '@/lib/mockTasks';
import { isOfficer } from '@/lib/roles';
import { isTaskCompleted, isRsvpTaskExpired } from '@/lib/taskCompletion';
import { useRsvpVersion } from '@/lib/rsvpStore';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

// ─── Date helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoFromParts(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Month grid ─────────────────────────────────────────────────────────────

function MonthGrid({
  year, month, todayIso, selectedIso, eventKinds, taskDays, onSelect,
}: {
  year:        number;
  month:       number;
  todayIso:    string;
  selectedIso: string;
  eventKinds:  Map<string, EventKind[]>;   // distinct event kinds per day → colored dots
  taskDays:    Set<string>;
  onSelect:    (iso: string) => void;
}) {
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();   // 0=Sun
  const firstOffset  = (firstWeekday + 6) % 7;              // Monday-based

  const cells: (number | null)[] = Array(firstOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={s.grid}>
      <View style={s.gridRow}>
        {WK_LABELS.map(w => <Text key={w} style={s.wkHead}>{w}</Text>)}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={s.gridRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={s.cell} />;
            const iso     = isoFromParts(year, month, day);
            const isToday = iso === todayIso;
            const isSel   = iso === selectedIso;
            const kinds   = eventKinds.get(iso) ?? [];
            const hasTask = taskDays.has(iso);
            return (
              <Pressable
                key={ci}
                style={[s.cell, isSel && s.cellSel, isToday && !isSel && s.cellToday]}
                onPress={() => onSelect(iso)}
              >
                <Text style={[s.cellNum, isSel && s.cellNumSel, isToday && !isSel && s.cellNumToday]}>{day}</Text>
                <View style={s.dotRow}>
                  {/* One colored dot per distinct event kind (up to 3), then a task dot. */}
                  {kinds.slice(0, 3).map((k, idx) => (
                    <View key={idx} style={[s.dot, { backgroundColor: isSel ? '#fff' : KIND_COLORS[k] }]} />
                  ))}
                  {hasTask && <View style={[s.dot, { backgroundColor: isSel ? '#fff' : '#fbbf24' }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Event card ─────────────────────────────────────────────────────────────

function EventCard({ event, onPress }: { event: MockEvent; onPress: () => void }) {
  const color = KIND_COLORS[event.kind];
  const bg    = KIND_BG[event.kind];
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={[s.accent, { backgroundColor: color }]} />
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle}>{event.title}</Text>
          <View style={[s.kindBadge, { backgroundColor: bg }]}>
            <Text style={[s.kindText, { color }]}>{KIND_LABELS[event.kind]}</Text>
          </View>
          {event.isRecurring && (
            <View style={s.recurringBadge}><Text style={s.recurringText}>↻</Text></View>
          )}
        </View>
        <Text style={s.cardMeta}>{event.time} · {event.location}</Text>
        <Text style={s.audienceText}>{AUDIENCE_LABEL[event.audience]}</Text>
      </View>
    </Pressable>
  );
}

// ─── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, onPress }: { task: MockTask; onPress: () => void }) {
  const state = getStoredState(task.id, task.state);
  return (
    <Pressable style={s.taskRow} onPress={onPress}>
      <View style={[s.taskStripe, { backgroundColor: STATE_COLOR[state] }]} />
      <View style={s.taskBody}>
        <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={s.taskMeta}>
          {dueLabelOf(task)}{task.linkedEvent ? `  ·  ${task.linkedEvent}` : ''}
        </Text>
      </View>
      <View style={[s.taskBadge, { backgroundColor: STATE_BG[state] }]}>
        <Text style={[s.taskBadgeText, { color: STATE_COLOR[state] }]}>{DISPLAY_STATE_LABEL[state]}</Text>
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

  useTaskStateVersion();   // re-render when task state changes (badges/dots)
  useRsvpVersion();        // re-render when an RSVP/date answer changes (completion)

  const today    = new Date();
  const todayIso = isoOf(today);

  const [viewYear,  setViewYear ] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedIso, setSelectedIso] = useState(todayIso);

  // Org id for data scoping (DEMO_CHAPTER_ID while ORG_SCOPED_DATA is false).
  const dataOrgId = useActiveDataOrgId();
  const [events, setEvents] = useState<MockEvent[]>(() => getAllEvents());

  // Clear local events synchronously on an actual org change (kept-alive tab).
  const prevOrg = useRef(dataOrgId);
  useLayoutEffect(() => {
    if (prevOrg.current !== dataOrgId) { setEvents([]); prevOrg.current = dataOrgId; }
  }, [dataOrgId]);

  // Refetch events from Supabase. Shared by the focus effect and pull-to-refresh
  // so a manual pull picks up another user's newly-created/edited events without
  // leaving the screen.
  const loadEvents = useCallback(async () => {
    const remote = await fetchAllEvents(dataOrgId);
    setSupabaseEventCache(remote);
    setEvents(getAllEvents());
  }, [dataOrgId]);

  // Manual pull-to-refresh: server-wins refetch of events + tasks + task states +
  // notices so another user's changes in the same org appear. (Calendar shows
  // events + tasks-due; no RSVP roster, so RSVP refresh is handled on Today/Event
  // detail.) Distinct from the focus effect (loadEvents = events only).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [remoteEvents, remoteTasks, remoteStates] = await Promise.all([
        fetchAllEvents(dataOrgId),
        fetchAllTasks(dataOrgId),
        fetchTaskStates(dataOrgId),
      ]);
      setSupabaseEventCache(remoteEvents);
      setSupabaseTaskCache(remoteTasks);
      refreshTaskStates(remoteStates);
      await hydrateUpdateNotices(dataOrgId);
      setEvents(getAllEvents());
    } finally {
      setRefreshing(false);
    }
  }, [dataOrgId]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataOrgId]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: officer
        ? () => (
            <Pressable style={s.createBtn} onPress={() => router.push('/event/create' as any)}>
              <Text style={s.createBtnText}>+ Create</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [officer, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map events to their real calendar date (getEventDate handles any dayOffset).
  const eventsByDate = useMemo(() => {
    const m = new Map<string, MockEvent[]>();
    for (const e of events) {
      const iso = isoOf(getEventDate(e.dayOffset));
      (m.get(iso) ?? m.set(iso, []).get(iso)!).push(e);
    }
    return m;
  }, [events]);

  // Role-visible OPEN tasks with a due date, keyed by due day. Completed tasks
  // (answered RSVPs, saved date names, approved tasks) are hidden — consistent
  // with Today/Tasks; the calendar shows what still needs doing. Not memoized so
  // it reflects task/RSVP completion immediately (component re-renders via the
  // version hooks above).
  const tasksByDate = (() => {
    const m = new Map<string, MockTask[]>();
    for (const t of filterTasksForRole(role)) {
      if (t.isWorkflowParent || !t.dueAt) continue;
      if (isTaskCompleted(t, role) || isRsvpTaskExpired(t)) continue;
      const iso = t.dueAt.slice(0, 10);
      (m.get(iso) ?? m.set(iso, []).get(iso)!).push(t);
    }
    return m;
  })();

  // Distinct event kinds per day, preserving first-seen order → colored dots.
  const eventKindsByDate = useMemo(() => {
    const m = new Map<string, EventKind[]>();
    for (const [iso, evs] of eventsByDate) {
      const seen: EventKind[] = [];
      for (const e of evs) if (!seen.includes(e.kind)) seen.push(e.kind);
      m.set(iso, seen);
    }
    return m;
  }, [eventsByDate]);
  const taskDays  = new Set(tasksByDate.keys());

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0)  { m = 11; y -= 1; }
    if (m > 11) { m = 0;  y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedIso(todayIso);
  }

  const dayEvents = eventsByDate.get(selectedIso) ?? [];
  const dayTasks  = tasksByDate.get(selectedIso) ?? [];
  const selDate   = new Date(selectedIso + 'T00:00:00');
  const selHeading = selDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />
      }
    >
      {/* Month nav */}
      <View style={s.nav}>
        <Pressable style={s.navBtn} onPress={() => goMonth(-1)}><Text style={s.navArrow}>‹</Text></Pressable>
        <Pressable onPress={goToday}><Text style={s.navLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text></Pressable>
        <Pressable style={s.navBtn} onPress={() => goMonth(+1)}><Text style={s.navArrow}>›</Text></Pressable>
      </View>

      <MonthGrid
        year={viewYear}
        month={viewMonth}
        todayIso={todayIso}
        selectedIso={selectedIso}
        eventKinds={eventKindsByDate}
        taskDays={taskDays}
        onSelect={setSelectedIso}
      />

      {/* Day detail */}
      <View style={s.listHeader}>
        <Text style={s.listHeading}>{selHeading}</Text>
        <Text style={s.listCount}>
          {dayEvents.length + dayTasks.length} item{dayEvents.length + dayTasks.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {dayEvents.length === 0 && dayTasks.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Nothing scheduled</Text>
          {officer && (
            <Pressable style={s.emptyCreateBtn} onPress={() => router.push('/event/create' as any)}>
              <Text style={s.emptyCreateText}>+ Create event</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {dayEvents.length > 0 && <Text style={s.sectionLabel}>EVENTS</Text>}
          {dayEvents.map(ev => (
            <EventCard key={ev.id} event={ev} onPress={() => router.push(`/event/${ev.id}` as any)} />
          ))}
          {dayTasks.length > 0 && <Text style={s.sectionLabel}>TASKS DUE</Text>}
          {dayTasks.map(t => (
            <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingBottom: 24 },

  createBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  createBtnText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  // Month nav
  nav:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  navBtn:   { padding: 8 },
  navArrow: { fontSize: 24, color: '#818cf8', fontWeight: '700', lineHeight: 26 },
  navLabel: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },

  // Grid
  grid:    { paddingHorizontal: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  gridRow: { flexDirection: 'row' },
  wkHead:  { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.2, paddingVertical: 6 },
  cell:        { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 1, borderRadius: 8, gap: 2 },
  cellSel:     { backgroundColor: '#6366f1' },
  cellToday:   { backgroundColor: '#1e1b4b' },
  cellNum:     { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  cellNumSel:  { color: '#fff', fontWeight: '700' },
  cellNumToday:{ color: '#a5b4fc', fontWeight: '700' },
  dotRow:      { flexDirection: 'row', gap: 3, height: 5 },
  dot:         { width: 5, height: 5, borderRadius: 3 },

  // Day detail header
  listHeader:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  listHeading: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', flexShrink: 1 },
  listCount:   { fontSize: 13, color: '#475569' },
  sectionLabel:{ fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 6, marginBottom: 8 },

  // Empty
  empty:           { alignItems: 'center', paddingVertical: 40 },
  emptyText:       { color: '#475569', fontSize: 15 },
  emptyCreateBtn:  { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1e1b4b', borderRadius: 8 },
  emptyCreateText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  // Event card
  card:      { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#1e293b', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden' },
  accent:    { width: 3, alignSelf: 'stretch', marginVertical: 10, borderRadius: 2, marginRight: 12, marginLeft: 4 },
  cardBody:  { flex: 1, paddingVertical: 12, paddingRight: 14, gap: 4 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', flexShrink: 1 },
  kindBadge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  kindText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardMeta:  { fontSize: 13, color: '#64748b' },
  audienceText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  recurringBadge: { backgroundColor: '#1e1b4b', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  recurringText:  { fontSize: 11, color: '#818cf8', fontWeight: '700' },

  // Task row
  taskRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden' },
  taskStripe:{ width: 4, alignSelf: 'stretch' },
  taskBody:  { flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 6, gap: 3 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  taskMeta:  { fontSize: 12, color: '#64748b' },
  taskBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginRight: 12, flexShrink: 0 },
  taskBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
