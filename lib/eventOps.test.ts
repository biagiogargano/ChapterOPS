/**
 * Isolated tests for lib/eventOps.ts — dependency-free harness (no framework).
 * Compile with tsc to a temp dir, run with node; non-zero exit on failure.
 * Pure (no stores/services loaded — eventOps uses type-only imports).
 */

import { summarizeEventOps, type RsvpLike, type TaskLike } from './eventOps';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

type R = RsvpLike;
type T = TaskLike;

// Empty input → all zeros.
{
  const s = summarizeEventOps([], []);
  check('empty rsvp total 0',        s.rsvp.total === 0);
  check('empty rsvp responded 0',    s.rsvp.responded === 0);
  check('empty rsvp attending 0',    s.rsvp.attending === 0);
  check('empty rsvp notAttending 0', s.rsvp.notAttending === 0);
  check('empty rsvp excused 0',      s.rsvp.excused === 0);
  check('empty rsvp noResponse 0',   s.rsvp.noResponse === 0);
  check('empty tasks total 0',       s.tasks.total === 0);
  check('empty tasks completed 0',   s.tasks.completed === 0);
  check('empty tasks open 0',        s.tasks.open === 0);
}

// RSVP counts: attending, not_attending (no excuse), excused (not_attending + excuse), no_response.
{
  const rsvps: R[] = [
    { status: 'attending' },
    { status: 'attending' },
    { status: 'not_attending' },                       // not attending, no excuse
    { status: 'not_attending', excuse: 'Lab exam' },   // excused
    { status: 'not_attending', excuse: '   ' },        // whitespace-only excuse → NOT excused
    { status: 'no_response' },
  ];
  const s = summarizeEventOps(rsvps, []);
  check('rsvp total = entries provided (6)', s.rsvp.total === 6);
  check('rsvp responded = non-no_response (5)', s.rsvp.responded === 5);
  check('rsvp attending = 2', s.rsvp.attending === 2);
  check('rsvp notAttending = 3 (incl excused)', s.rsvp.notAttending === 3);
  check('rsvp excused = 1 (non-empty excuse only)', s.rsvp.excused === 1);
  check('rsvp noResponse = 1', s.rsvp.noResponse === 1);
  check('excused is subset of notAttending', s.rsvp.excused <= s.rsvp.notAttending);
  check('responded + noResponse = total', s.rsvp.responded + s.rsvp.noResponse === s.rsvp.total);
}

// Task counts: approved = completed; everything else = open.
{
  const tasks: T[] = [
    { state: 'approved' },
    { state: 'approved' },
    { state: 'assigned' },
    { state: 'submitted' },
    { state: 'rejected' },
    { state: 'overdue' },
    { state: 'escalated' },
  ];
  const s = summarizeEventOps([], tasks);
  check('tasks total = 7', s.tasks.total === 7);
  check('tasks completed = approved (2)', s.tasks.completed === 2);
  check('tasks open = total - completed (5)', s.tasks.open === 5);
  check('completed + open = total', s.tasks.completed + s.tasks.open === s.tasks.total);
}

// Determinism: same input → same output (order-independent counting).
{
  const rsvps: R[] = [{ status: 'attending' }, { status: 'no_response' }];
  const tasks: T[] = [{ state: 'approved' }, { state: 'assigned' }];
  const a = summarizeEventOps(rsvps, tasks);
  const b = summarizeEventOps([...rsvps].reverse(), [...tasks].reverse());
  check('deterministic across orderings', JSON.stringify(a) === JSON.stringify(b));
}

console.log(`\neventOps.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
