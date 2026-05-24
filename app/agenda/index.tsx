/**
 * app/agenda/index.tsx — Meeting Agenda auto-population prototype.
 * PROTOTYPE ONLY (see SPEC_MEETING_AGENDA_AUTOPOPULATION.md).
 *
 * Read-only: aggregates the current events + tasks into agenda sections via the
 * pure buildAgenda(). No writes, no AI, no new task kind. Report-derived sections
 * (announcements / help-needed) are omitted until #6 exists. Dev-only screen; not
 * linked from phase-2, not wired into the alpha.
 */

import { buildAgenda, isAgendaEmpty, type AgendaItem } from '@/lib/agenda/buildAgenda';
import { getAllEvents } from '@/lib/eventStore';
import { getAllTasks } from '@/lib/mockTasks';
import { getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function Section({ label, items, onItem }: { label: string; items: AgendaItem[]; onItem: (i: AgendaItem) => void }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {items.length === 0 ? (
        <Text style={s.empty}>— nothing —</Text>
      ) : (
        items.map(i => (
          <Pressable key={`${i.kind}_${i.id}`} style={s.row} onPress={() => onItem(i)}>
            <View style={[s.dot, { backgroundColor: i.kind === 'event' ? '#818cf8' : '#fbbf24' }]} />
            <View style={s.rowBody}>
              <Text style={s.rowTitle} numberOfLines={1}>{i.title}</Text>
              <Text style={s.rowMeta} numberOfLines={1}>{i.meta}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

export default function AgendaScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useTaskStateVersion();   // recompute when task states change

  useEffect(() => { navigation.setOptions({ title: 'Meeting Agenda' }); }, [navigation]);

  const todayOffset = (new Date().getDay() + 6) % 7;
  const agenda = buildAgenda({
    events:      getAllEvents(),
    tasks:       getAllTasks(),
    stateOf:     (t) => getStoredState(t.id, t.state),
    todayOffset,
  });

  function open(i: AgendaItem) {
    router.push(`/${i.kind}/${i.id}` as any);
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · auto-drafted from current data</Text></View>

      <Text style={s.heading}>Meeting Agenda</Text>
      <Text style={s.sub}>Auto-drafted from this week’s events & tasks</Text>

      {isAgendaEmpty(agenda) ? (
        <View style={s.allEmpty}><Text style={s.empty}>Nothing to put on the agenda yet.</Text></View>
      ) : (
        <>
          <Section label="OLD BUSINESS"          items={agenda.oldBusiness} onItem={open} />
          <Section label="NEW BUSINESS"          items={agenda.newBusiness} onItem={open} />
          <Section label="BROTHER-WIDE TASKS"    items={agenda.brotherWide} onItem={open} />
          <Section label="UNRESOLVED ACTION ITEMS" items={agenda.unresolved} onItem={open} />
        </>
      )}

      <Text style={s.footNote}>
        Officer-report announcements and help-needed items will appear here once the
        questionnaire/report system (#6) exists.
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
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 },

  section:      { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },
  empty:        { fontSize: 13, color: '#475569', fontStyle: 'italic' },
  allEmpty:     { paddingVertical: 30, alignItems: 'center' },

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8, paddingVertical: 12, paddingHorizontal: 12, gap: 12 },
  dot:      { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  rowBody:  { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  rowMeta:  { fontSize: 12, color: '#64748b' },
  chevron:  { fontSize: 20, color: '#334155' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 14, lineHeight: 18 },
});
