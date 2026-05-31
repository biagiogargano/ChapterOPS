/**
 * reviewInbox.ts — pure aggregation for the Leadership Review Inbox / Command Center.
 *
 * Turns existing, real data (tasks + their live state, goals, agenda docs, notices) into the
 * actionable buckets a leadership review surface shows. PURE: no React, no store, no Supabase,
 * no I/O — the caller injects `stateOf` (the live task state from devTaskStore) and the
 * already-fetched goals/agenda/notice data. Never throws.
 *
 * Permissions are NOT changed here — it reuses lib/mockTasks.canApproveTask (named reviewer OR
 * leadership) so the inbox only surfaces what the viewer may actually act on.
 */

import { canApproveTask, type MockTask, type TaskState } from './mockTasks';
import { isGoalUpdateDefinitionId } from './goalUpdateGeneration';
import { isLeadershipRole, ROLES, type Role } from './roles';

/** Roles that get the Review Inbox: broad leadership (Consul/Pro Consul) + the Annotator. */
export function canAccessReviewInbox(role: Role): boolean {
  return isLeadershipRole(role) || role === ROLES.ANNOTATOR;
}

/** True when a task is a weekly goal-update (carries a goalupddef_ definition id). Pure. */
export function isGoalUpdateTask(task: Pick<MockTask, 'reportDefinitionId'>): boolean {
  return isGoalUpdateDefinitionId(task.reportDefinitionId);
}

/**
 * Tasks submitted and awaiting THIS viewer's review (named reviewer or leadership override),
 * by their LIVE state. Includes weekly goal updates AND any other approval-required task in
 * 'submitted'. Pure — `stateOf` resolves each task's effective state.
 */
export function pendingReviewTasks(
  tasks: MockTask[],
  role: Role,
  stateOf: (t: MockTask) => TaskState,
): MockTask[] {
  return (tasks ?? []).filter(t => stateOf(t) === 'submitted' && canApproveTask(t, role));
}

/**
 * Weekly goal-update tasks this viewer returned for changes (state 'rejected'), awaiting the
 * officer's revise + resubmit. Pure.
 */
export function returnedUpdateTasks(
  tasks: MockTask[],
  role: Role,
  stateOf: (t: MockTask) => TaskState,
): MockTask[] {
  return (tasks ?? []).filter(t => stateOf(t) === 'rejected' && isGoalUpdateTask(t) && canApproveTask(t, role));
}

// ─── Agenda action status ─────────────────────────────────────────────────────

export type AgendaActionStatus = 'not_saved' | 'needs_finalize' | 'finalized';

/** Classify a meeting's agenda doc (or absence) into an action status. Pure. */
export function agendaActionStatus(doc: { finalizedAt?: string | null } | null | undefined): AgendaActionStatus {
  if (!doc) return 'not_saved';
  return doc.finalizedAt ? 'finalized' : 'needs_finalize';
}

/** True when a meeting's agenda still needs leadership action (generate or finalize). Pure. */
export function agendaNeedsAction(status: AgendaActionStatus): boolean {
  return status === 'not_saved' || status === 'needs_finalize';
}

/** Short label for an agenda action status. Pure. */
export function agendaActionLabel(status: AgendaActionStatus): string {
  switch (status) {
    case 'not_saved':      return 'No agenda yet — generate one';
    case 'needs_finalize': return 'Saved — review & finalize';
    case 'finalized':      return 'Finalized';
  }
}

// ─── Counts ───────────────────────────────────────────────────────────────────

export interface ReviewInboxCounts {
  pendingReview:        number;
  returnedUpdates:      number;
  goalsNeedingAttention: number;
  agendasToPrepare:     number;
  recentNotices:        number;
  /** Total of the directly-actionable buckets (excludes informational notices). */
  actionable:           number;
}

/**
 * Aggregate the inbox counts from already-computed inputs. Pure; never throws. `actionable`
 * sums the things leadership should DO (reviews + returned + goals-attention + agendas-to-prep),
 * not informational notices.
 */
export function reviewInboxCounts(input: {
  pendingReview?:         number;
  returnedUpdates?:       number;
  goalsNeedingAttention?: number;
  agendasToPrepare?:      number;
  recentNotices?:         number;
}): ReviewInboxCounts {
  const pendingReview         = Math.max(0, input.pendingReview ?? 0);
  const returnedUpdates       = Math.max(0, input.returnedUpdates ?? 0);
  const goalsNeedingAttention = Math.max(0, input.goalsNeedingAttention ?? 0);
  const agendasToPrepare      = Math.max(0, input.agendasToPrepare ?? 0);
  const recentNotices         = Math.max(0, input.recentNotices ?? 0);
  return {
    pendingReview, returnedUpdates, goalsNeedingAttention, agendasToPrepare, recentNotices,
    actionable: pendingReview + returnedUpdates + goalsNeedingAttention + agendasToPrepare,
  };
}
