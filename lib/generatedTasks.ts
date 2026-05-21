/**
 * generatedTasks.ts — Phase 3 (P3) event-generated task builders.
 *
 * ⚠️ STATUS: Step 1 groundwork only. This module is INERT — nothing imports
 *    buildRsvpReviewTask yet. It is a PURE builder: given an event-like input it
 *    returns a normal structured MockTask. It performs no I/O, mutates no store,
 *    and reads no flags, so importing it changes no runtime behavior. A later
 *    checkpoint wires it into the event-create flow (optimistic add + insertTask)
 *    and the event-delete cascade.
 *
 * MVP behavior (decided): when an event with RSVP enabled is created, generate
 * exactly ONE "Review RSVP list for [event title]" task, due the day before the
 * event, linked to the event, assigned to the organizer. For recurring events
 * the caller generates this for the PRIMARY/created event only (no per-instance
 * fan-out yet) — that decision lives in the future wiring layer, not here.
 *
 * Duplicate protection is by DETERMINISTIC id (`task_rsvpreview_${event.id}`):
 * the same event id always yields the same task id, so optimistic add,
 * hydration re-merge, and insert retry all collapse to a single task.
 */

import { deriveDueMeta, deriveVisibleTo, type MockTask } from './mockTasks';
import { ROLE_LABELS, type Role } from './roles';

/** Minimal event shape this builder needs (a structural subset of UserCreatedEvent). */
export interface RsvpReviewEventInput {
  id:            string;   // event instance id (deterministic task id derives from this)
  title:         string;   // event title (shown in the task title/description)
  dateString:    string;   // event date, ISO "YYYY-MM-DD"
  createdByRole: Role;     // organizer — becomes the task's assignee + creator
}

/** Stable id prefix so the generated review task is one-per-event and dedupable. */
export const RSVP_REVIEW_ID_PREFIX = 'task_rsvpreview_';

/** Deterministic id for an event's RSVP-review task. */
export function rsvpReviewTaskId(eventId: string): string {
  return `${RSVP_REVIEW_ID_PREFIX}${eventId}`;
}

/**
 * Return the calendar day before an ISO "YYYY-MM-DD" date, as ISO "YYYY-MM-DD".
 * Local-time arithmetic, matching deriveDueMeta's local Date parsing.
 */
function dayBefore(dateString: string): string {
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Build the "Review RSVP list for [event title]" task for an event.
 *
 * Pure: returns a fresh MockTask; adds nothing to any store and persists nothing.
 * The task is a normal editable structured task (type 'structured', no approval
 * for MVP), assigned to and created by the organizer, linked to the event by
 * both linkedEventId (instance key) and linkedEvent (title). Due the day before
 * the event; dueLabel/urgency are derived via the shared deriveDueMeta so the
 * label format matches every other task in the app.
 */
export function buildRsvpReviewTask(event: RsvpReviewEventInput): MockTask {
  const dueDate = dayBefore(event.dateString);
  const { dueLabel, urgency } = deriveDueMeta(dueDate);

  return {
    id:               rsvpReviewTaskId(event.id),
    title:            `Review RSVP list for ${event.title}`,
    type:             'structured',
    state:            'assigned',
    urgency,
    dueLabel,
    dueAt:            dueDate,
    assignedRole:     event.createdByRole,
    assignedTo:       ROLE_LABELS[event.createdByRole],
    visibleTo:        deriveVisibleTo(event.createdByRole),
    description:      `Review the RSVP list for ${event.title} and follow up on anyone who hasn't responded.`,
    linkedEvent:      event.title,
    linkedEventId:    event.id,
    requiresProof:    false,
    requiresApproval: false,   // MVP: no approval/reviewer
    createdByRole:    event.createdByRole,
  };
}
