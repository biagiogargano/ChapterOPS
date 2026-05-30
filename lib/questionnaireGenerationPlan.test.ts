/**
 * Isolated tests for lib/questionnaireGenerationPlan.ts — dependency-free harness.
 *
 * Proves the Me-tab card's generation plan, now read through activeStarterPack, is
 * BEHAVIOR-IDENTICAL to the previously-hardcoded { WEEKLY_OFFICER_REPORT_ID,
 * OFFICER_ROLES } — for the sigma_chi template and for any unknown/missing template
 * (which falls back to sigma_chi).
 */

import { planQuestionnaireGeneration } from './questionnaireGenerationPlan';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { OFFICER_ROLES } from './roles';
import { GENERIC_TEMPLATE_EXAMPLES } from './genericEventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const expectedRoles = OFFICER_ROLES.join(',');

// ── sigma_chi: identical to the old hardcoded values ──────────────────────────
{
  const plan = planQuestionnaireGeneration('sigma_chi');
  check('sigma_chi → Weekly Officer Report definition', plan.definitionId === WEEKLY_OFFICER_REPORT_ID);
  check('sigma_chi → exactly the officer roles', plan.roles.join(',') === expectedRoles);
}

// ── unknown / empty / missing template → same sigma_chi defaults (fallback) ───
for (const t of ['club', 'not_a_template', '', null, undefined] as (string | null | undefined)[]) {
  const plan = planQuestionnaireGeneration(t);
  check(`template ${JSON.stringify(t)} → Weekly Officer Report (fallback)`,
    plan.definitionId === WEEKLY_OFFICER_REPORT_ID);
  check(`template ${JSON.stringify(t)} → officer roles (fallback)`,
    plan.roles.join(',') === expectedRoles);
}

// ── plan never yields a generic EXAMPLE template as the definition ────────────
{
  const exampleIds = new Set(GENERIC_TEMPLATE_EXAMPLES.map(t => t.id));
  check('plan definition is never a generic example template',
    !exampleIds.has(planQuestionnaireGeneration('sigma_chi').definitionId));
}

// ── plan roles are non-empty and all real officer roles ───────────────────────
{
  const plan = planQuestionnaireGeneration('sigma_chi');
  check('plan yields a non-empty role set', plan.roles.length === OFFICER_ROLES.length);
  check('every planned role is a known officer role',
    plan.roles.every(r => OFFICER_ROLES.includes(r)));
}

console.log(`\nquestionnaireGenerationPlan.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
