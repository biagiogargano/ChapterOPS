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
import { OFFICER_ROLES, type Role } from '@/lib/roles';

// ─── Core types ───────────────────────────────────────────────────────────────

export type TaskType        = 'lightweight' | 'structured';
export type TaskState       = 'assigned' | 'submitted' | 'approved' | 'rejected' | 'overdue' | 'escalated';
export type TaskUrgency     = 'overdue' | 'today' | 'week';
export type ProofType       = 'text' | 'image' | 'screenshot' | 'document' | 'link';
export type LightweightKind = 'rsvp' | 'name_submission' | 'acknowledgment' | 'yes_no';

// ─── Visibility helpers ───────────────────────────────────────────────────────

const BROAD:    Role[] = ['president', 'pro_consul'];
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
  if (role === 'president' || role === 'pro_consul') return true;
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

/** All tasks: seed data + any auto-generated tasks. */
function getAllTasks(): MockTask[] {
  return [...MOCK_TASKS, ..._dynamicTasks];
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

export type ResponsibilityBucket = 'mine' | 'review' | 'alert' | 'supervising';

/**
 * Classify a visible task into a responsibility bucket for the given role.
 * Returns null if the role cannot see the task.
 */
export function getTaskBucket(task: MockTask, role: Role): ResponsibilityBucket | null {
  // Visibility gate
  if (task.visibleTo !== 'all' && !(task.visibleTo as Role[]).includes(role)) return null;

  const isMine    = isTaskAssignee(task, role);
  const canReview = canApproveTask(task, role) && !isMine;
  const inReview  = canReview && task.state === 'submitted';

  if (isMine)    return 'mine';
  if (inReview)  return 'review';

  // Non-mine overdue/escalated = chapter alert
  if (task.state === 'overdue' || task.state === 'escalated') return 'alert';

  return 'supervising';
}

const URGENCY_ORDER: Record<TaskUrgency, number> = { overdue: 0, today: 1, week: 2 };

export function sortByUrgency(tasks: MockTask[]): MockTask[] {
  return [...tasks].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
}

/** Get all tasks for a role, split into responsibility buckets. */
export function getResponsibilityGroups(role: Role) {
  const mine:       MockTask[] = [];
  const review:     MockTask[] = [];
  const alert:      MockTask[] = [];
  const supervising: MockTask[] = [];

  for (const task of getAllTasks()) {
    // Workflow parents are summary containers — their individual steps are shown instead
    if (task.isWorkflowParent) continue;

    const bucket = getTaskBucket(task, role);
    if (!bucket) continue;
    if (bucket === 'mine')        mine.push(task);
    else if (bucket === 'review') review.push(task);
    else if (bucket === 'alert')  alert.push(task);
    else                          supervising.push(task);
  }

  return {
    mine:        sortByUrgency(mine),
    review,
    alert:       sortByUrgency(alert),
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
