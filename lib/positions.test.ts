/**
 * Isolated tests for lib/positions.ts — dependency-free assertion harness so it
 * runs without a test framework (no package installs). Compile with tsc to a
 * temp dir and run with node; exits non-zero on any failure.
 *
 *   tsc lib/positions.ts lib/positions.test.ts --outDir <tmp> --module commonjs ...
 *   node <tmp>/lib/positions.test.js
 */

import { ROLE_PRECEDENCE, deriveActingRole, availableRoles, isOfficerMember } from './positions';
import type { Position } from '../types';

// Node's `process` without requiring @types/node in the project typecheck.
const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}
function eqArr(a: unknown[], b: unknown[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Position factory — only the fields positions.ts reads matter. */
function pos(role: string, isActive = true): Position {
  return {
    id: `p_${role}_${isActive}`,
    memberId: 'm1',
    orgId: 'o1',
    role,
    isActive,
    termStart: null,
    termEnd: null,
  };
}

// 1 — empty
check('empty → acting brother',    deriveActingRole([]) === 'brother');
check('empty → available [brother]', eqArr(availableRoles([]), ['brother']));
check('empty → not officer',       isOfficerMember([]) === false);

// 2 — brother-only
{
  const ps = [pos('brother')];
  check('brother-only → acting brother', deriveActingRole(ps) === 'brother');
  check('brother-only → available [brother]', eqArr(availableRoles(ps), ['brother']));
  check('brother-only → not officer', isOfficerMember(ps) === false);
}

// 3 — single officer
{
  const ps = [pos('risk_manager')];
  check('single officer → acting risk_manager', deriveActingRole(ps) === 'risk_manager');
  check('single officer → available [risk_manager, brother]', eqArr(availableRoles(ps), ['risk_manager', 'brother']));
  check('single officer → is officer', isOfficerMember(ps) === true);
}

// 4 — multi-officer precedence
{
  const ps = [pos('social_chair'), pos('president'), pos('risk_manager')];
  check('multi-officer → acting president (highest precedence)', deriveActingRole(ps) === 'president');
  check('multi-officer → available ordered by precedence',
    eqArr(availableRoles(ps), ['president', 'risk_manager', 'social_chair', 'brother']));
  check('multi-officer → is officer', isOfficerMember(ps) === true);
}

// 5 — inactive-only
{
  const ps = [pos('president', false)];
  check('inactive-only → acting brother', deriveActingRole(ps) === 'brother');
  check('inactive-only → available [brother]', eqArr(availableRoles(ps), ['brother']));
  check('inactive-only → not officer', isOfficerMember(ps) === false);
}

// 6 — duplicate roles (de-duped)
{
  const ps = [pos('risk_manager'), pos('risk_manager')];
  check('duplicate → acting risk_manager', deriveActingRole(ps) === 'risk_manager');
  check('duplicate → available de-duped [risk_manager, brother]',
    eqArr(availableRoles(ps), ['risk_manager', 'brother']));
}

// 7 — unknown role string (ignored defensively, no throw)
{
  const orig = console.warn;
  let warns = 0;
  console.warn = () => { warns++; };
  try {
    const onlyUnknown = [pos('grand_wizard')];
    check('unknown-only → acting brother', deriveActingRole(onlyUnknown) === 'brother');
    check('unknown-only → available [brother]', eqArr(availableRoles(onlyUnknown), ['brother']));
    check('unknown-only → warned', warns > 0);

    const mixed = [pos('grand_wizard'), pos('social_chair')];
    check('unknown + valid → acting social_chair', deriveActingRole(mixed) === 'social_chair');
  } finally {
    console.warn = orig;
  }
}

// sanity: precedence list shape — full officer catalog, brother as the floor.
check('precedence has 14 roles ending in brother',
  ROLE_PRECEDENCE.length === 14 && ROLE_PRECEDENCE[ROLE_PRECEDENCE.length - 1] === 'brother');

console.log(`\npositions.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
