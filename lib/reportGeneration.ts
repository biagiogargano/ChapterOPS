/**
 * reportGeneration.ts — controlled, MANUAL report-task generation.
 *
 * Creates weekly officer report TASKS from the pure builder (lib/reportTasks.
 * buildReportTask) so the existing Task Detail report form can be reached. This
 * is the deliberate, manual generation path — there is NO scheduler, NO recurring
 * background generation, NO reminders/push here (those are intentionally out of
 * scope for Reports v1).
 *
 * Idempotent by construction: report task ids are deterministic
 * (report_<role>_<cycle>), and addGeneratedTask() no-ops on an already-present or
 * tombstoned id — so generating the same role+cycle twice never duplicates. Each
 * newly-added task is persisted via taskService.insertTask (no-op in mock
 * fallback), exactly like template / RSVP-review generation.
 *
 * Pure-ish: mutates the in-memory task store (like addGeneratedTask elsewhere) and
 * fires fire-and-forget persistence; it does NOT touch Supabase schema, RLS, or
 * task state, and never throws.
 */

import { addGeneratedTask, type MockTask } from './mockTasks';
import { insertTask } from './taskService';
import { buildReportTask, reportTaskId } from './reportTasks';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { OFFICER_ROLES, type Role } from './roles';

export interface GenerateReportsInput {
  /** Org scope (carried into the task; not part of the deterministic id). */
  orgId:   string;
  /** Stable cycle key, e.g. '2026-W23'. Caller-supplied (no scheduler here). */
  cycle:   string;
  /** ISO 'YYYY-MM-DD' due date for this cycle's reports. Caller-supplied. */
  dueDate: string;
  /** Roles to generate a report task for. Defaults to all officer roles. */
  roles?:  Role[];
  /** Report definition to use. Defaults to the weekly officer report. */
  definitionId?: string;
}

export interface GenerateReportsResult {
  /** Report tasks newly created this call (excludes already-existing/tombstoned). */
  created:  MockTask[];
  /** Deterministic ids that already existed (idempotent skips). */
  skipped:  string[];
}

/**
 * Generate report tasks for the given roles + cycle. Manual/controlled — the
 * caller decides when and for whom. Idempotent: re-running for the same role+cycle
 * returns those ids under `skipped` and creates nothing new.
 *
 * Returns the created tasks + skipped ids. Never throws; persistence is
 * fire-and-forget (no-op when Supabase is unconfigured).
 */
export function generateReportTasks(input: GenerateReportsInput): GenerateReportsResult {
  const roles        = input.roles ?? OFFICER_ROLES;
  const definitionId = input.definitionId ?? WEEKLY_OFFICER_REPORT_ID;

  const created: MockTask[] = [];
  const skipped: string[]   = [];

  for (const role of roles) {
    const id   = reportTaskId(role, input.cycle);
    const task = buildReportTask({
      orgId:        input.orgId,
      role,
      cycle:        input.cycle,
      definitionId,
      dueDate:      input.dueDate,
    });
    if (!task) continue;   // unknown definition → fail safe (build returned null)

    const added = addGeneratedTask(task);
    if (added === task) {
      // Genuinely new (addGeneratedTask returns the SAME object it pushed).
      created.push(added);
      void insertTask(added);
    } else {
      // Already present (returns the existing task) or tombstoned (undefined).
      skipped.push(id);
    }
  }

  return { created, skipped };
}

/** Convenience: weekly officer reports for ALL officer roles for one cycle. */
export function generateWeeklyOfficerReports(
  orgId: string,
  cycle: string,
  dueDate: string,
): GenerateReportsResult {
  return generateReportTasks({ orgId, cycle, dueDate });
}

// ─── Generic entry point ──────────────────────────────────────────────────────
// The core operation is "generate questionnaire / structured-response tasks from a
// definition, for a chosen set of roles". `generateReportTasks` /
// `generateWeeklyOfficerReports` above are the Sigma Chi PRESET (they default to
// the Weekly Officer Report + all officer roles). `generateQuestionnaireTasks` is
// the GENERIC entry point any new caller (and the future manual-generation UI)
// should prefer — per the product doctrine, it forces NO fraternity defaults:
// definition and roles are explicit. An admin generating "Event Recap" for three
// committee roles must not silently get officer roles + the weekly report.
//
// Idempotency is per (role, cycle), as documented on reportTaskId — `cycle` is an
// opaque caller-supplied stable key. When generating MORE THAN ONE definition that
// could overlap the same role+cycle window, the caller distinguishes them via the
// cycle key (e.g. 'event_recap:evt_123' vs 'weekly:2026-W23'). See
// docs/STRUCTURED_RESPONSE_ROADMAP.md.

/** Generic questionnaire-generation request — definition + roles are explicit. */
export interface GenerateQuestionnaireInput {
  /** Org scope (carried into the task; not part of the deterministic id). */
  orgId:        string;
  /** Which questionnaire definition to generate tasks for (required, explicit). */
  definitionId: string;
  /** Roles to generate a task for (required, explicit — no fraternity default). */
  roles:        Role[];
  /** Stable, opaque cycle/run key. Caller-supplied (no scheduler here). */
  cycle:        string;
  /** ISO 'YYYY-MM-DD' due date. Caller-supplied. */
  dueDate:      string;
}

/** Generic result alias (same shape as report generation). */
export type GenerateQuestionnaireResult = GenerateReportsResult;

/**
 * Generate questionnaire (structured-response) tasks for explicit roles + cycle
 * from an explicit definition. Generic — forces no fraternity defaults. Fail-safe:
 * returns an empty result (creates nothing) when the definition id or roles are
 * missing/empty, or when the definition is unknown (the builder returns null).
 * Idempotent per (role, cycle); never throws; persistence is fire-and-forget.
 */
export function generateQuestionnaireTasks(
  input: GenerateQuestionnaireInput,
): GenerateQuestionnaireResult {
  if (!input.definitionId || !Array.isArray(input.roles) || input.roles.length === 0) {
    return { created: [], skipped: [] };
  }
  // Delegate to the shared loop with the explicit definition + roles (no defaults).
  return generateReportTasks({
    orgId:        input.orgId,
    cycle:        input.cycle,
    dueDate:      input.dueDate,
    roles:        input.roles,
    definitionId: input.definitionId,
  });
}
