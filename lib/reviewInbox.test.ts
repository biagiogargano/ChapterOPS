/**
 * Tests for lib/reviewInbox — pure leadership review-inbox aggregation.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  canAccessReviewInbox, isGoalUpdateTask,
  pendingReviewTasks, returnedUpdateTasks,
  agendaActionStatus, agendaNeedsAction, agendaActionLabel,
  reviewInboxCounts,
} from './reviewInbox';
import type { MockTask, TaskState } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function task(over: Partial<MockTask>): MockTask {
  return {
    id: 't', title: 'X', type: 'structured', state: 'assigned', urgency: 'week',
    dueLabel: 'Mon', assignedRole: 'social_chair', assignedTo: 'Social Chair',
    visibleTo: ['social_chair', 'annotator', 'president', 'pro_consul'],
    description: 'd', requiresProof: false, requiresApproval: false, createdByRole: 'social_chair',
    ...over,
  };
}

// A review-required weekly goal-update task (as the generator builds it).
function goalUpdate(over: Partial<MockTask> = {}): MockTask {
  return task({
    reportDefinitionId: 'goalupddef_social_chair__2026-W22',
    requiresApproval: true, reviewerRole: 'annotator',
    ...over,
  });
}

// ── inbox access: leadership + annotator only ─────────────────────────────────
{
  check('president can access', canAccessReviewInbox('president'));
  check('pro_consul can access', canAccessReviewInbox('pro_consul'));
  check('annotator can access', canAccessReviewInbox('annotator'));
  check('ordinary officer cannot access', !canAccessReviewInbox('social_chair'));
  check('brother cannot access', !canAccessReviewInbox('brother'));
}

// ── isGoalUpdateTask ──────────────────────────────────────────────────────────
{
  check('goal-update task detected', isGoalUpdateTask(goalUpdate()));
  check('ordinary task not a goal update', !isGoalUpdateTask(task({ reportDefinitionId: 'weekly_officer_report' })));
  check('no reportDefinitionId → not a goal update', !isGoalUpdateTask(task({})));
}

// ── pendingReviewTasks: submitted + approvable, by live state ─────────────────
{
  const tasks: MockTask[] = [
    goalUpdate({ id: 'g_sub' }),       // submitted (via stateOf)
    goalUpdate({ id: 'g_assigned' }),  // still assigned
    goalUpdate({ id: 'g_approved' }),  // approved
    task({ id: 'plain_sub', requiresApproval: true, reviewerRole: 'quaestor' }),  // other approval task, submitted
    task({ id: 'no_review_sub', requiresApproval: false }),  // submitted but no review gate
  ];
  const states: Record<string, TaskState> = {
    g_sub: 'submitted', g_assigned: 'assigned', g_approved: 'approved',
    plain_sub: 'submitted', no_review_sub: 'submitted',
  };
  const stateOf = (t: MockTask) => states[t.id] ?? t.state;

  // Annotator (named reviewer for goal updates) + leadership override.
  const forAnnotator = pendingReviewTasks(tasks, 'annotator', stateOf);
  check('annotator sees the submitted goal update', forAnnotator.some(t => t.id === 'g_sub'));
  check('annotator does not see assigned/approved goal updates', !forAnnotator.some(t => t.id === 'g_assigned' || t.id === 'g_approved'));
  check('annotator does NOT see a plain task reviewed by another role', !forAnnotator.some(t => t.id === 'plain_sub'));
  check('no-review submitted task never appears', !forAnnotator.some(t => t.id === 'no_review_sub'));

  const forPresident = pendingReviewTasks(tasks, 'president', stateOf);
  check('president (leadership override) sees the submitted goal update', forPresident.some(t => t.id === 'g_sub'));
  check('president (leadership) also sees the other submitted approval task', forPresident.some(t => t.id === 'plain_sub'));

  const forOfficer = pendingReviewTasks(tasks, 'social_chair', stateOf);
  check('ordinary officer sees no review items', forOfficer.length === 0);
}

// ── returnedUpdateTasks: rejected goal-updates the viewer can review ──────────
{
  const tasks: MockTask[] = [
    goalUpdate({ id: 'g_rejected' }),
    goalUpdate({ id: 'g_submitted' }),
    task({ id: 'plain_rejected', requiresApproval: true, reviewerRole: 'annotator' }), // not a goal update
  ];
  const states: Record<string, TaskState> = { g_rejected: 'rejected', g_submitted: 'submitted', plain_rejected: 'rejected' };
  const stateOf = (t: MockTask) => states[t.id] ?? t.state;
  const returned = returnedUpdateTasks(tasks, 'annotator', stateOf);
  check('returned = the rejected goal update', returned.length === 1 && returned[0].id === 'g_rejected');
  check('returned excludes submitted goal updates', !returned.some(t => t.id === 'g_submitted'));
  check('returned excludes non-goal-update rejected tasks', !returned.some(t => t.id === 'plain_rejected'));
  check('ordinary officer sees no returned updates', returnedUpdateTasks(tasks, 'social_chair', stateOf).length === 0);
}

// ── agenda action status ──────────────────────────────────────────────────────
{
  check('no doc → not_saved', agendaActionStatus(null) === 'not_saved');
  check('undefined doc → not_saved', agendaActionStatus(undefined) === 'not_saved');
  check('saved unfinalized → needs_finalize', agendaActionStatus({ finalizedAt: null }) === 'needs_finalize');
  check('finalized → finalized', agendaActionStatus({ finalizedAt: '2026-05-30T00:00:00Z' }) === 'finalized');
  check('not_saved needs action', agendaNeedsAction('not_saved'));
  check('needs_finalize needs action', agendaNeedsAction('needs_finalize'));
  check('finalized does NOT need action', !agendaNeedsAction('finalized'));
  check('labels are non-empty', ['not_saved', 'needs_finalize', 'finalized'].every(s => agendaActionLabel(s as any).length > 0));
}

// ── counts: actionable excludes notices; clamps negatives ─────────────────────
{
  const c = reviewInboxCounts({ pendingReview: 3, returnedUpdates: 1, goalsNeedingAttention: 4, agendasToPrepare: 2, recentNotices: 5 });
  check('actionable sums the action buckets (not notices)', c.actionable === 3 + 1 + 4 + 2);
  check('recentNotices carried but not in actionable', c.recentNotices === 5);
  const empty = reviewInboxCounts({});
  check('all-empty → 0 actionable', empty.actionable === 0 && empty.pendingReview === 0);
  const neg = reviewInboxCounts({ pendingReview: -3 });
  check('negatives clamped to 0', neg.pendingReview === 0 && neg.actionable === 0);
}

console.log(`\nreviewInbox.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
