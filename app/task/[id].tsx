import { loadTaskState, saveTaskState } from '@/lib/devTaskStore';
import { useDevRole } from '@/lib/devRoleStore';
import { findEventById, getAllEvents, resolveEventId } from '@/lib/eventStore';
import {
  PROOF_ICON,
  PROOF_LABEL,
  STATE_BG,
  STATE_COLOR,
  STATE_LABEL,
  STATE_STRIPE,
  canApproveTask,
  canManageTask,
  deleteUserTask,
  dueLabelOf,
  findTaskById,
  getParentTask,
  getWorkflowChildren,
  isTaskAssignee,
  type MockTask,
  type ProofType,
  type TaskState,
} from '@/lib/mockTasks';
import { getTaskSubmission, removeTask, upsertTaskSubmission, type TaskSubmission } from '@/lib/taskService';
import { AUTH_ENABLED, ORG_SCOPED_DATA } from '@/lib/flags';
import { isSupabaseConfigured } from '@/lib/memberService';
import { emitUpdateNotice } from '@/lib/updateNoticeStore';
import {
  getRsvpEntry,
  setRsvpEntry,
  useRsvpEntry,
  type RsvpEntry,
  type RsvpStatus,
} from '@/lib/rsvpStore';
import { ROLE_LABELS, isLeadershipRole, type Role } from '@/lib/roles';
import { canManageEventTasks } from '@/lib/eventTaskPermissions';
import { usePushRegistration } from '@/lib/usePushRegistration';
import { sendActionPush } from '@/lib/pushTokens';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { getReportDefinition } from '@/lib/reportDefinitions';
import {
  orderedQuestions,
  responseProgress,
  validateAnswers,
  withAnswerValue,
  withAnswerNoUpdate,
  type StructuredResponseDefinition,
  type StructuredAnswerMap,
} from '@/lib/structuredResponses';
import { getTaskReportSubmission, upsertTaskReportSubmission } from '@/lib/reportSubmissionService';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ─── Primitives ───────────────────────────────────────────────────────────────

function SLabel({ text }: { text: string }) {
  return <Text style={s.sLabel}>{text}</Text>;
}
function Divider() {
  return <View style={s.divider} />;
}
function StatusChip({
  icon, text, color, bg,
}: {
  icon: string; text: string; color: string; bg: string;
}) {
  return (
    <View style={[s.statusChip, { backgroundColor: bg }]}>
      <Text style={s.statusChipIcon}>{icon}</Text>
      <Text style={[s.statusChipText, { color }]}>{text}</Text>
    </View>
  );
}

// ─── RSVP status badge (replaces TaskState badge for RSVP tasks) ──────────────

const RSVP_BADGE: Record<RsvpStatus, { label: string; color: string; bg: string }> = {
  no_response:   { label: 'Response Needed', color: '#64748b', bg: '#1e293b' },
  attending:     { label: 'Attending',       color: '#4ade80', bg: '#052e16' },
  not_attending: { label: 'Not Attending',   color: '#fbbf24', bg: '#1c1407' },
};

