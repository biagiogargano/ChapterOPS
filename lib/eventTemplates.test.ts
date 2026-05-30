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

// Assignees (Social Chair owns venue + guest/date list; Risk Manager owns the risk plan).
check('venue → social_chair',     byKey('venue')?.assignedRole === 'social_chair');
check('guestlist → social_chair', byKey('guestlist')?.assignedRole === 'social_chair');
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

// ── Meeting templates (manual-apply only) ─────────────────────────────────────
const cm = buildTasksFromTemplate('chapter_meeting', ev);
const eb = buildTasksFromTemplate('eboard_meeting', ev);
const cmBy = (k: string) => cm.find(t => t.id.endsWith(`_${k}`));
const ebBy = (k: string) => eb.find(t => t.id.endsWith(`_${k}`));

check('chapter_meeting builds 3 tasks', cm.length === 3);
check('eboard_meeting builds 2 tasks',  eb.length === 2);
check('meeting templates in picker',
  ['chapter_meeting', 'eboard_meeting'].every(id => EVENT_TEMPLATE_OPTIONS.some(o => o.id === id)));

// Manual-apply only: NOT wired into kind defaults.
check('chapter NOT auto-defaulted', DEFAULT_TEMPLATE_BY_KIND.chapter === undefined);
check('eboard NOT auto-defaulted',  DEFAULT_TEMPLATE_BY_KIND.eboard === undefined);

// Chapter Meeting specs.
check('cm agenda → annotator/-2/review by president',
  cmBy('agenda')?.assignedRole === 'annotator' && cmBy('agenda')?.dueAt === '2030-05-08' &&
  cmBy('agenda')?.requiresApproval === true && cmBy('agenda')?.reviewerRole === 'president');
check('cm reminder → annotator/-1/no review',
  cmBy('reminder')?.assignedRole === 'annotator' && cmBy('reminder')?.dueAt === '2030-05-09' &&
  cmBy('reminder')?.requiresApproval === false);
check('cm minutes → annotator/+1/link proof/no review',
  cmBy('minutes')?.assignedRole === 'annotator' && cmBy('minutes')?.dueAt === '2030-05-11' &&
  cmBy('minutes')?.requiresProof === true && cmBy('minutes')?.proofType === 'link' &&
  cmBy('minutes')?.requiresApproval === false);

// E-Board Meeting specs.
check('eb agenda → annotator/-2/review by president',
  ebBy('agenda')?.assignedRole === 'annotator' && ebBy('agenda')?.dueAt === '2030-05-08' &&
  ebBy('agenda')?.requiresApproval === true && ebBy('agenda')?.reviewerRole === 'president');
check('eb minutes → annotator/+1/link proof/no review',
  ebBy('minutes')?.assignedRole === 'annotator' && ebBy('minutes')?.dueAt === '2030-05-11' &&
  ebBy('minutes')?.requiresProof === true && ebBy('minutes')?.proofType === 'link' &&
  ebBy('minutes')?.requiresApproval === false);

// Meeting templates carry no binary proof types (alpha = text/link only).
check('meeting proof types are link-only',
  [...cm, ...eb].every(t => !t.requiresProof || t.proofType === 'link'));

// ── Registry-wide invariants (protect EVERY current + future template) ────────
// These guard the foundation: a new template entry that violates any of these
// would fail CI, catching authoring mistakes (self-review, dup keys, bad proof).

const KNOWN_ROLES = new Set<string>([
  'president', 'pro_consul', 'annotator', 'quaestor', 'magister', 'kustos',
  'tribune', 'risk_manager', 'social_chair', 'recruitment_chair',
  'philanthropy_chair', 'scholarship_chair', 'house_manager', 'brother',
]);
// Roles that can be a reviewer/approver (leadership). Keep in sync with
// lib/roles LEADERSHIP_ROLES; templates today use president / pro_consul.
const APPROVER_ROLES = new Set<string>(['president', 'pro_consul']);

for (const t of EVENT_TEMPLATES) {
  // 1. Spec keys unique within the template (deterministic ids must not collide).
  const keys = t.taskSpecs.map(s => s.key);
  check(`[${t.id}] spec keys are unique`, new Set(keys).size === keys.length);

  for (const spec of t.taskSpecs) {
    // 2. Every assigned role is a known role.
    check(`[${t.id}/${spec.key}] assignedRole is known`, KNOWN_ROLES.has(spec.assignedRole));
    // 3. Approval tasks: reviewer present, a valid approver, and NOT the assignee.
    if (spec.requiresApproval) {
      check(`[${t.id}/${spec.key}] approval task has a reviewer`, !!spec.reviewerRole);
      check(`[${t.id}/${spec.key}] reviewer is a leadership approver`,
        !!spec.reviewerRole && APPROVER_ROLES.has(spec.reviewerRole));
      check(`[${t.id}/${spec.key}] reviewer differs from assignee`,
        spec.reviewerRole !== spec.assignedRole);
    }
    // 4. Proof tasks declare a proofType; alpha exposes text/link only.
    if (spec.requiresProof) {
      check(`[${t.id}/${spec.key}] proof task has a text/link proofType`,
        spec.proofType === 'text' || spec.proofType === 'link');
    }
    // 5. Offsets are integers (date math is whole-day).
    check(`[${t.id}/${spec.key}] dueOffsetDays is an integer`,
      Number.isInteger(spec.dueOffsetDays));
  }
}

// 6. Template ids are globally unique across the registry.
{
  const ids = EVENT_TEMPLATES.map(t => t.id);
  check('template ids are globally unique', new Set(ids).size === ids.length);
}

// 7. Generated task ids are globally unique for a single event (no collisions
//    across templates/specs sharing the same event id).
{
  const ids = allTemplateTaskIdsForEvent('evt-x');
  check('all generated ids unique per event', new Set(ids).size === ids.length);
}

console.log(`\neventTemplates.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
