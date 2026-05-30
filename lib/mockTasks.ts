/**
 * mockTasks.ts — task DEFINITIONS + read/permission helpers.
 *
 * ── ARCHITECTURE (read before persisting tasks) ───────────────────────────────
 * Tasks are split across THREE runtime layers today; all are session-only:
 *
 *   1. MOCK_TASKS (this file)        — static seed task DEFINITIONS.
 *   2. _dynamicTasks (this file)     — RSVP task DEFINITIONS auto-generated at
 *                                      runtime by eventStore.maybeGenerateRsvpTask
 *                                      when an officer creates a mandatory/officer
 *                                      event. Added via addDynamicTask().
 *   3. devTaskStore._store           — mutable INTERACTION STATE keyed by task id
 *                                      ({ state, proofContent, rejectionNote }).
 *                                      Read via getStoredState(task.id, task.state).
 *
 * This file owns the DEFINITION + the read API (findTaskById, filterTasksForRole,
 * getResponsibilityGroups, getWorkflowChildren/getParentTask) and pure permission
 * helpers (isTaskAssignee, canApproveTask, getTaskBucket). It holds NO mutable
 * lifecycle state — that lives in devTaskStore.
 *
 * ── STATE OWNERSHIP / RSVP DUALITY (critical for persistence) ─────────────────
 * For lightweight tasks of kind 'rsvp' and 'name_submission', completion is owned
 * by rsvpStore (the rsvps table), NOT by devTaskStore or task.state. See
 * app/(tabs)/tasks.tsx computeSummary, which reads those from rsvpStore. A future
 * persistence layer (lib/taskService.ts + supabase/tasks_schema.sql) must keep
 * RSVP completion in rsvps and treat the task row as definition-only for those.
 *
 * ── KNOWN TECH DEBT (flagged, not addressed here) ─────────────────────────────
 *   • dueLabel/urgency/state are static strings — overdue is NOT computed from a
 *     real date. Adding a machine-readable due_at would change behavior → deferred.
 *   • assignedTo is a denormalized display string (derivable from assignedRole).
 *   • seed linkedEventId uses mock ids ('e1'..) requiring resolveEventId mapping.
 *   • dynamic RSVP-task generation is client-side and coupled to eventStore.
 */
import { LEADERSHIP_ROLES, OFFICER_ROLES, ROLE_LABELS, isLeadershipRole, type Role } from '@/lib/roles';
import { ORG_SCOPED_DATA } from '@/lib/flags';
import { taskWindowView } from '@/lib/taskWindow';

// ─── Core types ───────────────────────────────────────────────────────────────

export type TaskType        = 'lightweight' | 'structured';
export type TaskState       = 'assigned' | 'submitted' | 'approved' | 'rejected' | 'overdue' | 'escalated';
export type TaskUrgency     = 'overdue' | 'today' | 'week';
export type ProofType       = 'text' | 'image' | 'screenshot' | 'document' | 'link';
export type LightweightKind = 'rsvp' | 'name_submission' | 'acknowledgment' | 'yes_no';

// ─── Visibility helpers ───────────────────────────────────────────────────────

