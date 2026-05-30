/**
 * questionnaireGenerationPlan.ts — pure "what should the Me-tab card generate?"
 * resolver, read through the active starter pack.
 *
 * This is the first behavior-identical wiring of activeStarterPack into a real
 * read path. The Me-tab "Create questionnaire tasks" card previously hardcoded
 * WEEKLY_OFFICER_REPORT_ID + OFFICER_ROLES; it now asks this helper, which derives
 * the same values from the org's starter pack (lib/starterPacks). For the alpha
 * (sigma_chi, or any unknown/missing template → sigma_chi fallback) the result is
 * IDENTICAL to the old hardcoded values — the sigma_chi pack is itself derived from
 * those same constants. No behavior change; this just routes the read through the
 * pack so a future org type would supply its own defaults.
 *
 * PURE: no React, no stores, no I/O. Fail-safe — if a pack somehow lacks a
 * questionnaire id or officer roles, callers fall back to the alpha constants.
 */

import { activeStarterPack } from './starterPacks';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { OFFICER_ROLES, type Role } from './roles';

export interface QuestionnaireGenerationPlan {
  /** Which questionnaire definition the card generates (the pack's first default). */
  definitionId: string;
  /** Which roles get a task (the pack's officer roles). */
  roles: Role[];
}

/**
 * Resolve the questionnaire-generation plan for an org template, via its active
 * starter pack. Unknown/empty/missing template → sigma_chi (matching today). If the
 * resolved pack is missing a default questionnaire id or officer roles, fall back to
 * the alpha constants so the card never breaks.
 *
 * For alpha this returns exactly { WEEKLY_OFFICER_REPORT_ID, OFFICER_ROLES } — a
 * behavior-identical replacement for the previously-hardcoded values.
 */
export function planQuestionnaireGeneration(template?: string | null): QuestionnaireGenerationPlan {
  const pack = activeStarterPack(template);

  const definitionId = pack.rolePack.defaultQuestionnaireIds?.[0] ?? WEEKLY_OFFICER_REPORT_ID;

  // The pack's officer roles are RoleKey[] (strings) derived from OFFICER_ROLES;
  // keep only values that are real Role keys, then fall back if empty.
  const known = new Set<string>(OFFICER_ROLES);
  const packRoles = (pack.rolePack.officerRoles ?? []).filter(r => known.has(r)) as Role[];
  const roles = packRoles.length > 0 ? packRoles : [...OFFICER_ROLES];

  return { definitionId, roles };
}
