/**
 * taskListView.ts — pure filter/search/sort logic for the Tasks tab.
 *
 * Extracted verbatim from app/(tabs)/tasks.tsx so the list-shaping logic is
 * unit-testable and reused without the screen. No React, no stores, no I/O —
 * completion is resolved via the injected isCompleted predicate (the screen
 * passes isTaskCompleted), keeping this module store-free and pure.
 */

import { sortTasks, type MockTask, type TaskSortBy } from './mockTasks';

/** Tasks-tab status filter. "To Do" = not done; "Done" = done; "All" = both. */
export type StatusFilter = 'todo' | 'done' | 'all';

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'done', label: 'Done' },
  { id: 'all',  label: 'All' },
];

export const TASK_SORTS: { id: TaskSortBy; label: string }[] = [
  { id: 'due',   label: 'Due date' },
  { id: 'event', label: 'Event' },
  { id: 'type',  label: 'Type' },
];

/**
 * Does a task match the chosen status filter? "Done" uses the caller's single
 * source of truth for completion (isCompleted = isTaskCompleted: approved /
 * answered RSVP / saved date name). "To Do" is everything not done — so overdue,
 * rejected, and waiting-on-review all stay actionable. "All" shows both.
 */
export function matchesStatus(
  task: MockTask,
  filter: StatusFilter,
  isCompleted: (t: MockTask) => boolean,
): boolean {
  if (filter === 'all') return true;
  const done = isCompleted(task);
  return filter === 'done' ? done : !done;
}

/** Case-insensitive search over a task's title and linked-event title. */
export function matchesQuery(task: MockTask, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    task.title.toLowerCase().includes(q) ||
    (task.linkedEvent ?? '').toLowerCase().includes(q)
  );
}

/**
 * Apply the active status filter + search + sort to a list of tasks. Pure.
 * `isCompleted` is injected so this stays store-free (the screen passes a
 * role-bound isTaskCompleted).
 */
export function applyTaskView(
  tasks: MockTask[],
  filter: StatusFilter,
  sortBy: TaskSortBy,
  query: string,
  isCompleted: (t: MockTask) => boolean,
): MockTask[] {
  const filtered = tasks.filter(
    t => matchesStatus(t, filter, isCompleted) && matchesQuery(t, query),
  );
  return sortTasks(filtered, sortBy);
}
