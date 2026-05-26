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
import { getAllEvents, resolveEventId } from './eventStore';
import { getEventDate } from './mockEvents';
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

/**
 * True when an event-linked RSVP / date-name task's event has already passed
 * (its day is strictly before today). Such tasks are no longer actionable — the
 * RSVP window is gone — so Today / Calendar / Tasks should stop surfacing them
 * as open work. Answered-vs-unanswered is handled separately by isTaskCompleted;
 * this is purely about the event being in the past.
 *
 * Fail-open: if the linked event can't be resolved, returns false (don't hide a
 * task we can't date). Only applies to 'rsvp' / 'name_submission' lightweight
 * tasks — every other task type returns false.
 */
export function isRsvpTaskExpired(t: MockTask): boolean {
  if (t.lightweightKind !== 'rsvp' && t.lightweightKind !== 'name_submission') return false;
  const eventKey = t.linkedEventId ?? t.linkedEvent;
  if (!eventKey) return false;
  const eid = resolveEventId(eventKey);
  const ev  = getAllEvents().find(e => e.id === eid);
  if (!ev) return false;
  const evDay = getEventDate(ev.dayOffset); evDay.setHours(0, 0, 0, 0);
  const today = new Date();              today.setHours(0, 0, 0, 0);
  return evDay.getTime() < today.getTime();
}
