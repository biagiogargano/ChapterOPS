/**
 * Isolated tests for lib/goalUpdateTasks.ts — dependency-free harness.
 * Pure goal-update task builder: deterministic ids, period sensitivity, active-only
 * generation, fail-safe on missing definition / unsupported owner role, structured /
 * no-proof / no-review shape. Fixed dates → deterministic.
 */

import {
  goalUpdateTaskId, buildGoalUpdateTask, shouldGenerateGoalUpdateTask,
  goalUpdateTaskTitle, goalUpdateTaskDescription, GOAL_UPDATE_TASK_PREFIX,
} from './goalUpdateTasks';
import { goalPeriodKey } from './goalHelpers';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { ROLE_LABELS } from './roles';
import type { Goal } from './goals';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id:                  'g1',
    orgId:               'org-1',
    title:               'Recruit 12 new members',
    ownerRole:           'recruitment_chair',
    cadence:             'weekly',
    status:              'active',
    updateDefinitionId:  WEEKLY_OFFICER_REPORT_ID,
    ...over,
  };
}

// ── Deterministic id ──────────────────────────────────────────────────────────
check('id = goalupd_<goalId>_<period>', goalUpdateTaskId('g1', '2026-W23') === 'goalupd_g1_2026-W23');
check('id carries the prefix', goalUpdateTaskId('g', 'p').startsWith(GOAL_UPDATE_TASK_PREFIX));
check('same goal + period → same id', goalUpdateTaskId('g1', 'p1') === goalUpdateTaskId('g1', 'p1'));
check('different period → different id', goalUpdateTaskId('g1', 'p1') !== goalUpdateTaskId('g1', 'p2'));
check('different goal → different id', goalUpdateTaskId('g1', 'p') !== goalUpdateTaskId('g2', 'p'));

// ── Title / description stable ────────────────────────────────────────────────
check('title from goal', goalUpdateTaskTitle(goal()) === 'Update: Recruit 12 new members');
check('description from goal', goalUpdateTaskDescription(goal()).includes('Recruit 12 new members'));
check('title fallback for empty', goalUpdateTaskTitle({ title: '  ' }) === 'Goal update');

// ── buildGoalUpdateTask: shape + determinism ──────────────────────────────────
{
  const t = buildGoalUpdateTask(goal(), '2026-W23', '2026-06-08');
  check('builds a task for a valid goal', t !== null);
  if (t) {
    check('deterministic id', t.id === 'goalupd_g1_2026-W23');
    check('type structured', t.type === 'structured');
    check('state assigned', t.state === 'assigned');
    check('assigned to owner role', t.assignedRole === 'recruitment_chair');
    check('assignedTo = role label', t.assignedTo === ROLE_LABELS.recruitment_chair);
    check('dueAt passed through', t.dueAt === '2026-06-08');
    check('no proof', t.requiresProof === false);
    check('no approval', t.requiresApproval === false);
    check('carries the update definition id', t.reportDefinitionId === WEEKLY_OFFICER_REPORT_ID);
    check('visibleTo includes the owner', (t.visibleTo as string[]).includes('recruitment_chair'));
    check('visibleTo includes leadership', (t.visibleTo as string[]).includes('president'));
  }
  // Determinism.
  const again = buildGoalUpdateTask(goal(), '2026-W23', '2026-06-08');
  check('same inputs → identical task', JSON.stringify(t) === JSON.stringify(again));
}

// ── Fail safe: unknown definition → null ──────────────────────────────────────
check('unknown update definition → null',
  buildGoalUpdateTask(goal({ updateDefinitionId: 'nope' }), 'p', '2026-06-08') === null);
check('missing update definition → null',
  buildGoalUpdateTask(goal({ updateDefinitionId: undefined }), 'p', '2026-06-08') === null);

// ── Fail safe: custom/unsupported owner role → null (ownership gap) ────────────
check('custom owner role → null (not a runtime Role)',
  buildGoalUpdateTask(goal({ ownerRole: 'vice_president' }), 'p', '2026-06-08') === null);
check('missing owner role → null',
  buildGoalUpdateTask(goal({ ownerRole: undefined }), 'p', '2026-06-08') === null);

// ── shouldGenerate: active + due + not-existing ───────────────────────────────
{
  const g = goal();
  const ref = D(2026, 6, 1);          // ISO W23
  check('active goal, no prior update → should generate',
    shouldGenerateGoalUpdateTask(g, ref, [], null) === true);
  check('completed goal → should NOT generate',
    shouldGenerateGoalUpdateTask(goal({ status: 'completed' }), ref, [], null) === false);
  check('archived goal → should NOT generate',
    shouldGenerateGoalUpdateTask(goal({ status: 'archived' }), ref, [], null) === false);
  check('unknown definition → should NOT generate',
    shouldGenerateGoalUpdateTask(goal({ updateDefinitionId: 'nope' }), ref, [], null) === false);
  check('custom owner role → should NOT generate',
    shouldGenerateGoalUpdateTask(goal({ ownerRole: 'event_chair' }), ref, [], null) === false);

  // Idempotent: this period's id already exists → skip.
  const id = goalUpdateTaskId(g.id, goalPeriodKey(g, ref));
  check('existing task id (array) → skip', shouldGenerateGoalUpdateTask(g, ref, [id], null) === false);
  check('existing task id (set) → skip', shouldGenerateGoalUpdateTask(g, ref, new Set([id]), null) === false);

  // Already updated this period → not due.
  const period = goalPeriodKey(g, ref);
  check('already updated this period → should NOT generate',
    shouldGenerateGoalUpdateTask(g, ref, [], period) === false);
  // Updated a DIFFERENT (prior) period → due again.
  check('prior-period update → should generate (new period)',
    shouldGenerateGoalUpdateTask(g, ref, [], '2026-W22') === true);
}

console.log(`\ngoalUpdateTasks.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
