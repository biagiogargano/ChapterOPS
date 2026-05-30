/**
 * starterPacks.ts — pure org-type starter-pack REGISTRY + loader (foundation).
 *
 * The next scale seam: `organizations.template` exists and org creation passes a
 * template (lib/memberService.createOrganization → p_template), but nothing reads
 * that template to choose role/template/questionnaire packs. This module is that
 * read side — a pure registry of SetupPacks keyed by org type, plus an
 * `activeStarterPack(template)` loader that falls back safely to the alpha pack.
 *
 * ⚠️ FOUNDATION — NOT WIRED. Nothing in the app imports this yet, so it changes NO
 *    behavior. It DESCRIBES current alpha behavior (the sigma_chi pack is built by
 *    REFERENCING the existing constants — lib/roles, lib/orgLevels, lib/eventTemplates,
 *    lib/reportDefinitions — so it cannot drift from them) rather than introducing
 *    anything new. A later slice wires `activeStarterPack` in place of the direct
 *    catalog imports; until then this is a tested, inert read model. See
 *    docs/ORG_ONBOARDING_AND_SETUP_PLAN.md and docs/NEXT_BUILDABLE_WORK.md (#4).
 *
 * PURE: no React, no stores, no Supabase, no I/O. The pack is derived from the live
 * constants at module load, so "what the pack says" always equals "what the app
 * does" today. Generic example packs (lib/genericEventTemplates) are intentionally
 * NOT registered as active — only sigma_chi is active in alpha.
 */

import { SetupPack, type RolePack, type PackRole } from './rolePack';
import {
  ROLES, ROLE_LABELS, OFFICER_ROLES, LEADERSHIP_ROLES, FLOOR_ROLE,
  ROLE_SWITCHER_OPTIONS, type Role,
} from './roles';
import { ROLE_LEVEL, SIGMA_CHI_ASSIGNMENT_EXCEPTIONS } from './orgLevels';
import { EVENT_TEMPLATES } from './eventTemplates';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';

/** The org-type id of the alpha default pack (matches the `sigma_chi` template). */
export const DEFAULT_STARTER_PACK_ID = 'sigma_chi';

/**
 * Agenda section keys the alpha fraternity agenda emits today. Mirrors the section
 * groups produced by lib/buildAgenda (oldBusiness / newBusiness / unresolved /
 * brotherWide). Named here as pack data so a future org type can emit a different
 * set; the agenda engine itself is unchanged.
 */
const SIGMA_CHI_AGENDA_SECTIONS = ['oldBusiness', 'newBusiness', 'unresolved', 'brotherWide'];

/** Build the alpha role pack by REFERENCING the live role/level constants. */
function buildSigmaChiRolePack(): RolePack {
  // Roles in the existing display/precedence order, each carrying its live label +
  // level. Derived — so this list always equals the current catalog.
  const roles: PackRole[] = ROLE_SWITCHER_OPTIONS.map((key: Role) => ({
    key,
    label: ROLE_LABELS[key],
    level: ROLE_LEVEL[key],
  }));

  return {
    id:    DEFAULT_STARTER_PACK_ID,
    label: 'Sigma Chi (fraternity)',
    roles,
    floorRole:       FLOOR_ROLE,
    leadershipRoles: [...LEADERSHIP_ROLES],
    officerRoles:    [...OFFICER_ROLES],
    assignmentExceptions: [...SIGMA_CHI_ASSIGNMENT_EXCEPTIONS],
    // Default content this pack ships, by id (references to the live registries):
    defaultEventTemplateIds: EVENT_TEMPLATES.map(t => t.id),
    defaultQuestionnaireIds: [WEEKLY_OFFICER_REPORT_ID],
    defaultAgendaSections:   SIGMA_CHI_AGENDA_SECTIONS,
  };
}

/** The alpha Sigma Chi starter pack (the only active pack today). */
export const SIGMA_CHI_STARTER_PACK: SetupPack = {
  orgType: DEFAULT_STARTER_PACK_ID,
  label:   'Sigma Chi (fraternity)',
  rolePack: buildSigmaChiRolePack(),
  // Event kinds the alpha pack uses (the full current EventKind set).
  defaultEventKinds: [
    'chapter', 'eboard', 'social', 'academic', 'recruitment', 'philanthropy',
    'risk', 'finance', 'education', 'ritual', 'communications', 'facility',
  ],
};

/**
 * All registered starter packs. Alpha ships exactly one (sigma_chi). Future org
 * types (club / sports_team / business_team / class_project / nonprofit) get their
 * own entries here — the loader + every consumer stay unchanged.
 */
export const STARTER_PACKS: SetupPack[] = [
  SIGMA_CHI_STARTER_PACK,
];

/** True if `id` names a registered starter pack. */
export function isKnownStarterPackId(id: string): boolean {
  return STARTER_PACKS.some(p => p.orgType === id);
}

/** Look up a starter pack by its org-type id, or null if unknown (fail safe). */
export function getStarterPack(id: string): SetupPack | null {
  return STARTER_PACKS.find(p => p.orgType === id) ?? null;
}

/**
 * Resolve an `organizations.template` value to its starter pack, or null if the
 * template is unknown/empty. Prefer `activeStarterPack` at call sites that need a
 * guaranteed pack — this one is the strict lookup.
 */
export function getStarterPackForOrgTemplate(template: string | null | undefined): SetupPack | null {
  if (!template) return null;
  return getStarterPack(template);
}

/**
 * The ACTIVE starter pack for an org template — always returns a pack. An unknown,
 * empty, or missing template falls back safely to the alpha default (sigma_chi),
 * matching today's behavior where every org uses the Sigma Chi catalog regardless
 * of template value. Never throws.
 */
export function activeStarterPack(template?: string | null): SetupPack {
  return getStarterPackForOrgTemplate(template) ?? SIGMA_CHI_STARTER_PACK;
}
