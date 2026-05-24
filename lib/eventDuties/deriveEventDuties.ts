/**
 * eventDuties/deriveEventDuties.ts — what tasks an event auto-generates.
 * PROTOTYPE / pure. Given an event, returns the role-owned "duty" tasks it should
 * spin up (attendance, RSVP, safety, headcount, minutes…), each with an owner and
 * an event-relative timing note. Read-only; demonstrates the "features are tasks
 * tied to events" principle (SPEC_FEATURE_INTEGRATION.md). No task-engine changes.
 */

import type { MockEvent } from '@/lib/mockEvents';
import type { Role } from '@/lib/roles';

export interface EventDuty {
  id:        string;
  label:     string;
  owner:     Role | 'all';
  timing:    string;        // when it opens / is due, relative to the event
  /** Optional in-app route this duty opens (prototype tie-in). */
  route?:    string;
}

/** Derive the duty tasks a given event would generate. */
export function deriveEventDuties(e: MockEvent): EventDuty[] {
  const duties: EventDuty[] = [];
  const mandatory = e.audience === 'all';
  const officers  = e.audience === 'officers';
  const meeting   = e.kind === 'chapter' || e.kind === 'eboard';

  // RSVP — head count for mandatory/officer events.
  if (mandatory || officers) {
    duties.push({
      id: `rsvp_${e.id}`,
      label: 'RSVP / head count',
      owner: officers ? 'all' : 'all',
      timing: 'Due before the event starts',
    });
  }

  // Attendance — Annotator, for meetings + any mandatory event.
  if (meeting || mandatory) {
    duties.push({
      id: `attendance_${e.id}`,
      label: 'Take attendance',
      owner: 'annotator',
      timing: 'Opens at start · due ~1h after it ends',
      route: '/checkin',
    });
  }

  // Minutes & agenda sign-off — Annotator, for chapter/eboard meetings.
  if (meeting) {
    duties.push({
      id: `minutes_${e.id}`,
      label: 'Minutes & agenda sign-off',
      owner: 'annotator',
      timing: 'Due ~1 day after the meeting',
      route: '/agenda',
    });
  }

  // Safety checklist — Risk Manager, for social/risk events.
  if (e.kind === 'social' || e.kind === 'risk') {
    duties.push({
      id: `safety_${e.id}`,
      label: 'Safety checklist',
      owner: 'risk_manager',
      timing: 'Due before the event starts',
    });
  }

  // Headcount & logistics — Social Chair, for social events.
  if (e.kind === 'social') {
    duties.push({
      id: `logistics_${e.id}`,
      label: 'Headcount & logistics',
      owner: 'social_chair',
      timing: 'Due a few days before',
    });
  }

  return duties;
}
