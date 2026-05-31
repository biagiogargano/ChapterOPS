/**
 * goalUpdateRun.ts — the MANUAL weekly goal-update run (leadership action).
 *
 * Async wrapper around the pure lib/goalUpdateGeneration builder: it fetches the
 * org's active goals, derives this week's period key + open/due window, builds one
 * task per officer ROLE with active goals, and persists each NEW task through the
 * same addGeneratedTask + insertTask path that report/template generation uses.
 *
 * NOT a scheduler. No timer, no background job, no push, no AI. It runs once per
 * button press; the caller supplies `now`. Idempotent: task ids are deterministic
 * (goalupdrole_<role>__<period>) and addGeneratedTask no-ops on an existing or
 * tombstoned id, so a re-run the same week creates nothing new. Never throws —
 * returns a result the UI shows (created / skipped / rolesWithGoals, or error).
 *
 * The period/window helpers are PURE (no Date.now() inside) and exported for tests.
 */

import { addGeneratedTask } from './mockTasks';
import { insertTask } from './taskService';
import { listGoalsForOrg } from './goalService';
import { isoWeek, toISODate } from './questionnaireCycle';
import { generateWeeklyGoalUpdateTasks } from './goalUpdateGeneration';
import type { Role } from './roles';
import type { Goal } from './goals';

/** Deterministic ISO-week period key for a run, e.g. '2026-W22'. Pure. */
export function weeklyGoalUpdatePeriodKey(now: Date): string {
  const { year, week } = isoWeek(now);
  return `${year}-W${week < 10 ? `0${week}` : week}`;
}

/** True for a usable Date (instanceof + finite time). Pure. */
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime());
}

/**
 * The reporting period key an AGENDA should use for its update-derived sections: the ISO
 * week of the MEETING EVENT's date, falling back to `fallbackDate`'s week when the event
 * date is missing/invalid. Pure.
 *
 * ALPHA DEFAULT: a meeting's agenda pulls the weekly updates for the meeting's own week
 * (not blindly "now"). With the current client event model (dayOffset within the current
 * week), this coincides with the current week; it becomes meaningfully different once events
 * carry absolute dates. A fully org-configurable reporting calendar is future work.
 */
export function agendaReportingPeriodKey(eventDate: Date | null | undefined, fallbackDate: Date): string {
  return weeklyGoalUpdatePeriodKey(isValidDate(eventDate) ? eventDate : fallbackDate);
}

/**
 * The open/due window for a weekly goal-update run, relative to `now` (pure):
 *   • availableAt = now + 4 days  → opens near the END of the week (officers update
 *     once the week's work has happened, not Monday morning).
 *   • dueAt       = now + 7 days  → due about a week out.
 * Documented alpha default — there is no per-org window preference yet. Local ISO dates.
 */
export function weeklyGoalUpdateWindow(now: Date): { availableAt: string; dueAt: string } {
  const open = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  const due  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  return { availableAt: toISODate(open), dueAt: toISODate(due) };
}

export interface RunWeeklyGoalUpdatesInput {
  /** Org scope. */
  orgId: string;
  /** Reference moment (caller supplies — no Date.now() inside). */
  now: Date;
  /** Optional restriction to a subset of roles. */
  roles?: Role[];
  /**
   * Optional injected goals (testing / preview). When omitted, the live org goals
   * are fetched via listGoalsForOrg (leadership-readable). Only active goals owned
   * by a runtime role produce a task.
   */
  goals?: Goal[];
}

export interface RunWeeklyGoalUpdatesResult {
  /** Tasks newly created this run. */
  created: number;
  /** Roles whose task already existed (idempotent skip). */
  skipped: number;
  /** How many roles had ≥1 active goal (whether created or skipped). */
  rolesWithGoals: number;
  /** True if the goal fetch failed / nothing could be read (UI shows an error). */
  error?: boolean;
}

/**
 * Run the manual weekly goal-update generation. Fetches active goals (unless injected),
 * builds one task per officer role with active goals, and persists each new one.
 * Idempotent + fail-safe; never throws.
 */
export async function runWeeklyGoalUpdateGeneration(
  input: RunWeeklyGoalUpdatesInput,
): Promise<RunWeeklyGoalUpdatesResult> {
  if (!input.orgId) return { created: 0, skipped: 0, rolesWithGoals: 0 };

  let goals: Goal[];
  if (input.goals) {
    goals = input.goals;
  } else {
    try {
      goals = await listGoalsForOrg(input.orgId);
    } catch {
      return { created: 0, skipped: 0, rolesWithGoals: 0, error: true };
    }
  }

  const periodKey = weeklyGoalUpdatePeriodKey(input.now);
  const window    = weeklyGoalUpdateWindow(input.now);

  // Build every per-role task (dedup is handled by addGeneratedTask below, matching
  // the report/template generation pattern), then add+persist the genuinely-new ones.
  const { tasks, rolesWithGoals } = generateWeeklyGoalUpdateTasks({
    goals, periodKey, window, roles: input.roles,
  });

  let created = 0;
  let skipped = 0;
  for (const task of tasks) {
    const added = addGeneratedTask(task);
    if (added === task) { created++; void insertTask(added); }
    else { skipped++; }   // already present or tombstoned
  }

  return { created, skipped, rolesWithGoals: rolesWithGoals.length };
}
