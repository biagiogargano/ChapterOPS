/**
 * Isolated tests for lib/orgLevels.ts — dependency-free harness (no framework),
 * mirroring lib/roles.test.ts / lib/positions.test.ts.
 *
 * Verifies the DEFAULT assignment rule (higher level assigns strictly downward;
 * same-level denied; unknown roles fail safe) and that owner/advisors levels
 * exist without disturbing the current role→level mapping.
 */

import {
  LEVEL_ORDER,
  LEVEL_RANK,
  ROLE_LEVEL,
  getRoleLevel,
  compareLevels,
  canAssign,
  type OrgLevel,
} from './orgLevels';
import { ROLES } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Levels exist + ordering ───────────────────────────────────────────────────
check('LEVEL_ORDER = owner>executives>officers>members>advisors',
  JSON.stringify(LEVEL_ORDER) === JSON.stringify(['owner', 'executives', 'officers', 'members', 'advisors']));
check('owner level exists',     LEVEL_RANK.owner === 0);
check('advisors level exists',  LEVEL_RANK.advisors === 4);
check('executives outrank officers', LEVEL_RANK.executives < LEVEL_RANK.officers);
check('officers outrank members',    LEVEL_RANK.officers < LEVEL_RANK.members);

// ── Role → level mapping (current Sigma Chi pack) ─────────────────────────────
check('president → executives',   getRoleLevel(ROLES.PRESIDENT)  === 'executives');
check('pro_consul → executives',  getRoleLevel(ROLES.PRO_CONSUL) === 'executives');
check('annotator → officers',     getRoleLevel(ROLES.ANNOTATOR)  === 'officers');
check('social_chair → officers',  getRoleLevel(ROLES.SOCIAL_CHAIR) === 'officers');
check('house_manager → officers', getRoleLevel(ROLES.HOUSE_MANAGER) === 'officers');
check('brother → members',        getRoleLevel(ROLES.BROTHER)    === 'members');

// Every catalog role maps to a known level.
{
  const allRoles = Object.values(ROLES);
  check('every role has a level', allRoles.every(r => getRoleLevel(r) !== null));
  check('ROLE_LEVEL covers exactly the catalog',
    Object.keys(ROLE_LEVEL).length === allRoles.length);
}

// No current Sigma Chi role maps to owner or advisors (reserved, unpopulated).
{
  const levels = Object.values(ROLE_LEVEL) as OrgLevel[];
  check('no role maps to owner yet',    !levels.includes('owner'));
  check('no role maps to advisors yet', !levels.includes('advisors'));
}

// ── compareLevels ─────────────────────────────────────────────────────────────
check('compareLevels(executives,officers) < 0', compareLevels('executives', 'officers') < 0);
check('compareLevels(officers,officers) === 0', compareLevels('officers', 'officers') === 0);
check('compareLevels(members,officers) > 0',    compareLevels('members', 'officers') > 0);

// ── canAssign: executives ─────────────────────────────────────────────────────
check('executives CAN assign officers', canAssign(ROLES.PRESIDENT, ROLES.SOCIAL_CHAIR) === true);
check('executives CAN assign members',  canAssign(ROLES.PRESIDENT, ROLES.BROTHER) === true);
check('executives CANNOT assign executives (same level)',
  canAssign(ROLES.PRESIDENT, ROLES.PRO_CONSUL) === false);
check('executives CANNOT assign self-level (president→president)',
  canAssign(ROLES.PRESIDENT, ROLES.PRESIDENT) === false);

// ── canAssign: officers ───────────────────────────────────────────────────────
check('officers CAN assign members', canAssign(ROLES.SOCIAL_CHAIR, ROLES.BROTHER) === true);
check('officers CANNOT assign officers (same level)',
  canAssign(ROLES.SOCIAL_CHAIR, ROLES.ANNOTATOR) === false);
check('officers CANNOT assign executives (upward)',
  canAssign(ROLES.SOCIAL_CHAIR, ROLES.PRESIDENT) === false);

// ── canAssign: members ────────────────────────────────────────────────────────
check('members CANNOT assign officers',    canAssign(ROLES.BROTHER, ROLES.SOCIAL_CHAIR) === false);
check('members CANNOT assign executives',  canAssign(ROLES.BROTHER, ROLES.PRESIDENT) === false);
check('members CANNOT assign members (same level)',
  canAssign(ROLES.BROTHER, ROLES.BROTHER) === false);

// ── Unknown roles fail safe ───────────────────────────────────────────────────
check('getRoleLevel(unknown) === null', getRoleLevel('archon') === null);
check('canAssign(unknown, member) false', canAssign('archon', ROLES.BROTHER) === false);
check('canAssign(executive, unknown) false', canAssign(ROLES.PRESIDENT, 'archon') === false);
check('canAssign(unknown, unknown) false', canAssign('archon', 'sentinel') === false);

console.log(`\norgLevels.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
