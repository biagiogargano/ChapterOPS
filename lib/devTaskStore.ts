/**
 * Module-level dev store — persists task interaction state across navigation
 * within a session (resets on app reload). Lets Role A submit proof, then
 * Role B (reviewer) open the same task and see the submitted content.
 */
import type { TaskState } from '@/lib/mockTasks';

export interface StoredTask {
  state:         TaskState;
  proofContent:  string;  // text/link entered by assignee
  rejectionNote: string;  // note written by reviewer on rejection
}

const _store: Record<string, StoredTask> = {};

export function loadTaskState(
  taskId:   string,
  defaults: { state: TaskState },
): StoredTask {
  if (!_store[taskId]) {
    _store[taskId] = {
      state:         defaults.state,
      proofContent:  '',
      rejectionNote: '',
    };
  }
  return { ..._store[taskId] };
}

export function saveTaskState(taskId: string, patch: Partial<StoredTask>): void {
  if (_store[taskId]) {
    _store[taskId] = { ..._store[taskId], ...patch };
  }
}

/**
 * Read the currently stored state for a task without initialising an entry.
 * Falls back to the provided default (i.e. the mock task's original state).
 */
export function getStoredState(taskId: string, defaultState: TaskState): TaskState {
  return _store[taskId]?.state ?? defaultState;
}

/**
 * Read the currently stored proofContent without initialising an entry.
 */
export function getStoredProof(taskId: string): string {
  return _store[taskId]?.proofContent ?? '';
}
