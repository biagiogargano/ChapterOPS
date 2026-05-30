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
