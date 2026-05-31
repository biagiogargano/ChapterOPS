/**
 * agendaGoals.ts — pure derivation of "goals needing attention" for a meeting agenda.
 *
 * Product direction (agenda from real operational data): a meeting agenda should surface
 * goals that leadership ought to discuss — not every goal, just the ones that need a
 * decision or a nudge. This is the pure, store-agnostic seam for that section, the goal
 * analog of lib/agendaContributions (which pulls announcement/help-needed from update
 * answers). Like agendaContributions, "quiet" goals (healthy, in-progress) contribute
 * nothing — only goals that need attention surface, so the agenda stays signal.
 *
 * ⚠️ PURE FOUNDATION — NOT WIRED. The agenda screen (app/agenda/[eventId].tsx) renders
 *    buildAgenda (events + tasks) only; it does not fetch goals yet. Wiring this needs the
 *    agenda screen to fetch the org's goals (an existing leadership-readable RPC — verify
 *    on device first), then render goalsNeedingAttention(...). This module is the testable
 *    half. No React, no store, no Supabase, no I/O. Never throws.
 *
 * A goal needs attention when (active goals only):
 *   • needs_setup       — numeric goal with no usable target (can't track progress).
 *   • not_started       — has a target (or is a text goal) but shows no progress yet.
 *   • ready_to_complete — numeric goal that reached/passed its target but is still active.
 */

import { goalProgress, goalValueKind } from './goalHelpers';
import type { Goal } from './goals';

export type AgendaGoalReason = 'needs_setup' | 'not_started' | 'ready_to_complete';

export interface AgendaGoalItem {
  goalId:     string;
  title:      string;
  ownerRole?: Goal['ownerRole'];
  reason:     AgendaGoalReason;
}

/**
 * Why (if at all) a single goal needs agenda attention, or null if it's healthy /
 * inactive. Pure; never throws.
 */
export function goalAttentionReason(goal: Goal): AgendaGoalReason | null {
  if (goal.status !== 'active') return null;

  if (goalValueKind(goal) === 'text') {
    const cur = (goal.currentText ?? '').trim();
    return cur.length === 0 ? 'not_started' : null;   // text goals: only "not started" is derivable
  }

  // Numeric goal.
  const tgt = goal.targetValue;
  const hasTarget = typeof tgt === 'number' && Number.isFinite(tgt) && tgt > 0;
  if (!hasTarget) return 'needs_setup';

  if (goalProgress(goal).reached) return 'ready_to_complete';

  const cur = goal.currentValue;
  const started = typeof cur === 'number' && Number.isFinite(cur) && cur > 0;
  return started ? null : 'not_started';
}

/**
 * The active goals needing attention, in input order, as agenda items. Pure; never
 * throws. Healthy in-progress goals are omitted (quiet goals don't clutter the agenda).
 */
export function goalsNeedingAttention(goals: Goal[]): AgendaGoalItem[] {
  const out: AgendaGoalItem[] = [];
  for (const g of goals ?? []) {
    const reason = goalAttentionReason(g);
    if (!reason) continue;
    out.push({
      goalId: g.id,
      title: (g.title ?? '').trim(),
      ...(g.ownerRole ? { ownerRole: g.ownerRole } : {}),
      reason,
    });
  }
  return out;
}

/** Short human label for an attention reason (agenda chip). Pure. */
export function agendaGoalReasonLabel(reason: AgendaGoalReason): string {
  switch (reason) {
    case 'needs_setup':       return 'Needs a target';
    case 'not_started':       return 'Not started';
    case 'ready_to_complete': return 'Ready to complete';
  }
}
