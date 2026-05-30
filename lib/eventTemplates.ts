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
import type { EventKind } from './mockEvents';

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
        assignedRole:  'social_chair',
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
  {
    id:    'recruitment',
    label: 'Recruitment Event',
    taskSpecs: [
      {
        key:           'venue',
        title:         'Confirm venue & logistics for {event}',
        description:   'Lock the venue, schedule, and setup plan for {event}.',
        assignedRole:  'recruitment_chair',
        dueOffsetDays: -7,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
        supervisorRole: 'president',   // higher-stakes: the event itself
      },
      {
        key:           'rushlist',
        title:         'Finalize rush / invite list for {event}',
        description:   'Build and finalize the prospective-member invite list for {event}.',
        assignedRole:  'recruitment_chair',
        dueOffsetDays: -5,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
      {
        key:           'budget',
        title:         'Budget & materials for {event}',
        description:   'Confirm the budget and prepare materials/giveaways for {event}.',
        assignedRole:  'recruitment_chair',
        dueOffsetDays: -4,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
      {
        key:           'riskplan',
        title:         'Safety plan for {event}',
        description:   'Submit the safety/risk plan for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -3,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
        supervisorRole: 'president',   // higher-stakes
      },
      {
        key:           'followup',
        title:         'Follow-up & bid tracking for {event}',
        description:   'Track interested prospects and follow-ups after {event}.',
        assignedRole:  'recruitment_chair',
        dueOffsetDays: 1,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
    ],
  },
  {
    id:    'formal',
    label: 'Formal',
    taskSpecs: [
      {
        key:           'venue',
        title:         'Confirm venue & transportation for {event}',
        description:   'Lock the venue, transportation, and timeline for {event}.',
        assignedRole:  'social_chair',
        dueOffsetDays: -14,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
        supervisorRole: 'president',   // higher-stakes: the event itself
      },
      {
        key:           'guestlist',
        title:         'Finalize guest / date list for {event}',
        description:   'Collect and finalize the guest/date list for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -7,
        requiresApproval: true,
        reviewerRole:  'pro_consul',
      },
      {
        key:           'riskplan',
        title:         'Risk management plan for {event}',
        description:   'Submit the risk-management and safety plan for {event}.',
        assignedRole:  'risk_manager',
        dueOffsetDays: -7,
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
  {
    // Manual-apply only (intentionally NOT in DEFAULT_TEMPLATE_BY_KIND): meetings
    // recur, so auto-generating prep tasks every occurrence would be noise. Light
    // set owned by the Annotator (Secretary); only the agenda is review-gated.
    // "File minutes" uses the working link-proof flow (paste the minutes-doc URL)
    // — NOT an in-app minutes system.
    id:    'chapter_meeting',
    label: 'Chapter Meeting',
    taskSpecs: [
      {
        key:           'agenda',
        title:         'Prepare the agenda for {event}',
        description:   'Draft and circulate the agenda for {event}.',
        assignedRole:  'annotator',
        dueOffsetDays: -2,
        requiresApproval: true,
        reviewerRole:  'president',
      },
      {
        key:           'reminder',
        title:         'Send meeting reminder to everyone',
        description:   'Remind the chapter about {event} (time, place, what to bring).',
        assignedRole:  'annotator',
        dueOffsetDays: -1,
        requiresApproval: false,
      },
      {
        key:           'minutes',
        title:         'File minutes for {event}',
        description:   'Post the minutes for {event} and attach the link.',
        assignedRole:  'annotator',
        dueOffsetDays: 1,
        requiresProof:    true,
        proofType:        'link',
        requiresApproval: false,
      },
    ],
  },
  {
    // Manual-apply only (see chapter_meeting note). Leaner than the chapter
    // template — officers are expected to attend, so no chapter-wide reminder.
    id:    'eboard_meeting',
    label: 'E-Board Meeting',
    taskSpecs: [
      {
        key:           'agenda',
        title:         'Prepare the e-board agenda for {event}',
        description:   'Draft the executive-board agenda for {event}.',
        assignedRole:  'annotator',
        dueOffsetDays: -2,
        requiresApproval: true,
        reviewerRole:  'president',
      },
      {
        key:           'minutes',
        title:         'File e-board minutes for {event}',
        description:   'Post the e-board minutes for {event} and attach the link.',
        assignedRole:  'annotator',
        dueOffsetDays: 1,
        requiresProof:    true,
        proofType:        'link',
        requiresApproval: false,
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

/**
 * Recommended built-in template per event kind. Used to PRE-SELECT a sensible
 * prep workflow when an officer creates an event of that kind — they still see
 * the preview and can switch templates or choose None. Only kinds with a clearly
 * matching built-in template are mapped; every other kind defaults to no
 * template. Pure data — reuses the existing template engine, no schema/RLS, no
 * mock generation. Extend as more built-in templates are added.
 */
export const DEFAULT_TEMPLATE_BY_KIND: Partial<Record<EventKind, string>> = {
  social:      'date_party',
  recruitment: 'recruitment',
};

/**
 * Typed accessor for a kind's recommended default template id (or null if the
 * kind has no auto-default). Prefer this over indexing DEFAULT_TEMPLATE_BY_KIND
 * directly at call sites — it makes adding future kind-defaults a one-line map
 * change behind a stable function, and never throws on an unmapped kind.
 *
 * Pure. Does NOT generate tasks or change behavior — only reports the mapping.
 */
export function getDefaultTemplateIdForKind(kind: EventKind): string | null {
  return DEFAULT_TEMPLATE_BY_KIND[kind] ?? null;
}

/** True if this kind auto-suggests a template at event-create time. */
export function kindHasDefaultTemplate(kind: EventKind): boolean {
  return getDefaultTemplateIdForKind(kind) !== null;
}

/**
 * Diagnostic: which event kinds currently have an auto-default template and which
 * don't, given the kinds in play. Pure, read-only — for future-default planning
 * and tests, NOT used to auto-create anything. Callers pass the kind list (e.g.
 * from mockEvents) to avoid a circular import here.
 */
export function defaultTemplateCoverage(kinds: EventKind[]): {
  withDefault:    EventKind[];
  withoutDefault: EventKind[];
} {
  const withDefault:    EventKind[] = [];
  const withoutDefault: EventKind[] = [];
  for (const k of kinds) {
    (kindHasDefaultTemplate(k) ? withDefault : withoutDefault).push(k);
  }
  return { withDefault, withoutDefault };
}

// ─── Date math ────────────────────────────────────────────────────────────────

/**
 * Human label for a template spec's due offset relative to the event day, e.g.
 * "7 days before", "1 day after", "On event day". Pure; used by the event-create
 * template preview. Lives here so the preview copy stays next to the spec data.
 */
export function dueOffsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return 'On event day';
  const d = Math.abs(offsetDays);
  return `${d} day${d === 1 ? '' : 's'} ${offsetDays < 0 ? 'before' : 'after'}`;
}

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

/** Build all tasks for a concrete template object (built-in OR custom). Pure. */
export function buildTasksFromTemplateObject(template: EventTaskTemplate, event: EventTemplateInput): MockTask[] {
  return template.taskSpecs.map(spec => buildTaskFromSpec(template.id, event, spec));
}

/**
 * Build all tasks for a BUILT-IN template id applied to an event. Returns [] for
 * the "None" sentinel or an unknown id. Pure. (Custom templates resolve through
 * customTemplatesStore.buildTasksForTemplateId.)
 */
export function buildTasksFromTemplate(templateId: string, event: EventTemplateInput): MockTask[] {
  const template = getEventTemplate(templateId);
  return template ? buildTasksFromTemplateObject(template, event) : [];
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
