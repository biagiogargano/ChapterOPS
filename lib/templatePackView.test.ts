/**
 * Isolated tests for lib/templatePackView.ts — dependency-free harness.
 * Proves the pack-aware built-in template view is behavior-identical to today for
 * the Sigma Chi alpha, falls back safely, never surfaces generic examples, and
 * preserves built-ins-before-custom merge order.
 */

import {
  eventTemplatesForStarterPack, eventTemplateIdsForStarterPack,
  getBuiltInEventTemplatesForOrgTemplate, getTemplateOptionsForOrgTemplate,
} from './templatePackView';
import { EVENT_TEMPLATES, NO_TEMPLATE, type EventTaskTemplate } from './eventTemplates';
import { SIGMA_CHI_STARTER_PACK, getStarterPack } from './starterPacks';
import { GENERIC_TEMPLATE_EXAMPLES } from './genericEventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const liveIds = EVENT_TEMPLATES.map(t => t.id).join(',');

// ── sigma_chi: identical built-in list + order as today ───────────────────────
check('sigma_chi pack templates === EVENT_TEMPLATES (same set + order)',
  eventTemplateIdsForStarterPack(SIGMA_CHI_STARTER_PACK).join(',') === liveIds);
check('sigma_chi pack returns the actual template objects',
  eventTemplatesForStarterPack(SIGMA_CHI_STARTER_PACK).length === EVENT_TEMPLATES.length);

// ── org-template resolution: sigma_chi + fallback ─────────────────────────────
check('getBuiltIn(sigma_chi) === live list',
  getBuiltInEventTemplatesForOrgTemplate('sigma_chi').map(t => t.id).join(',') === liveIds);
for (const t of ['unknown', '', null, undefined] as (string | null | undefined)[]) {
  check(`getBuiltIn(${JSON.stringify(t)}) falls back to sigma_chi list`,
    getBuiltInEventTemplatesForOrgTemplate(t).map(x => x.id).join(',') === liveIds);
}

// ── generic example templates are NEVER surfaced ──────────────────────────────
{
  const exampleIds = new Set(GENERIC_TEMPLATE_EXAMPLES.map(t => t.id));
  check('sigma_chi built-ins contain no generic example',
    !eventTemplateIdsForStarterPack(SIGMA_CHI_STARTER_PACK).some(id => exampleIds.has(id)));
  check('club built-ins contain no generic example',
    !eventTemplateIdsForStarterPack(getStarterPack('club')!).some(id => exampleIds.has(id)));
}

// ── picker options: None first, built-ins, then custom (order preserved) ──────
{
  const opts = getTemplateOptionsForOrgTemplate('sigma_chi');
  check('options start with None', opts[0].id === NO_TEMPLATE);
  check('options then list the live built-ins in order',
    opts.slice(1).map(o => o.id).join(',') === liveIds);

  const custom: EventTaskTemplate[] = [
    { id: 'custom_x', label: 'My Template', taskSpecs: [
      { key: 'k', title: 'T', description: 'D', assignedRole: 'social_chair', dueOffsetDays: -1 },
    ] },
  ];
  const withCustom = getTemplateOptionsForOrgTemplate('sigma_chi', custom);
  check('custom templates merge AFTER built-ins',
    withCustom[withCustom.length - 1].id === 'custom_x');
  check('built-ins still present + in order with custom appended',
    withCustom.slice(1, 1 + EVENT_TEMPLATES.length).map(o => o.id).join(',') === liveIds);
}

// ── club: empty pack template list → falls back to all built-ins (safe; never
//    active in alpha). Asserts the "unconstrained pack" rule, not a live surface. ─
{
  const club = getStarterPack('club')!;
  check('club has no declared event-template ids', (club.rolePack.defaultEventTemplateIds ?? []).length === 0);
  check('club (empty list) → full built-in set (unconstrained fallback)',
    eventTemplateIdsForStarterPack(club).join(',') === liveIds);
}

console.log(`\ntemplatePackView.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
