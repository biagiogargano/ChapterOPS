/**
 * app/agenda/[eventId].tsx — meeting agenda: persisted document + live preview.
 *
 * Two layers:
 *   • A PERSISTED agenda document (agenda_documents, via lib/agendaDocumentService) —
 *     leadership/Annotator GENERATE it from the current agenda, everyone VIEWS it, and a
 *     FINALIZE action locks it (read-only) as the meeting baseline.
 *   • A live PREVIEW derived from this week's events + open tasks (pure buildAgenda →
 *     assembleAgendaDocument) shown when no document has been saved yet.
 *
 * Real persistence only — no fake save. Inline text/item editing of a saved document is a
 * documented follow-up (the service stores an arbitrary AgendaDocument; a future editor
 * mutates it and calls upsert).
 *
 * GOALS-NEEDING-ATTENTION is folded in at GENERATE time: leadership (who can read org
 * goals) fetches them and the section is persisted into the document, so members see it by
 * reading the saved doc — no member-side goals read needed.
 *
 * ANNOUNCEMENTS / HELP-NEEDED (from officers' weekly goal-update submissions) are NOT yet
 * included. Missing read path: there is only a per-task get_task_report_submission RPC —
 * no "list submissions for an org + cycle". Options: (a) a new
 * list_submissions_for_org_cycle RPC (cleanest), or (b) enumerate the cycle's
 * goalupdrole_<role>__<period> task ids and fetch each, then extractAgendaContributions +
 * groupAgendaContributions (both pure + tested). Deferred until that read path lands.
 */

