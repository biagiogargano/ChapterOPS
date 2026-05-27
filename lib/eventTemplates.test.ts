/**
 * Isolated tests for lib/eventTemplates.ts — dependency-free harness (no framework).
 * Asserts the deterministic, pure template builder. Does not assert now-dependent
 * fields (dueLabel/urgency); only structural + deterministic outputs.
 */

import {
  DEFAULT_TEMPLATE_BY_KIND,
  EVENT_TEMPLATES,
  EVENT_TEMPLATE_OPTIONS,
  NO_TEMPLATE,
  allTemplateTaskIdsForEvent,
  buildTasksFromTemplate,
  getEventTemplate,
  templateTaskId,
  type EventTemplateInput,
} from './eventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const ev: EventTemplateInput = {
  id:            'evt-1',
  title:         'Spring Formal',
  dateString:    '2030-05-10',
  createdByRole: 'social_chair',
};

const tasks = buildTasksFromTemplate('date_party', ev);
const byKey = (k: string) => tasks.find(t => t.id.endsWith(`_${k}`));

// Shape / count.
check('date_party builds 5 tasks', tasks.length === 5);
check('options include None first', EVENT_TEMPLATE_OPTIONS[0].id === NO_TEMPLATE);
check('options include date_party', EVENT_TEMPLATE_OPTIONS.some(o => o.id === 'date_party'));

// Deterministic ids.
check('venue id matches templateTaskId', byKey('venue')?.id === templateTaskId('date_party', 'evt-1', 'venue'));
check('all ids carry the tmpl_ prefix', tasks.every(t => t.id.startsWith('tmpl_')));
check('all linked to the event', tasks.every(t => t.linkedEventId === 'evt-1'));

// Due offsets (deterministic from the event date).
check('venue due −7 days',     byKey('venue')?.dueAt === '2030-05-03');
check('riskplan due −5 days',   byKey('riskplan')?.dueAt === '2030-05-05');
check('monitors due −1 day',    byKey('monitors')?.dueAt === '2030-05-09');
check('incident due +1 day',    byKey('incident')?.dueAt === '2030-05-11');

// Assignees (guest list + risk plan are Risk Manager).
check('venue → social_chair',     byKey('venue')?.assignedRole === 'social_chair');
check('guestlist → risk_manager', byKey('guestlist')?.assignedRole === 'risk_manager');
check('riskplan → risk_manager',  byKey('riskplan')?.assignedRole === 'risk_manager');

// Approval: everything goes through Pro Consul.
check('all require approval',          tasks.every(t => t.requiresApproval === true));
check('all reviewed by pro_consul',    tasks.every(t => t.reviewerRole === 'pro_consul'));
check('reviewer differs from assignee', tasks.every(t => t.reviewerRole !== t.assignedRole));

// Higher-stakes oversight: venue (the event) + risk plan also surface President.
check('venue supervised by president',    byKey('venue')?.supervisorRole === 'president');
check('riskplan supervised by president', byKey('riskplan')?.supervisorRole === 'president');
check('guestlist has no supervisor',      byKey('guestlist')?.supervisorRole === undefined);

// Sentinels / unknown.
check('none → no tasks',    buildTasksFromTemplate(NO_TEMPLATE, ev).length === 0);
check('unknown → no tasks', buildTasksFromTemplate('does_not_exist', ev).length === 0);

// Cascade id enumeration covers every spec.
const allIds = allTemplateTaskIdsForEvent('evt-1');
const specCount = EVENT_TEMPLATES.reduce((n, t) => n + t.taskSpecs.length, 0);
check('cascade ids cover all specs', allIds.length === specCount);
check('cascade ids include venue',   allIds.includes(templateTaskId('date_party', 'evt-1', 'venue')));

// Determinism: same input → identical output.
const again = buildTasksFromTemplate('date_party', ev);
check('deterministic build', JSON.stringify(tasks) === JSON.stringify(again));

// Kind → recommended template defaults (create-time pre-selection).
check('social → date_party default',      DEFAULT_TEMPLATE_BY_KIND.social === 'date_party');
check('recruitment → recruitment default', DEFAULT_TEMPLATE_BY_KIND.recruitment === 'recruitment');
check('mapped defaults resolve to real templates',
  Object.values(DEFAULT_TEMPLATE_BY_KIND).every(id => !!id && !!getEventTemplate(id)));
check('unmapped kind has no default (chapter)', DEFAULT_TEMPLATE_BY_KIND.chapter === undefined);

console.log(`\neventTemplates.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
