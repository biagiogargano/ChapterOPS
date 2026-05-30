/**
 * questionnaireCycle.ts — pure helpers for the MANUAL questionnaire-generation
 * trigger: a deterministic "current cycle" id and a default due date.
 *
 * This is NOT a scheduler. Nothing here runs on a timer or in the background — the
 * caller (a button press) passes "now" and gets a stable cycle key + due date for
 * that moment. Pure: no Date.now() inside (caller supplies the reference date), no
 * I/O, never throws. Generic — the cycle concept is org-neutral.
 */

/** Zero-pad a positive integer to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a Date as a local ISO 'YYYY-MM-DD' (no time, no timezone shift). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * ISO-8601 week number of `d` (weeks start Monday; week 1 contains the first
 * Thursday). Returns { year, week } where `year` is the ISO week-year (which can
 * differ from the calendar year in late December / early January). Pure.
 */
export function isoWeek(d: Date): { year: number; week: number } {
  // Work on a UTC copy so DST never shifts the day boundary.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // ISO weekday: Mon=1 … Sun=7.
  const day = t.getUTCDay() || 7;
  // Shift to the Thursday of this week (ISO weeks are anchored on Thursday).
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, week };
}

/**
 * Deterministic cycle key for a weekly questionnaire run, namespaced by template
 * so two different definitions never collide on the same (role, week). E.g.
 * `weekly_officer_report:2026-W22`. The reference date is supplied by the caller.
 */
export function weeklyCycleId(definitionId: string, ref: Date): string {
  const { year, week } = isoWeek(ref);
  return `${definitionId}:${year}-W${pad2(week)}`;
}

/**
 * A safe default due date for a weekly questionnaire: `daysAhead` days after the
 * reference date (default 7 — i.e. "due in a week"), as a local ISO date string.
 * Simple and documented; there is no stored per-org due-date preference yet, so
 * this is the agreed default for the manual trigger.
 */
export function defaultWeeklyDueDate(ref: Date, daysAhead = 7): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() + daysAhead);
  return toISODate(d);
}
