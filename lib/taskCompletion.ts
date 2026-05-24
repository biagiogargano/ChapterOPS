/**
 * taskCompletion.ts — single source of truth for "is this task completed?"
 *
 * Completion spans multiple stores, not just the structured state machine:
 *  - RSVP tasks complete via rsvpStore (responded attending/not-attending)
 *  - name_submission tasks complete when a date name is saved
 *  - structured / acknowledgment / yes-no tasks complete at state 'approved'
 *
 * Used by Today and the Tasks tab so completed work is hidden consistently.
 * Leaf module (imports the stores; nothing imports it) → no cycles.
 */

import { getStoredState } from './devTaskStore';
import { getRsvpEntry } from './rsvpStore';
import { resolveEventId } from './eventStore';
import type { MockTask } from './mockTasks';

export function isTaskCompleted(t: MockTask, role: string): boolean {
  const eventKey = t.linkedEventId ?? t.linkedEvent;
  if (t.lightweightKind === 'rsvp' && eventKey) {
    const st = getRsvpEntry(resolveEventId(eventKey), role).status;
    return st === 'attending' || st === 'not_attending';
  }
  if (t.lightweightKind === 'name_submission' && eventKey) {
    return getRsvpEntry(resolveEventId(eventKey), role).dateName.trim().length > 0;
  }
  return getStoredState(t.id, t.state) === 'approved';
}
