/**
 * Tests for lib/goalUpdateGeneration — the pure per-ROLE weekly goal-update run.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  GOAL_UPDATE_TASK_PREFIX, GOAL_UPDATE_DEF_PREFIX,
  goalUpdateTaskId, goalUpdateDefinitionId,
  isGoalUpdateDefinitionId, isGoalUpdateTaskId, parseGoalUpdateId,
  reconstructGoalUpdateDefinition, buildGoalUpdateTaskForRole,
  generateWeeklyGoalUpdateTasks,
} from './goalUpdateGeneration';
import { parseGoalFieldKey } from './goalUpdateDefinition';
import { canApproveTask } from './mockTasks';
import type { Goal } from './goals';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const PERIOD = '2026-W22';
const WINDOW = { availableAt: '2026-05-29', dueAt: '2026-06-01' };

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', orgId: 'org1', title: 'Recruit 12', status: 'active',
    ownerRole: 'social_chair', cadence: 'weekly',
    ...over,
  } as Goal;
}

// ── id helpers: deterministic + namespaced ────────────────────────────────────
{
  check('task id shape', goalUpdateTaskId('social_chair', PERIOD) === `${GOAL_UPDATE_TASK_PREFIX}social_chair__${PERIOD}`);
  check('def id shape',  goalUpdateDefinitionId('social_chair', PERIOD) === `${GOAL_UPDATE_DEF_PREFIX}social_chair__${PERIOD}`);
  check('task id deterministic', goalUpdateTaskId('quaestor', PERIOD) === goalUpdateTaskId('quaestor', PERIOD));
  check('different period → different id', goalUpdateTaskId('quaestor', PERIOD) !== goalUpdateTaskId('quaestor', '2026-W23'));
  check('different role → different id', goalUpdateTaskId('quaestor', PERIOD) !== goalUpdateTaskId('social_chair', PERIOD));
}

// ── id classification ─────────────────────────────────────────────────────────
{
  check('isGoalUpdateDefinitionId true',  isGoalUpdateDefinitionId(goalUpdateDefinitionId('quaestor', PERIOD)));
  check('isGoalUpdateDefinitionId false on task id', !isGoalUpdateDefinitionId(goalUpdateTaskId('quaestor', PERIOD)));
  check('isGoalUpdateDefinitionId false on static', !isGoalUpdateDefinitionId('weekly_officer_report'));
  check('isGoalUpdateDefinitionId null-safe', !isGoalUpdateDefinitionId(null) && !isGoalUpdateDefinitionId(undefined));
  check('isGoalUpdateTaskId true', isGoalUpdateTaskId(goalUpdateTaskId('quaestor', PERIOD)));
  check('isGoalUpdateTaskId false on def id', !isGoalUpdateTaskId(goalUpdateDefinitionId('quaestor', PERIOD)));
}

// ── parse round-trips (role has an underscore; period has a hyphen) ────────────
{
  const p1 = parseGoalUpdateId(goalUpdateDefinitionId('social_chair', PERIOD));
  check('parse def id → role', !!p1 && p1.role === 'social_chair');
  check('parse def id → period', !!p1 && p1.periodKey === PERIOD);
  const p2 = parseGoalUpdateId(goalUpdateTaskId('pro_consul', '2026-W30'));
  check('parse task id → role (multi-underscore role)', !!p2 && p2.role === 'pro_consul');
  check('parse task id → period', !!p2 && p2.periodKey === '2026-W30');
  check('parse rejects non-goal-update id', parseGoalUpdateId('weekly_officer_report') === null);
  check('parse rejects unknown role', parseGoalUpdateId(`${GOAL_UPDATE_DEF_PREFIX}not_a_role__${PERIOD}`) === null);
  check('parse rejects missing period', parseGoalUpdateId(`${GOAL_UPDATE_DEF_PREFIX}quaestor__`) === null);
}

// ── reconstruction: rebuilds the definition from live goals ────────────────────
{
  const defId = goalUpdateDefinitionId('social_chair', PERIOD);
  const def = reconstructGoalUpdateDefinition(defId, [
    { id: 'g1', title: 'Recruit 12' },
    { id: 'g2', title: 'Host 3 socials' },
  ]);
  check('reconstruct returns a definition', !!def);
  check('reconstruct id matches the task def id', !!def && def.id === defId);
  // 2 goals × 4 fields + 4 check-in questions = 12.
  check('reconstruct has per-goal + check-in questions', !!def && def.questions.length === 2 * 4 + 4);
  // The per-goal keys map back to the goals.
  const goalKeys = def!.questions.map(q => parseGoalFieldKey(q.key)).filter(Boolean);
  check('reconstruct keys map back to both goals',
    goalKeys.some(k => k!.goalId === 'g1') && goalKeys.some(k => k!.goalId === 'g2'));
  check('reconstruct of non-goal-update id is null', reconstructGoalUpdateDefinition('weekly_officer_report', []) === null);
  // Zero goals → still a valid check-in-only definition.
  const empty = reconstructGoalUpdateDefinition(defId, []);
  check('reconstruct with no goals → check-in only (4 q)', !!empty && empty.questions.length === 4);
}

// ── per-role task builder ─────────────────────────────────────────────────────
{
  const t = buildGoalUpdateTaskForRole('quaestor', PERIOD, WINDOW);
  check('task built', !!t);
  check('task id correct', !!t && t.id === goalUpdateTaskId('quaestor', PERIOD));
  check('task carries the def id', !!t && t.reportDefinitionId === goalUpdateDefinitionId('quaestor', PERIOD));
  check('task availableAt set', !!t && t.availableAt === WINDOW.availableAt);
  check('task dueAt set', !!t && t.dueAt === WINDOW.dueAt);
  check('task is structured', !!t && t.type === 'structured');
  check('task has no proof', !!t && t.requiresProof === false);
  // Review-required: reviewer = Annotator (runtime), so the update goes to PENDING REVIEW
  // (not auto-complete) on submit. canApproveTask also grants leadership override.
  check('task requires approval (review gate on)', !!t && t.requiresApproval === true);
  check('task reviewerRole = annotator', !!t && t.reviewerRole === 'annotator');
  check('task assigned to the role', !!t && t.assignedRole === 'quaestor');
  check('task visible to owner role', !!t && t.visibleTo.includes('quaestor'));
  check('task visible to the reviewer (annotator)', !!t && t.visibleTo.includes('annotator'));

  // Review mechanics (existing canApproveTask): Annotator + leadership can review; others can't.
  check('annotator can review the goal update', !!t && canApproveTask(t, 'annotator'));
  check('president (leadership) can review', !!t && canApproveTask(t, 'president'));
  check('pro_consul (leadership) can review', !!t && canApproveTask(t, 'pro_consul'));
  check('an ordinary officer cannot review', !!t && !canApproveTask(t, 'social_chair'));
  check('the assignee role itself is not auto-reviewer (unless leadership)', !!t && !canApproveTask(t, 'kustos'));
}

// ── generation: one task per role with active goals, idempotent ────────────────
{
  const goals: Goal[] = [
    goal({ id: 'g1', ownerRole: 'social_chair', status: 'active' }),
    goal({ id: 'g2', ownerRole: 'social_chair', status: 'active' }),  // same role → still one task
    goal({ id: 'g3', ownerRole: 'quaestor',    status: 'active' }),
    goal({ id: 'g4', ownerRole: 'quaestor',    status: 'completed' }), // not active
    goal({ id: 'g5', ownerRole: undefined,      status: 'active' }),    // no owner role
    goal({ id: 'g6', ownerRole: 'not_a_runtime_role', status: 'active' }), // non-runtime role
  ];
  const r = generateWeeklyGoalUpdateTasks({ goals, periodKey: PERIOD, window: WINDOW });
  check('one task per role with active goals', r.created === 2);
  check('tasks length matches created', r.tasks.length === 2);
  check('rolesWithGoals = the two valid roles', r.rolesWithGoals.length === 2 &&
    r.rolesWithGoals.includes('social_chair') && r.rolesWithGoals.includes('quaestor'));
  check('rolesWithGoals sorted (deterministic)',
    JSON.stringify(r.rolesWithGoals) === JSON.stringify([...r.rolesWithGoals].sort()));
  check('each task carries availableAt+dueAt', r.tasks.every(t => t.availableAt === WINDOW.availableAt && t.dueAt === WINDOW.dueAt));
}

// ── idempotent re-run: existing ids skipped ───────────────────────────────────
{
  const goals: Goal[] = [
    goal({ id: 'g1', ownerRole: 'social_chair', status: 'active' }),
    goal({ id: 'g3', ownerRole: 'quaestor',    status: 'active' }),
  ];
  const existing = [goalUpdateTaskId('social_chair', PERIOD)];
  const r = generateWeeklyGoalUpdateTasks({ goals, periodKey: PERIOD, window: WINDOW, existingTaskIds: existing });
  check('re-run skips the existing role', r.skipped === 1 && r.created === 1);
  check('re-run only builds the new role', r.tasks.length === 1 && r.tasks[0].assignedRole === 'quaestor');
  // Full re-run: everything already exists → nothing created.
  const allExisting = new Set([goalUpdateTaskId('social_chair', PERIOD), goalUpdateTaskId('quaestor', PERIOD)]);
  const r2 = generateWeeklyGoalUpdateTasks({ goals, periodKey: PERIOD, window: WINDOW, existingTaskIds: allExisting });
  check('full re-run creates nothing', r2.created === 0 && r2.skipped === 2 && r2.tasks.length === 0);
}

// ── roles restriction ─────────────────────────────────────────────────────────
{
  const goals: Goal[] = [
    goal({ id: 'g1', ownerRole: 'social_chair', status: 'active' }),
    goal({ id: 'g3', ownerRole: 'quaestor',    status: 'active' }),
  ];
  const r = generateWeeklyGoalUpdateTasks({ goals, periodKey: PERIOD, window: WINDOW, roles: ['quaestor'] });
  check('roles restriction limits to subset', r.created === 1 && r.tasks[0].assignedRole === 'quaestor');
}

// ── empty input ────────────────────────────────────────────────────────────────
{
  const r = generateWeeklyGoalUpdateTasks({ goals: [], periodKey: PERIOD, window: WINDOW });
  check('no goals → nothing created, no throw', r.created === 0 && r.skipped === 0 && r.tasks.length === 0);
}

console.log(`\ngoalUpdateGeneration.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
