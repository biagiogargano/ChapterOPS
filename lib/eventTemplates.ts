/**
 * eventTemplates.ts — declarative event → task templates ("workflows").
 *
 * GOAL: a flexible, open-ended template SYSTEM. A template is plain DATA (a list
 * of task specs); generating a workflow for an event = mapping that data to
 * normal structured MockTasks. Adding a new workflow (recruitment event, formal,
 * philanthropy, …) is just another registry entry — no engine changes. This is
 * the foundation for org-designed templates; a later phase can persist
 * user-edited templates (which WOULD need storage) on top of this same shape.
 *
 * PURE: builders return fresh MockTasks; no I/O, no store mutation, no flags.
 * Deterministic ids (`tmpl_<templateId>_<eventId>_<key>`) make generation
 * idempotent and cascade-deletable, mirroring generatedTasks.buildRsvpReviewTask.
 *
 * NOTE on approvals: the task state machine is single-reviewer. "Higher-stakes,
 * goes through both Pro Consul and President" is represented here as
 * reviewerRole = pro_consul (the approval gate) + supervisorRole = president
 * (oversight, shown on Task Detail). True sequential dual-approval would require
 * a state-machine change and is intentionally out of scope.
 */

import { deriveDueMeta, deriveVisibleTo, type MockTask } from './mockTasks';
import { ROLE_LABELS, type Role } from './roles';
import type { ProofType } from './mockTasks';

/** Minimal event shape a template needs (structural subset of a created event). */
export interface EventTemplateInput {
  id:            string;   // event instance id (task ids derive from this)
  title:         string;
  dateString:    string;   // ISO "YYYY-MM-DD"
  createdByRole: Role;     // organizer — task creator
}

/** One generated task within a template. */
export interface EventTaskSpec {
  key:               string;   // stable id segment (unique within a template)
  title:             string;   // "{event}" is replaced with the event title
  description:       string;   // "{event}" replaced too
  assignedRole:      Role;
  dueOffsetDays:     number;   // relative to the event date (negative = before)
  requiresProof?:    boolean;
  proofType?:        ProofType;
  requiresApproval?: boolean;
  reviewerRole?:     Role;     // approval gate (must differ from assignee)
  supervisorRole?:   Role;     // oversight only (e.g. President on high-stakes)
}

export interface EventTaskTemplate {
  id:        string;
  label:     string;
  taskSpecs: EventTaskSpec[];
}

/** Stable prefix so template tasks are dedupable and cascade-deletable. */
export const EVENT_TEMPLATE_TASK_PREFIX = 'tmpl_';

export function templateTaskId(templateId: string, eventId: string, key: string): string {
  return `${EVENT_TEMPLATE_TASK_PREFIX}${templateId}_${eventId}_${key}`;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add a new workflow by adding an entry here. v1 ships the Date Party / Social
// workflow; recruitment / formal / philanthropy etc. are future entries.

export const EVENT_TEMPLATES: EventTaskTemplate[] = [
  {
    id:    'date_party',
    label: 'Date Party / Social',
    taskSpecs: [
      {
        key:           'venue',
        title:         'Confirm venue & logistics for {event}',
        description:   'Lock the venue, transportation, and timeline for {event}.',
        assignedRole:  'social_chair',
        dueOffsetDays: -7,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
        supervisorRole: 'president',   // higher-stakes: the event itself
      },
      {
        key:           'guestlist',
        title:         'Finalize guest / date list for {event}',
        description:   'Collect and finalize the guest/date list for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -3,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
      {
        key:           'riskplan',
        title:         'Risk management plan for {event}',
        description:   'Submit the risk-management and safety plan for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -5,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
        supervisorRole: 'president',   // higher-stakes
      },
      {
        key:           'monitors',
        title:         'Assign sober monitors & safety brief for {event}',
        description:   'Assign sober monitors and run the safety brief for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -1,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
      {
        key:           'incident',
        title:         'Post-event incident report for {event}',
        description:   'File the post-event incident/debrief report for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: 1,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
    ],
  },
];

/** Picker options: a "None" sentinel followed by every registered template. */
export const NO_TEMPLATE = 'none';
export const EVENT_TEMPLATE_OPTIONS: { id: string; label: string }[] = [
  { id: NO_TEMPLATE, label: 'None' },
  ...EVENT_TEMPLATES.map(t => ({ id: t.id, label: t.label })),
];

export function getEventTemplate(templateId: string): EventTaskTemplate | undefined {
  return EVENT_TEMPLATES.find(t => t.id === templateId);
}

// ─── Date math ────────────────────────────────────────────────────────────────

/** Shift an ISO "YYYY-MM-DD" date by `delta` days (local-time, tz-safe). */
function addDays(dateString: string, delta: number): string {
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/** Build one MockTask from a spec for a given event. Pure. */
function buildTaskFromSpec(templateId: string, event: EventTemplateInput, spec: EventTaskSpec): MockTask {
  const dueDate = addDays(event.dateString, spec.dueOffsetDays);
  const { dueLabel, urgency } = deriveDueMeta(dueDate);
  const fill = (s: string) => s.replace(/\{event\}/g, event.title);
  const requiresApproval = spec.requiresApproval ?? false;

  return {
    id:               templateTaskId(templateId, event.id, spec.key),
    title:            fill(spec.title),
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            dueDate,
    assignedRole:     spec.assignedRole,
    assignedTo:       ROLE_LABELS[spec.assignedRole],
    visibleTo:        deriveVisibleTo(spec.assignedRole, spec.reviewerRole),
    description:      fill(spec.description),
    linkedEvent:      event.title,
    linkedEventId:    event.id,
    requiresProof:    spec.requiresProof ?? false,
    proofType:        spec.requiresProof ? spec.proofType : undefined,
    requiresApproval,
    reviewerRole:     requiresApproval ? spec.reviewerRole : undefined,
    supervisorRole:   spec.supervisorRole,
    createdByRole:    event.createdByRole,
  };
}

/**
 * Build all tasks for a template applied to an event. Returns [] for the "None"
 * sentinel or an unknown template id. Pure — adds nothing to any store.
 */
export function buildTasksFromTemplate(templateId: string, event: EventTemplateInput): MockTask[] {
  const template = getEventTemplate(templateId);
  if (!template) return [];
  return template.taskSpecs.map(spec => buildTaskFromSpec(templateId, event, spec));
}

/**
 * Every possible template-task id for an event, across ALL templates. Used by
 * the event-delete cascade: deleteUserTask is a harmless no-op for ids that
 * never existed, so we don't need to store which template was applied.
 */
export function allTemplateTaskIdsForEvent(eventId: string): string[] {
  const ids: string[] = [];
  for (const t of EVENT_TEMPLATES) {
    for (const spec of t.taskSpecs) ids.push(templateTaskId(t.id, eventId, spec.key));
  }
  return ids;
}
