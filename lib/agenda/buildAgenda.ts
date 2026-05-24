/**
 * agenda/buildAgenda.ts — pure aggregation for the Meeting Agenda prototype.
 * PROTOTYPE ONLY (see SPEC_MEETING_AGENDA_AUTOPOPULATION.md).
 *
 * Read-only rollup of existing events + tasks into agenda sections. No writes,
 * no AI, no new task kind. Pure: takes plain inputs so it's trivially testable
 * and has no React/store coupling. The report-derived sections (announcements /
 * help-needed) are intentionally omitted — they depend on #6 (questionnaires).
 *
 * Not wired into phase-2 / the alpha; the screen that calls this is dev-only.
 */

import type { MockEvent } from '@/lib/mockEvents';
import type { MockTask, TaskState } from '@/lib/mockTasks';

export interface AgendaItem {
  id:    string;
  title: string;
  meta:  string;
  /** Where tapping should route ('event' → /event/:id, 'task' → /task/:id). */
  kind:  'event' | 'task';
}

export interface Agenda {
  oldBusiness: AgendaItem[];   // past-week events
  newBusiness: AgendaItem[];   // upcoming events (this week)
  brotherWide: AgendaItem[];   // chapter-wide tasks
  unresolved:  AgendaItem[];   // still-open / overdue tasks
}

const OPEN_STATES: TaskState[] = ['assigned', 'rejected', 'overdue', 'escalated'];

export interface BuildAgendaInput {
  events:      MockEvent[];
  tasks:       MockTask[];
  /** Resolve a task's effective (stored) state. */
  stateOf:     (t: MockTask) => TaskState;
  /** Offset of today within the Mon-based week (0=Mon … 6=Sun). */
  todayOffset: number;
}

/** Compute the meeting agenda sections from current events + tasks. */
export function buildAgenda({ events, tasks, stateOf, todayOffset }: BuildAgendaInput): Agenda {
  const realTasks = tasks.filter(t => !t.isWorkflowParent);

  const eventItem = (e: MockEvent): AgendaItem => ({
    id: e.id, title: e.title, kind: 'event',
    meta: `${e.time}${e.location ? ' · ' + e.location : ''}`,
  });
  const taskItem = (t: MockTask): AgendaItem => ({
    id: t.id, title: t.title, kind: 'task',
    meta: t.linkedEvent ? `${t.dueLabel} · ${t.linkedEvent}` : t.dueLabel,
  });

  const oldBusiness = events
    .filter(e => e.dayOffset < todayOffset)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map(eventItem);

  const newBusiness = events
    .filter(e => e.dayOffset >= todayOffset && e.dayOffset <= 6)
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map(eventItem);

  const brotherWide = realTasks
    .filter(t => t.assignedRole === 'all')
    .map(taskItem);

  const unresolved = realTasks
    .filter(t => OPEN_STATES.includes(stateOf(t)))
    .map(taskItem);

  return { oldBusiness, newBusiness, brotherWide, unresolved };
}

/** True when an agenda has nothing in any section. */
export function isAgendaEmpty(a: Agenda): boolean {
  return (
    a.oldBusiness.length === 0 &&
    a.newBusiness.length === 0 &&
    a.brotherWide.length === 0 &&
    a.unresolved.length === 0
  );
}
