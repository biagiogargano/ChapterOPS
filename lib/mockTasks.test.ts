/**
 * Isolated tests for the addGeneratedTask helper in lib/mockTasks.ts —
 * dependency-free harness (no framework). Compile with tsc to a temp dir, run
 * with node; non-zero exit on failure. Mirrors the lib/orgScope.test.ts pattern.
 *
 * Scope: only the deterministic-id optimistic-add contract (dedup + tombstone).
 */

import { addGeneratedTask, deleteUserTask, type MockTask } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function makeTask(id: string): MockTask {
  return {
    id,
    title:        'Review RSVP list for X',
    type:         'structured',
    state:        'assigned',
    urgency:      'week',
    dueLabel:     'Mon, Jan 1',
    assignedRole: 'social_chair',
    assignedTo:   'Social Chair',
    visibleTo:    ['president', 'pro_consul', 'social_chair'],
    description:  'desc',
    linkedEvent:   'X',
    linkedEventId: 'evt-1',
    requiresProof:    false,
    requiresApproval: false,
    createdByRole:    'social_chair',
  };
}

// First insert: returns the inserted task.
const first = addGeneratedTask(makeTask('task_rsvpreview_evt-1'));
check('first insert returns the task', first?.id === 'task_rsvpreview_evt-1');

// Duplicate insert (same id): no duplicate; returns the already-present task.
const second = addGeneratedTask(makeTask('task_rsvpreview_evt-1'));
check('duplicate insert returns existing (same reference)', second === first);

// A different id inserts independently.
const other = addGeneratedTask(makeTask('task_rsvpreview_evt-2'));
check('different id inserts', other?.id === 'task_rsvpreview_evt-2');

// Tombstone: after delete, re-adding the same id is refused (returns undefined).
deleteUserTask('task_rsvpreview_evt-2');
const resurrect = addGeneratedTask(makeTask('task_rsvpreview_evt-2'));
check('deleted id is not resurrected', resurrect === undefined);

console.log(`\nmockTasks.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
