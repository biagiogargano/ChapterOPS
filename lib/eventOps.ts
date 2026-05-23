/**
 * eventOps.ts — pure operational summary for the (future) Event Detail hub
 * status strip.
 *
 * ⚠️ STATUS: Checkpoint 3.4a groundwork — INERT. Exported and unit-tested, but
 *    NOTHING renders it yet. A later step (3.4b) wires it into the Event Detail
 *    "at-a-glance" strip. Pure: no stores/services, no I/O, no flag reads.
 *    Type-only imports keep it free of runtime dependencies (safe under node).
 *
 * It does NOT invent new data-model assumptions. It summarizes whatever RSVP
 * entries and linked tasks the caller passes, using the CURRENT shapes:
 *   - RsvpStatus is 'no_response' | 'attending' | 'not_attending' (there is no
 *     'maybe'/'going' status; "excused" is a not_attending entry that carries a
 *     non-empty excuse).
 *   - Task completion is derived from MockTask.state: 'approved' is the only
 *     terminal "done" state; everything else (assigned/submitted/rejected/
 *     overdue/escalated) counts as open/in-progress.
 *
 * Limitation — RSVP "total": there is no reliable source of the expected
 * responder count in the current data model. `rsvp.total` is therefore simply
 * the number of entries the caller provides. If the caller passes a roster
 * (incl. seeded 'no_response' rows) it equals the roster size; if it passes
 * only actual responses, it equals `responded`. Treat it as "entries provided",
 * not a guaranteed expected-roster count.
 */

import type { RsvpStatus } from './rsvpStore';
import type { TaskState } from './mockTasks';

/** Minimal RSVP input the summary reads (a real RsvpEntry satisfies this). */
export interface RsvpLike {
  status:  RsvpStatus;
  excuse?: string | null;
}

/** Minimal task input the summary reads (a real MockTask satisfies this). */
export interface TaskLike {
  state: TaskState;
}

export interface EventOpsSummary {
  rsvp: {
    total:        number;   // entries provided (see limitation in file header)
    responded:    number;   // status !== 'no_response'
    attending:    number;   // status === 'attending'
    notAttending: number;   // status === 'not_attending' (includes excused)
    excused:      number;   // not_attending AND a non-empty excuse (subset of notAttending)
    noResponse:   number;   // status === 'no_response'
  };
  tasks: {
    total:     number;
    completed: number;      // state === 'approved'
    open:      number;      // total - completed
  };
}

/** A non-empty excuse string marks a not_attending entry as "excused". */
function hasExcuse(e: RsvpLike): boolean {
  return typeof e.excuse === 'string' && e.excuse.trim().length > 0;
}

/**
 * Deterministic operational summary for an event. Safe on empty input (all
 * zeros). Pure — counts only; performs no I/O and mutates nothing.
 */
export function summarizeEventOps(
  rsvps: ReadonlyArray<RsvpLike>,
  tasks: ReadonlyArray<TaskLike>,
): EventOpsSummary {
  let attending = 0;
  let notAttending = 0;
  let excused = 0;
  let noResponse = 0;

  for (const r of rsvps) {
    switch (r.status) {
      case 'attending':
        attending++;
        break;
      case 'not_attending':
        notAttending++;
        if (hasExcuse(r)) excused++;
        break;
      case 'no_response':
      default:
        noResponse++;
        break;
    }
  }

  const total = rsvps.length;
  const responded = total - noResponse;

  let completed = 0;
  for (const t of tasks) {
    if (t.state === 'approved') completed++;
  }
  const tasksTotal = tasks.length;

  return {
    rsvp: { total, responded, attending, notAttending, excused, noResponse },
    tasks: { total: tasksTotal, completed, open: tasksTotal - completed },
  };
}
