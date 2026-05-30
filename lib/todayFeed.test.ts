/**
 * Isolated tests for lib/todayFeed.ts — dependency-free harness. Covers Today's
 * bucket split, the action count, the urgent flag, and the summary text.
 */

import {
  bucketUrgencies,
  todaysTaskCount,
  todayIsUrgent,
  todaySummaryText,
} from './todayFeed';
import type { TaskUrgency } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── bucketUrgencies ───────────────────────────────────────────────────────────
{
  const us: TaskUrgency[] = ['overdue', 'overdue', 'today', 'week', 'week', 'week'];
  const b = bucketUrgencies(us);
  check('buckets overdue=2', b.overdue === 2);
  check('buckets today=1',   b.today === 1);
  check('buckets week=3',    b.week === 3);
}
check('empty buckets are zero', (() => {
  const b = bucketUrgencies([]);
  return b.overdue === 0 && b.today === 0 && b.week === 0;
})());

// ── todaysTaskCount (overdue + today + review; excludes week) ──────────────────
check('count = overdue + today + review',
  todaysTaskCount({ overdue: 2, today: 1, week: 5 }, 3) === 6);
check('count excludes week-out tasks',
  todaysTaskCount({ overdue: 0, today: 0, week: 4 }, 0) === 0);
check('count with only review', todaysTaskCount({ overdue: 0, today: 0, week: 0 }, 2) === 2);

// ── todayIsUrgent (only when overdue > 0) ─────────────────────────────────────
check('urgent when overdue present',  todayIsUrgent({ overdue: 1, today: 0, week: 0 }) === true);
check('NOT urgent for due-today only', todayIsUrgent({ overdue: 0, today: 3, week: 0 }) === false);
check('NOT urgent when empty',         todayIsUrgent({ overdue: 0, today: 0, week: 0 }) === false);

// ── todaySummaryText (omits zero segments; '' when nothing) ───────────────────
check('summary all three',
  todaySummaryText({ overdue: 2, today: 1, week: 9 }, 3) === '2 overdue  ·  1 due today  ·  3 to review');
check('summary omits zero overdue',
  todaySummaryText({ overdue: 0, today: 1, week: 0 }, 0) === '1 due today');
check('summary omits zero today + overdue, keeps review',
  todaySummaryText({ overdue: 0, today: 0, week: 0 }, 4) === '4 to review');
check('summary empty when nothing to act on',
  todaySummaryText({ overdue: 0, today: 0, week: 2 }, 0) === '');
// Week-out tasks never appear in the summary.
check('summary never mentions week',
  !todaySummaryText({ overdue: 1, today: 0, week: 7 }, 0).includes('week'));

console.log(`\ntodayFeed.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
