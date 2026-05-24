/**
 * attendance/mockAttendanceTasks.ts — derive attendance tasks from events.
 * PROTOTYPE / pure. Read-only: turns qualifying events into Annotator-owned
 * attendance tasks with an event-relative window (opens at start, due ~1h after
 * end). Does NOT modify the real task engine/state machine. Demonstrates the
 * "features are tasks tied to events" principle (SPEC_FEATURE_INTEGRATION.md).
 */

import type { MockEvent } from '@/lib/mockEvents';

/** Attendance is owned by the Annotator. */
export const ATTENDANCE_OWNER_ROLE = 'annotator' as const;

/** Hours after an event ends that the attendance task stays due. */
export const DUE_OFFSET_HOURS = 1;

export type AttendanceStatus = 'scheduled' | 'open' | 'overdue';

export interface AttendanceTask {
  id:         string;
  eventId:    string;
  eventTitle: string;
  status:     AttendanceStatus;
  /** Human window description. */
  windowLabel: string;
}

/** Which events get an attendance task: chapter/eboard meetings + any mandatory event. */
export function qualifiesForAttendance(e: MockEvent): boolean {
  return e.kind === 'chapter' || e.kind === 'eboard' || e.audience === 'all';
}

/**
 * Derive attendance tasks for qualifying events. Status is computed from the
 * event's day relative to today (mock proxy for "opens at start / due 1h after
 * end"): future = scheduled, today = open, past = overdue-until-recorded.
 */
export function deriveAttendanceTasks(events: MockEvent[], todayOffset: number): AttendanceTask[] {
  return events
    .filter(qualifiesForAttendance)
    .map(e => {
      const status: AttendanceStatus =
        e.dayOffset > todayOffset ? 'scheduled' :
        e.dayOffset === todayOffset ? 'open' : 'overdue';
      const windowLabel =
        status === 'scheduled' ? `Opens when ${e.title} starts` :
        status === 'open'      ? `Open now · due ~${DUE_OFFSET_HOURS}h after it ends` :
                                 `Was due ~${DUE_OFFSET_HOURS}h after it ended`;
      return {
        id:         `attendance_${e.id}`,
        eventId:    e.id,
        eventTitle: e.title,
        status,
        windowLabel,
      };
    })
    .sort((a, b) => {
      // Open first, then scheduled, then overdue.
      const order: Record<AttendanceStatus, number> = { open: 0, scheduled: 1, overdue: 2 };
      return order[a.status] - order[b.status];
    });
}
