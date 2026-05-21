/**
 * Isolated tests for lib/generatedTasks.ts — dependency-free harness (no
 * framework). Compile with tsc to a temp dir, run with node; non-zero exit on
 * failure. Mirrors the lib/orgScope.test.ts pattern.
 */

import { buildRsvpReviewTask, rsvpReviewTaskId } from './generatedTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// A far-future date keeps urgency deterministically 'week' (independent of when
// the test runs) and gives an unambiguous day-before across a month boundary.
const event = {
  id:            'evt-123',
  title:         'Spring Formal',
  dateString:    '2999-06-01',
  createdByRole: 'social_chair' as const,
};

const task = buildRsvpReviewTask(event);

// Deterministic id (one-per-event, dedupable)
check('id is deterministic prefix+eventId', task.id === 'task_rsvpreview_evt-123');
check('rsvpReviewTaskId matches builder',   rsvpReviewTaskId(event.id) === task.id);

// Title
check('title is "Review RSVP list for [title]"', task.title === 'Review RSVP list for Spring Formal');

// Linkage (task → event only)
check('linkedEventId = event id',    task.linkedEventId === 'evt-123');
check('linkedEvent = event title',   task.linkedEvent === 'Spring Formal');

// Ownership: organizer is both assignee and creator
check('assignedRole = organizer',    task.assignedRole === 'social_chair');
check('createdByRole = organizer',   task.createdByRole === 'social_chair');
check('visibleTo includes organizer', Array.isArray(task.visibleTo) && task.visibleTo.includes('social_chair'));

// Shape: normal editable structured task, no approval for MVP
check('type structured',  task.type === 'structured');
check('state assigned',   task.state === 'assigned');
check('no approval',      task.requiresApproval === false);
check('no proof',         task.requiresProof === false);

// Due date = day before the event (crosses the month boundary: Jun 1 → May 31)
check('dueAt is day before event', task.dueAt === '2999-05-31');
check('urgency week (far future)', task.urgency === 'week');
check('dueLabel non-empty',        typeof task.dueLabel === 'string' && task.dueLabel.length > 0);

console.log(`\ngeneratedTasks.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
