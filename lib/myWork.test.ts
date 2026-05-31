/**
 * Tests for lib/myWork — pure officer/member "My Work" aggregation.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  isMyTask, taskNeedsMyAction, myOpenTasks, myOverdueTasks, myDueSoonTasks,
  myNotOpenTasks, myGoalUpdateTasks, myInReviewUpdates, myReturnedUpdates, myWorkCounts,
} from './myWork';
import type { MockTask, TaskState } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const NOW = new Date(2026, 4, 20); // 2026-05-20
function iso(y: number, m: number, d: number): string { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function task(over: Partial<MockTask>): MockTask {
  return {
    id: 't', title: 'X', type: 'structured', state: 'assigned', urgency: 'week',
    dueLabel: 'Mon', assignedRole: 'social_chair', assignedTo: 'Social Chair',
    visibleTo: ['social_chair'], description: 'd', requiresProof: false,
    requiresApproval: false, createdByRole: 'social_chair', ...over,
  };
}
function goalUpdate(over: Partial<MockTask> = {}): MockTask {
  return task({ reportDefinitionId: 'goalupddef_social_chair__2026-W21', requiresApproval: true, reviewerRole: 'annotator', ...over });
}

// ── isMyTask: my role or 'all'; excludes rsvp/name-submission ─────────────────
{
  check('my role task is mine', isMyTask(task({ assignedRole: 'social_chair' }), 'social_chair'));
  check('chapter-wide (all) task is mine', isMyTask(task({ assignedRole: 'all' }), 'social_chair'));
  check('another role task is NOT mine', !isMyTask(task({ assignedRole: 'quaestor' }), 'social_chair'));
  check('rsvp lightweight excluded', !isMyTask(task({ assignedRole: 'social_chair', lightweightKind: 'rsvp' }), 'social_chair'));
  check('name_submission excluded', !isMyTask(task({ assignedRole: 'social_chair', lightweightKind: 'name_submission' }), 'social_chair'));
}

// ── taskNeedsMyAction: actionable states + window open ────────────────────────
{
  const stateOf = (t: MockTask) => t.state;
  check('assigned + no window → actionable', taskNeedsMyAction(task({ state: 'assigned' }), stateOf, NOW));
  check('rejected → actionable', taskNeedsMyAction(task({ state: 'rejected' }), stateOf, NOW));
  check('submitted → NOT actionable (waiting review)', !taskNeedsMyAction(task({ state: 'submitted' }), stateOf, NOW));
  check('approved → NOT actionable (done)', !taskNeedsMyAction(task({ state: 'approved' }), stateOf, NOW));
  check('not-yet-open → NOT actionable',
    !taskNeedsMyAction(task({ state: 'assigned', availableAt: iso(2026,5,25), dueAt: iso(2026,5,28) }), stateOf, NOW));
}

// ── open / overdue / due-soon ─────────────────────────────────────────────────
{
  const tasks: MockTask[] = [
    task({ id: 'overdue', dueAt: iso(2026,5,18) }),                          // past → overdue
    task({ id: 'today', dueAt: iso(2026,5,20) }),                            // today → due soon
    task({ id: 'soon', dueAt: iso(2026,5,21) }),                             // tomorrow → due soon
    task({ id: 'later', dueAt: iso(2026,5,30) }),                            // far → open, not soon
    task({ id: 'submitted', state: 'submitted', dueAt: iso(2026,5,18) }),    // not actionable
    task({ id: 'mine_none', assignedRole: 'quaestor', dueAt: iso(2026,5,18) }), // not mine
  ];
  const stateOf = (t: MockTask) => t.state;
  const open = myOpenTasks(tasks, 'social_chair', stateOf, NOW);
  check('open excludes submitted + not-mine', !open.some(t => t.id === 'submitted' || t.id === 'mine_none'));
  check('open includes the 4 actionable mine', open.length === 4);

  const overdue = myOverdueTasks(tasks, 'social_chair', stateOf, NOW);
  check('overdue = the past-due task', overdue.length === 1 && overdue[0].id === 'overdue');

  const soon = myDueSoonTasks(tasks, 'social_chair', stateOf, NOW, 2);
  check('due-soon = today + tomorrow (within 2 days), not overdue/later',
    soon.map(t => t.id).sort().join(',') === 'soon,today');
}

// ── not-open tasks ────────────────────────────────────────────────────────────
{
  const tasks: MockTask[] = [
    goalUpdate({ id: 'notopen', availableAt: iso(2026,5,25), dueAt: iso(2026,5,28) }),
    goalUpdate({ id: 'open', availableAt: iso(2026,5,18), dueAt: iso(2026,5,28) }),
    goalUpdate({ id: 'submitted', state: 'submitted', availableAt: iso(2026,5,25) }),  // not "waiting to open"
  ];
  const stateOf = (t: MockTask) => t.state;
  const notOpen = myNotOpenTasks(tasks, 'social_chair', stateOf, NOW);
  check('not-open = the future-availableAt task only', notOpen.length === 1 && notOpen[0].id === 'notopen');
}

// ── weekly goal-update status: open / in-review / returned ────────────────────
{
  const tasks: MockTask[] = [
    goalUpdate({ id: 'gu_open', availableAt: iso(2026,5,18), dueAt: iso(2026,5,28) }),  // open to submit
    goalUpdate({ id: 'gu_review', state: 'submitted' }),
    goalUpdate({ id: 'gu_returned', state: 'rejected' }),
    goalUpdate({ id: 'gu_done', state: 'approved' }),
    task({ id: 'plain_open', dueAt: iso(2026,5,21) }),  // not a goal update
  ];
  const stateOf = (t: MockTask) => t.state;
  check('open updates = gu_open (goal-update + actionable + window open)',
    myGoalUpdateTasks(tasks, 'social_chair', stateOf, NOW).map(t => t.id).join(',') === 'gu_open');
  check('in-review = gu_review', myInReviewUpdates(tasks, 'social_chair', stateOf).map(t => t.id).join(',') === 'gu_review');
  check('returned = gu_returned', myReturnedUpdates(tasks, 'social_chair', stateOf).map(t => t.id).join(',') === 'gu_returned');
  check('plain task is not a goal-update', !myGoalUpdateTasks(tasks, 'social_chair', stateOf, NOW).some(t => t.id === 'plain_open'));
}

// ── chapter-wide ('all') tasks are mine; goal-update overlap is the screen's to split ──
{
  const tasks: MockTask[] = [
    task({ id: 'all_overdue', assignedRole: 'all', dueAt: iso(2026,5,18) }),       // chapter-wide overdue → mine
    goalUpdate({ id: 'gu_overdue', state: 'rejected', dueAt: iso(2026,5,18) }),     // returned + overdue goal update
  ];
  const stateOf = (t: MockTask) => t.state;
  const open = myOpenTasks(tasks, 'social_chair', stateOf, NOW);
  check("chapter-wide 'all' task is mine + open", open.some(t => t.id === 'all_overdue'));
  // A rejected goal-update with a past due date is BOTH overdue (generic helper) AND returned;
  // the screen de-dups by filtering goal-updates out of the needs-action buckets.
  check('generic myOverdueTasks includes the overdue goal-update', myOverdueTasks(tasks, 'social_chair', stateOf, NOW).some(t => t.id === 'gu_overdue'));
  check('it is also in myReturnedUpdates', myReturnedUpdates(tasks, 'social_chair', stateOf).some(t => t.id === 'gu_overdue'));
  check('but NOT in myGoalUpdateTasks (returned excluded there)', !myGoalUpdateTasks(tasks, 'social_chair', stateOf, NOW).some(t => t.id === 'gu_overdue'));
}

// ── counts ────────────────────────────────────────────────────────────────────
{
  const c = myWorkCounts({ overdue: 2, dueSoon: 1, returned: 1, openUpdates: 1, inReview: 3, notOpen: 1 });
  check('actionNow = overdue+dueSoon+returned+openUpdates', c.actionNow === 2 + 1 + 1 + 1);
  check('inReview + notOpen carried but not in actionNow', c.inReview === 3 && c.notOpen === 1);
  const z = myWorkCounts({});
  check('empty → 0 actionNow', z.actionNow === 0);
  check('negatives clamped', myWorkCounts({ overdue: -5 }).overdue === 0);
}

console.log(`\nmyWork.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
