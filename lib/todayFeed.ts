/**
 * todayFeed.ts — pure helpers for the Today tab's grouping/labels.
 *
 * Keeps the display-decision logic (what counts as "today's work", whether the
 * section should read as urgent) out of the screen so it is unit-testable. No
 * React, no stores, no I/O — callers pass already-computed counts.
 */

import type { TaskUrgency } from './mockTasks';

/** Buckets for a member's OPEN personal tasks on Today. */
export interface TodayTaskBuckets {
  /** Past-due open tasks (most pressing). */
  overdue: number;
  /** Due today (not overdue). */
  today:   number;
  /** Due later this week. */
  week:    number;
}

/** Split a list of urgencies into Today's buckets. Pure. */
export function bucketUrgencies(urgencies: TaskUrgency[]): TodayTaskBuckets {
  const b: TodayTaskBuckets = { overdue: 0, today: 0, week: 0 };
  for (const u of urgencies) {
    if (u === 'overdue') b.overdue++;
    else if (u === 'today') b.today++;
    else b.week++;
  }
  return b;
}

/**
 * The count shown next to "TODAY'S TASKS": work the user should act on now =
 * overdue + due-today + anything awaiting their review. Week-out tasks live under
 * "Coming up" and are excluded here.
 */
export function todaysTaskCount(buckets: TodayTaskBuckets, reviewCount: number): number {
  return buckets.overdue + buckets.today + reviewCount;
}

/**
 * Should the "TODAY'S TASKS" header render as URGENT (red)? Only when there is
 * actually overdue work — due-today alone is normal, not alarming.
 */
export function todayIsUrgent(buckets: TodayTaskBuckets): boolean {
  return buckets.overdue > 0;
}

/**
 * Short, honest subtitle for the Today tasks section, e.g. "2 overdue · 1 due
 * today · 3 to review". Returns '' when there is nothing to act on. Omits any
 * zero segment so the line never reads "0 overdue".
 */
export function todaySummaryText(buckets: TodayTaskBuckets, reviewCount: number): string {
  const parts: string[] = [];
  if (buckets.overdue > 0) parts.push(`${buckets.overdue} overdue`);
  if (buckets.today   > 0) parts.push(`${buckets.today} due today`);
  if (reviewCount     > 0) parts.push(`${reviewCount} to review`);
  return parts.join('  ·  ');
}
