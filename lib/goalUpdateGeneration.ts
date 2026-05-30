/**
 * goalUpdateGeneration.ts — pure builder for the MANUAL weekly goal-update run.
 *
 * Product decision (alpha): leadership taps "Create weekly goal update tasks". That
 * generates ONE structured task per officer ROLE that has ≥1 active goal. Each task
 * walks the officer through their active goals + a short weekly check-in, opens near
 * the end of the week (availableAt), and is due shortly after (dueAt). Re-running is
 * safe — a role's task id is deterministic, so an existing one is skipped.
 *
 * ⚠️ PURE FOUNDATION. No React, no stores, no Supabase, no scheduler, no push, no AI,
 *    no Date.now() (caller supplies the reference moment / window). It builds plain
 *    MockTasks a wiring layer hands to addGeneratedTask/insertTask — exactly the
 *    pattern lib/reportGeneration uses. Never throws.
 *
 * THE DEFINITION GATE (why a task only carries a definition *id*, not the questions):
 *   A goal-update definition is built from the role's CURRENT active goals
 *   (buildGoalUpdateDefinition) — it is dynamic, so it is NOT in the static
 *   REPORT_DEFINITIONS registry. Task Detail must therefore RECONSTRUCT it at render
 *   time from live goals (see reconstructGoalUpdateDefinition + isGoalUpdateDefinitionId)
 *   rather than look it up. That keeps the form correct across reload with NO new
 *   storage: the questions are re-derived from persisted goals; the ANSWERS persist
 *   through the existing task_report_submissions RPC, keyed by the stable goal field
 *   keys. (The alternative — storing the definition jsonb — is a Supabase lane and is
 *   intentionally NOT taken here.)
 *
 * This is the live per-ROLE scheme for the manual run. (An earlier per-GOAL builder,
 * lib/goalUpdateTasks, was removed once the product chose one task per role.)
 */

import { buildGoalUpdateDefinition } from './goalUpdateDefinition';
import { deriveDueMeta, deriveVisibleTo, type MockTask } from './mockTasks';
import { ROLE_LABELS, type Role } from './roles';
import { isRuntimeRoleKey } from './rolePackRuntime';
import type { StructuredResponseDefinition } from './structuredResponses';
import type { Goal } from './goals';

/** Stable prefixes so goal-update artifacts are dedupable + recognizable. */
export const GOAL_UPDATE_TASK_PREFIX = 'goalupdrole_';
export const GOAL_UPDATE_DEF_PREFIX  = 'goalupddef_';

/**
 * Separator between the role key and the period key inside the generated ids. Role
 * keys are single-underscore snake_case (e.g. social_chair) and period keys contain
 * no underscores (e.g. 2026-W22), so a DOUBLE underscore unambiguously splits them.
 */
const SEP = '__';

/** Deterministic task id for a role's weekly goal update: goalupdrole_<role>__<period>. */
export function goalUpdateTaskId(role: Role, periodKey: string): string {
  return `${GOAL_UPDATE_TASK_PREFIX}${role}${SEP}${periodKey}`;
}

/** Deterministic definition id for a role's weekly goal update: goalupddef_<role>__<period>. */
export function goalUpdateDefinitionId(role: Role, periodKey: string): string {
  return `${GOAL_UPDATE_DEF_PREFIX}${role}${SEP}${periodKey}`;
}

/** True when an id is a goal-update DEFINITION id (so Task Detail reconstructs it). */
export function isGoalUpdateDefinitionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(GOAL_UPDATE_DEF_PREFIX);
}

/** True when an id is a goal-update TASK id. */
export function isGoalUpdateTaskId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(GOAL_UPDATE_TASK_PREFIX);
}

/**
 * Parse a goal-update definition (or task) id back into { role, periodKey }, or null
 * if it is not one / is malformed. The role is validated against the runtime Role set
 * so a bad id never yields a non-Role. Pure.
 */
export function parseGoalUpdateId(id: string): { role: Role; periodKey: string } | null {
  let rest: string | null = null;
  if (id.startsWith(GOAL_UPDATE_DEF_PREFIX))  rest = id.slice(GOAL_UPDATE_DEF_PREFIX.length);
  else if (id.startsWith(GOAL_UPDATE_TASK_PREFIX)) rest = id.slice(GOAL_UPDATE_TASK_PREFIX.length);
  if (rest === null) return null;
  const i = rest.indexOf(SEP);
  if (i <= 0) return null;
  const role = rest.slice(0, i);
  const periodKey = rest.slice(i + SEP.length);
  if (!periodKey || !isRuntimeRoleKey(role)) return null;
  return { role, periodKey };
}

/** Human label for a role's weekly goal-update form (used by the reconstructed def). */
export function goalUpdateDefinitionLabel(role: Role): string {
  return `${ROLE_LABELS[role] ?? 'Officer'} — Weekly Goal Update`;
}

