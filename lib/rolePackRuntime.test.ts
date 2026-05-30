/**
 * Isolated tests for lib/rolePackRuntime.ts — dependency-free harness.
 * Verifies the pack-role → runtime-role compatibility boundary: Sigma Chi roles are
 * all runtime-supported; club's custom keys are reported as unsupported (not thrown,
 * not forwarded); ordering + de-dup preserved.
 */

import {
  isRuntimeRoleKey, toRuntimeRole, runtimeRolesFromPackRoles,
  unsupportedRuntimeRoleKeys, packOfficerRuntimeRoles, packHasOnlyRuntimeRoles,
} from './rolePackRuntime';
import { ROLES, OFFICER_ROLES } from './roles';
import { SIGMA_CHI_STARTER_PACK, getStarterPack } from './starterPacks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── isRuntimeRoleKey / toRuntimeRole ──────────────────────────────────────────
check('known role is a runtime role key', isRuntimeRoleKey('president') === true);
check('custom club key is NOT a runtime role key', isRuntimeRoleKey('vice_president') === false);
check('garbage is not a runtime role key', isRuntimeRoleKey('not_a_role') === false);
check('toRuntimeRole maps a known role', toRuntimeRole(ROLES.SOCIAL_CHAIR) === ROLES.SOCIAL_CHAIR);
check('toRuntimeRole returns null for custom key', toRuntimeRole('event_chair') === null);

// ── runtimeRolesFromPackRoles: filter + order + de-dup ────────────────────────
{
  const mixed = ['president', 'event_chair', 'social_chair', 'president', 'vice_president'];
  const out = runtimeRolesFromPackRoles(mixed);
  check('filters out custom keys', out.join(',') === 'president,social_chair');
  check('preserves input order + de-dupes', out.length === 2);
  const unsup = unsupportedRuntimeRoleKeys(mixed);
  check('reports unsupported keys (order + de-dup)', unsup.join(',') === 'event_chair,vice_president');
  check('supported + unsupported partition the distinct input',
    out.length + unsup.length === new Set(mixed).size);
}

// ── never throws on empty / unknown ───────────────────────────────────────────
{
  let threw = false;
  try {
    runtimeRolesFromPackRoles([]);
    unsupportedRuntimeRoleKeys(['x', 'y']);
    toRuntimeRole('');
  } catch { threw = true; }
  check('helpers never throw', threw === false);
  check('empty input → empty output', runtimeRolesFromPackRoles([]).length === 0);
}

// ── Sigma Chi pack: fully runtime-supported ───────────────────────────────────
{
  const rp = SIGMA_CHI_STARTER_PACK.rolePack;
  check('sigma_chi pack has ONLY runtime roles', packHasOnlyRuntimeRoles(rp) === true);
  check('sigma_chi officer runtime roles === OFFICER_ROLES',
    packOfficerRuntimeRoles(rp).join(',') === OFFICER_ROLES.join(','));
  check('sigma_chi has no unsupported keys',
    unsupportedRuntimeRoleKeys(rp.roles.map(r => r.key)).length === 0);
}

// ── Club pack: custom keys are unsupported, reported, not forwarded ───────────
{
  const club = getStarterPack('club')!.rolePack;
  check('club pack does NOT have only-runtime roles', packHasOnlyRuntimeRoles(club) === false);
  // club officers are secretary/treasurer/event_chair — NONE are in the closed Role
  // union (the alpha catalog uses annotator/quaestor, not secretary/treasurer), so
  // ALL are custom → the runtime officer set is empty.
  const officers = packOfficerRuntimeRoles(club);
  check('club has NO runtime-supported officer roles (all custom)', officers.length === 0);
  const unsup = unsupportedRuntimeRoleKeys(club.roles.map(r => r.key));
  check('club reports its custom keys as unsupported',
    unsup.includes('vice_president') && unsup.includes('event_chair') &&
    unsup.includes('secretary') && unsup.includes('treasurer'));
  check('club president IS a runtime role (overlaps the catalog)',
    isRuntimeRoleKey('president') === true);
}

console.log(`\nrolePackRuntime.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
