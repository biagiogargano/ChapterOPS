/**
 * Isolated tests for lib/taskListView.ts — dependency-free harness. Covers the
 * Tasks-tab status filter, search match, and combined filter+search+sort view.
 * Completion is injected (the screen passes isTaskCompleted), so tests control it.
 */

import {
  STATUS_FILTERS,
  TASK_SORTS,
  matchesStatus,
  matchesQuery,
  applyTaskView,
} from './taskListView';
import type { MockTask } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Minimal task factory (only fields the view logic reads).
function task(p: Partial<MockTask> & { id: string }): MockTask {
  return {
    title: p.title ?? p.id,
    type: 'structured',
    state: 'assigned',
    urgency: 'week',
    dueLabel: '',
    assignedRole: 'social_chair',
    assignedTo: 'Social Chair',
    visibleTo: 'all',
    description: '',
    ...p,
  } as MockTask;
}

// ── option lists ──────────────────────────────────────────────────────────────
check('status filters = todo/done/all',
  STATUS_FILTERS.map(f => f.id).join(',') === 'todo,done,all');
check('sorts = due/event/type',
  TASK_SORTS.map(s => s.id).join(',') === 'due,event,type');

// ── matchesStatus (completion injected) ───────────────────────────────────────
const t1 = task({ id: 't1' });
const doneSet = new Set(['t1']);
const isDone = (t: MockTask) => doneSet.has(t.id);
check('all → always matches',  matchesStatus(t1, 'all', isDone) === true);
check('done → matches done',   matchesStatus(t1, 'done', isDone) === true);
check('todo → excludes done',  matchesStatus(t1, 'todo', isDone) === false);
{
  const t2 = task({ id: 't2' });  // not in doneSet
  check('todo → matches not-done', matchesStatus(t2, 'todo', isDone) === true);
  check('done → excludes not-done', matchesStatus(t2, 'done', isDone) === false);
}

// ── matchesQuery (title + linked event, case-insensitive) ─────────────────────
const tq = task({ id: 'tq', title: 'Confirm Venue', linkedEvent: 'Spring Formal' });
check('empty query matches',        matchesQuery(tq, '') === true);
check('whitespace query matches',   matchesQuery(tq, '   ') === true);
check('title substring matches',    matchesQuery(tq, 'venue') === true);
check('event substring matches',    matchesQuery(tq, 'formal') === true);
check('case-insensitive',           matchesQuery(tq, 'CONFIRM') === true);
check('non-match excluded',         matchesQuery(tq, 'budget') === false);

// ── applyTaskView (filter + search + sort) ────────────────────────────────────
{
  const a = task({ id: 'a', title: 'Alpha', dueAt: '2030-01-03', linkedEvent: 'Zeta' });
  const b = task({ id: 'b', title: 'Bravo', dueAt: '2030-01-01', linkedEvent: 'Yarn' });
  const c = task({ id: 'c', title: 'Charlie', dueAt: '2030-01-02', linkedEvent: 'Xeno' });
  const all = [a, b, c];
  const noneDone = (_: MockTask) => false;

  // Sort by due date (ascending).
  const byDue = applyTaskView(all, 'all', 'due', '', noneDone);
  check('sort by due ascending', byDue.map(t => t.id).join(',') === 'b,c,a');

  // Filter to done with none done → empty.
  check('done filter with none done → empty',
    applyTaskView(all, 'done', 'due', '', noneDone).length === 0);

  // Search narrows the set.
  const searched = applyTaskView(all, 'all', 'due', 'bravo', noneDone);
  check('search narrows to one', searched.length === 1 && searched[0].id === 'b');

  // todo filter excludes a done task.
  const done = new Set(['a']);
  const someDone = (t: MockTask) => done.has(t.id);
  const todo = applyTaskView(all, 'todo', 'due', '', someDone);
  check('todo excludes the done task', !todo.some(t => t.id === 'a'));
}

console.log(`\ntaskListView.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
