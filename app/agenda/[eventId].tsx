/**
 * app/agenda/[eventId].tsx — dedicated, READ-ONLY meeting agenda.
 *
 * A real-data artifact view for a chapter/eboard meeting: it renders the pure
 * buildAgenda() output (this week's events + open tasks) for the given meeting
 * event. No editing, no persistence, no mock data — it reads getAllEvents() /
 * getAllTasks() / stored task state live. Reached from the "Open agenda" card on
 * Event Detail (officer-gated there).
 *
 * Report-derived sections (announcements / help-needed) and minutes capture are
 * intentionally NOT here — they depend on the not-yet-built reports work.
 */

import { buildAgenda, isAgendaEmpty, type AgendaItem } from '@/lib/buildAgenda';
import { findEventById, getAllEvents } from '@/lib/eventStore';
import { getAllTasks } from '@/lib/mockTasks';
import { getEventDate } from '@/lib/mockEvents';
import { getStoredProof, getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const HTTP_RE = /^https?:\/\//i;

export default function AgendaScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const navigation  = useNavigation();
  const router      = useRouter();

  // Re-render when task state / proof changes so the agenda + doc link stay live.
  useTaskStateVersion();

  useEffect(() => {
    navigation.setOptions({ title: 'Meeting Agenda' });
  }, [navigation]);

  const event = eventId ? findEventById(eventId) : undefined;

  if (!event) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Meeting not found</Text>
      </View>
    );
  }

  const date     = getEventDate(event.dayOffset);
  const dateStr  = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const agenda = buildAgenda({
    events:      getAllEvents().filter(e => e.id !== event.id),   // exclude this meeting
    tasks:       getAllTasks(),
    stateOf:     t => getStoredState(t.id, t.state),
    todayOffset: (new Date().getDay() + 6) % 7,                   // Mon=0 … Sun=6
  });

  // Optional, real: if a "Prepare agenda" prep task for THIS event has a saved
  // link proof (the existing proofContent path), surface it as "Agenda document".
  // No new field, no schema — just reads what the annotator already submitted.
  const agendaTask = getAllTasks().find(t =>
    t.linkedEventId === event.id &&
    t.proofType === 'link' &&
    /agenda/i.test(t.title),
  );
  const agendaDoc = agendaTask ? getStoredProof(agendaTask.id).trim() : '';
  const hasAgendaDoc = HTTP_RE.test(agendaDoc);

  const groups: { label: string; items: AgendaItem[] }[] = [
    { label: 'Old business', items: agenda.oldBusiness },
    { label: 'New business', items: agenda.newBusiness },
    { label: 'Open tasks',   items: agenda.unresolved },
    { label: 'Everyone',     items: agenda.brotherWide },
  ].filter(g => g.items.length > 0);

  function openItem(it: AgendaItem) {
    router.push(
      it.kind === 'event'
        ? `/event/${it.id}` as any
        : `/task/${it.id}?fromEventId=${event!.id}` as any,
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Meeting header */}
      <Text style={s.title}>{event.title}</Text>
      <Text style={s.subtitle}>{dateStr} · {event.time}</Text>
      <Text style={s.hint}>Auto-built from this week’s events and open tasks. Read-only.</Text>

      {/* Agenda document (only if a prep task already carries a link) */}
      {hasAgendaDoc && (
        <Pressable style={s.docCard} onPress={() => { void Linking.openURL(agendaDoc); }}>
          <Text style={s.docLabel}>AGENDA DOCUMENT</Text>
          <Text style={s.docLink} numberOfLines={1}>{agendaDoc}</Text>
        </Pressable>
      )}

      {isAgendaEmpty(agenda) ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🗒️</Text>
          <Text style={s.emptyTitle}>Nothing to put on the agenda yet</Text>
          <Text style={s.emptyText}>
            This week’s events and open tasks will appear here as they’re added.
          </Text>
        </View>
      ) : (
        groups.map(g => (
          <View key={g.label} style={s.group}>
            <Text style={s.groupLabel}>{g.label}</Text>
            {g.items.map(it => (
              <Pressable key={`${it.kind}_${it.id}`} style={s.item} onPress={() => openItem(it)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={1}>{it.title}</Text>
                  <Text style={s.itemMeta} numberOfLines={1}>{it.meta}</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  title:    { fontSize: 22, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  hint:     { fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 16, lineHeight: 17 },

  docCard:  { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16, gap: 3 },
  docLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.6 },
  docLink:  { fontSize: 14, color: '#818cf8', textDecorationLine: 'underline' },

  group:      { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  item:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, gap: 8 },
  itemTitle:  { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  itemMeta:   { fontSize: 12, color: '#64748b', marginTop: 1 },
  chevron:    { fontSize: 18, color: '#475569' },

  empty:      { alignItems: 'center', paddingTop: 56, gap: 8 },
  emptyIcon:  { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#cbd5e1' },
  emptyText:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  notFound:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 15, color: '#64748b' },
});
