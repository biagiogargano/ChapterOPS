/**
 * Tests for lib/goalUpdateReview — the pure weekly goal-update review model.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  GOAL_UPDATE_REVIEWER_ROLE,
  goalUpdateReviewStage, reviewStageLabel, reviewStageHint,
  canReviewGoalUpdate, goalUpdateReviewView,
} from './goalUpdateReview';
import type { TaskState } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── stage mapping is total over TaskState ─────────────────────────────────────
{
  check('assigned → not_submitted',  goalUpdateReviewStage('assigned') === 'not_submitted');
  check('overdue → not_submitted',   goalUpdateReviewStage('overdue') === 'not_submitted');
  check('escalated → not_submitted', goalUpdateReviewStage('escalated') === 'not_submitted');
  check('submitted → pending_review', goalUpdateReviewStage('submitted') === 'pending_review');
  check('approved → reviewed',        goalUpdateReviewStage('approved') === 'reviewed');
  check('rejected → changes_requested', goalUpdateReviewStage('rejected') === 'changes_requested');
  // Total: every TaskState yields a non-empty label + hint.
  const states: TaskState[] = ['assigned', 'submitted', 'approved', 'rejected', 'overdue', 'escalated'];
  check('every state has a non-empty label', states.every(s => reviewStageLabel(goalUpdateReviewStage(s)).length > 0));
  check('every state has a non-empty hint', states.every(s => reviewStageHint(goalUpdateReviewStage(s)).length > 0));
}

// ── reviewer authority: Annotator primary + broad leadership ──────────────────
{
  check('reviewer role is annotator', GOAL_UPDATE_REVIEWER_ROLE === 'annotator');
  check('annotator can review', canReviewGoalUpdate('annotator'));
  check('president can review', canReviewGoalUpdate('president'));
  check('pro_consul can review', canReviewGoalUpdate('pro_consul'));
  check('ordinary officer cannot review', !canReviewGoalUpdate('social_chair'));
  check('brother cannot review', !canReviewGoalUpdate('brother'));
  // An explicit per-task reviewer role also qualifies that role.
  check('explicit reviewerRole qualifies', canReviewGoalUpdate('quaestor', 'quaestor'));
  check('non-reviewer still blocked with explicit reviewer set', !canReviewGoalUpdate('kustos', 'quaestor'));
}

// ── view: canReviewNow only when pending AND viewer can review ────────────────
{
  const annotatorPending = goalUpdateReviewView('submitted', 'annotator');
  check('annotator + submitted → canReviewNow', annotatorPending.canReviewNow === true);
  check('view carries pending label', annotatorPending.label === 'Pending review');

  const annotatorReviewed = goalUpdateReviewView('approved', 'annotator');
  check('annotator + approved → not canReviewNow (already reviewed)', annotatorReviewed.canReviewNow === false);
  check('reviewed stage', annotatorReviewed.stage === 'reviewed');

  const officerPending = goalUpdateReviewView('submitted', 'social_chair');
  check('officer + submitted → cannot review', officerPending.canReviewNow === false);

  const annotatorNotSubmitted = goalUpdateReviewView('assigned', 'annotator');
  check('nothing submitted → cannot review yet', annotatorNotSubmitted.canReviewNow === false);
}

console.log(`\ngoalUpdateReview.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
