/**
 * Isolated tests for lib/genericEventTemplates.ts — dependency-free harness.
 *
 * Two jobs:
 *  1. Prove the org-neutral example templates satisfy the SAME structural
 *     invariants the live registry enforces (so the engine is genuinely generic —
 *     a non-fraternity template is a valid template), AND build into real tasks
 *     through the same pure builder.
 *  2. Prove the pack boundary: these examples are NOT surfaced — not in
 *     EVENT_TEMPLATES, the picker options, the kind-default map, or the
 *     cascade-delete id enumeration.
 */

import {
  GENERIC_TEMPLATE_EXAMPLES,
  CLUB_FUNDRAISER_PREP, TEAM_PRACTICE_PREP, BUSINESS_MEETING_PREP,
} from './genericEventTemplates';
import {
  EVENT_TEMPLATES, EVENT_TEMPLATE_OPTIONS, DEFAULT_TEMPLATE_BY_KIND,
  buildTasksFromTemplateObject, allTemplateTaskIdsForEvent,
  type EventTemplateInput,
} from './eventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Same role/approver sets the registry invariants use.
const KNOWN_ROLES = new Set<string>([
  'president', 'pro_consul', 'annotator', 'quaestor', 'magister', 'kustos',
  'tribune', 'risk_manager', 'social_chair', 'recruitment_chair',
  'philanthropy_chair', 'scholarship_chair', 'house_manager', 'brother',
]);

const ev: EventTemplateInput = {
  id:            'gen-evt-1',
  title:         'Spring Drive',
  dateString:    '2030-04-10',
  createdByRole: 'president',
};

// ── 1. Same structural invariants as the live registry ────────────────────────
for (const t of GENERIC_TEMPLATE_EXAMPLES) {
  const keys = t.taskSpecs.map(s => s.key);
  check(`[${t.id}] non-empty id + label`, t.id.length > 0 && t.label.length > 0);
  check(`[${t.id}] has specs`, t.taskSpecs.length > 0);
  check(`[${t.id}] spec keys unique`, new Set(keys).size === keys.length);

  for (const spec of t.taskSpecs) {
    check(`[${t.id}/${spec.key}] assignedRole is known`, KNOWN_ROLES.has(spec.assignedRole));
    check(`[${t.id}/${spec.key}] integer due offset`, Number.isInteger(spec.dueOffsetDays));
    // Approval tasks: reviewer present, known role, not the assignee (no self-review).
    if (spec.requiresApproval) {
      check(`[${t.id}/${spec.key}] approval task has a reviewer`, !!spec.reviewerRole);
      check(`[${t.id}/${spec.key}] reviewer is a known role`,
        !!spec.reviewerRole && KNOWN_ROLES.has(spec.reviewerRole));
      check(`[${t.id}/${spec.key}] reviewer differs from assignee`,
        spec.reviewerRole !== spec.assignedRole);
    }
    // Proof tasks: text/link only (alpha has no file proof).
    if (spec.requiresProof) {
      check(`[${t.id}/${spec.key}] proof type is text/link`,
        spec.proofType === 'text' || spec.proofType === 'link');
    }
  }
}

// Template ids are globally unique among the examples.
{
  const ids = GENERIC_TEMPLATE_EXAMPLES.map(t => t.id);
  check('example template ids are unique', new Set(ids).size === ids.length);
}

// ── 2. They build into real tasks via the same pure builder ───────────────────
{
  const tasks = buildTasksFromTemplateObject(CLUB_FUNDRAISER_PREP, ev);
  check('club fundraiser builds one task per spec',
    tasks.length === CLUB_FUNDRAISER_PREP.taskSpecs.length);
  check('built tasks are linked to the event', tasks.every(t => t.linkedEventId === ev.id));
  check('built tasks carry the tmpl_ id prefix', tasks.every(t => t.id.startsWith('tmpl_')));
  check('{event} placeholder is filled', tasks.every(t => !t.title.includes('{event}')));
  // Determinism.
  const again = buildTasksFromTemplateObject(CLUB_FUNDRAISER_PREP, ev);
  check('builder is deterministic', JSON.stringify(tasks) === JSON.stringify(again));
}

// ── 3. Pack boundary: examples are NOT surfaced anywhere ──────────────────────
{
  const exampleIds = new Set(GENERIC_TEMPLATE_EXAMPLES.map(t => t.id));
  check('examples are NOT in EVENT_TEMPLATES',
    !EVENT_TEMPLATES.some(t => exampleIds.has(t.id)));
  check('examples are NOT in the picker options',
    !EVENT_TEMPLATE_OPTIONS.some(o => exampleIds.has(o.id)));
  check('examples are NOT a kind default',
    !Object.values(DEFAULT_TEMPLATE_BY_KIND).some(id => id && exampleIds.has(id)));
  // The cascade enumeration walks EVENT_TEMPLATES only, so example ids never appear.
  const cascade = allTemplateTaskIdsForEvent(ev.id);
  check('example task ids are NOT in the delete-cascade enumeration',
    !cascade.some(id => id.includes('generic_club_fundraiser')
      || id.includes('generic_team_practice')
      || id.includes('generic_business_meeting')));
}

// ── 4. The set covers distinct non-fraternity org types ───────────────────────
check('three distinct example templates',
  GENERIC_TEMPLATE_EXAMPLES.length === 3 &&
  new Set([CLUB_FUNDRAISER_PREP.id, TEAM_PRACTICE_PREP.id, BUSINESS_MEETING_PREP.id]).size === 3);

console.log(`\ngenericEventTemplates.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