/**
 * Reconstruct the structured-response definition for a goal-update task at render
 * time, from the role's CURRENT active goals. `definitionId` is the task's
 * reportDefinitionId (carries the role/period); `goals` is the live, already-filtered
 * set of that role's active goals. Pure — wraps buildGoalUpdateDefinition. Returns
 * null only if `definitionId` is not a goal-update definition id.
 */
export function reconstructGoalUpdateDefinition(
  definitionId: string,
  goals: Pick<Goal, 'id' | 'title'>[],
): StructuredResponseDefinition | null {
  const parsed = parseGoalUpdateId(definitionId);
  if (!parsed) return null;
  return buildGoalUpdateDefinition({
    goals,
    id: definitionId,
    label: goalUpdateDefinitionLabel(parsed.role),
    includeCheckIn: true,
  });
}

/** A fixed title/description for the weekly goal-update task. Pure. */
export function goalUpdateTaskTitle(): string {
  return 'Weekly goal update';
}
export function goalUpdateTaskDescription(): string {
  return 'Update your active goals for this week and answer the weekly check-in.';
}

/**
 * Build the weekly goal-update task for ONE role + period. The role must have ≥1
 * active goal (the caller groups goals); the task carries a goal-update DEFINITION id
 * (reconstructed at render, see above), availableAt (opens) + dueAt (due), no proof,
 * no approval, visibleTo = owner role + leadership. Pure. Returns null only if the
 * role is not a runtime-supported Role.
 */
export function buildGoalUpdateTaskForRole(
  role: Role,
  periodKey: string,
  window: { availableAt: string; dueAt: string },
): MockTask | null {
  if (!isRuntimeRoleKey(role)) return null;
  const { dueLabel, urgency } = deriveDueMeta(window.dueAt);
  return {
    id:               goalUpdateTaskId(role, periodKey),
    title:            goalUpdateTaskTitle(),
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            window.dueAt,
    availableAt:      window.availableAt,
    assignedRole:     role,
    assignedTo:       ROLE_LABELS[role],
    visibleTo:        deriveVisibleTo(role),
    description:      goalUpdateTaskDescription(),
    requiresProof:    false,
    requiresApproval: false,
    createdByRole:    role,
    reportDefinitionId: goalUpdateDefinitionId(role, periodKey),
  };
}

export interface GenerateWeeklyGoalUpdatesInput {
  /** Active (or any) goals across the org; only status==='active' with a runtime owner role count. */
  goals: Goal[];
  /** Deterministic period key for this run (e.g. ISO week) — same key → same task ids. */
  periodKey: string;
  /** Window: when the task opens (availableAt) and when it's due (dueAt). ISO dates/strings. */
  window: { availableAt: string; dueAt: string };
  /** Task ids that already exist (idempotent skip). */
  existingTaskIds?: ReadonlySet<string> | string[];
  /** Optional restriction to a subset of roles (default: every role with active goals). */
  roles?: Role[];
}

export interface GenerateWeeklyGoalUpdatesResult {
  /** Newly-built tasks (NOT including ones that already existed). */
  tasks: MockTask[];
  /** Count of newly-built tasks. */
  created: number;
  /** Count of role tasks skipped because their id already existed. */
  skipped: number;
  /** Roles that had ≥1 active goal (whether created or skipped), sorted. */
  rolesWithGoals: Role[];
}

function hasId(set: ReadonlySet<string> | string[] | undefined, id: string): boolean {
  if (!set) return false;
  return Array.isArray(set) ? set.includes(id) : set.has(id);
}

/**
 * Build one weekly goal-update task per officer ROLE that has ≥1 active goal. Pure;
 * never throws. Idempotent: a role whose task id is already in `existingTaskIds` is
 * skipped (counted in `skipped`, not returned in `tasks`). A goal with no owner role,
 * a non-runtime owner role, or a non-active status contributes nothing. Optionally
 * restricted to `roles`. Roles are processed in a stable (sorted) order so output is
 * deterministic.
 */
export function generateWeeklyGoalUpdateTasks(
  input: GenerateWeeklyGoalUpdatesInput,
): GenerateWeeklyGoalUpdatesResult {
  const allow = input.roles ? new Set<Role>(input.roles) : null;

  // Group active goals by runtime owner role.
  const byRole = new Map<Role, true>();
  for (const g of input.goals ?? []) {
    if (g.status !== 'active') continue;
    const r = g.ownerRole;
    if (!r || !isRuntimeRoleKey(r)) continue;       // narrows RoleKey → Role
    if (allow && !allow.has(r)) continue;
    byRole.set(r, true);
  }

  const rolesWithGoals = Array.from(byRole.keys()).sort();
  const tasks: MockTask[] = [];
  let created = 0;
  let skipped = 0;

  for (const role of rolesWithGoals) {
    const id = goalUpdateTaskId(role, input.periodKey);
    if (hasId(input.existingTaskIds, id)) { skipped++; continue; }
    const task = buildGoalUpdateTaskForRole(role, input.periodKey, input.window);
    if (!task) continue;                            // unreachable (role already runtime-checked)
    tasks.push(task);
    created++;
  }

  return { tasks, created, skipped, rolesWithGoals };
}
