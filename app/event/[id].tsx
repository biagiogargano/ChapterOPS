import { useDevRole } from '@/lib/devRoleStore';
import { fetchEventById, removeEvent, removeEventSeries } from '@/lib/eventService';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { canManageEvent, findEventById, getAllEvents, deleteEvent, deleteEventSeries, isUserCreatedEvent } from '@/lib/eventStore';
import {
  AUDIENCE_LABEL,
  KIND_BG,
  KIND_COLORS,
  KIND_LABELS,
  getEventDate,
} from '@/lib/mockEvents';
import {
  getAllRsvpsForEvent,
  getRsvpEntry,
  hydrateRsvpsFromSupabase,
  refreshRsvpsFromSupabase,
  setRsvpEntry,
  useRsvpEntry,
  useRsvpVersion,
  type RsvpStatus,
} from '@/lib/rsvpStore';
import { FLOOR_ROLE, OFFICER_ROLES, ROLE_LABELS, isLeadershipRole, isOfficer, type Role } from '@/lib/roles';
import { canManageEventTasks } from '@/lib/eventTaskPermissions';
import { buildAgenda, isAgendaEmpty, type Agenda, type AgendaItem } from '@/lib/buildAgenda';
import { emitUpdateNotice, hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import {
  STATE_COLOR,
  addGeneratedTask,
  clearGeneratedTombstones,
  deleteUserTask,
  dueLabelOf,
  filterTasksForRole,
  getAllTasks,
  isOverdue,
  setSupabaseTaskCache,
  type MockTask,
  type TaskState,
} from '@/lib/mockTasks';
import { getStoredState, refreshTaskStates, useTaskStateVersion } from '@/lib/devTaskStore';
import { summarizeEventOps } from '@/lib/eventOps';
import { rsvpReviewTaskId } from '@/lib/generatedTasks';
import { NO_TEMPLATE } from '@/lib/eventTemplates';
import { buildTasksForTemplateId, mergedTemplateOptions, useCustomTemplatesVersion } from '@/lib/customTemplatesStore';
import SearchablePicker from '@/components/SearchablePicker';
import { fetchAllTasks, fetchTaskStates, insertTask, removeTask } from '@/lib/taskService';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

// ─── UUID detection ───────────────────────────────────────────────────────────
// Supabase event ids are UUIDs; mock/session ids are 'e1'/'uce_…' — never match.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(s: string): boolean { return UUID_RE.test(s); }
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.detailLabel}>{label}</Text>
        <Text style={s.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * RSVP inline panel — explicit "saved vs. editing" model.
 *
 *  • Saved states (Attending / Not attending / No response) are read directly
 *    from the reactive store and shown with a clear banner + Change button.
 *  • Tapping Change/Respond enters an editing mode with a local draft.
 *  • In editing mode, tapping Attending / Not attending only updates the draft;
 *    nothing is persisted until the user taps Save.
 *  • Cancel discards the draft and returns to the saved state.
 */
function RsvpSection({
  eventId,
  role,
  mandatory,
  requiresCovering,
}: {
  eventId:          string;   // unique event instance ID — rsvpStore key
  role:             string;
  mandatory:        boolean;
  requiresCovering: boolean;
}) {
  // Reactive saved state — re-renders whenever setRsvpEntry fires anywhere.
  const entry = useRsvpEntry(eventId, role);
  const saved = entry.status;   // 'no_response' | 'attending' | 'not_attending'

  // Editing mode + local draft (NOT persisted until Save).
  const [editing,       setEditing      ] = useState(false);
  const [draftStatus,   setDraftStatus  ] = useState<RsvpStatus>(saved);
  const [draftExcuse,   setDraftExcuse  ] = useState(entry.excuse);
  const [draftCovering, setDraftCovering] = useState(entry.covering);

  function beginEdit() {
    setDraftStatus(saved);
    setDraftExcuse(entry.excuse);
    setDraftCovering(entry.covering);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);   // discard draft → previous saved state shows again
  }

  const draftHasExcuse   = draftExcuse.trim().length   > 0;
  const draftHasCovering = draftCovering.trim().length > 0;
  const canSave =
    draftStatus === 'attending'     ? true :
    draftStatus === 'not_attending' ? (!mandatory || draftHasExcuse) && (!requiresCovering || draftHasCovering)
    : false; // 'no_response' is not a savable response

  function save() {
    if (!canSave) return;
    const na = draftStatus === 'not_attending';
    setRsvpEntry(eventId, role, {
      status:   draftStatus,
      excuse:   na ? draftExcuse.trim()   : '',
      covering: na ? draftCovering.trim() : '',
    });
    setEditing(false);
  }

  // ── Editing mode ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <View style={s.rsvpBlock}>
        <SectionLabel text="RSVP · EDITING" />

        <View style={s.rsvpButtons}>
          <Pressable
            style={[s.rsvpBtn, draftStatus === 'attending' && s.rsvpBtnYes]}
            onPress={() => setDraftStatus('attending')}
          >
            <Text style={[s.rsvpBtnText, draftStatus === 'attending' && s.rsvpBtnTextActive]}>
              Attending
            </Text>
          </Pressable>
          <Pressable
            style={[s.rsvpBtn, draftStatus === 'not_attending' && s.rsvpBtnNo]}
            onPress={() => setDraftStatus('not_attending')}
          >
            <Text style={[s.rsvpBtnText, draftStatus === 'not_attending' && s.rsvpBtnTextActive]}>
              Not Attending
            </Text>
          </Pressable>
        </View>

        {draftStatus === 'not_attending' && (
          <View style={s.excuseBox}>
            <Text style={s.excuseLabel}>
              {mandatory ? 'Reason required (mandatory event)' : 'Reason (optional)'}
            </Text>
            <TextInput
              style={s.excuseInput}
              placeholder="e.g. class conflict, family obligation…"
              placeholderTextColor="#475569"
              value={draftExcuse}
              onChangeText={setDraftExcuse}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {requiresCovering && (
              <>
                <Text style={[s.excuseLabel, { marginTop: 10 }]}>
                  Who will cover for you? (required)
                </Text>
                <TextInput
                  style={[s.excuseInput, { minHeight: 0 }]}
                  placeholder="Officer name or role…"
                  placeholderTextColor="#475569"
                  value={draftCovering}
                  onChangeText={setDraftCovering}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </>
            )}
          </View>
        )}

        <View style={s.rsvpEditActions}>
          <Pressable style={s.rsvpCancelBtn} onPress={cancelEdit}>
            <Text style={s.rsvpCancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.rsvpSaveBtn, !canSave && s.rsvpSaveBtnDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            <Text style={s.rsvpSaveBtnText}>Save Response</Text>
          </Pressable>
        </View>

        {draftStatus === 'not_attending' && !canSave && (
          <Text style={s.rsvpHint}>
            {mandatory && !draftHasExcuse ? 'An excuse is required. ' : ''}
            {requiresCovering && !draftHasCovering ? 'A covering officer is required.' : ''}
          </Text>
        )}
        {draftStatus === 'no_response' && (
          <Text style={s.rsvpHint}>Choose Attending or Not Attending, then Save.</Text>
        )}
      </View>
    );
  }

  // ── Saved: Attending ─────────────────────────────────────────────────────────
  if (saved === 'attending') {
    return (
      <View style={s.rsvpBlock}>
        <SectionLabel text="RSVP" />
        <View style={[s.rsvpSavedBanner, s.rsvpSavedBannerYes]}>
          <Text style={s.rsvpSavedYesText}>✓ Saved: Attending</Text>
          <Pressable style={s.rsvpEditBtn} onPress={beginEdit}>
            <Text style={s.rsvpEditBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Saved: Not attending ─────────────────────────────────────────────────────
  if (saved === 'not_attending') {
    return (
      <View style={s.rsvpBlock}>
        <SectionLabel text="RSVP" />
        <View style={[s.rsvpSavedBanner, s.rsvpSavedBannerNo]}>
          <View style={s.rsvpSavedInfo}>
            <Text style={s.rsvpSavedNoText}>Saved: Not attending</Text>
            {entry.excuse.trim()   ? <Text style={s.rsvpSavedDetail}>Reason: {entry.excuse}</Text>     : null}
            {entry.covering.trim() ? <Text style={s.rsvpSavedDetail}>Covering: {entry.covering}</Text> : null}
          </View>
          <Pressable style={s.rsvpEditBtn} onPress={beginEdit}>
            <Text style={s.rsvpEditBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── No response yet ──────────────────────────────────────────────────────────
  return (
    <View style={s.rsvpBlock}>
      <SectionLabel text="RSVP" />
      <View style={s.rsvpSavedBanner}>
        <Text style={s.rsvpNoResponseText}>No response yet</Text>
        <Pressable style={s.rsvpEditBtn} onPress={beginEdit}>
          <Text style={s.rsvpEditBtnText}>Respond</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Collapse the effective task state into a small completion/status badge.
// Uses existing TaskState only — no new state system. approved = done.
function taskBadgeFor(state: TaskState, overdue: boolean): { label: string; color: string; bg: string } {
  if (state === 'approved')                          return { label: 'Done',      color: '#4ade80', bg: '#052e16' };
  if (state === 'submitted')                         return { label: 'In review', color: '#fbbf24', bg: '#1c1407' };
  if (overdue || state === 'overdue' || state === 'escalated')
                                                     return { label: 'Overdue',   color: '#f87171', bg: '#1a0505' };
  return { label: 'To do', color: '#94a3b8', bg: '#1e293b' };   // assigned / rejected
}

function RelatedTaskCard({ task, onPress }: { task: MockTask; onPress: () => void }) {
  // Effective state from the interaction store (falls back to the task's own
  // state). Parent calls useTaskStateVersion(), so this re-renders on changes.
  const state       = getStoredState(task.id, task.state);
  const overdue     = isOverdue(task.dueAt, state);   // date-driven (fallback to state)
  const statusColor = STATE_COLOR[state];
  const badge       = taskBadgeFor(state, overdue);

  // Origin tag (presentational, derived from the id convention): template-applied
  // prep tasks use deterministic `tmpl_` ids; officer-authored tasks use `tk_`
  // ids (see mockTasks.addUserTask). Anything else (seed data) shows no tag.
  const origin: 'auto' | 'added' | null =
    task.id.startsWith('tmpl_') ? 'auto' : task.id.startsWith('tk_') ? 'added' : null;

  return (
    <Pressable style={[s.taskCard, overdue && s.taskCardOverdue]} onPress={onPress}>
      <View style={[s.taskStripe, { backgroundColor: overdue ? '#ef4444' : '#334155' }]} />
      <View style={s.taskBody}>
        <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
        <View style={s.taskMetaRow}>
          {origin && (
            <View style={origin === 'auto' ? s.originAuto : s.originAdded}>
              <Text style={origin === 'auto' ? s.originAutoText : s.originAddedText}>
                {origin === 'auto' ? 'AUTO' : 'ADDED'}
              </Text>
            </View>
          )}
          <Text style={[s.taskDue, overdue && s.taskDueRed]}>{dueLabelOf(task)}</Text>
        </View>
      </View>
      <View style={[s.taskBadge, { backgroundColor: badge.bg }]}>
        <Text style={[s.taskBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
      <View style={[s.taskStatusDot, { backgroundColor: statusColor }]} />
      <Text style={s.taskChevron}>›</Text>
    </Pressable>
  );
}

// ─── Member date-name submission — reads/writes live rsvpStore ────────────────
//
// Shown to every role when the event collects date names (requiresDateNames).
// Uses the same rsvpStore key (eventId::role) as the Today/Tasks quick-action
// cards, so a name entered on any surface stays in sync here. Draft/Save model:
// typing buffers locally; only Save commits.

function DateNameSubmitSection({ eventId, role }: { eventId: string; role: string }) {
  const entry = useRsvpEntry(eventId, role);          // reactive saved state
  const [draft,   setDraft  ] = useState(() => getRsvpEntry(eventId, role).dateName);
  const [editing, setEditing] = useState(false);
  const isSaved = entry.dateName.trim().length > 0 && !editing;

  function save() {
    const name = draft.trim();
    if (!name) return;
    setRsvpEntry(eventId, role, { dateName: name });  // merges — leaves status intact
    setEditing(false);
  }
  function clear() {
    setDraft('');
    setEditing(false);
    setRsvpEntry(eventId, role, { dateName: '' });
  }

  // ── Saved: show committed name + Edit / Clear ──────────────────────────────
  if (isSaved) {
    return (
      <View style={s.rsvpBlock}>
        <SectionLabel text="YOUR DATE" />
        <View style={[s.rsvpSavedBanner, s.rsvpSavedBannerYes]}>
          <Text style={[s.rsvpSavedYesText, { flex: 1 }]} numberOfLines={1}>✓ {entry.dateName}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
            <Pressable style={s.rsvpEditBtn} onPress={() => setEditing(true)}>
              <Text style={s.rsvpEditBtnText}>Edit</Text>
            </Pressable>
            <Pressable style={[s.rsvpEditBtn, { backgroundColor: '#1a0505' }]} onPress={clear}>
              <Text style={[s.rsvpEditBtnText, { color: '#f87171' }]}>Clear</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Draft: input + Save ────────────────────────────────────────────────────
  return (
    <View style={s.rsvpBlock}>
      <SectionLabel text="YOUR DATE" />
      <Text style={s.dateSubmitHint}>Enter your date's full name for this event.</Text>
      <TextInput
        style={s.dateNameInput}
        placeholder="Date's full name…"
        placeholderTextColor="#475569"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Pressable
        style={[s.rsvpSaveBtn, { marginTop: 10 }, !draft.trim() && s.rsvpSaveBtnDisabled]}
        onPress={save}
        disabled={!draft.trim()}
      >
        <Text style={s.rsvpSaveBtnText}>Save Date Name</Text>
      </Pressable>
    </View>
  );
}

// ─── Date Party submissions — reads live rsvpStore ───────────────────────────

function DateSubmissionsSection({ eventId }: { eventId: string }) {
  useRsvpVersion(); // re-render whenever any RSVP changes
  const entries  = getAllRsvpsForEvent(eventId).filter(e => e.dateName.trim() !== '');
  const count    = entries.length;
  const TOTAL    = 30; // mock chapter size

  return (
    <View>
      <SectionLabel text={`DATE SUBMISSIONS  (${count} of ${TOTAL})`} />
      {count === 0 ? (
        <View style={s.responseFooter}>
          <Text style={s.responseFooterText}>No submissions yet.</Text>
        </View>
      ) : (
        <View style={s.responseList}>
          {entries.map((e, i) => {
            const roleName = ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] ?? e.role;
            return (
              <View key={i} style={s.responseRow}>
                <View style={s.responseLeft}>
                  <Text style={s.responseMember}>{roleName}</Text>
                  <Text style={s.responseSub}>↳ {e.dateName}</Text>
                </View>
                <Text style={s.responseTime}>{e.updatedAt}</Text>
              </View>
            );
          })}
          {count < TOTAL && (
            <View style={s.responseFooter}>
              <Text style={s.responseFooterText}>{TOTAL - count} members haven't submitted yet</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── RSVP Responses — reads live rsvpStore ────────────────────────────────────

const DOT_COLOR: Record<string, string> = {
  attending:     '#22c55e',
  not_attending: '#f59e0b',
  no_response:   '#475569',
};

function RsvpResponsesSection({ eventId, label }: { eventId: string; label: string }) {
  useRsvpVersion(); // re-render whenever any RSVP changes
  const entries    = getAllRsvpsForEvent(eventId);
  const attending  = entries.filter(e => e.status === 'attending').length;
  const excused    = entries.filter(e => e.status === 'not_attending').length;

  if (entries.length === 0) {
    return (
      <View>
        <SectionLabel text={label} />
        <View style={s.responseFooter}>
          <Text style={s.responseFooterText}>No responses yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <SectionLabel text={label} />

      {/* Stats row */}
      <View style={s.rsvpStats}>
        <View style={[s.rsvpStat, { backgroundColor: '#052e16' }]}>
          <Text style={[s.rsvpStatNum, { color: '#4ade80' }]}>{attending}</Text>
          <Text style={s.rsvpStatLabel}>Attending</Text>
        </View>
        <View style={[s.rsvpStat, { backgroundColor: '#1c1407' }]}>
          <Text style={[s.rsvpStatNum, { color: '#fbbf24' }]}>{excused}</Text>
          <Text style={s.rsvpStatLabel}>Not Attending</Text>
        </View>
      </View>

      <View style={s.responseList}>
        {entries.map((e, i) => {
          const roleName = ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] ?? e.role;
          return (
            <View key={i} style={s.responseRow}>
              <View style={[s.rsvpDot, { backgroundColor: DOT_COLOR[e.status] }]} />
              <View style={s.responseLeft}>
                <Text style={s.responseMember}>{roleName}</Text>
                {e.excuse     ? <Text style={s.responseSub}>"{e.excuse}"</Text> : null}
                {e.covering   ? <Text style={s.responseCovering}>Covering: {e.covering}</Text> : null}
              </View>
              {e.updatedAt ? (
                <Text style={s.responseTime}>{e.updatedAt}</Text>
              ) : (
                <Text style={s.responseAbsent}>—</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Meeting agenda (read-only, derived from real events + tasks) ─────────────

function AgendaSection({ agenda, onOpen }: { agenda: Agenda; onOpen: (item: AgendaItem) => void }) {
  const groups: { label: string; items: AgendaItem[] }[] = [
    { label: 'Old business',  items: agenda.oldBusiness },
    { label: 'New business',  items: agenda.newBusiness },
    { label: 'Open tasks',    items: agenda.unresolved },
    { label: 'Everyone',      items: agenda.brotherWide },
  ].filter(g => g.items.length > 0);

  return (
    <>
      <Text style={s.agendaHint}>Auto-built from this week’s events and open tasks.</Text>
      {groups.map(g => (
        <View key={g.label} style={s.agendaGroup}>
          <Text style={s.agendaGroupLabel}>{g.label}</Text>
          {g.items.map(it => (
            <Pressable key={`${it.kind}_${it.id}`} style={s.agendaItem} onPress={() => onOpen(it)}>
              <View style={{ flex: 1 }}>
                <Text style={s.agendaItemTitle} numberOfLines={1}>{it.title}</Text>
                <Text style={s.agendaItemMeta} numberOfLines={1}>{it.meta}</Text>
              </View>
              <Text style={s.agendaChevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router     = useRouter();
  const { role }   = useDevRole();

  // Org id for data scoping (DEMO_CHAPTER_ID while ORG_SCOPED_DATA is false).
  const dataOrgId = useActiveDataOrgId();

  // Seed from local store immediately (mock + session events resolve synchronously).
  // For Supabase UUID ids that aren't in the local store, fetch async.
  const [event, setEvent] = useState(() => findEventById(id ?? ''));

  // True only while a Supabase fetch is in flight and local lookup found nothing.
  // Prevents a "not found" flash before the network response arrives.
  const [loading, setLoading] = useState(() => {
    return findEventById(id ?? '') === undefined && isUUID(id ?? '');
  });

  useEffect(() => {
    if (!id || !isUUID(id)) return;           // local ids never need a Supabase call
    let cancelled = false;

    fetchEventById(id, dataOrgId).then(remote => {
      if (cancelled) return;
      if (remote) setEvent(remote);           // Supabase found it — update event
      setLoading(false);                      // clear loading either way
    });

    return () => { cancelled = true; };
  }, [id, dataOrgId]);

  // On focus: recompute related tasks AND re-read the event from the store so an
  // edit made elsewhere (Event Create/Edit updates the cache, then router.back()s
  // here) shows immediately. Guarded so a UUID event not yet in the local cache
  // isn't blanked — the fetchEventById effect above still handles that case.
  const [, _bumpFocus] = useState(0);
  useFocusEffect(useCallback(() => {
    _bumpFocus(n => n + 1);
    const fresh = findEventById(id ?? '');
    if (fresh) setEvent(fresh);
  }, [id]));

  // Related tasks for this event. A user sees an event's tasks only when they can
  // MANAGE that event's kind (president/pro_consul → any; the owning chair → their
  // domain) — those see EVERY task on the event (incl. template-generated tasks
  // assigned to others). Everyone else stays role-scoped (filterTasksForRole =
  // only tasks assigned to them or that they review), so an unrelated officer
  // (e.g. Kustos on a Social event) doesn't see foreign event tasks.
  // Match by linkedEventId when present (robust to a title edit), else by title.
  const canManageThisEvent = event ? canManageEventTasks(role, event.kind) : false;
  const taskSource = canManageThisEvent ? getAllTasks() : filterTasksForRole(role);
  const allRelatedTasks = taskSource.filter(t => {
    if (t.isWorkflowParent) return false;
    return t.linkedEventId ? t.linkedEventId === event?.id : t.linkedEvent === event?.title;
  });
  // Hide RSVP tasks from the list — RSVP is already surfaced by RsvpSection above
  const relatedTasks = allRelatedTasks.filter(t => t.lightweightKind !== 'rsvp');
  // True when any related task was generated from an event template (deterministic
  // `tmpl_` id — same signal the per-card AUTO tag uses). Drives a clearer "PREP
  // TASKS" label + a small "generated from template" caption. Pure read of real
  // task data — no preview, no generation.
  const hasGeneratedTasks = relatedTasks.some(t => t.id.startsWith('tmpl_'));

  // Re-render when any task interaction state changes so the prep-progress strip
  // and the per-task badges stay in sync with the Task Detail state machine.
  useTaskStateVersion();
  useCustomTemplatesVersion();   // picker reflects newly-built custom templates
  // Prep-task progress (completed = approved). RSVP summary intentionally omitted.
  const taskOps = summarizeEventOps(
    [],
    relatedTasks.map(t => ({ state: getStoredState(t.id, t.state) })),
  ).tasks;

  // Apply-template-to-existing-event picker (officer action).
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const templateChoices = mergedTemplateOptions().filter(o => o.id !== NO_TEMPLATE);

  function applyTemplateToEvent(templateId: string) {
    setTemplatePickerOpen(false);
    if (!event) return;
    const ev = event;

    // That occurrence's ISO date, for due-date math relative to it.
    const dsFor = (e: typeof ev) => {
      const d = getEventDate(e.dayOffset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const inputFor = (e: typeof ev) => ({
      id: e.id, title: e.title, dateString: dsFor(e), createdByRole: role,
    });

    // Add-style generation for a list of events; counts only NEW tasks
    // (addGeneratedTask returns the existing task when already present → idempotent).
    const generateAdd = (targets: (typeof ev)[]): number => {
      const existingIds = new Set(getAllTasks().map(t => t.id));
      let added = 0;
      targets.forEach(e => {
        buildTasksForTemplateId(templateId, inputFor(e)).forEach(t => {
          const a = addGeneratedTask(t);
          if (a && !existingIds.has(t.id)) { added++; void insertTask(a); }
        });
      });
      _bumpFocus(n => n + 1);   // recompute the related-task list now
      return added;
    };

    const PROTECTED = new Set<string>(['submitted', 'approved']);
    // Existing template tasks linked to any of the given event ids.
    const tmplTasksFor = (ids: Set<string>): MockTask[] =>
      getAllTasks().filter(t => !!t.linkedEventId && ids.has(t.linkedEventId) && t.id.startsWith('tmpl_'));

    // Replace across a set of target events: remove not-yet-acted-on template
    // tasks (submitted/approved are kept), then regenerate for each target.
    const performReplace = (targets: (typeof ev)[], existingTmpl: MockTask[]) => {
      const removable = existingTmpl.filter(t => !PROTECTED.has(getStoredState(t.id, t.state)));
      const keptCount = existingTmpl.length - removable.length;
      removable.forEach(t => { deleteUserTask(t.id); void removeTask(t.id); });
      const snapshot = new Set(getAllTasks().map(t => t.id));   // post-deletion
      let added = 0;
      targets.forEach(e => {
        const newTasks = buildTasksForTemplateId(templateId, inputFor(e));
        clearGeneratedTombstones(newTasks.map(t => t.id));       // allow same-template regen
        newTasks.forEach(t => { const a = addGeneratedTask(t); if (a && !snapshot.has(t.id)) { added++; void insertTask(a); } });
      });
      _bumpFocus(n => n + 1);
      const keptMsg = keptCount > 0 ? ` ${keptCount} in-review/done kept.` : '';
      const scope   = targets.length > 1 ? ` across ${targets.length} events` : '';
      Alert.alert('Template replaced', `Removed ${removable.length}, added ${added}${scope}.${keptMsg}`);
    };

    // Replace flow with confirmation. Series replace ALWAYS confirms (explicit);
    // single-event confirms only when in-progress/done tasks would be kept.
    const replaceFlow = (targets: (typeof ev)[], alwaysConfirm: boolean) => {
      const existingTmpl   = tmplTasksFor(new Set(targets.map(t => t.id)));
      const removableCount = existingTmpl.filter(t => !PROTECTED.has(getStoredState(t.id, t.state))).length;
      const keptCount      = existingTmpl.length - removableCount;
      if (keptCount > 0 || alwaysConfirm) {
        const parts: string[] = [];
        if (targets.length > 1) parts.push(`This affects ${targets.length} events in the series.`);
        parts.push(keptCount > 0
          ? `${keptCount} in-review/done task${keptCount === 1 ? '' : 's'} will be kept; ${removableCount} will be replaced.`
          : `${removableCount} existing template task${removableCount === 1 ? '' : 's'} will be replaced.`);
        Alert.alert('Replace template tasks?', parts.join(' '), [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => performReplace(targets, existingTmpl) },
        ]);
      } else {
        performReplace(targets, existingTmpl);
      }
    };

    // Apply to a set of events: direct add if none have template tasks yet; else
    // prompt Add on top vs Replace. `alwaysConfirmReplace` is true for a series.
    const applyTo = (targets: (typeof ev)[], alwaysConfirmReplace: boolean) => {
      const existing = tmplTasksFor(new Set(targets.map(t => t.id)));
      const scope = targets.length > 1 ? ` across ${targets.length} events` : ' to this event';
      if (existing.length === 0) {
        const n = generateAdd(targets);
        Alert.alert('Template applied', n > 0 ? `Added ${n} task${n === 1 ? '' : 's'}${scope}.` : 'Those tasks are already present.');
        return;
      }
      Alert.alert(
        'Already has template tasks',
        `Add this template on top of the existing tasks, or replace the existing template tasks${targets.length > 1 ? ' across the series' : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add on top',
            onPress: () => {
              const n = generateAdd(targets);
              Alert.alert('Template applied', n > 0 ? `Added ${n} task${n === 1 ? '' : 's'}${scope}.` : 'Those tasks are already present.');
            },
          },
          { text: 'Replace', style: 'destructive', onPress: () => replaceFlow(targets, alwaysConfirmReplace) },
        ],
      );
    };

    const occurrences = (ev.isRecurring && ev.seriesId)
      ? getAllEvents().filter(e => e.seriesId === ev.seriesId)
      : [];

    // Recurring series → choose scope first, then Add vs Replace within that scope.
    if (occurrences.length > 1) {
      Alert.alert('Apply template', `"${ev.title}" is part of a recurring series.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'This Event Only', onPress: () => applyTo([ev], false) },
        { text: 'Entire Series',   onPress: () => applyTo(occurrences, true) },
      ]);
      return;
    }

    applyTo([ev], false);
  }

  useEffect(() => {
    if (!event) return;
    const canEdit = canManageEvent(event, role);
    navigation.setOptions({
      title: event.title,
      headerRight: canEdit
        ? () => (
            <Pressable
              style={s.editHdrBtn}
              onPress={() => router.push(`/event/create?eventId=${event.id}` as any)}
            >
              <Text style={s.editHdrText}>Edit</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [event, navigation, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once we have a Supabase-backed event, pull its rsvps into the local store.
  // hydrateRsvpsFromSupabase short-circuits on non-UUID ids (mock/session
  // events), so this is safe for every event type.
  useEffect(() => {
    if (!event?.id) return;
    void hydrateRsvpsFromSupabase(event.id);
  }, [event?.id]);

  // Manual pull-to-refresh: SERVER-WINS so another user's changes in the same org
  // appear. Re-fetches this event, OVERWRITES its RSVP/date roster from the server
  // (refreshRsvpsFromSupabase), and refetches tasks + task states + notices so the
  // related-task list / prep progress reflect cross-device updates. Distinct from
  // the mount hydrate (local-wins), so a just-made optimistic write isn't clobbered.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (id && isUUID(id)) {
        const remote = await fetchEventById(id, dataOrgId);
        if (remote) setEvent(remote);
      }
      if (event?.id) await refreshRsvpsFromSupabase(event.id);
      const [remoteTasks, remoteStates] = await Promise.all([
        fetchAllTasks(dataOrgId),
        fetchTaskStates(dataOrgId),
      ]);
      setSupabaseTaskCache(remoteTasks);
      refreshTaskStates(remoteStates);
      await hydrateUpdateNotices(dataOrgId);
      _bumpFocus(n => n + 1);
    } finally {
      setRefreshing(false);
    }
  }, [id, dataOrgId, event?.id]);

  if (loading) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Loading…</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Event not found</Text>
      </View>
    );
  }

  const date       = getEventDate(event.dayOffset);
  const dateStr    = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const color      = KIND_COLORS[event.kind];
  const bg         = KIND_BG[event.kind];
  const isMandatory = event.audience === 'all';

  // Role-gated officer sections
  const officer     = isOfficer(role);
  // Task management (Apply template / + Add Task) follows event-kind permissions:
  // a role may only manage tasks on events whose kind is in its allowed set.
  // president/pro_consul → any kind; each chair → their domain; brother → none.
  // Same predicate as the related-task visibility gate above.
  const canManageTasks = canManageThisEvent;

  // Read-only meeting agenda — only for officers on chapter/eboard meeting events.
  // Pure derivation from this week's real events (excluding this meeting itself)
  // and open tasks; recomputed on task-state changes via useTaskStateVersion().
  const isMeetingEvent = event.kind === 'chapter' || event.kind === 'eboard';
  const agenda = officer && isMeetingEvent
    ? buildAgenda({
        events:      getAllEvents().filter(e => e.id !== event.id),
        tasks:       getAllTasks(),
        stateOf:     t => getStoredState(t.id, t.state),
        todayOffset: (new Date().getDay() + 6) % 7,   // Mon=0 … Sun=6
      })
    : null;
  const isBROAD     = isLeadershipRole(role);
  const canSeeRsvps = isBROAD || role === 'annotator';
  const canSeeDates = isBROAD || role === 'risk_manager' || role === 'social_chair';

  // Show RSVP response roster for mandatory, officer-only, OR optional-with-RSVP
  // events (the last is optional to attend but still collects a headcount).
  const showRsvpResponses  = (isMandatory || event.audience === 'officers' || event.audience === 'optional_rsvp') && canSeeRsvps;
  const rsvpResponseLabel  = event.audience === 'officers' ? 'OFFICER RSVPS' : 'MEMBER RSVPS';

  // Show date submissions only for date-style social events (requiresDateNames),
  // not every social event.
  const showDateSubmissions = !!event.requiresDateNames && canSeeDates;

  // If any RSVP task requires covering, bubble that up into the RSVP panel
  const rsvpNeedsCovering = allRelatedTasks.some(
    t => t.lightweightKind === 'rsvp' && !!t.requiresCovering,
  );

  // Only officer-created events are deletable (the 4 seed events are not), and
  // only by someone who can manage the event (creator role or BROAD leadership) —
  // same gate as the header Edit button, so a brother can't delete an officer's event.
  const isUserCreated = isUserCreatedEvent(event.id);
  const canManage     = canManageEvent(event, role);

  function handleDelete() {
    if (!event) return;
    const ev = event;
    // Cascade-delete the generated tasks tied to the given event id(s): each
    // event's RSVP-review task (deterministic id) plus every generated template
    // task linked to it (scanned by the 'tmpl_' prefix so custom-template tasks
    // are caught too, without needing to know which template was applied). All ids
    // are deterministic, so this is a harmless no-op for events that never had
    // them. Local optimistic delete + fire-and-forget persisted delete.
    function cascadeTasksForEventIds(eventIds: string[]) {
      const idSet = new Set(eventIds);
      const templateIds = getAllTasks()
        .filter(t => !!t.linkedEventId && idSet.has(t.linkedEventId) && t.id.startsWith('tmpl_'))
        .map(t => t.id);
      const reviewIds = eventIds.map(id => rsvpReviewTaskId(id));
      for (const id of [...reviewIds, ...templateIds]) {
        deleteUserTask(id);
        void removeTask(id);
      }
    }
    // Affected roles for a cancellation: officer events → officers; otherwise everyone.
    const recipients: Role[] = ev.audience === 'officers' ? OFFICER_ROLES : [...OFFICER_ROLES, FLOOR_ROLE];
    function notifyCancelled() {
      emitUpdateNotice({
        entityType:    'event',
        entityId:      ev.id,
        summary:       `${ev.title} was cancelled`,
        severity:      'critical',
        audienceRoles: recipients,
        changedByRole: role,
      });
    }

    if (ev.isRecurring && ev.seriesId) {
      Alert.alert(
        'Delete Recurring Event',
        `"${ev.title}" is part of a recurring series.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'This Event Only',
            onPress: () => {
              notifyCancelled();
              deleteEvent(ev.id);
              void removeEvent(ev.id);
              cascadeTasksForEventIds([ev.id]);   // only this occurrence's tasks
              router.back();
            },
          },
          {
            text: 'Entire Series',
            style: 'destructive',
            onPress: () => {
              // Gather all occurrence ids BEFORE deleting the series, so we can
              // cascade generated/review tasks linked to every occurrence.
              const seriesIds = getAllEvents()
                .filter(e => e.seriesId === ev.seriesId)
                .map(e => e.id);
              notifyCancelled();
              deleteEventSeries(ev.seriesId!);
              void removeEventSeries(ev.seriesId!);
              cascadeTasksForEventIds(seriesIds.length > 0 ? seriesIds : [ev.id]);
              router.back();
            },
          },
        ],
      );
    } else {
      Alert.alert('Delete Event', `Delete "${ev.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            notifyCancelled();
            deleteEvent(ev.id);
            void removeEvent(ev.id);
            cascadeTasksForEventIds([ev.id]);
            router.back();
          },
        },
      ]);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />
      }
    >
      {/* Kind + audience badges */}
      <View style={s.badgeRow}>
        <View style={[s.kindBadge, { backgroundColor: bg }]}>
          <Text style={[s.kindText, { color }]}>{KIND_LABELS[event.kind]}</Text>
        </View>
        <View style={[s.audienceBadge, isMandatory && s.audienceBadgeMandatory]}>
          <Text style={[s.audienceText, isMandatory && s.audienceTextMandatory]}>
            {AUDIENCE_LABEL[event.audience]}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={s.title}>{event.title}</Text>

      {/* Accent bar */}
      <View style={[s.accentBar, { backgroundColor: color }]} />

      {/* ── Event info ── */}
      <View style={s.detailBlock}>
        <DetailRow icon="📅" label="Date"     value={dateStr} />
        <DetailRow icon="🕐" label="Time"     value={event.time} />
        <DetailRow icon="📍" label="Location" value={event.location} />
        <DetailRow icon="👥" label="Who"      value={AUDIENCE_LABEL[event.audience]} />
      </View>

      <View style={s.divider} />

      {/* ── RSVP / attendance ── */}
      <RsvpSection
        eventId={event.id}
        role={role}
        mandatory={isMandatory}
        requiresCovering={rsvpNeedsCovering}
      />

      {/* ── Your Date (member submission — any role, when event collects names) ── */}
      {event.requiresDateNames && (
        <>
          <View style={s.divider} />
          <DateNameSubmitSection eventId={event.id} role={role} />
        </>
      )}

      {/* ── Date Submissions roster (Risk Mgr, Social Chair, BROAD) ── */}
      {showDateSubmissions && (
        <>
          <View style={s.divider} />
          <DateSubmissionsSection eventId={event.id} />
        </>
      )}

      {/* ── RSVP Responses (mandatory / officer events — Annotator, BROAD) ── */}
      {showRsvpResponses && (
        <>
          <View style={s.divider} />
          <RsvpResponsesSection eventId={event.id} label={rsvpResponseLabel} />
        </>
      )}

      {/* ── Related tasks + prep progress (RSVP tasks already filtered out) ── */}
      {(officer || relatedTasks.length > 0) && (
        <>
          <View style={s.divider} />
          <View style={s.relatedHeader}>
            <SectionLabel text={hasGeneratedTasks ? 'PREP TASKS' : 'RELATED TASKS'} />
            <View style={s.relatedHeaderRight}>
              {taskOps.total > 0 && (
                <Text style={s.prepProgressText}>{taskOps.completed}/{taskOps.total} done</Text>
              )}
              {canManageTasks && (
                <>
                  <Pressable onPress={() => setTemplatePickerOpen(true)}>
                    <Text style={s.addTaskText}>Apply template</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/task/create?eventId=${event.id}` as any)}>
                    <Text style={s.addTaskText}>+ Add Task</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          {hasGeneratedTasks && (
            <Text style={s.generatedHint}>Generated from this event’s template</Text>
          )}
          {relatedTasks.length === 0 ? (
            canManageTasks ? (
              <Text style={s.noRelatedText}>
                No prep tasks yet. Tap “Apply template” to add a standard task set, or “+ Add Task” to create one.
              </Text>
            ) : (
              <Text style={s.noRelatedText}>No related tasks yet.</Text>
            )
          ) : (
            relatedTasks.map(task => (
              <RelatedTaskCard
                key={task.id}
                task={task}
                onPress={() => router.push(`/task/${task.id}?fromEventId=${event.id}` as any)}
              />
            ))
          )}
        </>
      )}

      {/* ── Meeting agenda (chapter/eboard meetings · officers · read-only) ── */}
      {agenda && !isAgendaEmpty(agenda) && (
        <>
          <View style={s.divider} />
          <SectionLabel text="MEETING AGENDA" />
          <AgendaSection
            agenda={agenda}
            onOpen={(it) => router.push(
              it.kind === 'event'
                ? `/event/${it.id}` as any
                : `/task/${it.id}?fromEventId=${event.id}` as any,
            )}
          />
        </>
      )}

      {/* ── About (secondary detail, kept lower) ── */}
      <View style={s.divider} />
      <SectionLabel text="ABOUT" />
      <Text style={s.description}>{event.description}</Text>

      {/* ── Delete button — user-created events, manager roles only ── */}
      {isUserCreated && canManage && (
        <>
          <View style={s.divider} />
          <Pressable style={s.deleteBtn} onPress={handleDelete}>
            <Text style={s.deleteBtnText}>
              {event.isRecurring ? 'Delete Event…' : 'Delete Event'}
            </Text>
          </Pressable>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* ── Apply-template picker (officer) ── */}
    <SearchablePicker
      visible={templatePickerOpen}
      title="Apply a template"
      hint="Adds the template's prep tasks to this event."
      searchPlaceholder="Filter templates…"
      options={templateChoices}
      onSelect={(id) => applyTemplateToEvent(id)}
      onClose={() => setTemplatePickerOpen(false)}
    />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },

  notFound: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: '#64748b',
    fontSize: 16,
  },

  // Header
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kindBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  audienceBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
  },
  audienceBadgeMandatory: {
    backgroundColor: '#312e81',
  },
  audienceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  audienceTextMandatory: {
    color: '#a5b4fc',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 16,
    lineHeight: 32,
  },
  accentBar: {
    height: 3,
    borderRadius: 2,
    width: 40,
    marginBottom: 24,
  },

  // Detail block
  detailBlock: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIcon: {
    fontSize: 18,
    lineHeight: 24,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f1f5f9',
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Related tasks header row (+ Add Task)
  relatedHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  relatedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prepProgressText:   { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 12 },
  addTaskText:   { fontSize: 13, fontWeight: '600', color: '#818cf8', marginBottom: 12 },
  noRelatedText: { fontSize: 13, color: '#475569', marginBottom: 4 },
  generatedHint: { fontSize: 12, color: '#64748b', marginTop: -4, marginBottom: 10 },

  // Meeting agenda (read-only)
  agendaHint:       { fontSize: 12, color: '#64748b', marginTop: -4, marginBottom: 12 },
  agendaGroup:      { marginBottom: 12 },
  agendaGroupLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.6, marginBottom: 6 },
  agendaItem:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, gap: 8 },
  agendaItemTitle:  { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  agendaItemMeta:   { fontSize: 12, color: '#64748b', marginTop: 1 },
  agendaChevron:    { fontSize: 18, color: '#475569' },

  // Header edit button
  editHdrBtn:    { paddingHorizontal: 12, paddingVertical: 4 },
  editHdrText:   { color: '#818cf8', fontSize: 15, fontWeight: '600' },

  description: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 24,
    marginBottom: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 24,
  },

  // RSVP saved-state banner
  rsvpSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rsvpSavedBannerYes: { backgroundColor: '#052e16', borderColor: '#166534' },
  rsvpSavedBannerNo:  { backgroundColor: '#1c1407', borderColor: '#854d0e' },
  rsvpSavedInfo:      { flex: 1 },
  rsvpSavedYesText:   { fontSize: 15, fontWeight: '700', color: '#4ade80' },
  rsvpSavedNoText:    { fontSize: 15, fontWeight: '700', color: '#fbbf24' },
  rsvpNoResponseText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  rsvpSavedDetail:    { fontSize: 13, color: '#cbd5e1', marginTop: 4, lineHeight: 18 },
  rsvpEditBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
    flexShrink: 0,
  },
  rsvpEditBtnText: { fontSize: 13, fontWeight: '600', color: '#818cf8' },

  // RSVP editing actions
  rsvpEditActions:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  rsvpCancelBtn:       { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  rsvpCancelBtnText:   { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  rsvpSaveBtn:         { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4f46e5', alignItems: 'center' },
  rsvpSaveBtnDisabled: { backgroundColor: '#1e293b', opacity: 0.5 },
  rsvpSaveBtnText:     { fontSize: 14, fontWeight: '700', color: '#fff' },
  rsvpHint:            { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 18 },

  // Member date-name submission
  dateSubmitHint: { fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 18 },
  dateNameInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  // RSVP
  rsvpBlock: {
    gap: 0,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  rsvpBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rsvpBtnYes: {
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  rsvpBtnNo: {
    backgroundColor: '#450a0a',
    borderColor: '#7f1d1d',
  },
  rsvpBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  rsvpBtnTextActive: {
    color: '#f1f5f9',
  },
  rsvpConfirm: {
    fontSize: 13,
    color: '#4ade80',
    fontWeight: '500',
    marginTop: 4,
  },
  excuseBox: {
    marginTop: 4,
    gap: 8,
  },
  excuseLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  excuseInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 14,
    padding: 12,
    minHeight: 80,
  },

  // Related tasks
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  taskCardOverdue: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  taskStripe: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
  },
  taskBody: {
    flex: 1,
    paddingVertical: 12,
    gap: 3,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDue: {
    fontSize: 12,
    color: '#64748b',
  },
  taskDueRed: {
    color: '#f87171',
  },
  // Origin tags (auto-generated from a template vs manually added)
  originAuto:     { backgroundColor: '#1e293b', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#334155' },
  originAutoText: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.4 },
  originAdded:    { backgroundColor: '#1e1b4b', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#4f46e5' },
  originAddedText:{ fontSize: 9, fontWeight: '800', color: '#a5b4fc', letterSpacing: 0.4 },
  taskBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  taskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  taskStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginHorizontal: 10,
    flexShrink: 0,
  },
  taskChevron: {
    fontSize: 22,
    color: '#334155',
    paddingRight: 12,
    lineHeight: 28,
  },

  // Date submissions
  responseList: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  responseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  responseLeft: {
    flex: 1,
    gap: 2,
  },
  responseMember: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  responseSub: {
    fontSize: 12,
    color: '#64748b',
  },
  responseCovering: {
    fontSize: 12,
    color: '#818cf8',
  },
  responseTime: {
    fontSize: 11,
    color: '#475569',
    flexShrink: 0,
    marginTop: 2,
  },
  responseAbsent: {
    fontSize: 12,
    color: '#ef4444',
    flexShrink: 0,
    marginTop: 2,
  },
  responseFooter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#162032',
  },
  responseFooterText: {
    fontSize: 12,
    color: '#475569',
  },

  // Delete button
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#1a0505',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f87171',
  },

  // RSVP responses
  rsvpStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rsvpStat: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  rsvpStatNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  rsvpStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rsvpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
});
