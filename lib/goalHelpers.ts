/**
 * goalHelpers.ts — pure helpers over the inert Goal types (lib/goals).
 *
 * ⚠️ FOUNDATION — behavior-free. No UI, no storage, no Supabase, no generated tasks,
 *    no scheduler, no notifications, no app-screen imports. Pure functions a future
 *    Goals layer (helpers → tab → generation) will call. Never throws. See
 *    docs/GOALS_FIRST_SYSTEM_PLAN.md.
 *
 * The cadence/"due" logic is pure PERIOD BUCKETING (reusing the ISO-week/date
 * helpers from questionnaireCycle), NOT a scheduler — the caller supplies the
 * reference date and the goal's last-updated period; this just compares buckets.
 */

import type { Goal, GoalCadence } from './goals';
import { isoWeek, toISODate } from './questionnaireCycle';

// ─── 1. Bulk goal prompt parsing ──────────────────────────────────────────────

/**
 * Parse a bulk "quick add" input into normalized goal prompt strings. Splits on
 * newlines AND semicolons, trims each, drops empties, and de-duplicates exact
 * (post-trim) duplicates while preserving first-seen order. Pure.
 */
export function parseGoalPrompts(input: string): string[] {
  if (typeof input !== 'string' || input.trim() === '') return [];
  const parts = input.split(/[\n;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim();
    if (t === '' || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// ─── 2. Goal progress ─────────────────────────────────────────────────────────

export interface GoalProgress {
  /** Percent 0–100, clamped for display. null when not computable (no numeric target). */
  percent: number | null;
  /** Raw (unclamped) ratio × 100; lets the UI show ">100%". null when not computable. */
  rawPercent: number | null;
  /** True when current ≥ target (numeric target > 0). */
  reached: boolean;
  /** True when current exceeds target. */
  overTarget: boolean;
}

/**
 * Progress for a goal from its current/target values. Safe on missing/nonnumeric
 * values and target ≤ 0 (returns percent: null — "not measurable"). A numeric
 * current ≥ target > 0 reaches the goal; over-target reports rawPercent > 100 while
 * `percent` clamps to 100. Pure.
 */
export function goalProgress(goal: Pick<Goal, 'currentValue' | 'targetValue'>): GoalProgress {
  const cur = goal.currentValue;
  const tgt = goal.targetValue;
  const numeric = typeof cur === 'number' && Number.isFinite(cur)
    && typeof tgt === 'number' && Number.isFinite(tgt);
  if (!numeric || (tgt as number) <= 0) {
    return { percent: null, rawPercent: null, reached: false, overTarget: false };
  }
  const raw = ((cur as number) / (tgt as number)) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return {
    percent: clamped,
    rawPercent: raw,
    reached: (cur as number) >= (tgt as number),
    overTarget: (cur as number) > (tgt as number),
  };
}

// ─── 3. Cadence / update-due ──────────────────────────────────────────────────

/**
 * The period key a goal's update belongs to for a given date, by cadence:
 *   daily   → 'YYYY-MM-DD'
 *   weekly  → 'YYYY-Www'  (ISO week)
 *   monthly → 'YYYY-MM'
 *   custom  → 'custom:<n>:<dayBucket>' where dayBucket groups days into
 *             customPeriodDays-sized buckets from the epoch (deterministic, no
 *             scheduler). Falls back to daily when customPeriodDays is missing/≤0.
 * Pure; reference date supplied by the caller.
 */
export function goalPeriodKey(goal: Pick<Goal, 'cadence' | 'customPeriodDays'>, ref: Date): string {
  switch (goal.cadence) {
    case 'daily':
      return toISODate(ref);
    case 'weekly': {
      const { year, week } = isoWeek(ref);
      return `${year}-W${week < 10 ? '0' + week : week}`;
    }
    case 'monthly':
      return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    case 'custom': {
      const n = goal.customPeriodDays;
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return toISODate(ref);
      // Whole-day count since the epoch, bucketed into n-day windows (UTC-based so
      // it's tz-stable). Deterministic; not a real schedule.
      const dayNum = Math.floor(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()) / 86400000);
      return `custom:${n}:${Math.floor(dayNum / n)}`;
    }
    default:
      return toISODate(ref);
  }
}

/**
 * Is a goal update DUE as of `ref`? An update is due when the goal is active AND the
 * current period key differs from `lastUpdatePeriod` (i.e. no update exists yet for
 * the current period). With no prior update, an active goal is always due. Pure —
 * pure bucket comparison, NOT a scheduler.
 */
export function isGoalUpdateDue(
  goal: Pick<Goal, 'cadence' | 'customPeriodDays' | 'status'>,
  ref: Date,
  lastUpdatePeriod?: string | null,
): boolean {
  if (goal.status !== 'active') return false;
  const current = goalPeriodKey(goal, ref);
  return current !== (lastUpdatePeriod ?? null);
}

// ─── 4. Goal status ───────────────────────────────────────────────────────────

export function isGoalActive(goal: Pick<Goal, 'status'>): boolean {
  return goal.status === 'active';
}

export function isGoalCompleted(goal: Pick<Goal, 'status'>): boolean {
  return goal.status === 'completed';
}

/** A goal can be archived unless it is already archived. Pure. */
export function canArchiveGoal(goal: Pick<Goal, 'status'>): boolean {
  return goal.status !== 'archived';
}
