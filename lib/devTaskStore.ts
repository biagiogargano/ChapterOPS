/**
 * Module-level dev store — persists task interaction state across navigation
 * within a session (resets on app reload). Lets Role A submit proof, then
 * Role B (reviewer) open the same task and see the submitted content.
 */
import { isPersistedTask, type TaskState } from '@/lib/mockTasks';
import { updateTaskState, type PersistedTaskState } from '@/lib/taskService';

export interface StoredTask {
  state:         TaskState;
  proofContent:  string;  // text/link entered by assignee
  rejectionNote: string;  // note written by reviewer on rejection
}

const _store: Record<string, StoredTask> = {};

/**
 * Seed interaction state from Supabase at startup so state, proofContent, and
 * rejectionNote survive reload. Skips ids that already have a local entry, so an
 * in-session edit is never clobbered by a slightly older persisted value.
 */
export function seedTaskStates(states: PersistedTaskState[]): void {
  for (const s of states) {
    if (_store[s.id]) continue;   // local write wins
    _store[s.id] = {
      state:         s.state,
      proofContent:  s.proofContent,
      rejectionNote: s.rejectionNote,
    };
  }
}

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
  // Persist interaction-state changes for Supabase-backed (structured) tasks.
  // Fire-and-forget (optimistic): the local write above is the source of truth
  // in-session. No-ops for non-persisted tasks (RSVP/name use rsvpStore; mock
  // fallback has no cache), and updateTaskState itself no-ops when unconfigured.
  if (isPersistedTask(taskId)) {
    void updateTaskState(taskId, patch);
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
