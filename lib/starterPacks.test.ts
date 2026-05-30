/**
 * Isolated tests for lib/starterPacks.ts — dependency-free harness.
 *
 * Verifies the pure starter-pack registry + loader DESCRIBES current alpha behavior
 * (the sigma_chi pack references the live constants) and falls back safely, WITHOUT
 * changing anything: the registry is read-only foundation, nothing is wired.
 */

import {
  STARTER_PACKS, DEFAULT_STARTER_PACK_ID, SIGMA_CHI_STARTER_PACK,
  getStarterPack, getStarterPackForOrgTemplate, activeStarterPack, isKnownStarterPackId,
} from './starterPacks';
import {
  ROLES, ROLE_LABELS, OFFICER_ROLES, LEADERSHIP_ROLES, FLOOR_ROLE, ROLE_SWITCHER_OPTIONS,
} from './roles';
import { ROLE_LEVEL, SIGMA_CHI_ASSIGNMENT_EXCEPTIONS } from './orgLevels';
import { EVENT_TEMPLATES } from './eventTemplates';
import { WEEKLY_OFFICER_REPORT_ID } from './reportDefinitions';
import { GENERIC_TEMPLATE_EXAMPLES } from './genericEventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Registry basics ───────────────────────────────────────────────────────────
check('default pack id is sigma_chi', DEFAULT_STARTER_PACK_ID === 'sigma_chi');
check('sigma_chi pack exists', getStarterPack('sigma_chi') !== null);
check('exactly one pack is active in alpha', STARTER_PACKS.length === 1);
check('the one pack is sigma_chi', STARTER_PACKS[0].orgType === 'sigma_chi');
check('isKnownStarterPackId true for sigma_chi', isKnownStarterPackId('sigma_chi') === true);
check('isKnownStarterPackId false for a future id', isKnownStarterPackId('club') === false);

// ── Unknown / empty template → safe fallback to sigma_chi ─────────────────────
check('activeStarterPack(unknown) falls back to sigma_chi',
  activeStarterPack('not_a_real_template').orgType === 'sigma_chi');
check('activeStarterPack(undefined) falls back to sigma_chi',
  activeStarterPack(undefined).orgType === 'sigma_chi');
check('activeStarterPack(null) falls back to sigma_chi',
  activeStarterPack(null).orgType === 'sigma_chi');
check('activeStarterPack("") falls back to sigma_chi',
  activeStarterPack('').orgType === 'sigma_chi');
check('activeStarterPack(sigma_chi) returns sigma_chi',
  activeStarterPack('sigma_chi').orgType === 'sigma_chi');

// Strict lookup returns null where active falls back.
check('getStarterPackForOrgTemplate(unknown) is null',
  getStarterPackForOrgTemplate('club') === null);
check('getStarterPackForOrgTemplate(null) is null',
  getStarterPackForOrgTemplate(null) === null);
check('getStarterPack(unknown) is null', getStarterPack('nope') === null);

// ── Pack DESCRIBES the live constants (no drift, no behavior change) ──────────
const rp = SIGMA_CHI_STARTER_PACK.rolePack;
check('pack floorRole === live FLOOR_ROLE', rp.floorRole === FLOOR_ROLE);
check('pack leadershipRoles === live LEADERSHIP_ROLES',
  rp.leadershipRoles.join(',') === LEADERSHIP_ROLES.join(','));
check('pack officerRoles === live OFFICER_ROLES',
  rp.officerRoles.join(',') === OFFICER_ROLES.join(','));
check('pack roles cover the full role catalog',
  rp.roles.length === ROLE_SWITCHER_OPTIONS.length);
check('each pack role carries its live label + level',
  rp.roles.every(r => r.label === ROLE_LABELS[r.key as keyof typeof ROLE_LABELS]
    && r.level === ROLE_LEVEL[r.key as keyof typeof ROLE_LEVEL]));
check('president maps to owner (via live ROLE_LEVEL)',
  rp.roles.find(r => r.key === ROLES.PRESIDENT)?.level === 'owner');
check('brother maps to members (via live ROLE_LEVEL)',
  rp.roles.find(r => r.key === ROLES.BROTHER)?.level === 'members');
check('pack exceptions === live SIGMA_CHI_ASSIGNMENT_EXCEPTIONS',
  rp.assignmentExceptions.length === SIGMA_CHI_ASSIGNMENT_EXCEPTIONS.length);

// ── Default content ids point at the live registries ──────────────────────────
check('pack event-template ids === live EVENT_TEMPLATES ids',
  (rp.defaultEventTemplateIds ?? []).join(',') === EVENT_TEMPLATES.map(t => t.id).join(','));
check('pack questionnaire ids include the weekly officer report',
  (rp.defaultQuestionnaireIds ?? []).includes(WEEKLY_OFFICER_REPORT_ID));
check('pack agenda sections match the buildAgenda groups',
  (rp.defaultAgendaSections ?? []).join(',') === 'oldBusiness,newBusiness,unresolved,brotherWide');
check('pack declares event kinds', SIGMA_CHI_STARTER_PACK.defaultEventKinds.length > 0);

// ── Generic EXAMPLE templates are NOT surfaced as active defaults ─────────────
{
  const exampleIds = new Set(GENERIC_TEMPLATE_EXAMPLES.map(t => t.id));
  check('no generic example template is an active pack default',
    !(rp.defaultEventTemplateIds ?? []).some(id => exampleIds.has(id)));
}

// ── Future pack ids representable by type, no runtime entry ────────────────────
// (Type-level: a SetupPack with orgType 'club' is valid TS; we just assert the
// registry does NOT contain it at runtime — packs are added deliberately.)
check('future org types are not silently active', !isKnownStarterPackId('sports_team'));

console.log(`\nstarterPacks.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
