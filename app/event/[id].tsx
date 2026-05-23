import { useDevRole } from '@/lib/devRoleStore';
import { fetchEventById, removeEvent, removeEventSeries } from '@/lib/eventService';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { canManageEvent, findEventById, deleteEvent, deleteEventSeries, isUserCreatedEvent } from '@/lib/eventStore';
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
  setRsvpEntry,
  useRsvpEntry,
  useRsvpVersion,
  type RsvpStatus,
} from '@/lib/rsvpStore';
import { OFFICER_ROLES, ROLE_LABELS, isOfficer, type Role } from '@/lib/roles';
import { emitUpdateNotice } from '@/lib/updateNoticeStore';
import {
  STATE_COLOR,
  deleteUserTask,
  dueLabelOf,
  filterTasksForRole,
  isOverdue,
  type MockTask,
  type TaskState,
} from '@/lib/mockTasks';
import { getStoredState, useTaskStateVersion } from '@/lib/devTaskStore';
import { summarizeEventOps } from '@/lib/eventOps';
import { rsvpReviewTaskId } from '@/lib/generatedTasks';
import { removeTask } from '@/lib/taskService';
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
  return { label: 'Open', color: '#94a3b8', bg: '#1e293b' };   // assigned / rejected
}

function RelatedTaskCard({ task, onPress }: { task: MockTask; onPress: () => void }) {
  // Effective state from the interaction store (falls back to the task's own
  // state). Parent calls useTaskStateVersion(), so this re-renders on changes.
  const state       = getStoredState(task.id, task.state);
  const overdue     = isOverdue(task.dueAt, state);   // date-driven (fallback to state)
  const statusColor = STATE_COLOR[state];
  const badge       = taskBadgeFor(state, overdue);

  return (
    <Pressable style={[s.taskCard, overdue && s.taskCardOverdue]} onPress={onPress}>
      <View style={[s.taskStripe, { backgroundColor: overdue ? '#ef4444' : '#334155' }]} />
      <View style={s.taskBody}>
        <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={[s.taskDue, overdue && s.taskDueRed]}>{dueLabelOf(task)}</Text>
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

  // All related tasks visible to this role. Match by linkedEventId when present
  // (robust to a title edit), else by title (legacy/seed tasks).
  const allRelatedTasks = filterTasksForRole(role).filter(t => {
    if (t.isWorkflowParent) return false;
    return t.linkedEventId ? t.linkedEventId === event?.id : t.linkedEvent === event?.title;
  });
  // Hide RSVP tasks from the list — RSVP is already surfaced by RsvpSection above
  const relatedTasks = allRelatedTasks.filter(t => t.lightweightKind !== 'rsvp');

  // Re-render when any task interaction state changes so the prep-progress strip
  // and the per-task badges stay in sync with the Task Detail state machine.
  useTaskStateVersion();
  // Prep-task progress (completed = approved). RSVP summary intentionally omitted.
  const taskOps = summarizeEventOps(
    [],
    relatedTasks.map(t => ({ state: getStoredState(t.id, t.state) })),
  ).tasks;

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
  const isBROAD     = role === 'president' || role === 'pro_consul';
  const canSeeRsvps = isBROAD || role === 'annotator';
  const canSeeDates = isBROAD || role === 'risk_manager' || role === 'social_chair';

  // Show RSVP response roster for mandatory or officer-only events
  const showRsvpResponses  = (isMandatory || event.audience === 'officers') && canSeeRsvps;
  const rsvpResponseLabel  = event.audience === 'officers' ? 'OFFICER RSVPS' : 'MEMBER RSVPS';

  // Show date submissions only for date-style social events (requiresDateNames),
  // not every social event.
  const showDateSubmissions = !!event.requiresDateNames && canSeeDates;

  // If any RSVP task requires covering, bubble that up into the RSVP panel
  const rsvpNeedsCovering = allRelatedTasks.some(
    t => t.lightweightKind === 'rsvp' && !!t.requiresCovering,
  );

  // Only officer-created events are deletable (the 4 seed events are not).
  const isUserCreated = isUserCreatedEvent(event.id);

  function handleDelete() {
    if (!event) return;
    const ev = event;
    // Cascade-delete the generated RSVP-review task tied to this event (Step 4).
    // Deterministic id → a harmless no-op if this event never had one (optional
    // events, or a non-primary recurrence instance). Local optimistic delete +
    // fire-and-forget persisted delete (no-op when unconfigured).
    function cascadeReviewTask() {
      const reviewId = rsvpReviewTaskId(ev.id);
      deleteUserTask(reviewId);
      void removeTask(reviewId);
    }
    // Affected roles for a cancellation: officer events → officers; otherwise everyone.
    const recipients: Role[] = ev.audience === 'officers' ? OFFICER_ROLES : [...OFFICER_ROLES, 'brother'];
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
              cascadeReviewTask();
              router.back();
            },
          },
          {
            text: 'Entire Series',
            style: 'destructive',
            onPress: () => {
              notifyCancelled();
              deleteEventSeries(ev.seriesId!);
              void removeEventSeries(ev.seriesId!);
              cascadeReviewTask();
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
            cascadeReviewTask();
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
            <SectionLabel text="RELATED TASKS" />
            <View style={s.relatedHeaderRight}>
              {taskOps.total > 0 && (
                <Text style={s.prepProgressText}>{taskOps.completed}/{taskOps.total} done</Text>
              )}
              {officer && (
                <Pressable
                  onPress={() => router.push(`/task/create?eventId=${event.id}` as any)}
                >
                  <Text style={s.addTaskText}>+ Add Task</Text>
                </Pressable>
              )}
            </View>
          </View>
          {relatedTasks.length === 0 ? (
            <Text style={s.noRelatedText}>No related tasks yet.</Text>
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

      {/* ── About (secondary detail, kept lower) ── */}
      <View style={s.divider} />
      <SectionLabel text="ABOUT" />
      <Text style={s.description}>{event.description}</Text>

      {/* ── Delete button — user-created events only ── */}
      {isUserCreated && (
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
  taskDue: {
    fontSize: 12,
    color: '#64748b',
  },
  taskDueRed: {
    color: '#f87171',
  },
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