const BROAD:    Role[] = LEADERSHIP_ROLES;
const DOCS:     Role[] = [...BROAD, 'annotator'];
// Dedup: same membership as the canonical OFFICER_ROLES in roles.ts. Used only
// with .includes() (visibleTo checks), so element order is irrelevant.
const OFFICERS: Role[] = OFFICER_ROLES;

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface MockTask {
  id:           string;
  title:        string;
  type:         TaskType;
  state:        TaskState;
  urgency:      TaskUrgency;
  dueLabel:     string;
  assignedRole: Role | 'all';
  assignedTo:   string;
  visibleTo:    Role[] | 'all';
  linkedEvent?:   string;
  /** Unique ID of the specific event instance — used as the RSVP store key. */
  linkedEventId?: string;
  description:    string;

  // Lightweight-specific
  lightweightKind?:      LightweightKind;
  linkedEventMandatory?: boolean;
  requiresCovering?:     boolean;  // if not attending, must name who covers

  // Structured-specific
  requiresProof?:    boolean;
  proofType?:        ProofType;
  requiresApproval?: boolean;
  reviewerRole?:     Role;

  // Workflow
  isWorkflowParent?: boolean;   // summary task — assignee works the steps instead
  parentTaskId?:     string;    // id of the parent workflow task
  supervisorRole?:   Role;      // role with management oversight

  // Escalation
  escalationChain?: Role[];
  escalatedTo?:     Role;

  // Created-task metadata (officer-created structured tasks — Phase: edit/delete)
  createdByRole?: Role;     // who created it (for edit/delete permission)
  dueAt?:         string;   // ISO date(+time) the due label was derived from
  // Optional "available from" (update windows): before this, the task is not yet
  // open to submit. Null/absent = always open (today's behavior). Persisted via the
  // tasks.available_at column (applied on alpha). Read by lib/taskWindow.
  availableAt?:   string;

  // Which structured-response / QUESTIONNAIRE definition this task collects (a
  // StructuredResponseDefinition.id). Generic by nature — the Weekly Officer Report
  // is just one definition; this is NOT fraternity-specific. The field name keeps
  // the report-era spelling for now (renaming to structuredResponseDefinitionId /
  // questionnaireDefinitionId would churn ~8 files for no behavior gain — deferred,
  // see docs/STRUCTURED_RESPONSE_ROADMAP.md). Optional + ignored by existing
  // screens; read by the questionnaire form flow. No behavior change for plain tasks.
  reportDefinitionId?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_TASKS: MockTask[] = [

  // ── All-member lightweight ──────────────────────────────────────────────────

  {
    id:                   'tk1',
    title:                'RSVP for Chapter Meeting',
    type:                 'lightweight',
    lightweightKind:      'rsvp',
    linkedEventMandatory: true,
    requiresApproval:     true,   // excuses route to annotator for review
    reviewerRole:         'annotator',
    state:                'assigned',
    urgency:              'today',
    dueLabel:             'Today by 6:00 PM',
    assignedRole:         'all',
    assignedTo:           'All Members',
    visibleTo:            'all',
    linkedEvent:          'Chapter Meeting',
    linkedEventId:        'e1',
    description:
      'All active members must RSVP before 6 PM today. Attendance is mandatory — an unexcused absence will be counted against your standing.',
  },

  {
    id:                   'tk2',
    title:                'Submit date name for Date Party',
    type:                 'lightweight',
    lightweightKind:      'name_submission',
    linkedEventMandatory: false,
    state:                'assigned',
    urgency:              'today',
    dueLabel:             'Today by 11:59 PM',
    assignedRole:         'all',
    assignedTo:           'All Members',
    visibleTo:            'all',
    linkedEvent:          'Date Party',
    linkedEventId:        'e3',
    description:
      "Submit your date's full name and phone number to the Social Chair by midnight. Names are used for the venue guest list.",
  },

  // ── Officer RSVP ───────────────────────────────────────────────────────────

  {
    id:                   'tk_eboard',
    title:                'RSVP for E-Board Meeting',
    type:                 'lightweight',
    lightweightKind:      'rsvp',
    linkedEventMandatory: true,
    requiresCovering:     true,
    requiresApproval:     true,   // absences + covering officer name → pro_consul for review
    reviewerRole:         'pro_consul',
    state:                'assigned',
    urgency:              'today',
    dueLabel:             'Today by 5:00 PM',
    assignedRole:         'all',
    assignedTo:           'All Officers',
    visibleTo:            OFFICERS,
    linkedEvent:          'E-Board Meeting',
    linkedEventId:        'e2',
    description:
      "All executive board officers must RSVP for tonight's E-Board meeting. Attendance is mandatory. If you cannot attend, you must name a covering officer.",
  },

  // ── Structured — overdue / escalated ───────────────────────────────────────

  {
    id:               'tk3',
    title:            'Submit officer report',
    type:             'structured',
    state:            'escalated',
    urgency:          'overdue',
    dueLabel:         'Was due Mon, May 12',
    assignedRole:     'president',
    assignedTo:       'Biagio Gargano (President)',
    visibleTo:        DOCS,
    requiresProof:    true,
    proofType:        'document',
    requiresApproval: true,
    reviewerRole:     'pro_consul',
    supervisorRole:   'pro_consul',
    escalationChain:  ['president', 'pro_consul'],
    escalatedTo:      'pro_consul',
    description:
      'Monthly officer report due to national headquarters. Include chapter financials, event recap, membership count, and any disciplinary notes. Use the national template.',
  },

  // ── Annotator ──────────────────────────────────────────────────────────────

  {
    id:               'tk4',
    title:            'Assign literary exercise',
    type:             'structured',
    state:            'assigned',
    urgency:          'today',
    dueLabel:         'Today by 8:00 PM',
    assignedRole:     'annotator',
    assignedTo:       'Annotator',
    visibleTo:        DOCS,
    linkedEvent:      'Chapter Meeting',
    requiresProof:    true,
    proofType:        'text',
    requiresApproval: false,
    supervisorRole:   'president',
    description:
      "Select and distribute this week's literary exercise before the chapter meeting. Paste the excerpt as your proof of completion.",
  },

  // ── Risk manager — workflow parent ─────────────────────────────────────────

  {
    id:               'tk5',
    title:            'Draft risk plan for Date Party',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Wed, May 21',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    true,
    proofType:        'document',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    escalationChain:  ['risk_manager', 'pro_consul', 'president'],
    isWorkflowParent: true,
    description:
      'Complete the national risk management plan template. Include venue info, alcohol policy, guest list cap, sober monitor assignments, and emergency contacts.',
  },

  // ── Risk manager — workflow steps ──────────────────────────────────────────

  {
    id:               'tk5a',
    title:            'Confirm Date Party venue details',
    type:             'structured',
    state:            'approved',
    urgency:          'week',
    dueLabel:         'Mon, May 19',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    true,
    proofType:        'text',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    parentTaskId:     'tk5',
    description:
      'Confirm the venue name, address, capacity, and any venue-specific rules for the Date Party. Submit as a brief summary.',
  },

  {
    id:               'tk5b',
    title:            'Draft alcohol policy for Date Party',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Tue, May 20',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    true,
    proofType:        'document',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    parentTaskId:     'tk5',
    description:
      'Draft the alcohol policy using the national risk management template. Include serving limits, ID verification, and cut-off times.',
  },

  {
    id:               'tk5c',
    title:            'Set guest list cap for Date Party',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Wed, May 21',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    false,
    requiresApproval: false,
    supervisorRole:   'president',
    parentTaskId:     'tk5',
    description:
      'Determine the maximum guest list size based on venue capacity and national guidelines. Communicate the cap to the Social Chair.',
  },

  {
    id:               'tk5d',
    title:            'Assign emergency contacts for Date Party',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Wed, May 21',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    true,
    proofType:        'text',
    requiresApproval: false,
    supervisorRole:   'president',
    parentTaskId:     'tk5',
    description:
      'Designate at least two chapter members as emergency contacts for the Date Party. Include names and phone numbers.',
  },

  // ── Risk manager — standalone ──────────────────────────────────────────────

  {
    id:               'tk6',
    title:            'Confirm sober monitors',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Thu, May 22',
    assignedRole:     'risk_manager',
    assignedTo:       'Risk Manager',
    visibleTo:        [...BROAD, 'risk_manager'],
    linkedEvent:      'Date Party',
    requiresProof:    true,
    proofType:        'text',
    requiresApproval: true,
    reviewerRole:     'pro_consul',
    supervisorRole:   'pro_consul',
    escalationChain:  ['risk_manager', 'pro_consul'],
    description:
      'Confirm 4 sober monitors for the Date Party. List their names and confirm each has completed national risk management training.',
  },

  // ── Recruitment chair — workflow parent ────────────────────────────────────

  {
    id:               'tk7',
    title:            'Recruitment video submission',
    type:             'structured',
    state:            'submitted',
    urgency:          'week',
    dueLabel:         'Fri, May 23',
    assignedRole:     'recruitment_chair',
    assignedTo:       'Recruitment Chair',
    visibleTo:        [...BROAD, 'recruitment_chair'],
    requiresProof:    true,
    proofType:        'link',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    escalationChain:  ['recruitment_chair', 'pro_consul', 'president'],
    isWorkflowParent: true,
    description:
      "Submit the chapter's official recruitment video for national review. Must be under 3 minutes, include the chapter motto, and follow national brand guidelines.",
  },

  // ── Recruitment chair — workflow steps ────────────────────────────────────

  {
    id:               'tk7a',
    title:            'Submit recruitment video script',
    type:             'structured',
    state:            'approved',
    urgency:          'week',
    dueLabel:         'Fri, May 9',
    assignedRole:     'recruitment_chair',
    assignedTo:       'Recruitment Chair',
    visibleTo:        [...BROAD, 'recruitment_chair'],
    requiresProof:    true,
    proofType:        'text',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    parentTaskId:     'tk7',
    description:
      'Submit the script and theme concept for the recruitment video. Must include the chapter motto and key messaging.',
  },

  {
    id:               'tk7b',
    title:            'Record recruitment video footage',
    type:             'structured',
    state:            'approved',
    urgency:          'week',
    dueLabel:         'Fri, May 16',
    assignedRole:     'recruitment_chair',
    assignedTo:       'Recruitment Chair',
    visibleTo:        [...BROAD, 'recruitment_chair'],
    requiresProof:    true,
    proofType:        'image',
    requiresApproval: false,
    supervisorRole:   'president',
    parentTaskId:     'tk7',
    description:
      'Record all footage for the recruitment video following the approved script.',
  },

  {
    id:               'tk7c',
    title:            'Edit and finalize recruitment video',
    type:             'structured',
    state:            'submitted',
    urgency:          'week',
    dueLabel:         'Fri, May 23',
    assignedRole:     'recruitment_chair',
    assignedTo:       'Recruitment Chair',
    visibleTo:        [...BROAD, 'recruitment_chair'],
    requiresProof:    true,
    proofType:        'link',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    parentTaskId:     'tk7',
    description:
      'Edit the recorded footage into the final recruitment video. Must be under 3 minutes and follow national brand guidelines.',
  },

  {
    id:               'tk7d',
    title:            'Submit final video to national portal',
    type:             'structured',
    state:            'assigned',
    urgency:          'week',
    dueLabel:         'Fri, May 23',
    assignedRole:     'recruitment_chair',
    assignedTo:       'Recruitment Chair',
    visibleTo:        [...BROAD, 'recruitment_chair'],
    requiresProof:    true,
    proofType:        'link',
    requiresApproval: true,
    reviewerRole:     'president',
    supervisorRole:   'president',
    parentTaskId:     'tk7',
    description:
      'Submit the final approved recruitment video to national headquarters via the national portal. Include the chapter ID in the form.',
  },
];

// ─── Permission helpers ───────────────────────────────────────────────────────

/** True if this role is the task's assignee (can submit proof / complete it). */
export function isTaskAssignee(task: MockTask, role: Role): boolean {
  if (task.assignedRole === 'all') return true;
  return task.assignedRole === role;
}

/** True if this role can approve/reject this task. */
export function canApproveTask(task: MockTask, role: Role): boolean {
  if (!task.requiresApproval) return false;
  if (isLeadershipRole(role)) return true;
  return task.reviewerRole === role;
}

// ─── Dynamic task store ────────────────────────────────────────────────────────
// Holds RSVP tasks auto-generated when officers create mandatory events.

const _dynamicTasks: MockTask[] = [];

/** Add an auto-generated task (e.g. RSVP task for a newly created event). */
export function addDynamicTask(task: MockTask): void {
  // Avoid duplicates (same id already in store)
  if (!_dynamicTasks.find(t => t.id === task.id)) {
    _dynamicTasks.push(task);
  }
}

/** Remove all dynamic tasks linked to a specific event title. */
export function removeDynamicTasksByEvent(linkedEvent: string): void {
  for (let i = _dynamicTasks.length - 1; i >= 0; i--) {
    if (_dynamicTasks[i].linkedEvent === linkedEvent) _dynamicTasks.splice(i, 1);
  }
}

/** Remove a dynamic task by its exact id. */
export function removeDynamicTaskById(id: string): void {
  const idx = _dynamicTasks.findIndex(t => t.id === id);
  if (idx >= 0) _dynamicTasks.splice(idx, 1);
}

// ─── User-created tasks (officer task creation — Phase 1) ──────────────────────
// Officer-created structured tasks. Held locally for optimistic display; also
// persisted to Supabase via taskService.insertTask by the create screen. Once a
// reload re-hydrates them into the Supabase cache, getAllTasks() dedups the
// local copy by id (same pattern as eventStore._userEvents).

const _userTasks: MockTask[] = [];

const BROAD_ROLES: Role[] = LEADERSHIP_ROLES;

/** Stable, collision-free id for a created task (distinct from seed 'tk3' ids). */
function _taskUuid(): string {
  return `tk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Derive a human due label + urgency bucket from a real date (+ optional time). */
export function deriveDueMeta(dateString: string, time?: string): { dueLabel: string; urgency: TaskUrgency } {
  const due   = new Date(dateString + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const weekday  = due.toLocaleDateString('en-US', { weekday: 'short' });
  const md       = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (diffDays < 0)   return { dueLabel: `Was due ${weekday}, ${md}`, urgency: 'overdue' };
  if (diffDays === 0) return { dueLabel: time ? `Today by ${time}` : 'Today', urgency: 'today' };
  return { dueLabel: time ? `${weekday}, ${md} · ${time}` : `${weekday}, ${md}`, urgency: 'week' };
}

/** Visibility = assignee + leadership + reviewer (so the approver always sees it). */
export function deriveVisibleTo(assignedRole: Role, reviewerRole?: Role): Role[] {
  const set = new Set<Role>(BROAD_ROLES);
  set.add(assignedRole);
  if (reviewerRole) set.add(reviewerRole);
  return Array.from(set);
}

/** Input for officer task creation / editing (structured tasks only). */
export interface CreateTaskInput {
  title:            string;
  assignedRole:     Role;
  dateString:       string;      // ISO "YYYY-MM-DD"
  time?:            string;      // e.g. "8:00 PM" — optional
  dueAt?:           string;      // ISO date(+time), for round-trip / persistence
  linkedEvent?:     string;      // event title
  linkedEventId?:   string;      // event instance id
  requiresProof:    boolean;
  proofType?:       ProofType;
  requiresApproval: boolean;
  reviewerRole?:    Role;
  description:      string;
  createdByRole?:   Role;        // creator (set on create; preserved on edit)
}

/**
 * Create a structured task: optimistic local add + fully-derived fields.
 * The caller (create screen) is responsible for the Supabase insertTask call.
 */
export function addUserTask(input: CreateTaskInput): MockTask {
  const { dueLabel, urgency } = deriveDueMeta(input.dateString, input.time);
  const reviewerRole = input.requiresApproval ? input.reviewerRole : undefined;

  const task: MockTask = {
    id:               _taskUuid(),
    title:            input.title,
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            input.dueAt,
    assignedRole:     input.assignedRole,
    assignedTo:       ROLE_LABELS[input.assignedRole],
    visibleTo:        deriveVisibleTo(input.assignedRole, reviewerRole),
    description:      input.description,
    linkedEvent:      input.linkedEvent,
    linkedEventId:    input.linkedEventId,
    requiresProof:    input.requiresProof,
    proofType:        input.requiresProof ? input.proofType : undefined,
    requiresApproval: input.requiresApproval,
    reviewerRole,
    supervisorRole:   reviewerRole,   // oversight defaults to the named reviewer
    createdByRole:    input.createdByRole,
  };

  _userTasks.push(task);
  return task;
}

/**
 * Optimistically insert a fully-built structured task that carries a
 * caller-provided DETERMINISTIC id (e.g. an event-generated RSVP-review task,
 * id `task_rsvpreview_${eventId}`). Distinct from addUserTask, which mints a
 * random id for officer-authored tasks — this helper trusts the caller's id so
 * generation is idempotent. The caller builds the task (see
 * generatedTasks.buildRsvpReviewTask) and owns persistence via
 * taskService.insertTask, exactly like addUserTask.
 *
 * Idempotent / dedup-safe:
 *   • returns undefined (no insert) if the id was deleted this session
 *     (_deletedTaskIds tombstone) — a deleted generated task is not resurrected;
 *   • returns the existing task (no duplicate push) if the id is already present
 *     locally (_userTasks) or already hydrated into the Supabase cache
 *     (_supabaseTasks);
 *   • otherwise pushes to _userTasks and returns it.
 *
 * Read-time dedup in getAllTasks() already collapses the optimistic copy against
 * the hydrated row by id, so this is fully compatible with later insertTask +
 * hydration wiring. Reads nothing flag-specific — scoped-data behavior unchanged.
 */
/**
 * Clear the deleted-task tombstone for the given ids so they can be regenerated.
 * Used by "Replace template tasks": deleting a generated task tombstones its
 * deterministic id, which would otherwise block re-creating the same id when the
 * SAME template is re-applied. Local session state only — no persistence/schema.
 */
export function clearGeneratedTombstones(ids: string[]): void {
  for (const id of ids) _deletedTaskIds.delete(id);
}

export function addGeneratedTask(task: MockTask): MockTask | undefined {
  if (_deletedTaskIds.has(task.id)) return undefined;
  const existing =
    _userTasks.find(t => t.id === task.id) ??
    _supabaseTasks?.find(t => t.id === task.id);
  if (existing) return existing;
  _userTasks.push(task);
  return task;
}

// ─── Edit / delete (user-created structured tasks only) ───────────────────────

const _seedTaskIds       = new Set(MOCK_TASKS.map(t => t.id));
const _deletedTaskIds    = new Set<string>();

/**
 * A task is editable/deletable only if it is an officer-CREATED structured task
 * (not seed, not lightweight RSVP/name, not a workflow parent/child).
 */
export function isEditableTask(task: MockTask): boolean {
  return (
    task.type === 'structured' &&
    !task.isWorkflowParent &&
    !task.parentTaskId &&
    !_seedTaskIds.has(task.id)
  );
}

/**
 * Edit/delete permission (DISTINCT from review/approval and from being assigned
 * the work). Being the assignee does NOT grant management rights.
 *
 *   • the creator can always manage their task; OR
 *   • BROAD leadership (president/pro_consul) has oversight — but NOT when they
 *     are the task's assignee (being assigned a task ≠ owning its definition).
 */
export function canManageTask(task: MockTask, role: Role): boolean {
  if (!isEditableTask(task)) return false;
  if (task.createdByRole === role) return true;            // creator
  const isBroad = isLeadershipRole(role);
  return isBroad && task.assignedRole !== role;            // oversight, not as assignee
}

/** Find a user-created task in either the local list or the Supabase cache. */
function _findUserTask(id: string): MockTask | undefined {
  return _userTasks.find(t => t.id === id) ?? _supabaseTasks?.find(t => t.id === id);
}

/**
 * Update an existing user-created task's definition fields. Preserves id, type,
 * state, createdByRole, and workflow/escalation metadata (those are never edited
 * here), so review state / reviewer history are untouched. Re-derives label,
 * urgency, assignee display, and visibility. Updates both the local list and the
 * Supabase cache; the caller persists via taskService.updateTask.
 */
export function updateUserTask(id: string, input: CreateTaskInput): MockTask | undefined {
  const existing = _findUserTask(id);
  if (!existing) return undefined;

  const { dueLabel, urgency } = deriveDueMeta(input.dateString, input.time);
  const reviewerRole = input.requiresApproval ? input.reviewerRole : undefined;

  const updated: MockTask = {
    ...existing,                       // preserves id, type, state, createdByRole, etc.
    title:            input.title,
    urgency,
    dueLabel,
    dueAt:            input.dueAt,
    assignedRole:     input.assignedRole,
    assignedTo:       ROLE_LABELS[input.assignedRole],
    visibleTo:        deriveVisibleTo(input.assignedRole, reviewerRole),
    description:      input.description,
    linkedEvent:      input.linkedEvent,
    linkedEventId:    input.linkedEventId,
    requiresProof:    input.requiresProof,
    proofType:        input.requiresProof ? input.proofType : undefined,
    requiresApproval: input.requiresApproval,
    reviewerRole,
    supervisorRole:   reviewerRole,
  };

  const ui = _userTasks.findIndex(t => t.id === id);
  if (ui >= 0) _userTasks[ui] = updated;
  if (_supabaseTasks) {
    const ci = _supabaseTasks.findIndex(t => t.id === id);
    if (ci >= 0) _supabaseTasks[ci] = updated;
  }
  return updated;
}

/**
 * Delete a user-created task from the local list AND the Supabase cache
 * (optimistic), and tombstone the id so a racing refetch can't resurrect it.
 * The caller fires taskService.removeTask for the Supabase row.
 */
export function deleteUserTask(id: string): void {
  _deletedTaskIds.add(id);
  const ui = _userTasks.findIndex(t => t.id === id);
  if (ui >= 0) _userTasks.splice(ui, 1);
  if (_supabaseTasks) _supabaseTasks = _supabaseTasks.filter(t => t.id !== id);
}

// ─── Supabase task cache (structured tasks only) ───────────────────────────────
//
// When persistent tasks are loaded (root layout startup hydrate), the STRUCTURED
// tasks are cached here. getAllTasks() then swaps each structured MOCK_TASK for
// its persisted version (same id), so the persisted `state` becomes the default
// shown after reload. Lightweight tasks (RSVP / name_submission) are NEVER
// persisted — their completion stays owned by rsvpStore — so they always come
// from MOCK_TASKS. Falls back entirely to MOCK_TASKS when the cache is unloaded.

let _supabaseTasks: MockTask[] | null = null;   // null = not yet loaded

/** Set the persisted task cache. Defensively keeps only structured tasks, and
 *  drops any task tombstoned by an in-session delete (guards the delete→refetch
 *  race). */
export function setSupabaseTaskCache(tasks: MockTask[]): void {
  const structured = tasks.filter(t => t.type === 'structured');
  if (structured.length === 0) return;          // keep mock fallback
  _supabaseTasks = structured.filter(t => !_deletedTaskIds.has(t.id));
}

/**
 * Clear all org-scoped task state (Supabase cache, optimistic user tasks,
 * auto-generated dynamic tasks, and delete tombstones) on an org transition so
 * the next org's hydration starts clean. Data-only — mockTasks has no
 * subscribers of its own (interaction-state reactivity lives in devTaskStore).
 *
 * Not wired into runtime yet (Issue B-1 groundwork).
 */
export function resetOrgScopedTasks(): void {
  _supabaseTasks = null;
  _userTasks.length = 0;
  _dynamicTasks.length = 0;
  _deletedTaskIds.clear();
}

/**
 * True if this id is backed by Supabase: a hydrated structured task, OR an
 * officer-created task this session (persisted via insertTask). Lets
 * saveTaskState persist state changes for freshly-created tasks too.
 */
export function isPersistedTask(id: string): boolean {
  if (_userTasks.some(t => t.id === id)) return true;
  return _supabaseTasks !== null && _supabaseTasks.some(t => t.id === id);
}

/** All tasks: seed/persisted data + user-created + any auto-generated tasks. */
export function getAllTasks(): MockTask[] {
  // Scoped mode (ORG_SCOPED_DATA on): return only persisted org tasks +
  // optimistic user-created tasks + runtime dynamic (RSVP) tasks. No MOCK_TASKS
  // seed merge/fallback, so a real org shows only its own data (empty when it
  // has none). Flag-off behavior below is unchanged.
  if (ORG_SCOPED_DATA) {
    const base     = _supabaseTasks ?? [];
    const baseIds  = new Set(base.map(t => t.id));
    const localUser = _userTasks.filter(t => !baseIds.has(t.id));
    return [...base, ...localUser, ..._dynamicTasks];
  }

  if (_supabaseTasks !== null) {
    const byId      = new Map(_supabaseTasks.map(t => [t.id, t]));
    const cacheIds  = new Set(_supabaseTasks.map(t => t.id));
    // Preserve MOCK_TASKS order (so role buckets render identically); swap each
    // structured task for its persisted version when present. Lightweight tasks
    // always remain the mock versions.
    const merged = MOCK_TASKS.map(t =>
      t.type === 'structured' ? (byId.get(t.id) ?? t) : t,
    );
    // Persisted structured tasks not in MOCK_TASKS (officer-created), then any
    // local user-created tasks not yet re-hydrated into the cache (dedup by id),
    // then runtime dynamic RSVP tasks.
    const extra     = _supabaseTasks.filter(t => !MOCK_TASKS.some(m => m.id === t.id));
    const localUser = _userTasks.filter(t => !cacheIds.has(t.id));
    return [...merged, ...extra, ...localUser, ..._dynamicTasks];
  }
  return [...MOCK_TASKS, ..._userTasks, ..._dynamicTasks];
}

/** Find any task by ID — searches both seed and dynamic tasks. */
export function findTaskById(id: string): MockTask | undefined {
  return getAllTasks().find(t => t.id === id);
}

/** Filter the full task list to what a given role is allowed to see. */
export function filterTasksForRole(role: Role): MockTask[] {
  return getAllTasks().filter(task => {
    if (task.visibleTo === 'all') return true;
    return (task.visibleTo as Role[]).includes(role);
  });
}

// ─── Responsibility buckets ───────────────────────────────────────────────────

export type ResponsibilityBucket = 'mine' | 'review' | 'alert' | 'reviewed' | 'supervising';

/**
 * Classify a visible task into a responsibility bucket for the given role.
 * Returns null if the role cannot see the task.
 *
 * `effectiveState` (optional) is the LIVE state (from devTaskStore) — pass it so
 * in-session submit/approve/reject re-route immediately without a reload. When
 * omitted, the task's definition state is used.
 *
 * REVIEW QUEUE RULE: "Needs my review" is driven by the NAMED reviewer only
 * (task.reviewerRole === role), NOT by broad president/pro_consul oversight.
 * Broad approval ability (canApproveTask) is a SEPARATE capability that still
 * lets leadership act if they open the task — it must not populate the queue,
 * or an approval task shows up for both leaders at once.
 */
export function getTaskBucket(
  task: MockTask,
  role: Role,
  effectiveState?: TaskState,
): ResponsibilityBucket | null {
  // Visibility gate
  if (task.visibleTo !== 'all' && !(task.visibleTo as Role[]).includes(role)) return null;

  const state  = effectiveState ?? task.state;
  const isMine = isTaskAssignee(task, role);

  // Named-reviewer gate (queue ownership). Defensive fallback: an approval task
  // with no valid reviewerRole falls back to leadership so it is never stuck
  // un-reviewable.
  const isNamedReviewer =
    !!task.requiresApproval && !isMine && (
      task.reviewerRole === role ||
      (!task.reviewerRole && isLeadershipRole(role))
    );

  if (isMine) return 'mine';

  if (isNamedReviewer && state === 'submitted') return 'review';

  // Already acted on by the named reviewer — keep it in "Recently Reviewed".
  if (isNamedReviewer && (state === 'approved' || state === 'rejected')) return 'reviewed';

  // Non-mine overdue/escalated = chapter alert
  if (state === 'overdue' || state === 'escalated') return 'alert';

  return 'supervising';
}

const URGENCY_ORDER: Record<TaskUrgency, number> = { overdue: 0, today: 1, week: 2 };

// ─── Date-driven urgency (read-time, from dueAt) ───────────────────────────────

function _dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _to12h(hhmm: string): string {
  const [hStr, m] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/** Urgency derived from a real due timestamp (compared by calendar day). */
export function deriveUrgency(dueAt: string, now: Date = new Date()): TaskUrgency {
  const dueDay = dueAt.slice(0, 10);   // 'YYYY-MM-DD'
  const today  = _dayStr(now);
  if (dueDay < today)   return 'overdue';
  if (dueDay === today) return 'today';
  return 'week';
}

/**
 * Overdue = past its due date AND not yet done. Completed work (submitted/
 * approved) is never overdue. Falls back to the task's state when no dueAt.
 */
export function isOverdue(dueAt: string | undefined, effectiveState: TaskState, now: Date = new Date()): boolean {
  if (effectiveState === 'submitted' || effectiveState === 'approved') return false;
  if (!dueAt) return effectiveState === 'overdue' || effectiveState === 'escalated';
  return dueAt.slice(0, 10) < _dayStr(now);
}

/** Human due label derived from a real due timestamp. */
export function formatDueLabel(dueAt: string, now: Date = new Date()): string {
  const dueDay  = dueAt.slice(0, 10);
  const today   = _dayStr(now);
  const hhmm    = dueAt.slice(11, 16);
  const hasTime = hhmm.length === 5 && hhmm !== '00:00';
  const d       = new Date(dueDay + 'T00:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md      = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time    = hasTime ? _to12h(hhmm) : '';
  if (dueDay < today)   return `Was due ${weekday}, ${md}`;
  if (dueDay === today) return hasTime ? `Today by ${time}` : 'Today';
  return hasTime ? `${weekday}, ${md} · ${time}` : `${weekday}, ${md}`;
}

/** Read-time urgency: computed from dueAt when present, else the stored value. */
export function urgencyOf(task: MockTask, now: Date = new Date()): TaskUrgency {
  return task.dueAt ? deriveUrgency(task.dueAt, now) : task.urgency;
}

/** Read-time due label: computed from dueAt when present, else the stored label. */
export function dueLabelOf(task: MockTask, now: Date = new Date()): string {
  return task.dueAt ? formatDueLabel(task.dueAt, now) : task.dueLabel;
}

/**
 * Schedule label for a task card. A task whose open window hasn't started yet
 * (availableAt in the future — e.g. a weekly goal update that opens near end of week)
 * shows "Opens <date>" instead of a due label, so the assignee isn't prompted to act
 * before they can. Any task without a future availableAt falls back to dueLabelOf —
 * so ordinary tasks are unchanged. Pure.
 */
export function dueOrOpenLabel(task: MockTask, now: Date = new Date()): string {
  const win = taskWindowView(task.availableAt, task.dueAt, now);
  return win.state === 'not_yet_open' ? win.label : dueLabelOf(task, now);
}

export function sortByUrgency(tasks: MockTask[]): MockTask[] {
  const now = new Date();
  return [...tasks].sort((a, b) => URGENCY_ORDER[urgencyOf(a, now)] - URGENCY_ORDER[urgencyOf(b, now)]);
}

/**
 * Tasks-tab sort modes. Pure, presentation-only ordering applied within each
 * responsibility section — no state machine or schema involvement.
 *   • 'due'   — soonest due date first (overdue floats up naturally by date)
 *   • 'event' — grouped by linked event title (A→Z), standalone tasks last
 *   • 'type'  — grouped by task type/kind, then by due date within a group
 */
export type TaskSortBy = 'due' | 'event' | 'type';

/** Stable due-date comparator (missing dueAt sorts last). */
function _cmpDue(a: MockTask, b: MockTask): number {
  return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
}

/** A coarse type/kind key for the "by type" grouping. */
function _typeKey(t: MockTask): string {
  if (t.type === 'lightweight') return `1_${t.lightweightKind ?? 'other'}`;
  return '0_structured';
}

export function sortTasks(tasks: MockTask[], sortBy: TaskSortBy): MockTask[] {
  const arr = [...tasks];
  if (sortBy === 'event') {
    return arr.sort((a, b) => {
      const ae = (a.linkedEvent ?? '').toLowerCase();
      const be = (b.linkedEvent ?? '').toLowerCase();
      // Standalone tasks (no event) sort after event-linked ones.
      if (ae === '' && be !== '') return 1;
      if (ae !== '' && be === '') return -1;
      if (ae !== be) return ae.localeCompare(be);
      return _cmpDue(a, b);
    });
  }
  if (sortBy === 'type') {
    return arr.sort((a, b) => {
      const ak = _typeKey(a), bk = _typeKey(b);
      if (ak !== bk) return ak.localeCompare(bk);
      return _cmpDue(a, b);
    });
  }
  // 'due'
  return arr.sort(_cmpDue);
}

/**
 * Get all tasks for a role, split into responsibility buckets.
 *
 * `getState` (optional) resolves the LIVE state for a task (e.g. from
 * devTaskStore) so submit/approve/reject re-route the review queue immediately.
 * Screens pass `(t) => getStoredState(t.id, t.state)`. When omitted, the
 * definition state is used.
 */
export function getResponsibilityGroups(
  role: Role,
  getState?: (task: MockTask) => TaskState,
) {
  const mine:        MockTask[] = [];
  const review:      MockTask[] = [];
  const alert:       MockTask[] = [];
  const reviewed:    MockTask[] = [];
  const supervising: MockTask[] = [];

  for (const task of getAllTasks()) {
    // Workflow parents are summary containers — their individual steps are shown instead
    if (task.isWorkflowParent) continue;

    const state  = getState ? getState(task) : task.state;
    const bucket = getTaskBucket(task, role, state);
    if (!bucket) continue;
    if (bucket === 'mine')          mine.push(task);
    else if (bucket === 'review')   review.push(task);
    else if (bucket === 'alert')    alert.push(task);
    else if (bucket === 'reviewed') reviewed.push(task);
    else                            supervising.push(task);
  }

  return {
    mine:        sortByUrgency(mine),
    review,
    alert:       sortByUrgency(alert),
    reviewed,
    supervising: sortByUrgency(supervising.filter(t => t.state !== 'approved')),
  };
}

/** Child tasks that belong to a workflow parent. */
export function getWorkflowChildren(parentId: string): MockTask[] {
  return getAllTasks().filter(t => t.parentTaskId === parentId);
}

/** Parent task for a workflow child. */
export function getParentTask(task: MockTask): MockTask | undefined {
  if (!task.parentTaskId) return undefined;
  return getAllTasks().find(t => t.id === task.parentTaskId);
}

// ─── Display maps ─────────────────────────────────────────────────────────────

export const STATE_LABEL: Record<TaskState, string> = {
  assigned:  'Assigned',
  submitted: 'Submitted',
  approved:  'Approved',
  rejected:  'Rejected',
  overdue:   'Overdue',
  escalated: 'Escalated',
};

/**
 * Member-facing status vocabulary. Collapses the internal six-state machine into
 * four simple words for cards/lists (Today, Tasks, Event Detail related tasks).
 * Task Detail intentionally keeps the precise STATE_LABEL so officers retain the
 * rejected/escalated nuance where they act. Display-only — TaskState is unchanged.
 */
export const DISPLAY_STATE_LABEL: Record<TaskState, string> = {
  assigned:  'To do',
  submitted: 'In review',
  approved:  'Done',
  rejected:  'To do',
  overdue:   'Overdue',
  escalated: 'Overdue',
};

export const STATE_COLOR: Record<TaskState, string> = {
  assigned:  '#64748b',
  submitted: '#f59e0b',
  approved:  '#22c55e',
  rejected:  '#ef4444',
  overdue:   '#ef4444',
  escalated: '#f97316',
};

export const STATE_BG: Record<TaskState, string> = {
  assigned:  '#1e293b',
  submitted: '#1c1407',
  approved:  '#052e16',
  rejected:  '#1a0505',
  overdue:   '#1a0505',
  escalated: '#1a0800',
};

export const STATE_STRIPE: Record<TaskState, string> = {
  assigned:  '#334155',
  submitted: '#d97706',
  approved:  '#16a34a',
  rejected:  '#dc2626',
  overdue:   '#dc2626',
  escalated: '#ea580c',
};

export const PROOF_LABEL: Record<ProofType, string> = {
  text:       'Text Response',
  image:      'Image Upload',
  screenshot: 'Screenshot',
  document:   'Document Upload',
  link:       'Link / URL',
};

export const PROOF_ICON: Record<ProofType, string> = {
  text:       '✏️',
  image:      '🖼️',
  screenshot: '📸',
  document:   '📄',
  link:       '🔗',
};

// ── Backward-compat aliases ───────────────────────────────────────────────────
export const STATUS_LABEL = STATE_LABEL;
export const STATUS_COLOR = STATE_COLOR;
export const STATUS_BG    = STATE_BG;
export type  TaskStatus   = TaskState;