function RsvpStatusBadge({ status }: { status: RsvpStatus }) {
  const { label, color, bg } = RSVP_BADGE[status];
  return (
    <View style={[s.stateBadge, { backgroundColor: bg }]}>
      <Text style={[s.stateText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Responsibility context badge ────────────────────────────────────────────

function ContextBadge({ isMine, isReviewer, canSupervise }: { isMine: boolean; isReviewer: boolean; canSupervise: boolean }) {
  if (isMine && isReviewer) {
    return (
      <View style={[s.ctxBadge, { backgroundColor: '#1a2535' }]}>
        <Text style={[s.ctxText, { color: '#94a3b8' }]}>You own · You review</Text>
      </View>
    );
  }
  if (isMine) {
    return (
      <View style={[s.ctxBadge, { backgroundColor: '#1e1b4b' }]}>
        <Text style={[s.ctxText, { color: '#a5b4fc' }]}>Your Task</Text>
      </View>
    );
  }
  if (isReviewer) {
    return (
      <View style={[s.ctxBadge, { backgroundColor: '#271a00' }]}>
        <Text style={[s.ctxText, { color: '#fbbf24' }]}>Review Required</Text>
      </View>
    );
  }
  // Only claim supervision when the role can actually manage/supervise this task
  // (its named supervisor, or a role that manages the linked event's kind). A
  // role with no stake (e.g. a chair viewing another domain's task) gets no badge
  // instead of a misleading "You're Supervising".
  if (!canSupervise) return null;
  return (
    <View style={[s.ctxBadge, { backgroundColor: '#162032' }]}>
      <Text style={[s.ctxText, { color: '#64748b' }]}>You're Supervising</Text>
    </View>
  );
}

// ─── Assignee callout ─────────────────────────────────────────────────────────

function AssigneeCallout({
  assignedTo,
  reminderSent,
  onReminder,
}: {
  assignedTo:   string;
  reminderSent: boolean;
  onReminder:   () => void;
}) {
  return (
    <View style={s.callout}>
      <View style={s.calloutInfo}>
        <Text style={s.calloutLabel}>ASSIGNED TO</Text>
        <Text style={s.calloutName}>{assignedTo}</Text>
      </View>
      <Pressable
        style={[s.reminderBtn, reminderSent && s.reminderBtnSent]}
        onPress={onReminder}
        disabled={reminderSent}
      >
        <Text style={[s.reminderBtnText, reminderSent && s.reminderBtnTextSent]}>
          {reminderSent ? '✓ Sent' : 'Remind'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Info block ───────────────────────────────────────────────────────────────

// Top-of-screen essentials only: Due, Assigned To, and the linked event (the
// latter suppressed when the tappable "View Event" action renders). Secondary
// metadata (proof / reviewer / supervisor / workflow) lives in the lower
// DETAILS section so the top stays scannable.
function InfoBlock({
  task,
  isAssignee,
  hideEventRow,
}: {
  task:          MockTask;
  isAssignee:    boolean;
  hideEventRow?: boolean;   // suppressed when the tappable "View Event" action renders
}) {
  return (
    <View style={s.infoBlock}>
      <InfoRow icon="📅" label="Due" value={dueLabelOf(task)} />
      <InfoRow
        icon="👤"
        label="Assigned To"
        value={isAssignee ? 'You' : task.assignedTo}
        highlight={isAssignee}
      />
      {task.linkedEvent && !hideEventRow && (
        <InfoRow icon="📌" label="Event" value={task.linkedEvent} accent />
      )}
    </View>
  );
}

// Secondary metadata rows for the lower DETAILS section. Returns null when the
// task carries none of them (so we don't render an empty box).
function SecondaryMeta({ task, parentTask }: { task: MockTask; parentTask?: MockTask }) {
  const rows = [
    task.isWorkflowParent ? <InfoRow key="type" icon="📋" label="Type" value="Workflow summary" /> : null,
    parentTask ? <InfoRow key="parent" icon="🔗" label="Part of Workflow" value={parentTask.title} accent /> : null,
    task.requiresProof && task.proofType
      ? <InfoRow key="proof" icon={PROOF_ICON[task.proofType]} label="Proof Required" value={PROOF_LABEL[task.proofType]} />
      : null,
    task.requiresApproval && task.reviewerRole && task.lightweightKind !== 'rsvp'
      ? <InfoRow key="reviewer" icon="✅" label="Reviewed By" value={ROLE_LABELS[task.reviewerRole]} />
      : null,
    task.supervisorRole && task.supervisorRole !== task.reviewerRole
      ? <InfoRow key="supervisor" icon="👁" label="Supervised By" value={ROLE_LABELS[task.supervisorRole]} />
      : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;
  return <View style={[s.infoBlock, { marginTop: 16 }]}>{rows}</View>;
}

function InfoRow({
  icon, label, value, accent, highlight,
}: {
  icon: string; label: string; value: string; accent?: boolean; highlight?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, accent && s.infoAccent, highlight && s.infoHighlight]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Workflow children section ────────────────────────────────────────────────

function WorkflowChildrenSection({ parentId }: { parentId: string }) {
  const router   = useRouter();
  const children = getWorkflowChildren(parentId);
  if (children.length === 0) return null;

  const childStates = children.map(c => {
    const stored = loadTaskState(c.id, { state: c.state });
    return { ...c, state: stored.state };
  });

  const doneCount = childStates.filter(c => c.state === 'approved').length;
  const pct       = Math.round((doneCount / children.length) * 100);

  return (
    <View>
      <View style={s.subHeader}>
        <SLabel text="WORKFLOW STEPS" />
        <Text style={s.subProgress}>{doneCount}/{children.length} complete</Text>
      </View>

      <View style={s.progressTrack}>
        <View
          style={[
            s.progressFill,
            { width: `${pct}%` as any },
            doneCount === children.length && s.progressFillDone,
          ]}
        />
      </View>

      <View style={s.subList}>
        {childStates.map(child => {
          const isDone = child.state === 'approved';
          return (
            <Pressable
              key={child.id}
              style={[s.subRow, isDone && s.subRowDone]}
              onPress={() => router.push(`/task/${child.id}` as any)}
            >
              <View style={[s.subCheck, isDone && s.subCheckDone]}>
                {isDone && <Text style={s.subCheckmark}>✓</Text>}
              </View>
              <View style={s.subBody}>
                <Text style={[s.subTitle, isDone && s.subTitleDone]}>{child.title}</Text>
                <Text style={[s.subDue,   isDone && s.subDueDone  ]}>{child.dueLabel}</Text>
              </View>
              {!isDone && (
                <View style={[s.subBadge, { backgroundColor: STATE_BG[child.state] }]}>
                  <Text style={[s.subBadgeText, { color: STATE_COLOR[child.state] }]}>
                    {STATE_LABEL[child.state]}
                  </Text>
                </View>
              )}
              <Text style={s.subChevron}>›</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── RSVP action — reads/writes rsvpStore, never locks ───────────────────────
//
// Every keystroke is auto-saved to rsvpStore so state survives navigation.
// Users can freely switch between Attending ↔ Not Attending before the due date.

function RsvpAction({ task, role }: { task: MockTask; role: Role }) {
  // Key by unique event instance ID — not title — so recurring events don't share state.
  // resolveEventId maps a seed mock id ('e1') to its Supabase UUID when loaded.
  const eventId       = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');
  const mandatory     = task.linkedEventMandatory ?? false;
  const needsCovering = task.requiresCovering    ?? false;

  // Reactive saved state from the store.
  const entry = useRsvpEntry(eventId, role);
  const saved = entry.status;

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
    draftStatus === 'not_attending' ? (!mandatory || draftHasExcuse) && (!needsCovering || draftHasCovering)
    : false;

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

  // ── Editing mode — draft only; nothing saved until Save ───────────────────
  if (editing) {
    return (
      <View style={s.actionBlock}>
        <View style={s.twoBtnRow}>
          <Pressable
            style={[s.twoBtn, draftStatus === 'attending' && s.twoBtnYes]}
            onPress={() => setDraftStatus('attending')}
          >
            <Text style={[s.twoBtnText, draftStatus === 'attending' && { color: '#4ade80' }]}>
              Attending
            </Text>
          </Pressable>
          <Pressable
            style={[s.twoBtn, draftStatus === 'not_attending' && s.twoBtnNoActive]}
            onPress={() => setDraftStatus('not_attending')}
          >
            <Text style={[s.twoBtnText, draftStatus === 'not_attending' && s.twoBtnTextActive]}>
              Not Attending
            </Text>
          </Pressable>
        </View>

        {draftStatus === 'not_attending' && (
          <View style={s.excuseBlock}>
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

            {needsCovering && (
              <>
                <Text style={s.excuseLabel}>Who will cover for you? (required)</Text>
                <TextInput
                  style={s.singleInput}
                  placeholder="Officer name or role…"
                  placeholderTextColor="#475569"
                  value={draftCovering}
                  onChangeText={setDraftCovering}
                  autoCapitalize="words"
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
          <Text style={s.rsvpMissingNote}>
            {mandatory && !draftHasExcuse ? 'An excuse is required for mandatory events.' : ''}
            {needsCovering && !draftHasCovering ? ' A covering officer is required.' : ''}
          </Text>
        )}
        {draftStatus === 'no_response' && (
          <Text style={s.rsvpMissingNote}>Choose Attending or Not Attending, then Save.</Text>
        )}
      </View>
    );
  }

  // ── Saved: Attending ──────────────────────────────────────────────────────
  if (saved === 'attending') {
    return (
      <View style={s.rsvpAttending}>
        <View style={s.rsvpAttendingLeft}>
          <Text style={s.rsvpAttendingIcon}>✓</Text>
          <Text style={s.rsvpAttendingText}>Saved: Attending</Text>
        </View>
        <Pressable style={s.rsvpChangeBtn} onPress={beginEdit}>
          <Text style={s.rsvpChangeBtnText}>Change</Text>
        </Pressable>
      </View>
    );
  }

  // ── Saved: Not attending ──────────────────────────────────────────────────
  if (saved === 'not_attending') {
    return (
      <View style={s.rsvpSavedNaBlock}>
        <View style={s.rsvpSavedNaInfo}>
          <Text style={s.rsvpSavedNaText}>Saved: Not attending</Text>
          {entry.excuse.trim()   ? <Text style={s.rsvpSavedNaDetail}>Reason: {entry.excuse}</Text>     : null}
          {entry.covering.trim() ? <Text style={s.rsvpSavedNaDetail}>Covering: {entry.covering}</Text> : null}
        </View>
        <Pressable style={s.rsvpChangeBtn} onPress={beginEdit}>
          <Text style={s.rsvpChangeBtnText}>Change</Text>
        </Pressable>
      </View>
    );
  }

  // ── No response yet ───────────────────────────────────────────────────────
  return (
    <View style={s.rsvpNoRespRow}>
      <Text style={s.rsvpNoRespText}>No response yet</Text>
      <Pressable style={s.rsvpChangeBtn} onPress={beginEdit}>
        <Text style={s.rsvpChangeBtnText}>Respond</Text>
      </Pressable>
    </View>
  );
}

// ─── Name submission action — reads/writes rsvpStore ─────────────────────────

function NameSubmitAction({ task, role }: { task: MockTask; role: Role }) {
  const eventId = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');

  const [dateName, setDateNameLocal] = useState(
    () => getRsvpEntry(eventId, role).dateName
  );

  function handleChange(v: string) {
    setDateNameLocal(v);
    setRsvpEntry(eventId, role, { dateName: v, status: v.trim() ? 'attending' : 'no_response' });
  }

  const submitted = dateName.trim().length > 0;

  return (
    <View style={s.actionBlock}>
      <Text style={s.actionHint}>Full name of your date</Text>
      <TextInput
        style={s.singleInput}
        placeholder="e.g. Jane Smith"
        placeholderTextColor="#475569"
        value={dateName}
        onChangeText={handleChange}
        autoCapitalize="words"
        returnKeyType="done"
      />
      {submitted && (
        <View style={s.rsvpSavedBadge}>
          <Text style={s.rsvpSavedText}>✓ Name saved — visible to Risk Manager &amp; Social Chair</Text>
        </View>
      )}
    </View>
  );
}

// ─── Acknowledgment / Yes-No actions ─────────────────────────────────────────

function AcknowledgmentAction({ onComplete }: { onComplete: (s: TaskState) => void }) {
  return (
    <View style={s.actionBlock}>
      <Pressable style={s.ackBtn} onPress={() => onComplete('approved')}>
        <Text style={s.ackBtnText}>✓  I Acknowledge</Text>
      </Pressable>
    </View>
  );
}

function YesNoAction({ onComplete }: { onComplete: (s: TaskState) => void }) {
  return (
    <View style={s.actionBlock}>
      <View style={s.twoBtnRow}>
        <Pressable style={[s.twoBtn, s.twoBtnYes]} onPress={() => onComplete('approved')}>
          <Text style={[s.twoBtnText, { color: '#4ade80' }]}>Yes</Text>
        </Pressable>
        <Pressable style={[s.twoBtn, s.twoBtnNo]} onPress={() => onComplete('approved')}>
          <Text style={[s.twoBtnText, { color: '#94a3b8' }]}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Lightweight action section dispatcher ───────────────────────────────────

function LightweightActionSection({
  task,
  role,
  taskState,
  onComplete,
}: {
  task:      MockTask;
  role:      Role;
  taskState: TaskState;
  onComplete:(s: TaskState) => void;
}) {
  // RSVP and name_submission are managed by rsvpStore — never show a generic lockout
  if (task.lightweightKind === 'rsvp') {
    return <RsvpAction task={task} role={role} />;
  }
  if (task.lightweightKind === 'name_submission') {
    return <NameSubmitAction task={task} role={role} />;
  }

  // Acknowledgment / yes_no use devTaskStore lockout flow
  if (taskState === 'approved') {
    return (
      <View style={s.actionDone}>
        <Text style={s.actionDoneText}>✓  Task completed</Text>
      </View>
    );
  }
  if (taskState === 'submitted') {
    return <StatusChip icon="⏳" text="Submitted — awaiting review" color="#fbbf24" bg="#1c1407" />;
  }

  if (task.lightweightKind === 'acknowledgment') {
    return <AcknowledgmentAction onComplete={onComplete} />;
  }
  if (task.lightweightKind === 'yes_no') {
    return <YesNoAction onComplete={onComplete} />;
  }

  return null;
}

// ─── Proof submit section (assignee only) ─────────────────────────────────────

function ProofSubmitSection({
  task,
  taskState,
  proofContent,
  setProofContent,
  onSubmit,
  submitError,
  submitting,
  reviewerLabel,
}: {
  task:            MockTask;
  taskState:       TaskState;
  proofContent:    string;
  setProofContent: (v: string) => void;
  onSubmit:        () => void;
  submitError?:    string | null;
  submitting?:     boolean;
  reviewerLabel?:  string;
}) {
  if (!task.requiresProof || !task.proofType) return null;

  const awaitingText = reviewerLabel
    ? `Submitted — awaiting review by ${reviewerLabel}`
    : 'Submitted — awaiting review';

  const icon    = PROOF_ICON[task.proofType];
  const isLink  = task.proofType === 'link';
  const canEdit = taskState === 'assigned' || taskState === 'overdue'
    || taskState === 'escalated' || taskState === 'rejected';

  // Alpha supports text + link proof only (file upload is Proof v1, not built).
  const trimmed = proofContent.trim();
  const linkOk  = /^https?:\/\//i.test(trimmed);
  const badLink = isLink && trimmed.length > 0 && !linkOk;
  const canSubmit = trimmed.length > 0 && (!isLink || linkOk);

  return (
    <View>
      <SLabel text="PROOF OF COMPLETION" />

      {taskState === 'approved'  && <StatusChip icon="✓"  text="Proof accepted"                     color="#4ade80" bg="#052e16" />}
      {taskState === 'submitted' && <StatusChip icon="⏳" text={awaitingText}                       color="#fbbf24" bg="#1c1407" />}
      {taskState === 'rejected'  && <StatusChip icon="✗"  text="Proof rejected — resubmit required" color="#fca5a5" bg="#1a0505" />}

      {canEdit && (
        <View style={s.proofInputBlock}>
          <Text style={s.proofHint}>
            {icon}  {isLink
              ? 'Paste a link (starting with https://) as your proof.'
              : 'Write a short update describing what you completed.'}
          </Text>

          <TextInput
            style={[s.proofInput, !isLink && { minHeight: 90 }]}
            placeholder={isLink ? 'https://…' : 'Describe what you completed…'}
            placeholderTextColor="#475569"
            value={proofContent}
            onChangeText={setProofContent}
            multiline={!isLink}
            numberOfLines={!isLink ? 4 : 1}
            textAlignVertical={!isLink ? 'top' : 'center'}
            autoCapitalize={isLink ? 'none' : 'sentences'}
            autoCorrect={!isLink}
            keyboardType={isLink ? 'url' : 'default'}
          />

          {badLink && (
            <Text style={s.proofLinkWarn}>Links must start with http:// or https://</Text>
          )}
          {submitError && (
            <Text style={s.proofSubmitError}>{submitError}</Text>
          )}

          <Pressable
            style={[s.submitBtn, (!canSubmit || submitting) && s.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit || !!submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit for Review'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Proof review section (reviewer only, when submitted) ─────────────────────

function ProofReviewSection({
  proofType,
  proofContent,
  reviewerLabel,
  onApprove,
  onReject,
}: {
  proofType?:    ProofType;
  proofContent:  string;
  reviewerLabel: string;
  onApprove: () => void;
  onReject:  (note: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejNote,    setRejNote   ] = useState('');
  const trimmed = proofContent.trim();
  const isLink  = proofType === 'link';
  const linkOk  = /^https?:\/\//i.test(trimmed);

  // A review-required task may carry NO proof requirement (the assignee just
  // marks it ready for review). Don't show an empty "SUBMITTED PROOF / No content
  // provided" box in that case — say plainly that there's nothing to attach.
  const hasProof = !!proofType;

  return (
    <View>
      {hasProof ? (
        <>
          <SLabel text="SUBMITTED PROOF" />
          <View style={s.proofDisplay}>
            <Text style={s.proofDisplayType}>{PROOF_ICON[proofType!]}  {PROOF_LABEL[proofType!]}</Text>
            {trimmed.length === 0 ? (
              <Text style={s.proofDisplayEmpty}>No content provided</Text>
            ) : isLink && linkOk ? (
              <Text style={s.proofDisplayLink} onPress={() => { void Linking.openURL(trimmed); }}>
                {trimmed}
              </Text>
            ) : (
              <Text style={s.proofDisplayContent}>{proofContent}</Text>
            )}
          </View>
        </>
      ) : (
        <>
          <SLabel text="READY FOR REVIEW" />
          <View style={s.proofDisplay}>
            <Text style={s.proofDisplayEmpty}>
              No proof was required — the assignee marked this complete and sent it for your review.
            </Text>
          </View>
        </>
      )}

      <SLabel text="YOUR REVIEW" />
      <View style={s.reviewBlock}>
        <Text style={s.reviewerNote}>Reviewing as {reviewerLabel}</Text>

        {!showReject ? (
          <View style={s.reviewBtns}>
            <Pressable style={s.approveBtn} onPress={onApprove}>
              <Text style={s.approveBtnText}>Approve</Text>
            </Pressable>
            <Pressable style={s.rejectBtn} onPress={() => setShowReject(true)}>
              <Text style={s.rejectBtnText}>Reject</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.rejectBlock}>
            <Text style={s.rejectBlockLabel}>Rejection reason</Text>
            <TextInput
              style={s.rejectInput}
              placeholder="What needs to be corrected…"
              placeholderTextColor="#475569"
              value={rejNote}
              onChangeText={setRejNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={s.rejectRow}>
              <Pressable
                style={s.cancelBtn}
                onPress={() => { setShowReject(false); setRejNote(''); }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.rejectConfirmBtn, !rejNote && s.disabledBtn]}
                onPress={() => { if (rejNote) onReject(rejNote); }}
              >
                <Text style={s.rejectConfirmText}>Confirm Rejection</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Report (structured-response) section ─────────────────────────────────────
// Rendered for tasks that carry a reportDefinitionId. The assignee fills + submits
// a structured form (no proof, no review); allowed readers see a read-only view.
// Backed by real RPCs via reportSubmissionService — fails safe (inline error) when
// unconfigured / on RPC error; never crashes.

function ReportFormSection({
  definition,
  taskId,
  editable,
  done,
  onSubmitted,
}: {
  definition:  StructuredResponseDefinition;
  taskId:      string;
  editable:    boolean;        // assignee may edit + submit; others read-only
  done:        boolean;        // task already complete (approved)
  onSubmitted: () => void;     // parent flips task state + navigates back
}) {
  const [answers, setAnswers]       = useState<StructuredAnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Load any existing submission once (no-op/null when unconfigured or unauthorized).
  useEffect(() => {
    let cancelled = false;
    void getTaskReportSubmission(taskId).then(sub => {
      if (!cancelled && sub?.answers) setAnswers(sub.answers);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  const questions = orderedQuestions(definition);
  const progress  = responseProgress(definition, answers);

  async function handleSubmit() {
    if (submitting) return;
    const v = validateAnswers(definition, answers);
    if (!v.valid) {
      setError(v.missingRequired.length > 0
        ? 'Please answer all required questions.'
        : 'Please fix the highlighted answers.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const ok = await upsertTaskReportSubmission(taskId, definition.id, answers);
    setSubmitting(false);
    if (!ok) { setError('Couldn’t submit your report. Please try again.'); return; }
    onSubmitted();
  }

  // ── Read-only view: a reader, or the assignee after it's submitted/done ──
  const readOnly = !editable || done;
  if (readOnly) {
    return (
      <View>
        <SLabel text={done ? 'SUBMITTED REPORT' : `${definition.label.toUpperCase()}`} />
        {done ? (
          <>
            <View style={s.actionDone}><Text style={s.actionDoneText}>✓  Report submitted</Text></View>
            <View style={{ marginTop: 10, gap: 12 }}>
              {questions.map(q => {
                const a = answers[q.key];
                const hasValue = typeof a?.value === 'string' && a.value.trim().length > 0;
                return (
                  <View key={q.key}>
                    <Text style={s.reportPrompt}>{q.prompt}</Text>
                    {a?.noUpdate ? (
                      <Text style={s.reportNoUpdateTag}>No update</Text>
                    ) : hasValue ? (
                      <Text style={s.proofDisplayContent}>{a!.value}</Text>
                    ) : (
                      <Text style={s.proofDisplayEmpty}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          // Reader viewing before the assignee has submitted. Answers only persist
          // on full submit (which flips the task to done), so a not-done read-only
          // view is always "nothing submitted yet" — say so instead of empty dashes.
          <Text style={s.reportHint}>Not submitted yet.</Text>
        )}
      </View>
    );
  }

  // ── Editable form (assignee, not yet done) ──
  return (
    <View>
      <SLabel text={definition.label.toUpperCase()} />
      <View style={{ gap: 14, marginTop: 4 }}>
        {questions.map(q => {
          const a        = answers[q.key];
          const isNoUpd  = a?.noUpdate === true;
          const isLong   = q.type === 'long_text';
          return (
            <View key={q.key}>
              <View style={s.reportPromptRow}>
                <Text style={s.reportPrompt}>{q.prompt}</Text>
                {q.required && <Text style={s.reportRequired}>required</Text>}
              </View>
              <TextInput
                style={[s.proofInput, isLong && { minHeight: 80 }, isNoUpd && s.reportInputDisabled]}
                placeholder={q.placeholder ?? ''}
                placeholderTextColor="#475569"
                value={isNoUpd ? '' : (a?.value ?? '')}
                editable={!isNoUpd}
                onChangeText={t => { setAnswers(m => withAnswerValue(m, q.key, t)); setError(null); }}
                multiline={isLong}
                numberOfLines={isLong ? 4 : 1}
                textAlignVertical={isLong ? 'top' : 'center'}
                maxLength={q.maxLength}
              />
              {q.allowNoUpdate && (
                <Pressable
                  style={s.reportNoUpdateRow}
                  onPress={() => { setAnswers(m => withAnswerNoUpdate(m, q.key, !isNoUpd)); setError(null); }}
                >
                  <View style={[s.reportCheckbox, isNoUpd && s.reportCheckboxOn]}>
                    {isNoUpd && <Text style={s.reportCheckboxMark}>✓</Text>}
                  </View>
                  <Text style={s.reportNoUpdateLabel}>No update this cycle</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {error && <Text style={s.proofSubmitError}>{error}</Text>}

      <Pressable
        style={[s.submitBtn, { marginTop: 14 }, (!progress.complete || submitting) && s.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!progress.complete || submitting}
      >
        <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
      </Pressable>
      {!progress.complete && (
        <Text style={s.reportHint}>Answer the required questions to submit.</Text>
      )}
    </View>
  );
}

// ─── Escalation chain ─────────────────────────────────────────────────────────

function EscalationSection({
  chain,
  escalatedTo,
}: {
  chain:        string[];
  escalatedTo?: string;
}) {
  return (
    <View>
      <SLabel text="ESCALATION PATH" />
      <View style={s.escalationBlock}>
        <View style={s.escalationChain}>
          {chain.map((r, i) => {
            const active = r === escalatedTo;
            return (
              <View key={r} style={s.escalationStep}>
                {i > 0 && <Text style={s.escalationArrow}>→</Text>}
                <View style={[s.escalationNode, active && s.escalationNodeActive]}>
                  <Text style={[s.escalationNodeText, active && s.escalationNodeTextActive]}>
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        {escalatedTo && (
          <Text style={s.escalationCaption}>
            ⚡ Currently escalated to {ROLE_LABELS[escalatedTo as keyof typeof ROLE_LABELS] ?? escalatedTo}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TaskDetailScreen() {
  const { id, fromEventId } = useLocalSearchParams<{ id: string; fromEventId?: string }>();
  const navigation = useNavigation();
  const router     = useRouter();
  const { role }   = useDevRole();

  // Re-read on focus so an edit (made on the create/edit screen, then back()) is
  // reflected here without leaving a duplicate detail in the nav stack.
  const [, _bumpFocus] = useState(0);
  useFocusEffect(useCallback(() => { _bumpFocus(n => n + 1); }, []));

  const task = findTaskById(id ?? '');

  // Edit/delete allowed only for officer-created structured tasks the role manages.
  const canManage = !!task && canManageTask(task, role);

  const _init = task ? loadTaskState(task.id, { state: task.state }) : null;

  const [taskState,    _setTaskState   ] = useState<TaskState>(_init?.state       ?? 'assigned');
  const [proofContent, _setProofContent] = useState         (_init?.proofContent  ?? '');
  const [rejNote,      _setRejNote     ] = useState         (_init?.rejectionNote ?? '');
  const [reminderSent, setReminderSent ] = useState(false);
  const [proofError,   setProofError   ] = useState<string | null>(null);
  const [submitting,   setSubmitting   ] = useState(false);
  const [remoteProof,  setRemoteProof  ] = useState<TaskSubmission | null>(null);

  // Real flag-on persistence mode (the alpha): proof submissions go through the
  // RPC-backed task_submissions primitive. Flag-off sandbox stays in-memory.
  const proofSyncRequired = AUTH_ENABLED && ORG_SCOPED_DATA && isSupabaseConfigured();

  // Push v1: opening a task is a "first meaningful action" — try to register this
  // device for push (no-op unless flag-on + real member + physical device; never
  // re-prompts after denial; deduped to once/session). Registration only — no sends.
  const { maybeRegisterForPush } = usePushRegistration();
  useEffect(() => {
    if (task) maybeRegisterForPush();
  }, [task, maybeRegisterForPush]);

  // Push v1 (Build 14): action-linked task pushes. Fire-and-forget, never blocks
  // the saved state change; audience is always a single concrete role:
  //   • submitted → reviewerRole only (skip if none)
  //   • approved/rejected → assignedRole only (skip if 'all')
  const pushOrgId = useActiveDataOrgId();
  function pushForTransition(t: MockTask, next: TaskState) {
    if (next === 'submitted') {
      const reviewer = t.reviewerRole;
      if (!reviewer) return;   // no reviewer → don't blast leadership (deferred)
      void sendActionPush({
        orgId: pushOrgId, entityType: 'task', entityId: t.id,
        audienceRoles: [reviewer],
        title: 'Task needs your review', body: t.title, actorRole: role,
      });
    } else if (next === 'approved' || next === 'rejected') {
      const assignee = t.assignedRole;
      if (!assignee || assignee === 'all') return;   // concrete role only
      void sendActionPush({
        orgId: pushOrgId, entityType: 'task', entityId: t.id,
        audienceRoles: [assignee],
        title: next === 'approved' ? 'Task approved' : 'Task needs changes',
        body: t.title, actorRole: role,
      });
    }
  }

  function setTaskState(s: TaskState) {
    _setTaskState(s);
    if (task) saveTaskState(task.id, { state: s });
  }
  function setProofContent(v: string) {
    _setProofContent(v);
    if (task) saveTaskState(task.id, { proofContent: v });
  }
  function setRejNote(v: string) {
    _setRejNote(v);
    if (task) saveTaskState(task.id, { rejectionNote: v });
  }

  // Submit proof. In flag-on mode write the access-controlled submission row
  // FIRST; only on success mark the task submitted (which keeps dual-writing
  // proof_content via saveTaskState). If the submission write fails, do NOT
  // mark submitted. Flag-off: skip the RPC, behave exactly as before (in-memory).
  async function handleProofSubmit() {
    if (!task || submitting) return;
    if (proofSyncRequired) {
      const isLink  = task.proofType === 'link';
      const content = proofContent.trim();
      setSubmitting(true);
      const ok = await upsertTaskSubmission(task.id, isLink ? '' : content, isLink ? content : '');
      setSubmitting(false);
      if (!ok) { setProofError('Couldn’t submit proof. Please try again.'); return; }
    }
    setProofError(null);
    setTaskState('submitted');
    pushForTransition(task, 'submitted');   // notify reviewer (if any)
  }

  // Reviewer read: prefer the access-controlled submission row; fall back to
  // proofContent (proof made on build 8 / flag-off). Fetch once in flag-on mode.
  useEffect(() => {
    if (!proofSyncRequired || !task) return;
    let cancelled = false;
    void getTaskSubmission(task.id).then(sub => { if (!cancelled && sub) setRemoteProof(sub); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, proofSyncRequired]);

  useEffect(() => {
    if (!task) return;
    navigation.setOptions({
      title: task.title,
      headerRight: canManage
        ? () => (
            <Pressable
              style={s.editHdrBtn}
              onPress={() => router.push(`/task/create?taskId=${task.id}` as any)}
            >
              <Text style={s.editHdrText}>Edit</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [task, navigation, canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDelete() {
    if (!task) return;
    Alert.alert('Delete Task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          // Notify affected roles that the task was cancelled.
          emitUpdateNotice({
            entityType:    'task',
            entityId:      task.id,
            summary:       `${task.title} was cancelled`,
            severity:      'critical',
            audienceRoles: [task.assignedRole, task.reviewerRole, task.supervisorRole]
              .filter((r): r is Role => !!r && r !== 'all'),
            changedByRole: role,
          });
          deleteUserTask(task.id);   // local + cache (optimistic) + tombstone
          void removeTask(task.id);  // Supabase row (no-op in mock fallback)
          router.back();
        },
      },
    ]);
  }

  if (!task) {
    return (
      <View style={s.notFound}>
        <Text style={s.notFoundText}>Task not found</Text>
      </View>
    );
  }

  // For RSVP tasks, derive badge from rsvpStore (not devTaskStore).
  // useRsvpEntry is called unconditionally (hooks must not be conditional).
  const isRsvpTask  = task.lightweightKind === 'rsvp' && !!task.linkedEvent;
  const rsvpEventId = resolveEventId(task.linkedEventId ?? task.linkedEvent ?? '');
  const rsvpEntry   = useRsvpEntry(rsvpEventId, role); // reactive; result used only when isRsvpTask

  // Resolve linked event so we can offer a "View Event" button
  const linkedEv = task.linkedEventId
    ? findEventById(task.linkedEventId)
    : task.linkedEvent
      ? getAllEvents().find(e => e.title === task.linkedEvent)
      : undefined;

  const stripeColor    = STATE_STRIPE[taskState];
  const stateColor     = STATE_COLOR[taskState];
  const stateBg        = STATE_BG[taskState];
  const isAssignee     = isTaskAssignee(task, role);
  const isReviewer     = canApproveTask(task, role);
  const isReviewerOnly = isReviewer && !isAssignee;

  // Supervision = this role's named supervisor, OR a role that can manage the
  // linked event's kind (president/pro_consul → any; owning chair → their
  // domain). Standalone tasks (no event) → only broad leadership supervises.
  const isBroadLeader = isLeadershipRole(role);
  const canSupervise  =
    task.supervisorRole === role ||
    (linkedEv ? canManageEventTasks(role, linkedEv.kind) : isBroadLeader);

  // Report task: carries a reportDefinitionId resolving to a known definition.
  // It's a structured-response form (no proof, no review) — handled by its own
  // section, so it's excluded from proof/approval/simple-complete below.
  const reportDef     = task.reportDefinitionId ? getReportDefinition(task.reportDefinitionId) : null;
  const isReportTask  = !!reportDef;
  // Readers allowed to view a report (matches the RPC's read set; the RPC is the
  // real gate — this only decides whether to render the read-only view).
  const canReadReport = isAssignee || role === 'annotator' || isLeadershipRole(role);

  const showProofSubmit = task.type === 'structured' && task.requiresProof && isAssignee && !isReportTask;
  // Approval-required tasks WITHOUT a proof requirement still need a submit path —
  // otherwise the assignee can't move it into review. Reuses the existing
  // 'submitted' state (no state-machine change).
  const showApprovalSubmit = task.type === 'structured' && !!task.requiresApproval && !task.requiresProof && isAssignee && !isReportTask;
  // Simple tasks — structured, assignee, NEITHER proof NOR approval, and NOT a
  // report — get a plain "Mark Complete" (sets 'approved'). Report tasks render
  // the report form instead.
  const showSimpleComplete =
    task.type === 'structured' && isAssignee && !task.requiresProof && !task.requiresApproval && !isReportTask;
  // Report section: the assignee's form, OR an allowed reader's read-only view.
  const showReport = isReportTask && canReadReport;
  const showProofReview = isReviewerOnly && taskState === 'submitted' && !isReportTask;
  const showEscalation  = !!(task.escalationChain && task.escalationChain.length > 1);
  const showWorkflow    = !!task.isWorkflowParent;

  const parentTask = getParentTask(task);

  function handleReject(note: string) {
    setRejNote(note);
    setTaskState('rejected');
    if (task) pushForTransition(task, 'rejected');   // notify assignee
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
        {/* ── Badge row ── */}
        <View style={s.badgeRow}>
          {isRsvpTask ? (
            <RsvpStatusBadge status={rsvpEntry.status} />
          ) : (
            <View style={[s.stateBadge, { backgroundColor: stateBg }]}>
              {taskState === 'escalated' && <Text style={s.escalateFlame}>⚡</Text>}
              <Text style={[s.stateText, { color: stateColor }]}>{STATE_LABEL[taskState]}</Text>
            </View>
          )}
          {taskState === 'escalated' && task.escalatedTo && (
            <View style={s.escalatedToBadge}>
              <Text style={s.escalatedToText}>
                → {ROLE_LABELS[task.escalatedTo as keyof typeof ROLE_LABELS]}
              </Text>
            </View>
          )}
          <ContextBadge isMine={isAssignee} isReviewer={isReviewer} canSupervise={canSupervise} />
        </View>

        {/* ── Title ── */}
        <Text style={s.title}>{task.title}</Text>
        <View style={[s.accentBar, { backgroundColor: isRsvpTask ? '#6366f1' : stripeColor }]} />

        {/* ── Assignee callout (reviewer view) ── */}
        {isReviewerOnly && (
          <>
            <AssigneeCallout
              assignedTo={task.assignedTo}
              reminderSent={reminderSent}
              onReminder={() => setReminderSent(true)}
            />
            <Divider />
          </>
        )}

        {/* ── Info block ── */}
        <InfoBlock task={task} isAssignee={isAssignee} hideEventRow={!!linkedEv} />

        {/* ── View Event button — shown when task is tied to a specific event ── */}
        {linkedEv && (
          <Pressable
            style={s.viewEventBtn}
            onPress={() => {
              // If we drilled in from this same Event Detail (Related Tasks),
              // return to it instead of pushing a duplicate. Otherwise (entered
              // from Today/Tasks) push normally.
              if (fromEventId && fromEventId === linkedEv.id) router.back();
              else router.push(`/event/${linkedEv.id}` as any);
            }}
          >
            <View style={s.viewEventLeft}>
              <Text style={s.viewEventLabel}>LINKED EVENT</Text>
              <Text style={s.viewEventName}>{task.linkedEvent}</Text>
            </View>
            <Text style={s.viewEventChevron}>›</Text>
          </Pressable>
        )}

        {/* ════════ PRIMARY ACTION (kept high so the user sees what to do) ════════ */}

        {/* ── Rejection feedback — actionable context for the assignee's resubmit.
               Assignee-facing label ("what to fix"); reviewers see the neutral
               state badge instead. Falls back to a clear line if no note. ── */}
        {taskState === 'rejected' && (isAssignee || isReviewerOnly) && (
          <>
            <Divider />
            <SLabel text={isReviewerOnly ? 'YOUR REJECTION NOTE' : 'WHAT TO FIX'} />
            <View style={s.rejectionNote}>
              <Text style={s.rejectionNoteText}>
                {rejNote
                  ? rejNote
                  : isReviewerOnly
                    ? 'No note was left.'
                    : 'Your reviewer asked for changes. Update your work and resubmit.'}
              </Text>
            </View>
          </>
        )}

        {/* ── Lightweight action (assignee only) ── */}
        {task.type === 'lightweight' && isAssignee && (
          <>
            <Divider />
            <SLabel text="YOUR ACTION" />
            <LightweightActionSection
              task={task}
              role={role}
              taskState={taskState}
              onComplete={setTaskState}
            />
          </>
        )}

        {/* ── Proof submit (structured, assignee only) ── */}
        {showProofSubmit && (
          <>
            <Divider />
            <ProofSubmitSection
              task={task}
              taskState={taskState}
              proofContent={proofContent}
              setProofContent={setProofContent}
              onSubmit={() => { void handleProofSubmit(); }}
              submitError={proofError}
              submitting={submitting}
              reviewerLabel={task.reviewerRole ? ROLE_LABELS[task.reviewerRole] : undefined}
            />
          </>
        )}

        {/* ── Submit for review (approval without proof, assignee only) ── */}
        {showApprovalSubmit && (
          <>
            <Divider />
            <SLabel text="YOUR ACTION" />
            {taskState === 'approved' ? (
              <View style={s.actionDone}>
                <Text style={s.actionDoneText}>✓  Approved</Text>
              </View>
            ) : taskState === 'submitted' ? (
              <StatusChip
                icon="⏳"
                text={task.reviewerRole
                  ? `Submitted — awaiting review by ${ROLE_LABELS[task.reviewerRole]}`
                  : 'Submitted — awaiting review'}
                color="#fbbf24" bg="#1c1407"
              />
            ) : (
              <View style={s.proofInputBlock}>
                {taskState === 'rejected' && (
                  <StatusChip icon="✗" text="Rejected — resubmit when ready" color="#fca5a5" bg="#1a0505" />
                )}
                <Pressable
                  style={s.submitBtn}
                  onPress={() => { setTaskState('submitted'); pushForTransition(task, 'submitted'); }}
                >
                  <Text style={s.submitBtnText}>Submit for Review</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── Report form (structured-response task) ── */}
        {showReport && reportDef && (
          <>
            <Divider />
            <ReportFormSection
              definition={reportDef}
              taskId={task.id}
              editable={isAssignee}
              done={taskState === 'approved'}
              onSubmitted={() => {
                // Report submitted → mark the task complete (approved = done per
                // isTaskCompleted; reports have no review gate), then return. The
                // answers persist via the RPC; this only flips task state.
                setTaskState('approved');
                router.back();
              }}
            />
          </>
        )}

        {/* ── Simple complete (no proof, no approval — assignee only) ── */}
        {showSimpleComplete && (
          <>
            <Divider />
            <SLabel text="YOUR ACTION" />
            {taskState === 'approved' ? (
              <View style={s.actionDone}>
                <Text style={s.actionDoneText}>✓  Completed</Text>
              </View>
            ) : (
              <Pressable
                style={s.submitBtn}
                onPress={() => {
                  // Save completion, then return to wherever the user came from
                  // (Today / Tasks / Event Detail). The list re-reads on focus, so
                  // the task drops out of To Do immediately.
                  setTaskState('approved');
                  router.back();
                }}
              >
                <Text style={s.submitBtnText}>Save &amp; Complete</Text>
              </Pressable>
            )}
          </>
        )}

        {/* ── Proof review (reviewer only, when submitted) ── */}
        {showProofReview && (
          <>
            <Divider />
            <ProofReviewSection
              proofType={task.proofType}
              proofContent={
                remoteProof
                  ? (task.proofType === 'link'
                      ? (remoteProof.proofLink || remoteProof.proofText)
                      : (remoteProof.proofText || remoteProof.proofLink))
                  : proofContent
              }
              reviewerLabel={ROLE_LABELS[role]}
              onApprove={() => { setTaskState('approved'); pushForTransition(task, 'approved'); }}
              onReject={handleReject}
            />
          </>
        )}

        {/* Post-review status is conveyed by the header state badge + the
            REJECTION FEEDBACK block above — no duplicate reviewer chip here. */}

        {/* ════════ SECONDARY / RARE (moved lower) ════════ */}

        {/* ── Workflow steps ── */}
        {showWorkflow && (
          <>
            <Divider />
            <WorkflowChildrenSection parentId={task.id} />
          </>
        )}

        {/* ── Escalation path ── */}
        {showEscalation && (
          <>
            <Divider />
            <EscalationSection chain={task.escalationChain!} escalatedTo={task.escalatedTo} />
          </>
        )}

        {/* ── Details: description + secondary metadata ── */}
        <Divider />
        <SLabel text="DETAILS" />
        <Text style={s.description}>{task.description}</Text>
        <SecondaryMeta task={task} parentTask={parentTask} />

        {/* ── Delete (creator/leadership only, user-created tasks) ── */}
        {canManage && (
          <>
            <Divider />
            <Pressable style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>Delete Task</Text>
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
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingTop: 28, paddingBottom: 40 },

  notFound:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: '#64748b', fontSize: 16 },

  sLabel:  { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#1e293b', marginVertical: 22 },

  // Header edit + destructive delete
  editHdrBtn:    { paddingHorizontal: 12, paddingVertical: 4 },
  editHdrText:   { color: '#818cf8', fontSize: 15, fontWeight: '600' },
  deleteBtn:     { alignItems: 'center', paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: '#1a0505' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#f87171' },

  statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 14 },
  statusChipIcon: { fontSize: 15 },
  statusChipText: { fontSize: 14, fontWeight: '600' },

  ctxBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  ctxText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  badgeRow:       { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  stateBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  escalateFlame:  { fontSize: 10, lineHeight: 14 },
  stateText:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  escalatedToBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1a0800', borderWidth: 1, borderColor: '#9a3412' },
  escalatedToText:  { fontSize: 11, fontWeight: '600', color: '#fb923c' },

  title:     { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 16, lineHeight: 30 },
  accentBar: { height: 3, borderRadius: 2, width: 40, marginBottom: 24 },

  callout:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 12 },
  calloutInfo:  { flex: 1, gap: 3 },
  calloutLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase' },
  calloutName:  { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  reminderBtn:         { backgroundColor: '#1e1b4b', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#4f46e5' },
  reminderBtnSent:     { backgroundColor: '#052e16', borderColor: '#166534' },
  reminderBtnText:     { fontSize: 13, fontWeight: '600', color: '#818cf8' },
  reminderBtnTextSent: { color: '#4ade80' },

  infoBlock: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 16, marginBottom: 4 },
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon:  { fontSize: 18, lineHeight: 24 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  infoValue:     { fontSize: 15, fontWeight: '500', color: '#f1f5f9' },
  infoAccent:    { color: '#818cf8' },
  infoHighlight: { color: '#a5b4fc', fontWeight: '700' },

  rejectionNote:      { backgroundColor: '#1a0505', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#7f1d1d' },
  rejectionNoteLabel: { fontSize: 11, fontWeight: '700', color: '#f87171', marginBottom: 6, letterSpacing: 0.4 },
  rejectionNoteText:  { fontSize: 14, color: '#fca5a5', lineHeight: 20 },

  subHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  subProgress:      { fontSize: 12, color: '#64748b', fontWeight: '500' },
  progressTrack:    { height: 4, backgroundColor: '#1e293b', borderRadius: 2, marginBottom: 14 },
  progressFill:     { height: 4, backgroundColor: '#6366f1', borderRadius: 2 },
  progressFillDone: { backgroundColor: '#22c55e' },
  subList:      { gap: 2 },
  subRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 8 },
  subRowDone:   { opacity: 0.55 },
  subCheck:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subCheckDone: { backgroundColor: '#052e16', borderColor: '#166534' },
  subCheckmark: { fontSize: 12, color: '#4ade80', lineHeight: 16 },
  subBody:      { flex: 1, gap: 2 },
  subTitle:     { fontSize: 14, fontWeight: '500', color: '#f1f5f9' },
  subTitleDone: { textDecorationLine: 'line-through', color: '#475569' },
  subDue:       { fontSize: 11, color: '#64748b' },
  subDueDone:   { color: '#334155' },
  subBadge:     { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  subBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  subChevron:   { fontSize: 18, color: '#334155', paddingLeft: 4 },

  // RSVP action
  rsvpAttending:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#052e16', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#166534' },
  rsvpAttendingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rsvpAttendingIcon: { fontSize: 18, color: '#4ade80' },
  rsvpAttendingText: { fontSize: 15, fontWeight: '700', color: '#4ade80' },
  rsvpChangeBtn:     { backgroundColor: '#0f172a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155' },
  rsvpChangeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  rsvpSaveRow:     { marginTop: 4 },
  rsvpSavedBadge:  { backgroundColor: '#052e16', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#166534' },
  rsvpSavedText:   { fontSize: 12, color: '#4ade80', fontWeight: '600' },
  rsvpMissingNote: { fontSize: 12, color: '#64748b', lineHeight: 18, marginTop: 8 },

  // Saved: Not attending banner
  rsvpSavedNaBlock:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#1c1407', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#854d0e' },
  rsvpSavedNaInfo:   { flex: 1 },
  rsvpSavedNaText:   { fontSize: 15, fontWeight: '700', color: '#fbbf24' },
  rsvpSavedNaDetail: { fontSize: 13, color: '#cbd5e1', marginTop: 4, lineHeight: 18 },

  // No response yet row
  rsvpNoRespRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  rsvpNoRespText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },

  // Editing actions
  rsvpEditActions:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  rsvpCancelBtn:       { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  rsvpCancelBtnText:   { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  rsvpSaveBtn:         { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4f46e5', alignItems: 'center' },
  rsvpSaveBtnDisabled: { backgroundColor: '#1e293b', opacity: 0.5 },
  rsvpSaveBtnText:     { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Lightweight actions (acknowledgment / yes_no)
  actionDone:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#052e16', borderRadius: 10, padding: 14 },
  actionDoneText: { fontSize: 14, color: '#4ade80', fontWeight: '600' },
  actionBlock:    { gap: 12 },
  actionHint:     { fontSize: 13, color: '#64748b' },
  twoBtnRow:      { flexDirection: 'row', gap: 10 },
  twoBtn:         { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  twoBtnYes:      { backgroundColor: '#052e16', borderColor: '#166534' },
  twoBtnNo:       { backgroundColor: '#1e293b', borderColor: '#334155' },
  twoBtnNoActive: { backgroundColor: '#450a0a', borderColor: '#ef4444' },
  twoBtnText:     { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  twoBtnTextActive:{ color: '#f1f5f9' },
  excuseBlock:    { gap: 10 },
  excuseLabel:    { fontSize: 12, color: '#64748b' },
  excuseInput:    { backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, padding: 12, minHeight: 80 },
  singleInput:    { backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, padding: 12 },
  ackBtn:         { backgroundColor: '#1e1b4b', borderRadius: 10, borderWidth: 1, borderColor: '#4f46e5', paddingVertical: 16, alignItems: 'center' },
  ackBtnText:     { fontSize: 15, fontWeight: '700', color: '#818cf8' },

  // Proof submit
  proofInputBlock: { gap: 10 },
  proofHint:       { fontSize: 13, color: '#64748b', lineHeight: 18 },
  proofInput:      { backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, padding: 12 },
  proofLinkWarn:   { fontSize: 12, color: '#fbbf24', marginTop: 6 },
  proofSubmitError:{ fontSize: 12, color: '#f87171', marginTop: 6 },
  uploadBtn:       { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', paddingVertical: 18, alignItems: 'center' },
  uploadBtnText:   { fontSize: 14, color: '#64748b', fontWeight: '500' },
  submitBtn:         { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#1e293b', opacity: 0.4 },
  submitBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Proof display (reviewer)
  proofDisplay:        { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, gap: 8, marginBottom: 20 },
  proofDisplayType:    { fontSize: 12, color: '#64748b', fontWeight: '500' },
  proofDisplayContent: { fontSize: 14, color: '#f1f5f9', lineHeight: 20 },
  proofDisplayLink:    { fontSize: 14, color: '#818cf8', lineHeight: 20, textDecorationLine: 'underline' },
  proofDisplayEmpty:   { fontSize: 13, color: '#334155', fontStyle: 'italic' },

  // Report (structured-response) form
  reportPromptRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reportPrompt:       { fontSize: 14, fontWeight: '600', color: '#cbd5e1', flexShrink: 1 },
  reportRequired:     { fontSize: 10, color: '#64748b', fontWeight: '500' },
  reportInputDisabled:{ opacity: 0.4 },
  reportNoUpdateRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  reportCheckbox:     { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  reportCheckboxOn:   { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  reportCheckboxMark: { fontSize: 11, color: '#a5b4fc', fontWeight: '700', lineHeight: 13 },
  reportNoUpdateLabel:{ fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  reportNoUpdateTag:  { fontSize: 13, color: '#818cf8', fontWeight: '600', fontStyle: 'italic' },
  reportHint:         { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8 },

  reviewBlock:    { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 14 },
  reviewerNote:   { fontSize: 13, color: '#64748b' },
  reviewBtns:     { flexDirection: 'row', gap: 10 },
  approveBtn:     { flex: 1, backgroundColor: '#052e16', borderWidth: 1, borderColor: '#166534', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#4ade80' },
  rejectBtn:      { flex: 1, backgroundColor: '#1a0505', borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectBtnText:  { fontSize: 14, fontWeight: '700', color: '#f87171' },
  rejectBlock:      { gap: 10 },
  rejectBlockLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  rejectInput:      { backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, padding: 12, minHeight: 80 },
  rejectRow:        { flexDirection: 'row', gap: 10 },
  cancelBtn:        { flex: 1, backgroundColor: '#1e293b', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  cancelBtnText:    { fontSize: 13, color: '#64748b', fontWeight: '600' },
  rejectConfirmBtn:  { flex: 2, backgroundColor: '#7f1d1d', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  rejectConfirmText: { fontSize: 13, color: '#fca5a5', fontWeight: '700' },
  disabledBtn: { opacity: 0.4 },

  escalationBlock:          { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, gap: 12 },
  escalationChain:          { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  escalationStep:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  escalationArrow:          { fontSize: 14, color: '#475569' },
  escalationNode:           { backgroundColor: '#0f172a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#334155' },
  escalationNodeActive:     { backgroundColor: '#1a0800', borderColor: '#ea580c' },
  escalationNodeText:       { fontSize: 12, color: '#64748b', fontWeight: '600' },
  escalationNodeTextActive: { color: '#fb923c' },
  escalationCaption:        { fontSize: 12, color: '#f97316', fontWeight: '500' },

  description: { fontSize: 15, color: '#94a3b8', lineHeight: 24 },

  // View Event button
  viewEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  viewEventLeft:    { flex: 1, gap: 2 },
  viewEventLabel:   { fontSize: 10, fontWeight: '700', color: '#6366f1', letterSpacing: 0.6, textTransform: 'uppercase' },
  viewEventName:    { fontSize: 14, fontWeight: '600', color: '#a5b4fc' },
  viewEventChevron: { fontSize: 20, color: '#4f46e5', paddingLeft: 8 },
});
