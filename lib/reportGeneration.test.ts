/**
 * Isolated tests for lib/reportGeneration.ts — dependency-free harness.
 * Verifies controlled report-task generation + idempotency (same role+cycle
 * never duplicates) over the real in-memory task store. Supabase is unconfigured
 * in the runner, so insertTask is a no-op and generation stays local.
 */

import {
  generateReportTasks,
  generateWeeklyOfficerReports,
} from './reportGeneration';
import { reportTaskId } from './reportTasks';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { getAllTasks } from './mockTasks';
import { OFFICER_ROLES, ROLES } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const ORG = 'org-1';
// Unique cycles per test block so store state from one block can't affect another.

// ── Single-role generation ────────────────────────────────────────────────────
{
  const cycle = '2099-W01';
  const res = generateReportTasks({ orgId: ORG, cycle, dueDate: '2099-01-04', roles: [ROLES.SOCIAL_CHAIR] });
  check('creates one task for one role', res.created.length === 1 && res.skipped.length === 0);
  const t = res.created[0];
  check('task has deterministic id', t.id === reportTaskId(ROLES.SOCIAL_CHAIR, cycle));
  check('task assigned to the role', t.assignedRole === ROLES.SOCIAL_CHAIR);
  check('task carries reportDefinitionId', t.reportDefinitionId === WEEKLY_OFFICER_REPORT_ID);
  check('task is structured, not proof/review',
    t.type === 'structured' && t.requiresProof === false && t.requiresApproval === false);
  check('task is now in the store', getAllTasks().some(x => x.id === t.id));
}

// ── Idempotency: same role + cycle does not duplicate ─────────────────────────
{
  const cycle = '2099-W02';
  const first  = generateReportTasks({ orgId: ORG, cycle, dueDate: '2099-01-11', roles: [ROLES.QUAESTOR] });
  const second = generateReportTasks({ orgId: ORG, cycle, dueDate: '2099-01-11', roles: [ROLES.QUAESTOR] });
  check('first call creates', first.created.length === 1);
  check('second call creates nothing', second.created.length === 0);
  check('second call skips the existing id', second.skipped.includes(reportTaskId(ROLES.QUAESTOR, cycle)));
  const count = getAllTasks().filter(x => x.id === reportTaskId(ROLES.QUAESTOR, cycle)).length;
  check('only one task exists for role+cycle', count === 1);
}

// ── Different cycles for the same role → distinct tasks ────────────────────────
{
  const a = generateReportTasks({ orgId: ORG, cycle: '2099-W03', dueDate: '2099-01-18', roles: [ROLES.KUSTOS] });
  const b = generateReportTasks({ orgId: ORG, cycle: '2099-W04', dueDate: '2099-01-25', roles: [ROLES.KUSTOS] });
  check('different cycles create distinct tasks',
    a.created.length === 1 && b.created.length === 1 && a.created[0].id !== b.created[0].id);
}

// ── Multi-role weekly convenience ─────────────────────────────────────────────
{
  const cycle = '2099-W05';
  const res = generateWeeklyOfficerReports(ORG, cycle, '2099-02-01');
  check('weekly creates one task per officer role', res.created.length === OFFICER_ROLES.length);
  check('all created carry the weekly definition',
    res.created.every(t => t.reportDefinitionId === WEEKLY_OFFICER_REPORT_ID));
  check('all created are assigned to officer roles',
    res.created.every(t => OFFICER_ROLES.includes(t.assignedRole as any)));
  // Re-run → all skipped, none duplicated.
  const again = generateWeeklyOfficerReports(ORG, cycle, '2099-02-01');
  check('weekly re-run creates nothing', again.created.length === 0);
  check('weekly re-run skips all', again.skipped.length === OFFICER_ROLES.length);
}

// ── Unknown definition → fail safe (no tasks) ─────────────────────────────────
{
  const res = generateReportTasks({
    orgId: ORG, cycle: '2099-W06', dueDate: '2099-02-08',
    roles: [ROLES.TRIBUNE], definitionId: 'does_not_exist',
  });
  check('unknown definition creates nothing', res.created.length === 0 && res.skipped.length === 0);
}

console.log(`\nreportGeneration.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
