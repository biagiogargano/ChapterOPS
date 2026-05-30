/**
 * taskWindow.ts — pure helpers for a task's OPEN WINDOW (available-from → due).
 *
 * Weekly updates shouldn't be submittable before the period they cover (the user
 * doesn't want officers submitting Monday for work that happens all week). This adds
 * the pure logic for an optional "available from" date: a task with an availableAt in
 * the future is NOT YET OPEN; once reached it's OPEN until/through its due date.
 *
 * ⚠️ PURE FOUNDATION. No React/stores/Supabase. Persisting availableAt needs a schema
 *    column — see supabase/task_available_at_patch_draft.sql (DRAFT, not applied). The
 *    locked UI must stay gated on that column so we never fake a lock the data can't
 *    enforce. Caller supplies `now` (no Date.now() inside) → deterministic. Never throws.
 */

export type TaskOpenState = 'open' | 'not_yet_open' | 'overdue' | 'open_no_window';

export interface TaskWindowView {
  state: TaskOpenState;
  /** True if the task may be acted on now (open, overdue, or no window set). */
  canSubmit: boolean;
  /** Short status line for the UI ('' when nothing to show). */
  label: string;
}

/** Parse an ISO date/datetime to epoch ms, or null if absent/invalid. Pure. */
function toMs(d?: string | null): number | null {
  if (!d) return null;
  // Bare 'YYYY-MM-DD' → treat as local midnight (matches deriveDueMeta's parsing).
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Resolve a task's open state from its availableAt + dueAt as of `now`.
 *   • no availableAt              → 'open_no_window' (always submittable — today's behavior)
 *   • now < availableAt           → 'not_yet_open' (canSubmit false)
 *   • availableAt ≤ now, with due  → 'open' (or 'overdue' if past due, still submittable)
 * `dueAt`/`availableAt` are ISO 'YYYY-MM-DD' or full ISO. Pure; never throws.
 */
export function taskWindowView(
  availableAt: string | null | undefined,
  dueAt: string | null | undefined,
  now: Date,
): TaskWindowView {
  const nowMs = now.getTime();
  const availMs = toMs(availableAt);
  const dueMs = toMs(dueAt);

  if (availMs === null) {
    // No open window configured → behave exactly as today.
    if (dueMs !== null && nowMs > dueMs) return { state: 'overdue', canSubmit: true, label: 'Overdue' };
    return { state: 'open_no_window', canSubmit: true, label: '' };
  }

  if (nowMs < availMs) {
    return { state: 'not_yet_open', canSubmit: false, label: `Opens ${fmt(availableAt!)}` };
  }
  // Window has opened.
  if (dueMs !== null && nowMs > dueMs) return { state: 'overdue', canSubmit: true, label: 'Overdue' };
  return { state: 'open', canSubmit: true, label: dueAt ? `Open · due ${fmt(dueAt)}` : 'Open' };
}

/** True if a task can be submitted now given its window. Convenience over the view. */
export function isTaskOpen(
  availableAt: string | null | undefined,
  dueAt: string | null | undefined,
  now: Date,
): boolean {
  return taskWindowView(availableAt, dueAt, now).canSubmit;
}

/** Friendly short date for window labels (e.g. 'Jun 8'). Falls back to the raw value. */
function fmt(d: string): string {
  const ms = toMs(d);
  if (ms === null) return d;
  try {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}
