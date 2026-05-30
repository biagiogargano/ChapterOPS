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
import { WEEKLY_TEAM_CHECKIN_ID } from './questionnaireTemplates';

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

// ─── Second pack: generic student org / club (architecture proof) ─────────────
// `club` exists to PROVE the starter-pack system can represent a non-fraternity org
// end to end. It uses REAL custom role keys (vice_president, event_chair, …) — not
// the Sigma Chi catalog — which the pack-DATA layer accepts because RolePack keys
// are RoleKey (string).
//
// ⚠️ LIMITATION (documented, not fought): the runtime engines that consume roles
//    (lib/orgLevels.ROLE_LEVEL, task assignment, generateQuestionnaireTasks's
//    Role[]) are keyed by the CLOSED `Role` union, so these custom keys are
//    expressible as data but NOT yet functional through those engines. This is the
//    known closed-`Role`-union gate (see docs/ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN
//    §8). The club pack is registry/test data only; it is NOT the default, NOT
//    surfaced in onboarding, and only active if an org's template is literally
//    'club' (org creation still hardcodes 'sigma_chi', so that never happens in
//    alpha). planQuestionnaireGeneration already guards this — unknown role keys are
//    filtered out and it falls back to the alpha officer set.

/** Generic club/student-org role pack with custom (non-Sigma-Chi) role keys. */
const CLUB_ROLE_PACK: RolePack = {
  id:    'club',
  label: 'Student Club',
  roles: [
    { key: 'president',      label: 'President',      level: 'owner' },
    { key: 'vice_president', label: 'Vice President', level: 'executives' },
    { key: 'secretary',      label: 'Secretary',      level: 'officers' },
    { key: 'treasurer',      label: 'Treasurer',      level: 'officers' },
    { key: 'event_chair',    label: 'Event Chair',    level: 'officers' },
    { key: 'member',         label: 'Member',         level: 'members' },
    { key: 'advisor',        label: 'Advisor',        level: 'advisors' },
  ],
  floorRole:       'member',
  leadershipRoles: ['president', 'vice_president'],
  officerRoles:    ['secretary', 'treasurer', 'event_chair'],
  // No same-level/upward grants for the club pack (keep it simple).
  assignmentExceptions: [],
  // Generic, org-neutral defaults (NOT the Sigma Chi content): a weekly team
  // check-in questionnaire; event templates left empty (the generic EXAMPLE
  // templates stay unsurfaced — a real club pack would register its own later).
  defaultEventTemplateIds: [],
  defaultQuestionnaireIds: [WEEKLY_TEAM_CHECKIN_ID],
  defaultAgendaSections:   ['oldBusiness', 'newBusiness', 'unresolved'],
};

/** The generic club starter pack (registry/test data; not active in alpha). */
export const CLUB_STARTER_PACK: SetupPack = {
  orgType: 'club',
  label:   'Student Club',
  rolePack: CLUB_ROLE_PACK,
  defaultEventKinds: ['social', 'philanthropy', 'finance', 'communications'],
};

/**
 * All registered starter packs. Alpha's DEFAULT + only active-in-practice pack is
 * `sigma_chi` (org creation hardcodes that template). `club` is registered as a
 * second pack to prove genericity — it only becomes active if an org's template is
 * literally 'club', which alpha never sets. Future org types (sports_team /
 * business_team / class_project / nonprofit) get their own entries here; the loader
 * and every consumer stay unchanged.
 */
export const STARTER_PACKS: SetupPack[] = [
  SIGMA_CHI_STARTER_PACK,
  CLUB_STARTER_PACK,
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
