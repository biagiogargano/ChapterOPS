/**
 * Isolated tests for lib/buildAgenda.ts — dependency-free harness (no framework).
 * Pure: feeds plain events/tasks + a state resolver, asserts the agenda sections.
 * Mirrors the lib/positions.test.ts pattern.
 */

import { buildAgenda, isAgendaEmpty } from './buildAgenda';
import type { MockEvent } from './mockEvents';
import type { MockTask, TaskState } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function ev(id: string, dayOffset: number): MockEvent {
  return {
    id, title: `Event ${id}`, kind: 'social', audience: 'all',
    dayOffset, time: '6:00 PM', location: 'House', description: '',
  };
}

function tk(id: string, over: Partial<MockTask>): MockTask {
  return {
    id, title: `Task ${id}`, type: 'structured', state: 'assigned',
    urgency: 'week', dueLabel: 'Mon', assignedRole: 'social_chair',
    assignedTo: 'Social Chair', visibleTo: ['social_chair'], description: '',
    requiresProof: false, requiresApproval: false, createdByRole: 'social_chair',
    ...over,
  };
}

const TODAY = 3; // Thu (Mon=0)

const events: MockEvent[] = [
  ev('past',     1),   // earlier this week → old business
  ev('today',    3),   // today → new business
  ev('upcoming', 5),   // later this week → new business
  ev('nextweek', 9),   // next week → out of scope
];

const tasks: MockTask[] = [
  tk('open_role',  { assignedRole: 'social_chair', state: 'assigned' }),   // unresolved
  tk('open_all',   { assignedRole: 'all',          state: 'assigned' }),   // brotherWide
  tk('overdue',    { assignedRole: 'risk_manager', state: 'overdue'  }),   // unresolved
  tk('done',       { assignedRole: 'social_chair', state: 'approved' }),   // excluded (closed)
  tk('parent',     { isWorkflowParent: true,       state: 'assigned' }),   // excluded (parent)
  tk('rsvp',       { lightweightKind: 'rsvp', type: 'lightweight', state: 'assigned' }), // excluded (attendance)
];

const stateOf = (t: MockTask): TaskState => t.state;
const a = buildAgenda({ events, tasks, stateOf, todayOffset: TODAY });

const ids = (xs: { id: string }[]) => xs.map(x => x.id).sort().join(',');

// Events
check('old business = earlier-this-week events', ids(a.oldBusiness) === 'past');
check('new business = today + later this week',  ids(a.newBusiness) === 'today,upcoming');
check('next-week event excluded',                !a.newBusiness.some(i => i.id === 'nextweek') && !a.oldBusiness.some(i => i.id === 'nextweek'));
check('events tagged kind=event',                a.oldBusiness.concat(a.newBusiness).every(i => i.kind === 'event'));

// Tasks
check('unresolved = open role-specific tasks',   ids(a.unresolved) === 'open_role,overdue');
check('brotherWide = open chapter-wide tasks',   ids(a.brotherWide) === 'open_all');
check('task sections do not overlap',            a.unresolved.every(u => !a.brotherWide.some(b => b.id === u.id)));
check('closed task excluded',                    !a.unresolved.some(i => i.id === 'done'));
check('workflow parent excluded',                !a.unresolved.some(i => i.id === 'parent'));
check('rsvp lightweight excluded',               ![...a.unresolved, ...a.brotherWide].some(i => i.id === 'rsvp'));
check('tasks tagged kind=task',                  a.unresolved.concat(a.brotherWide).every(i => i.kind === 'task'));

// Empty
check('non-empty agenda → not empty', isAgendaEmpty(a) === false);
check('empty inputs → empty agenda',
  isAgendaEmpty(buildAgenda({ events: [], tasks: [], stateOf, todayOffset: TODAY })) === true);

console.log(`\nbuildAgenda.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
