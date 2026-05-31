/**
 * goalUpdateReview.ts — pure model for the weekly goal-update REVIEW stage.
 *
 * Product direction: a submitted weekly update shouldn't just vanish — leadership
 * (Annotator first, the agenda compiler in the Sigma Chi pack) should be able to review
 * it. This module is the pure, store-agnostic layer for that review status.
 *
 * V1 REVIEW MODEL (decided — see docs/GOALS_PERSISTENCE_PLAN.md):
 *   • Unit of review = the TASK (one goal-update task per officer role per week).
 *   • Primary reviewer = the **Annotator** (already in the submission read-set; compiles
 *     the agenda). President / Pro Consul may also review (broad leadership).
 *   • NO new schema and NO new task state: the existing task state machine already
 *     expresses the stages —
 *         assigned/overdue/escalated → not submitted
 *         submitted                  → pending review
 *         approved                   → reviewed (acknowledged)
 *         rejected                   → changes requested (officer resubmits)
 *     i.e. "reviewed" == the reviewer approving the submitted update.
 *
 * ⚠️ PURE FOUNDATION — NOT WIRED. The live goal-update form currently submits straight
 *    to `approved` (no review step). Turning on review means generation sets
 *    reviewerRole='annotator' + requiresApproval, the form submits to `submitted` (not
 *    `approved`), and Task Detail shows the reviewer approve/reject affordance for
 *    goal-update tasks. That wiring is deliberately held until the BASE submit
 *    round-trip is device-verified (so we don't layer an unverified review step on an
 *    unverified submit). This module encodes the model + copy + gating so the wiring is
 *    mechanical and tested. No React, no store, no Supabase, no push. Never throws.
 */

import { isLeadershipRole, type Role } from './roles';
import type { TaskState } from './mockTasks';   // type-only (erased) — no store dependency

/** The role that primarily reviews weekly goal updates in the alpha pack. */
export const GOAL_UPDATE_REVIEWER_ROLE: Role = 'annotator';

/** The review lifecycle of one goal-update task. */
export type GoalUpdateReviewStage =
  | 'not_submitted'      // officer hasn't submitted this week's update yet
  | 'pending_review'     // submitted; waiting for a reviewer
  | 'reviewed'           // a reviewer acknowledged it (approved)
  | 'changes_requested'; // a reviewer sent it back (rejected) — officer resubmits

/** Map a task's state to its review stage. Pure; total over TaskState. */
export function goalUpdateReviewStage(state: TaskState): GoalUpdateReviewStage {
  switch (state) {
    case 'submitted': return 'pending_review';
    case 'approved':  return 'reviewed';
    case 'rejected':  return 'changes_requested';
    // assigned / overdue / escalated → nothing submitted to review yet
    default:          return 'not_submitted';
  }
}

/** Short status label for the review stage (UI chip / line). Pure. */
export function reviewStageLabel(stage: GoalUpdateReviewStage): string {
  switch (stage) {
    case 'pending_review':    return 'Pending review';
    case 'reviewed':          return 'Reviewed';
    case 'changes_requested': return 'Changes requested';
    case 'not_submitted':     return 'Not submitted';
  }
}

/** One-line explanation for the review stage (helper text). Pure. */
export function reviewStageHint(stage: GoalUpdateReviewStage): string {
  switch (stage) {
    case 'pending_review':    return 'Submitted — waiting for leadership to review.';
    case 'reviewed':          return 'A reviewer has read this update.';
    case 'changes_requested': return 'Sent back for changes — update and resubmit.';
    case 'not_submitted':     return 'This week’s update hasn’t been submitted yet.';
  }
}

/**
 * May `role` review weekly goal updates? The Annotator (primary), plus broad leadership
 * (President / Pro Consul). Mirrors the submission read-set + canApproveTask's leadership
 * fallback. An explicit per-task reviewerRole also qualifies. Pure.
 */
export function canReviewGoalUpdate(role: Role, reviewerRole: Role = GOAL_UPDATE_REVIEWER_ROLE): boolean {
  return role === reviewerRole || role === GOAL_UPDATE_REVIEWER_ROLE || isLeadershipRole(role);
}

export interface GoalUpdateReviewView {
  stage:     GoalUpdateReviewStage;
  label:     string;
  hint:      string;
  /** True if `viewerRole` may act as a reviewer AND there is something to review now. */
  canReviewNow: boolean;
}

/**
 * Build the review view for a goal-update task from its state + the viewer. `canReviewNow`
 * is true only when the viewer can review AND the update is pending (submitted). Pure.
 */
export function goalUpdateReviewView(
  state: TaskState,
  viewerRole: Role,
  reviewerRole: Role = GOAL_UPDATE_REVIEWER_ROLE,
): GoalUpdateReviewView {
  const stage = goalUpdateReviewStage(state);
  return {
    stage,
    label: reviewStageLabel(stage),
    hint:  reviewStageHint(stage),
    canReviewNow: stage === 'pending_review' && canReviewGoalUpdate(viewerRole, reviewerRole),
  };
}
