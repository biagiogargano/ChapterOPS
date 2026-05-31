/**
 * Tests for lib/agendaGoals — pure "goals needing attention" for the meeting agenda.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import { goalAttentionReason, goalsNeedingAttention, agendaGoalReasonLabel } from './agendaGoals';
import type { Goal } from './goals';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function goal(over: Partial<Goal>): Goal {
  return {
    id: 'g', orgId: 'o', title: 'Goal', status: 'active', cadence: 'weekly',
    valueKind: 'numeric', ...over,
  } as Goal;
}

// ── numeric: needs_setup / not_started / in-progress / ready_to_complete ───────
{
  check('numeric no target → needs_setup',
    goalAttentionReason(goal({ targetValue: undefined, currentValue: 0 })) === 'needs_setup');
  check('numeric target<=0 → needs_setup',
    goalAttentionReason(goal({ targetValue: 0, currentValue: 0 })) === 'needs_setup');
  check('numeric target set, current 0 → not_started',
    goalAttentionReason(goal({ targetValue: 12, currentValue: 0 })) === 'not_started');
  check('numeric target set, current undefined → not_started',
    goalAttentionReason(goal({ targetValue: 12, currentValue: undefined })) === 'not_started');
  check('numeric in progress → null (healthy, no attention)',
    goalAttentionReason(goal({ targetValue: 12, currentValue: 5 })) === null);
  check('numeric reached target → ready_to_complete',
    goalAttentionReason(goal({ targetValue: 12, currentValue: 12 })) === 'ready_to_complete');
  check('numeric over target → ready_to_complete',
    goalAttentionReason(goal({ targetValue: 12, currentValue: 15 })) === 'ready_to_complete');
}

// ── text goals: only "not started" is derivable ───────────────────────────────
{
  check('text empty current → not_started',
    goalAttentionReason(goal({ valueKind: 'text', currentText: '', targetText: 'Booked' })) === 'not_started');
  check('text whitespace current → not_started',
    goalAttentionReason(goal({ valueKind: 'text', currentText: '   ' })) === 'not_started');
  check('text with progress → null',
    goalAttentionReason(goal({ valueKind: 'text', currentText: 'Deposit paid' })) === null);
}

// ── inactive goals never need attention ───────────────────────────────────────
{
  check('completed goal → null', goalAttentionReason(goal({ status: 'completed', targetValue: 12, currentValue: 0 })) === null);
  check('archived goal → null', goalAttentionReason(goal({ status: 'archived', targetValue: 12, currentValue: 0 })) === null);
}

// ── goalsNeedingAttention: filters + maps, preserves order, carries owner ──────
{
  const goals: Goal[] = [
    goal({ id: 'a', title: 'Recruit 12', targetValue: 12, currentValue: 0, ownerRole: 'recruitment_chair' }), // not_started
    goal({ id: 'b', title: 'In progress', targetValue: 10, currentValue: 5 }),                                  // healthy → omitted
    goal({ id: 'c', title: 'Hit target', targetValue: 3, currentValue: 3 }),                                    // ready_to_complete
    goal({ id: 'd', title: 'No target' }),                                                                       // needs_setup
    goal({ id: 'e', title: 'Done goal', status: 'completed', targetValue: 5, currentValue: 0 }),                 // inactive → omitted
  ];
  const items = goalsNeedingAttention(goals);
  check('only attention-worthy active goals returned', items.length === 3);
  check('order preserved (a,c,d)', items.map(i => i.goalId).join(',') === 'a,c,d');
  check('reasons mapped', items[0].reason === 'not_started' && items[1].reason === 'ready_to_complete' && items[2].reason === 'needs_setup');
  check('ownerRole carried when present', items[0].ownerRole === 'recruitment_chair');
  check('ownerRole omitted when absent', !('ownerRole' in items[1]) || items[1].ownerRole === undefined);
  check('empty input → []', goalsNeedingAttention([]).length === 0);
}

// ── labels ────────────────────────────────────────────────────────────────────
{
  check('label needs_setup', agendaGoalReasonLabel('needs_setup') === 'Needs a target');
  check('label not_started', agendaGoalReasonLabel('not_started') === 'Not started');
  check('label ready_to_complete', agendaGoalReasonLabel('ready_to_complete') === 'Ready to complete');
}

console.log(`\nagendaGoals.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
