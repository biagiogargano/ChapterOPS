/**
 * myWork.ts — pure aggregation for the officer/member "My Work" hub.
 *
 * The assignee-facing counterpart to lib/reviewInbox: "what do I need to do?" for the current
 * role. Turns real existing data (tasks + live state + windows) into actionable buckets. PURE:
 * no React/store/Supabase — the caller injects `stateOf` (live task state) + `now`. Never throws.
 * Permissions unchanged: "mine" = isTaskAssignee (my role, or chapter-wide 'all').
 *
 * RSVP / name-submission lightweight tasks are EXCLUDED — their completion lives in rsvpStore
 * (not the task state machine), and they're already surfaced on Today/Event. This hub is about
 * structured work (tasks, weekly updates, goals).
 */

import { isTaskAssignee, isOverdue, type MockTask, type TaskState } from './mockTasks';
import { taskWindowView } from './taskWindow';
import { isGoalUpdateTask } from './reviewInbox';
import { toISODate } from './questionnaireCycle';
import type { Role } from './roles';

/** States where the task is waiting on ME to act (not submitted-for-review, not done). */
const ACTIONABLE_STATES: TaskState[] = ['assigned', 'overdue', 'escalated', 'rejected'];

/** Lightweight kinds whose completion is external (rsvpStore), excluded from this hub. */
function isExternalCompletionKind(task: Pick<MockTask, 'lightweightKind'>): boolean {
  return task.lightweightKind === 'rsvp' || task.lightweightKind === 'name_submission';
}

/** A task that belongs to MY responsibilities (assigned to my role or chapter-wide). Pure. */
export function isMyTask(task: MockTask, role: Role): boolean {
  return isTaskAssignee(task, role) && !isExternalCompletionKind(task);
}

/**
 * Does this task need MY action right now? True when its live state is actionable
 * (assigned/overdue/escalated/rejected — i.e. NOT submitted-for-review, NOT approved) AND its
 * open window has started (a not-yet-open task isn't actionable yet). Pure.
 */
export function taskNeedsMyAction(task: MockTask, stateOf: (t: MockTask) => TaskState, now: Date = new Date()): boolean {
  if (!ACTIONABLE_STATES.includes(stateOf(task))) return false;
  return taskWindowView(task.availableAt, task.dueAt, now).state !== 'not_yet_open';
}

/** My open, actionable tasks (mine + needs-action). Pure. */
export function myOpenTasks(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState, now: Date = new Date()): MockTask[] {
  return (tasks ?? []).filter(t => isMyTask(t, role) && taskNeedsMyAction(t, stateOf, now));
}

/** My overdue tasks (open + past due). Pure. */
export function myOverdueTasks(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState, now: Date = new Date()): MockTask[] {
  return myOpenTasks(tasks, role, stateOf, now).filter(t => isOverdue(t.dueAt, stateOf(t), now));
}

/** My tasks due within `withinDays` (open, not overdue, has a due date within the window). Pure. */
export function myDueSoonTasks(
  tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState,
  now: Date = new Date(), withinDays = 2,
): MockTask[] {
  const todayS = toISODate(now);
  const soonS  = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.max(0, withinDays)));
  return myOpenTasks(tasks, role, stateOf, now).filter(t => {
    if (!t.dueAt) return false;
    if (isOverdue(t.dueAt, stateOf(t), now)) return false;   // overdue is its own bucket
    const day = t.dueAt.slice(0, 10);
    return day >= todayS && day <= soonS;
  });
}

/** My tasks that aren't open yet (a future availableAt — e.g. a weekly update). Pure. */
export function myNotOpenTasks(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState, now: Date = new Date()): MockTask[] {
  return (tasks ?? []).filter(t => {
    if (!isMyTask(t, role)) return false;
    const st = stateOf(t);
    if (st === 'approved' || st === 'submitted') return false;   // done / under review → not "waiting to open"
    return taskWindowView(t.availableAt, t.dueAt, now).state === 'not_yet_open';
  });
}

// ─── Weekly goal-update status (mine) ─────────────────────────────────────────

/**
 * My weekly goal-update tasks that are fresh and OPEN to submit now (actionable + window open),
 * EXCLUDING returned/rejected ones (those have their own bucket — see myReturnedUpdates). Pure.
 */
export function myGoalUpdateTasks(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState, now: Date = new Date()): MockTask[] {
  return myOpenTasks(tasks, role, stateOf, now).filter(t => isGoalUpdateTask(t) && stateOf(t) !== 'rejected');
}

/** My weekly goal-update tasks submitted and awaiting leadership review. Pure. */
export function myInReviewUpdates(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState): MockTask[] {
  return (tasks ?? []).filter(t => isMyTask(t, role) && isGoalUpdateTask(t) && stateOf(t) === 'submitted');
}

/** My weekly goal-update tasks returned for changes (rejected) — I must revise + resubmit. Pure. */
export function myReturnedUpdates(tasks: MockTask[], role: Role, stateOf: (t: MockTask) => TaskState): MockTask[] {
  return (tasks ?? []).filter(t => isMyTask(t, role) && isGoalUpdateTask(t) && stateOf(t) === 'rejected');
}

// ─── Counts ───────────────────────────────────────────────────────────────────

export interface MyWorkCounts {
  overdue:       number;
  dueSoon:       number;
  returned:      number;
  openUpdates:   number;
  inReview:      number;
  notOpen:       number;
  /** Things needing action now (overdue + dueSoon + returned + openUpdates). */
  actionNow:     number;
}

/** Aggregate My Work counts from pre-computed inputs. Pure; clamps negatives. */
export function myWorkCounts(input: {
  overdue?: number; dueSoon?: number; returned?: number;
  openUpdates?: number; inReview?: number; notOpen?: number;
}): MyWorkCounts {
  const c = (n?: number) => Math.max(0, n ?? 0);
  const overdue = c(input.overdue), dueSoon = c(input.dueSoon), returned = c(input.returned);
  const openUpdates = c(input.openUpdates), inReview = c(input.inReview), notOpen = c(input.notOpen);
  return {
    overdue, dueSoon, returned, openUpdates, inReview, notOpen,
    actionNow: overdue + dueSoon + returned + openUpdates,
  };
}
