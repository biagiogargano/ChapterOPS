/**
 * buildAgenda.ts — pure derivation of a read-only meeting agenda from REAL
 * events + tasks (adapted from the feature-branch prototype, trimmed to v1).
 *
 * No writes, no new task kind, no AI, no report dependency. Pure: takes plain
 * inputs (events, tasks, a state resolver, today's week-offset) so it's trivially
 * testable and store-agnostic. Surfaced read-only on chapter/eboard meeting
 * Event Detail — never a standalone tab.
 *
 * Report-derived sections (announcements / help-needed) are intentionally OMITTED
 * in v1 — they depend on the weekly-report work, which isn't built yet.
 */

import type { MockEvent } from '@/lib/mockEvents';
import type { MockTask, TaskState } from '@/lib/mockTasks';

export interface AgendaItem {
  id:    string;
  title: string;
  meta:  string;
  kind:  'event' | 'task';   // drives nav target on tap
}

export interface Agenda {
  oldBusiness: AgendaItem[];   // earlier-this-week events (already happened)
  newBusiness: AgendaItem[];   // remaining-this-week events (today → Sun)
  unresolved:  AgendaItem[];   // open/overdue role-specific tasks
  brotherWide: AgendaItem[];   // open chapter-wide ('all') tasks
}

// A task still needs attention in these states (mirrors the Tasks-tab "open" set).
const OPEN_STATES: TaskState[] = ['assigned', 'rejected', 'overdue', 'escalated'];

export interface BuildAgendaInput {
  events:      MockEvent[];
  tasks:       MockTask[];
  /** Resolve a task's effective (stored) state. */
  stateOf:     (t: MockTask) => TaskState;
  /** Today's offset within the current Mon-based week (0=Mon … 6=Sun). */
  todayOffset: number;
}

/**
 * Compute the meeting-agenda sections from current events + tasks. Events are
 * scoped to the CURRENT week (dayOffset 0–6); other weeks are out of scope for a
 * weekly meeting agenda. Tasks exclude workflow parents and event-attendance
 * lightweight tasks (RSVP / name-submission derive completion from RSVP state,
 * not task.state, so they'd be noise here). Open chapter-wide vs role-specific
 * tasks are split so the two task sections don't overlap.
 */
export function buildAgenda({ events, tasks, stateOf, todayOffset }: BuildAgendaInput): Agenda {
  const eventItem = (e: MockEvent): AgendaItem => ({
    id:    e.id,
    title: e.title,
    kind:  'event',
    meta:  `${e.time}${e.location ? ' · ' + e.location : ''}`,
  });
  const taskItem = (t: MockTask): AgendaItem => ({
    id:    t.id,
    title: t.title,
    kind:  'task',
    meta:  t.linkedEvent ? `${t.dueLabel} · ${t.linkedEvent}` : t.dueLabel,
  });

  const oldBusiness = events
    .filter(e => e.dayOffset >= 0 && e.dayOffset < todayOffset)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map(eventItem);

  const newBusiness = events
    .filter(e => e.dayOffset >= todayOffset && e.dayOffset <= 6)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map(eventItem);

  const actionable = tasks.filter(t =>
    !t.isWorkflowParent &&
    t.lightweightKind !== 'rsvp' &&
    t.lightweightKind !== 'name_submission',
  );
  const isOpen = (t: MockTask) => OPEN_STATES.includes(stateOf(t));

  const brotherWide = actionable
    .filter(t => t.assignedRole === 'all' && isOpen(t))
    .map(taskItem);

  const unresolved = actionable
    .filter(t => t.assignedRole !== 'all' && isOpen(t))
    .map(taskItem);

  return { oldBusiness, newBusiness, unresolved, brotherWide };
}

/** True when an agenda has nothing in any section. */
export function isAgendaEmpty(a: Agenda): boolean {
  return (
    a.oldBusiness.length === 0 &&
    a.newBusiness.length === 0 &&
    a.unresolved.length  === 0 &&
    a.brotherWide.length === 0
  );
}
