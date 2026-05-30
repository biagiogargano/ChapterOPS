/**
 * reportTasks.ts — pure deterministic report-task generator (foundation).
 *
 * A report is a normal structured TASK whose completion is a structured-response
 * submission. This module builds the report-task METADATA deterministically from
 * (org, role, cycle, definition). It mirrors the template generator pattern
 * (lib/eventTemplates.templateTaskId) — deterministic ids make generation
 * idempotent and dedup-safe, exactly like template/RSVP-review tasks.
 *
 * FOUNDATION ONLY: pure, no React/stores/Supabase/I/O. Nothing imports it yet.
 * It does NOT insert tasks, does NOT touch the task state machine, and does NOT
 * persist answers (that needs the deferred `task_report_submissions` table — see
 * docs/STRUCTURED_RESPONSES_FOUNDATION.md). The returned MockTask is a plain,
 * structured task the future wiring layer can hand to addGeneratedTask/insertTask.
 */

import { deriveDueMeta, deriveVisibleTo, type MockTask } from './mockTasks';
import { ROLE_LABELS, type Role } from './roles';
import { getReportDefinition } from './reportDefinitions';

/** Stable id prefix so report tasks are dedupable + distinguishable. */
export const REPORT_TASK_PREFIX = 'report_';

/**
 * Deterministic id for a report task: report_<role>_<cycle>. The same
 * (role, cycle) always yields the same id, so optimistic add, hydration re-merge,
 * and regeneration all collapse to one task. `cycle` is a stable cycle key the
 * caller supplies (e.g. an ISO week '2026-W23' or a date) — this module does NOT
 * compute cycles (no scheduler).
 */
export function reportTaskId(role: Role, cycle: string): string {
  return `${REPORT_TASK_PREFIX}${role}_${cycle}`;
}

export interface ReportTaskInput {
  /** Org scope (carried for the future write path; not used in the id). */
  orgId:        string;
  /** Officer role the report is assigned to. */
  role:         Role;
  /** Stable cycle key (e.g. '2026-W23'). Supplied by the caller; not computed. */
  cycle:        string;
  /** Which report definition this task collects (e.g. WEEKLY_OFFICER_REPORT_ID). */
  definitionId: string;
  /** ISO 'YYYY-MM-DD' due date for this cycle's report. Supplied by the caller. */
  dueDate:      string;
}

/**
 * Build the report task for one (role, cycle). Returns null if the definition id
 * is unknown (fail safe — never fabricates a task for a missing definition).
 *
 * The task is a normal `structured` task:
 *   • deterministic id report_<role>_<cycle>;
 *   • stable title/description derived from the definition label;
 *   • assigned to the officer `role` (role-keyed like every task);
 *   • visibleTo = assignee + leadership (the standard structured visibility);
 *   • requiresProof = false, requiresApproval = false — a report's "answers" are
 *     its completion, collected via the structured-response form later, NOT proof
 *     or single-reviewer approval. The state machine is unchanged: submitting will
 *     flip the task to 'submitted' via the normal path in the future wiring.
 *   • reportDefinitionId tags which definition to render (custom MockTask field).
 *
 * Pure: no I/O, no store mutation. dueLabel/urgency come from the shared
 * deriveDueMeta (date-relative like all tasks); the deterministic fields (id,
 * title, description, assignedRole, dueAt, reportDefinitionId) do not depend on
 * the current date.
 */
export function buildReportTask(input: ReportTaskInput): MockTask | null {
  const def = getReportDefinition(input.definitionId);
  if (!def) return null;

  const { dueLabel, urgency } = deriveDueMeta(input.dueDate);
  const roleLabel = ROLE_LABELS[input.role];

  return {
    id:               reportTaskId(input.role, input.cycle),
    title:            `${def.label} — ${roleLabel}`,
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            input.dueDate,
    assignedRole:     input.role,
    assignedTo:       roleLabel,
    visibleTo:        deriveVisibleTo(input.role),
    description:      `Submit your ${def.label.toLowerCase()} for this cycle.`,
    requiresProof:    false,
    requiresApproval: false,
    createdByRole:    input.role,
    // Custom tag: which structured-response definition this task collects. Unknown
    // to existing screens (ignored), read by the future report submit/read flow.
    reportDefinitionId: input.definitionId,
  };
}
