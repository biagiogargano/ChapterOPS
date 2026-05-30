/**
 * goalUpdateTasks.ts — pure builder for a goal's UPDATE task (foundation).
 *
 * A persistent Goal (lib/goals) expects recurring updates; each update surfaces as a
 * normal structured TASK whose completion is the goal-update submission. This module
 * builds that task's METADATA deterministically from (goal, period, dueDate) — the
 * goal analog of lib/reportTasks.buildReportTask, mirroring its safe pattern.
 *
 * ⚠️ FOUNDATION — PURE. No React, no stores, no Supabase, no I/O, no task insertion,
 *    no scheduler. It does NOT touch the task state machine or persist anything. The
 *    returned MockTask is a plain structured task a future wiring layer can hand to
 *    addGeneratedTask/insertTask (like report/template generation). Nothing imports
 *    this yet. See docs/GOALS_FIRST_SYSTEM_PLAN.md / GOALS_PERSISTENCE_PLAN.md.
 *
 * OWNERSHIP NOTE: a goal may be owned by a RoleKey (ownerRole) or a person
 * (ownerMemberId). A MockTask is role-keyed (assignedRole: Role), so v1 builds an
 * update task only for a goal whose ownerRole is a RUNTIME-supported Role (via
 * lib/rolePackRuntime). A custom/unsupported owner role or a person-only owner →
 * null (fail safe, documented gap) until the Role union opens (Supabase-gated).
 */

import { deriveDueMeta, deriveVisibleTo, type MockTask } from './mockTasks';
import { ROLE_LABELS, type Role } from './roles';
import { isRuntimeRoleKey } from './rolePackRuntime';
import { getReportDefinition } from './reportDefinitions';
import { goalPeriodKey, isGoalUpdateDue } from './goalHelpers';
import type { Goal } from './goals';

/** Stable prefix so goal-update tasks are dedupable + distinguishable. */
export const GOAL_UPDATE_TASK_PREFIX = 'goalupd_';

/**
 * Deterministic id for a goal-update task: goalupd_<goalId>_<periodKey>. Same goal +
 * same period always yields the same id (idempotent generation, dedup-safe); a
 * different period yields a different id. `periodKey` is the goal's period for the
 * update window (from goalHelpers.goalPeriodKey) — supplied by the caller.
 */
export function goalUpdateTaskId(goalId: string, periodKey: string): string {
  return `${GOAL_UPDATE_TASK_PREFIX}${goalId}_${periodKey}`;
}

/** Stable task title for a goal update (uses the goal's title). Pure. */
export function goalUpdateTaskTitle(goal: Pick<Goal, 'title'>): string {
  const t = (goal.title ?? '').trim();
  return t.length > 0 ? `Update: ${t}` : 'Goal update';
}

/** Stable task description for a goal update. Pure. */
export function goalUpdateTaskDescription(goal: Pick<Goal, 'title'>): string {
  const t = (goal.title ?? '').trim();
  return t.length > 0
    ? `Submit this period's update for "${t}".`
    : "Submit this period's goal update.";
}

/**
 * Should a goal-update task be generated for `goal` as of `refDate`? True when the
 * goal is active, its update definition is known, it has a runtime-supported owner
 * role, an update is due for the current period, AND that period's task id isn't in
 * `existingTaskIds` (idempotent skip). Pure; never throws.
 */
export function shouldGenerateGoalUpdateTask(
  goal: Goal,
  refDate: Date,
  existingTaskIds: ReadonlySet<string> | string[] = [],
  lastUpdatePeriod?: string | null,
): boolean {
  if (goal.status !== 'active') return false;
  if (!goal.updateDefinitionId || getReportDefinition(goal.updateDefinitionId) === null) return false;
  if (!goal.ownerRole || !isRuntimeRoleKey(goal.ownerRole)) return false;   // see ownership note
  if (!isGoalUpdateDue(goal, refDate, lastUpdatePeriod)) return false;

  const id = goalUpdateTaskId(goal.id, goalPeriodKey(goal, refDate));
  const has = Array.isArray(existingTaskIds) ? existingTaskIds.includes(id) : existingTaskIds.has(id);
  return !has;
}

/**
 * Build the update task for a goal + period. Returns null (fail safe) when:
 *   • the goal's updateDefinitionId is missing/unknown, OR
 *   • the goal's ownerRole is missing or not a runtime-supported Role.
 * The task is a normal structured task: deterministic id, no proof, no approval,
 * carries reportDefinitionId = the goal's update definition (so the existing Task
 * Detail form renders it), visibleTo = owner + leadership. Pure — no I/O, no store.
 */
export function buildGoalUpdateTask(goal: Goal, periodKey: string, dueDate: string): MockTask | null {
  const def = goal.updateDefinitionId ? getReportDefinition(goal.updateDefinitionId) : null;
  if (!def) return null;
  if (!goal.ownerRole || !isRuntimeRoleKey(goal.ownerRole)) return null;

  const role: Role = goal.ownerRole;   // narrowed by isRuntimeRoleKey above
  const { dueLabel, urgency } = deriveDueMeta(dueDate);

  return {
    id:               goalUpdateTaskId(goal.id, periodKey),
    title:            goalUpdateTaskTitle(goal),
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            dueDate,
    assignedRole:     role,
    assignedTo:       ROLE_LABELS[role],
    visibleTo:        deriveVisibleTo(role),
    description:      goalUpdateTaskDescription(goal),
    requiresProof:    false,
    requiresApproval: false,
    createdByRole:    role,
    // The update task collects the goal's update questionnaire — reuses the existing
    // structured-response form/storage. (A future goal-link field would also carry
    // goal.id + periodKey; the deterministic task id already encodes both.)
    reportDefinitionId: goal.updateDefinitionId,
  };
}