import { buildAgenda } from '@/lib/buildAgenda';
import {
  assembleAgendaDocument,
  setSectionTitle, setItemText, addManualItem, removeItem,
  withAllCanonicalSections, pruneEmptySections,
  type AgendaDocument, type AgendaDocItem, type AgendaDocSection,
} from '@/lib/agendaDocument';
import {
  getAgendaDocument, upsertAgendaDocument, finalizeAgendaDocument, type AgendaReadResult,
} from '@/lib/agendaDocumentService';
import { goalsNeedingAttention } from '@/lib/agendaGoals';
import { agendaContributionsFromSubmissions, officerPriorityItems } from '@/lib/agendaUpdateContributions';
import { listGoalsForOrgResult } from '@/lib/goalService';
import { listSubmissionsForOrgCycle } from '@/lib/reportSubmissionService';
import { weeklyGoalUpdatePeriodKey } from '@/lib/goalUpdateRun';
import { findEventById, getAllEvents } from '@/lib/eventStore';
import { getAllTasks } from '@/lib/mockTasks';
import { getEventDate } from '@/lib/mockEvents';
import { getStoredProof, getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { isLeadershipRole } from '@/lib/roles';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { useDevRole } from '@/lib/devRoleStore';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const HTTP_RE = /^https?:\/\//i;

export default function AgendaScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const navigation  = useNavigation();
  const router      = useRouter();
  const { role }    = useDevRole();
  const orgId       = useActiveDataOrgId();

  // Re-render when task state / proof changes so the live preview stays current.
  useTaskStateVersion();

  useEffect(() => {
    navigation.setOptions({ title: 'Meeting Agenda' });
  }, [navigation]);

  const event = eventId ? findEventById(eventId) : undefined;

  // Persisted agenda document (loaded on focus).
  const [docResult, setDocResult] = useState<AgendaReadResult | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Inline editing: a local working copy of the saved AgendaDocument. Persisted only on Save.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AgendaDocument | null>(null);

  const loadDoc = useCallback(async () => {
    if (!eventId) { setLoadingDoc(false); return; }
    setLoadingDoc(true);
    const r = await getAgendaDocument(eventId);
    setDocResult(r);
    setLoadingDoc(false);
  }, [eventId]);
  useFocusEffect(useCallback(() => { void loadDoc(); }, [loadDoc]));

  if (!event) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Meeting not found</Text>
      </View>
    );
  }

  const date    = getEventDate(event.dayOffset);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Live-derived agenda → the preview document + the generation source.
  const agenda = buildAgenda({
    events:      getAllEvents().filter(e => e.id !== event.id),   // exclude this meeting
    tasks:       getAllTasks(),
    stateOf:     t => getStoredState(t.id, t.state),
    todayOffset: (new Date().getDay() + 6) % 7,                   // Mon=0 … Sun=6
  });
  const previewDoc = assembleAgendaDocument({ agenda, includeEmpty: false });

  // Optional, real: a "Prepare agenda" prep task's saved link proof → "Agenda document".
  const agendaTask = getAllTasks().find(t =>
    t.linkedEventId === event.id && t.proofType === 'link' && /agenda/i.test(t.title),
  );
  const agendaDoc = agendaTask ? getStoredProof(agendaTask.id).trim() : '';
  const hasAgendaDoc = HTTP_RE.test(agendaDoc);

  const isLeader  = isLeadershipRole(role) || role === 'annotator';
  const savedDoc  = docResult?.document ?? null;
  const finalized = !!savedDoc?.finalizedAt;
  const readFailed = !!docResult && !docResult.ok;

  // What we render: the saved document's AgendaDocument if present, else the live preview.
  // (AgendaDocumentRow.sections IS the AgendaDocument — { v, sections: [...] }.)
  const displayDocument = savedDoc ? savedDoc.sections : previewDoc;
  const sections = displayDocument.sections.filter(sec => sec.items.length > 0);

  function openDocItem(it: AgendaDocItem) {
    if (it.kind === 'event' && it.refId) router.push(`/event/${it.refId}` as any);
    else if (it.kind === 'task' && it.refId) router.push(`/task/${it.refId}?fromEventId=${event!.id}` as any);
    else if (it.kind === 'goal') router.push('/(tabs)/goals' as any);
    // 'contribution' / 'note' → no nav target.
  }

  // Regenerating overwrites the saved doc (incl. hand-edits) → confirm first when one exists.
  function confirmRegenerate() {
    if (!savedDoc) { void generate(); return; }
    Alert.alert(
      'Regenerate agenda?',
      'This replaces the saved agenda — including any edits you made — with a fresh one built from the current events, tasks, and goals.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: () => { void generate(); } },
      ],
    );
  }

  async function generate() {
    if (busy) return;
    setBusy(true); setActionError(null);

    // Leadership generates → fetch the org's goals (leadership-readable) and fold
    // "goals needing attention" into the SAVED document. Members then see that section by
    // reading the saved doc — no member-side goals read is required. A failed/empty goals
    // read just omits the section (honest; never blocks the save).
    let goalsAttn: ReturnType<typeof goalsNeedingAttention> = [];
    let contributions;
    let officerPriorities;
    if (orgId) {
      const gr = await listGoalsForOrgResult(orgId);
      if (gr.ok) goalsAttn = goalsNeedingAttention(gr.goals);

      // Fold Help-Needed / Announcements + Officer Priorities from this cycle's weekly
      // goal-update submissions. The list reader is leadership/Annotator-gated (the generate
      // button already is), and each submission carries its own snapshot so contributions need
      // no per-role goals. Fail-safe: the wrapper returns [] on error/empty → those sections
      // are simply omitted (assemble drops empty sections); never blocks the save, never fakes.
      // PERIOD: uses the CURRENT weekly period (when leadership generates). Weekly update tasks
      // key on the same now-relative period. TODO: when meetings get a calendar-anchored cycle,
      // derive the period from the meeting's week instead of "now".
      const period = weeklyGoalUpdatePeriodKey(new Date());
      const subs = await listSubmissionsForOrgCycle(orgId, period);
      contributions = agendaContributionsFromSubmissions(subs);
      officerPriorities = officerPriorityItems(subs);
    }

    const sections = assembleAgendaDocument({ agenda, goalsNeedingAttention: goalsAttn, contributions, officerPriorities, includeEmpty: false });
    const res = await upsertAgendaDocument({
      eventId: event!.id,
      title:   `${event!.title} — Agenda`,
      sections,
      generatedFrom: { source: 'buildAgenda+goals+updates', sections: sections.sections.map(x => x.key) },
    });
    setBusy(false);
    if (!res.ok) setActionError('Couldn’t save the agenda. Please try again.');
    else await loadDoc();
  }

  async function finalize() {
    if (busy) return;
    setBusy(true); setActionError(null);
    const res = await finalizeAgendaDocument(event!.id);
    setBusy(false);
    if (!res.ok) setActionError('Couldn’t finalize the agenda. Please try again.');
    else await loadDoc();
  }

  // ── Inline editing (leadership; unfinalized saved doc) ──
  function startEdit() {
    if (!savedDoc) return;
    setActionError(null);
    // Show every canonical section so notes can be added anywhere; empties pruned on save.
    setDraft(withAllCanonicalSections(savedDoc.sections));
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setDraft(null);
    setActionError(null);
  }
  async function saveEdit() {
    if (busy || !draft) return;
    setBusy(true); setActionError(null);
    const cleaned = pruneEmptySections(draft);
    const res = await upsertAgendaDocument({
      eventId: event!.id,
      title:   savedDoc?.title || `${event!.title} — Agenda`,
      sections: cleaned,
      generatedFrom: savedDoc?.generatedFrom ?? null,
    });
    setBusy(false);
    if (!res.ok) { setActionError('Couldn’t save your edits. Please try again.'); return; }
    setEditing(false);
    setDraft(null);
    await loadDoc();
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{event.title}</Text>
      <Text style={s.subtitle}>{dateStr} · {event.time}</Text>

      {/* Status banner: editing vs saved vs preview vs finalized */}
      {loadingDoc ? (
        <Text style={s.hint}>Loading the saved agenda…</Text>
      ) : editing ? (
        <View style={s.banner}>
          <Text style={s.bannerText}>Editing agenda — make changes below, then Save changes or Cancel.</Text>
        </View>
      ) : finalized ? (
        <View style={[s.banner, s.bannerFinal]}>
          <Text style={s.bannerText}>✓ Finalized agenda — locked for the meeting (read-only).</Text>
        </View>
      ) : savedDoc ? (
        <View style={s.banner}>
          <Text style={s.bannerText}>Saved agenda{isLeader ? ' — regenerate to refresh, or finalize to lock.' : ' (read-only).'}</Text>
        </View>
      ) : (
        <Text style={s.hint}>
          {isLeader
            ? 'Preview — auto-built from this week’s events and open tasks. Save it to share a fixed agenda with the chapter.'
            : 'Auto-built from this week’s events and open tasks. Read-only — no saved agenda yet.'}
        </Text>
      )}

      {readFailed && (
        <View style={[s.banner, s.bannerError]}>
          <Text style={s.bannerText}>Couldn’t load the saved agenda. Showing the live preview.</Text>
          <Pressable style={s.retryBtn} onPress={() => void loadDoc()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Agenda document link (prep task) */}
      {hasAgendaDoc && (
        <Pressable style={s.docCard} onPress={() => { void Linking.openURL(agendaDoc); }}>
          <Text style={s.docLabel}>AGENDA DOCUMENT</Text>
          <Text style={s.docLink} numberOfLines={1}>{agendaDoc}</Text>
        </Pressable>
      )}

      {/* ── EDIT MODE: editable draft (leadership, unfinalized) ── */}
      {editing && draft ? (
        <>
          {draft.sections.map((sec: AgendaDocSection) => (
            <View key={sec.key} style={s.group}>
              <TextInput
                style={s.sectionTitleInput}
                value={sec.title}
                onChangeText={txt => setDraft(d => (d ? setSectionTitle(d, sec.key, txt) : d))}
                placeholder="Section title"
                placeholderTextColor="#475569"
              />
              {sec.items.map(it => (
                <View key={it.id} style={s.editItemRow}>
                  <TextInput
                    style={s.editInput}
                    value={it.text}
                    onChangeText={txt => setDraft(d => (d ? setItemText(d, sec.key, it.id, txt) : d))}
                    placeholder="Agenda line"
                    placeholderTextColor="#475569"
                    multiline
                  />
                  <Pressable style={s.removeBtn} onPress={() => setDraft(d => (d ? removeItem(d, sec.key, it.id) : d))}>
                    <Text style={s.removeBtnText}>×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={s.addItemBtn} onPress={() => setDraft(d => (d ? addManualItem(d, sec.key, '') : d))}>
                <Text style={s.addItemText}>+ Add item</Text>
              </Pressable>
            </View>
          ))}

          <View style={s.actions}>
            <Pressable style={[s.actionBtn, busy && s.actionBtnDisabled]} onPress={() => void saveEdit()} disabled={busy}>
              <Text style={s.actionBtnText}>{busy ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
            <Pressable style={[s.actionBtnSecondary, busy && s.actionBtnDisabled]} onPress={cancelEdit} disabled={busy}>
              <Text style={s.actionBtnSecondaryText}>Cancel</Text>
            </Pressable>
            {actionError && <Text style={s.actionError}>{actionError}</Text>}
            <Text style={s.actionHint}>
              Edit section titles and lines, add manual items, or remove lines. Empty lines/sections
              are dropped on save. Changes are saved to the chapter’s agenda.
            </Text>
          </View>
        </>
      ) : (
        <>
          {/* Sections (saved doc or preview) — read-only */}
          {sections.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🗒️</Text>
              <Text style={s.emptyTitle}>Nothing to put on the agenda yet</Text>
              <Text style={s.emptyText}>This week’s events and open tasks will appear here as they’re added.</Text>
            </View>
          ) : (
            sections.map((sec: AgendaDocSection) => (
              <View key={sec.key} style={s.group}>
                <Text style={s.groupLabel}>{sec.title.toUpperCase()}</Text>
                {sec.items.map(it => {
                  const tappable = (it.kind === 'event' || it.kind === 'task') && !!it.refId || it.kind === 'goal';
                  return (
                    <Pressable key={it.id} style={s.item} onPress={() => openDocItem(it)} disabled={!tappable}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle} numberOfLines={2}>{it.text}</Text>
                        {!!it.meta && <Text style={s.itemMeta} numberOfLines={1}>{it.meta}</Text>}
                      </View>
                      {tappable && <Text style={s.chevron}>›</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}

          {/* Leadership actions */}
          {isLeader && !loadingDoc && !finalized && (
            <View style={s.actions}>
              <Pressable style={[s.actionBtn, busy && s.actionBtnDisabled]} onPress={confirmRegenerate} disabled={busy}>
                <Text style={s.actionBtnText}>
                  {busy ? 'Saving…' : savedDoc ? 'Regenerate from current' : 'Save agenda document'}
                </Text>
              </Pressable>
              {savedDoc && (
                <Pressable style={[s.actionBtnSecondary, busy && s.actionBtnDisabled]} onPress={startEdit} disabled={busy}>
                  <Text style={s.actionBtnSecondaryText}>Edit agenda</Text>
                </Pressable>
              )}
              {savedDoc && (
                <Pressable style={[s.actionBtnSecondary, busy && s.actionBtnDisabled]} onPress={() => void finalize()} disabled={busy}>
                  <Text style={s.actionBtnSecondaryText}>Finalize (lock)</Text>
                </Pressable>
              )}
              {actionError && <Text style={s.actionError}>{actionError}</Text>}
              <Text style={s.actionHint}>
                {savedDoc
                  ? 'Edit to hand-tune lines, Regenerate to rebuild from current events/tasks, or Finalize to lock.'
                  : 'Save to store this agenda for the chapter.'}
              </Text>
            </View>
          )}
        </>
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

  banner:      { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingVertical: 10, paddingHorizontal: 12, marginTop: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerFinal: { borderColor: '#16a34a', backgroundColor: '#052e16' },
  bannerError: { borderColor: '#b91c1c', backgroundColor: '#1a0505' },
  bannerText:  { fontSize: 12.5, color: '#cbd5e1', flex: 1, lineHeight: 17 },

  docCard:  { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16, gap: 3 },
  docLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.6 },
  docLink:  { fontSize: 14, color: '#818cf8', textDecorationLine: 'underline' },

  group:      { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  item:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, gap: 8 },
  itemTitle:  { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  itemMeta:   { fontSize: 12, color: '#64748b', marginTop: 1 },
  chevron:    { fontSize: 18, color: '#475569' },

  actions:          { marginTop: 8, gap: 10 },
  actionBtn:        { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  actionBtnText:    { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  actionBtnSecondary:     { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  actionBtnDisabled: { opacity: 0.5 },
  actionError:      { fontSize: 12.5, color: '#fca5a5' },
  actionHint:       { fontSize: 11.5, color: '#64748b', lineHeight: 16 },

  retryBtn:  { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { fontSize: 12, color: '#e2e8f0', fontWeight: '600' },

  sectionTitleInput: { fontSize: 11, fontWeight: '700', color: '#cbd5e1', letterSpacing: 0.8, marginBottom: 8, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 10, paddingVertical: 7 },
  editItemRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  editInput:    { flex: 1, fontSize: 14, color: '#f1f5f9', backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 9, minHeight: 40 },
  removeBtn:    { width: 36, height: 40, borderRadius: 10, backgroundColor: '#1a0505', borderWidth: 1, borderColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' },
  removeBtnText:{ fontSize: 20, color: '#fca5a5', lineHeight: 22 },
  addItemBtn:   { paddingVertical: 8, paddingHorizontal: 4 },
  addItemText:  { fontSize: 13, color: '#818cf8', fontWeight: '600' },

  empty:      { alignItems: 'center', paddingTop: 56, gap: 8 },
  emptyIcon:  { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#cbd5e1' },
  emptyText:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  notFound:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 15, color: '#64748b' },
});
