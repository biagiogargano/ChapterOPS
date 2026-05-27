/**
 * Isolated tests for lib/taskCompletion.ts (isRsvpTaskExpired) — dependency-free
 * harness (no framework). Compile with tsc to a temp dir, run with node; non-zero
 * exit on failure. Mirrors the lib/positions.test.ts pattern.
 *
 * Regression: an RSVP / date-name task whose event has already passed must NOT
 * keep surfacing as active on Today / Calendar / Tasks; future + event-day are
 * still active; non-RSVP tasks are never hidden by this helper (commit e369a1d).
 */

import { isRsvpTaskExpired } from './taskCompletion';
import { addUserEvent } from './eventStore';
import type { MockTask } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

/** ISO YYYY-MM-DD for today + N days (local, midnight-anchored). */
function isoOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Create a user event on a given date; return its id (deterministic date math). */
function makeEvent(dateString: string): string {
  const created = addUserEvent({
    title:         `Test ${dateString}`,
    kind:          'chapter',
    audience:      'optional',        // optional → no RSVP-task side effects
    dateString,
    time:          '6:00 PM',
    location:      'X',
    description:   '',
    createdByRole: 'president',
    recurrence:    'none',
  });
  return created[0].id;
}

/** A minimal RSVP task linked to an event id. */
function rsvpTask(eventId: string, overrides: Partial<MockTask> = {}): MockTask {
  return {
    id:               `tc_${eventId}`,
    title:            'RSVP',
    type:             'lightweight',
    lightweightKind:  'rsvp',
    state:            'assigned',
    urgency:          'today',
    dueLabel:         '',
    assignedRole:     'all',
    assignedTo:       'All Members',
    visibleTo:        'all',
    description:      '',
    linkedEvent:      `Test`,
    linkedEventId:    eventId,
    requiresProof:    false,
    requiresApproval: false,
    createdByRole:    'president',
    ...overrides,
  };
}

const futureEvent = makeEvent(isoOffset(14));
const todayEvent  = makeEvent(isoOffset(0));
const pastEvent   = makeEvent(isoOffset(-14));

// RSVP tasks
check('rsvp · future event → active (not expired)', isRsvpTaskExpired(rsvpTask(futureEvent)) === false);
check('rsvp · event day  → active (not expired)',    isRsvpTaskExpired(rsvpTask(todayEvent))  === false);
check('rsvp · past event  → expired',                isRsvpTaskExpired(rsvpTask(pastEvent))   === true);

// name_submission behaves the same way (event-day-bound)
check('name_submission · past event → expired',
  isRsvpTaskExpired(rsvpTask(pastEvent, { id: 'tc_name', lightweightKind: 'name_submission' })) === true);

// A non-RSVP (structured) task is NEVER hidden by this helper, even on a past event.
check('structured task · past event → never expired by this helper',
  isRsvpTaskExpired(rsvpTask(pastEvent, { id: 'tc_struct', type: 'structured', lightweightKind: undefined })) === false);

// An RSVP task with no resolvable event → fail-open (not expired).
check('rsvp · unknown event → not expired (fail-open)',
  isRsvpTaskExpired(rsvpTask('no-such-event-id')) === false);

console.log(`\ntaskCompletion.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
