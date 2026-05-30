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
  canAssignWithExceptions,
  getAssignableRoles,
  SIGMA_CHI_ASSIGNMENT_EXCEPTIONS,
  type OrgLevel,
  type AssignmentException,
} from './orgLevels';
import { ROLES, OFFICER_ROLES } from './roles';

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

// ── Role → level mapping (current Sigma Chi pack — alpha) ─────────────────────
check('president → owner',         getRoleLevel(ROLES.PRESIDENT)  === 'owner');
check('pro_consul → executives',   getRoleLevel(ROLES.PRO_CONSUL) === 'executives');
check('annotator → officers',      getRoleLevel(ROLES.ANNOTATOR)  === 'officers');
check('social_chair → officers',   getRoleLevel(ROLES.SOCIAL_CHAIR) === 'officers');
check('house_manager → officers',  getRoleLevel(ROLES.HOUSE_MANAGER) === 'officers');
check('brother → members',         getRoleLevel(ROLES.BROTHER)    === 'members');

// Every catalog role maps to a known level.
{
  const allRoles = Object.values(ROLES);
  check('every role has a level', allRoles.every(r => getRoleLevel(r) !== null));
  check('ROLE_LEVEL covers exactly the catalog',
    Object.keys(ROLE_LEVEL).length === allRoles.length);
}

// President now occupies owner; advisors remains reserved/unmapped.
{
  const levels = Object.values(ROLE_LEVEL) as OrgLevel[];
  check('president occupies the owner level',  levels.includes('owner'));
  check('no role maps to advisors yet',        !levels.includes('advisors'));
}

// ── compareLevels ─────────────────────────────────────────────────────────────
check('compareLevels(executives,officers) < 0', compareLevels('executives', 'officers') < 0);
check('compareLevels(officers,officers) === 0', compareLevels('officers', 'officers') === 0);
check('compareLevels(members,officers) > 0',    compareLevels('members', 'officers') > 0);

// ── canAssign: owner (President) ──────────────────────────────────────────────
check('owner CAN assign executives (president→pro_consul, normal downward)',
  canAssign(ROLES.PRESIDENT, ROLES.PRO_CONSUL) === true);
check('owner CAN assign officers', canAssign(ROLES.PRESIDENT, ROLES.SOCIAL_CHAIR) === true);
check('owner CAN assign members',  canAssign(ROLES.PRESIDENT, ROLES.BROTHER) === true);
check('owner CANNOT assign self-level (president→president)',
  canAssign(ROLES.PRESIDENT, ROLES.PRESIDENT) === false);

// ── canAssign: executives (Pro Consul) ───────────────────────────────────────
check('executives CAN assign officers', canAssign(ROLES.PRO_CONSUL, ROLES.SOCIAL_CHAIR) === true);
check('executives CAN assign members',  canAssign(ROLES.PRO_CONSUL, ROLES.BROTHER) === true);
check('executives CANNOT assign owner by default (pro_consul→president)',
  canAssign(ROLES.PRO_CONSUL, ROLES.PRESIDENT) === false);

// ── canAssign: officers ───────────────────────────────────────────────────────
check('officers CAN assign members', canAssign(ROLES.SOCIAL_CHAIR, ROLES.BROTHER) === true);
check('officers CANNOT assign officers (same level)',
  canAssign(ROLES.SOCIAL_CHAIR, ROLES.ANNOTATOR) === false);
check('officers CANNOT assign owner by default (upward)',
  canAssign(ROLES.SOCIAL_CHAIR, ROLES.PRESIDENT) === false);
check('officers CANNOT assign executives (upward)',
  canAssign(ROLES.SOCIAL_CHAIR, ROLES.PRO_CONSUL) === false);

// ── canAssign: members ────────────────────────────────────────────────────────
check('members CANNOT assign officers',  canAssign(ROLES.BROTHER, ROLES.SOCIAL_CHAIR) === false);
check('members CANNOT assign owner',     canAssign(ROLES.BROTHER, ROLES.PRESIDENT) === false);
check('members CANNOT assign members (same level)',
  canAssign(ROLES.BROTHER, ROLES.BROTHER) === false);

// ── Unknown roles fail safe ───────────────────────────────────────────────────
check('getRoleLevel(unknown) === null', getRoleLevel('archon') === null);
check('canAssign(unknown, member) false', canAssign('archon', ROLES.BROTHER) === false);
check('canAssign(executive, unknown) false', canAssign(ROLES.PRESIDENT, 'archon') === false);
check('canAssign(unknown, unknown) false', canAssign('archon', 'sentinel') === false);

// ── Exceptions ────────────────────────────────────────────────────────────────
function eqSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
}

// Default alpha exceptions: exactly the two upward-to-President grants.
check('default exceptions = pro_consul→president and annotator→president',
  SIGMA_CHI_ASSIGNMENT_EXCEPTIONS.length === 2);
check('default exception: pro_consul → president',
  canAssignWithExceptions(ROLES.PRO_CONSUL, ROLES.PRESIDENT) === true);
check('default exception: annotator → president',
  canAssignWithExceptions(ROLES.ANNOTATOR, ROLES.PRESIDENT) === true);
// A NON-granted upward pair stays denied (social_chair has no →president grant).
check('non-granted upward stays denied (social_chair→president)',
  canAssignWithExceptions(ROLES.SOCIAL_CHAIR, ROLES.PRESIDENT) === false);
// Annotator → peer officer is NOT granted by default (same-level stays denied).
check('annotator → peer officer NOT granted by default',
  canAssignWithExceptions(ROLES.ANNOTATOR, ROLES.SOCIAL_CHAIR) === false);

// With an explicitly-EMPTY exception list, canAssignWithExceptions == canAssign.
check('empty-exception pro_consul→president denied',
  canAssignWithExceptions(ROLES.PRO_CONSUL, ROLES.PRESIDENT, []) === false);
check('empty-exception downward still allowed',
  canAssignWithExceptions(ROLES.PRESIDENT, ROLES.BROTHER, []) === true);

// An explicit exception GRANTS a specific same-level pair.
{
  const ex: AssignmentException[] = [
    { assignerRole: ROLES.PRO_CONSUL, targetRole: ROLES.ANNOTATOR, note: 'test grant' },
  ];
  check('exception allows specific same-level pair',
    canAssignWithExceptions(ROLES.PRO_CONSUL, ROLES.ANNOTATOR, ex) === true);
  // …but only that exact pair — a DIFFERENT same-level pair (still denied by the
  // default rule, and not in this exception list) stays denied.
  check('exception does not leak to other same-level pairs',
    canAssignWithExceptions(ROLES.SOCIAL_CHAIR, ROLES.ANNOTATOR, ex) === false);
  // Exceptions only GRANT — they never revoke a normally-allowed downward assign.
  check('exception never revokes downward',
    canAssignWithExceptions(ROLES.PRESIDENT, ROLES.BROTHER, ex) === true);
}

// ── getAssignableRoles ────────────────────────────────────────────────────────
const ALL = [...OFFICER_ROLES, ROLES.BROTHER];

// Self-assignment is always included.
check('self-assignment always included (officer)',
  getAssignableRoles(ROLES.SOCIAL_CHAIR, ALL).includes(ROLES.SOCIAL_CHAIR));
check('self-assignment always included (member)',
  getAssignableRoles(ROLES.BROTHER, ALL).includes(ROLES.BROTHER));

// President (owner) sees self + Pro Consul + all officers + Brother.
{
  const got = getAssignableRoles(ROLES.PRESIDENT, ALL);
  const officers = OFFICER_ROLES.filter(r => getRoleLevel(r) === 'officers');
  const expected = [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ...officers, ROLES.BROTHER];
  check('president sees self + pro_consul + officers + brother', eqSet(got, expected));
  check('president sees pro_consul (downward)', got.includes(ROLES.PRO_CONSUL));
}

// Pro Consul (executives) sees self + President (by default exception) + officers + Brother.
{
  const got = getAssignableRoles(ROLES.PRO_CONSUL, ALL);
  const officers = OFFICER_ROLES.filter(r => getRoleLevel(r) === 'officers');
  const expected = [ROLES.PRO_CONSUL, ROLES.PRESIDENT, ...officers, ROLES.BROTHER];
  check('pro_consul sees self + president(exception) + officers + brother', eqSet(got, expected));
  check('pro_consul sees president by exception', got.includes(ROLES.PRESIDENT));
}

// Annotator (officer) sees self + President (by default exception) + Brother only —
// NOT peer officers/chairs (same-level stays denied; no peer grant by default).
{
  const got = getAssignableRoles(ROLES.ANNOTATOR, ALL);
  check('annotator sees self + president(exception) + brother',
    eqSet(got, [ROLES.ANNOTATOR, ROLES.PRESIDENT, ROLES.BROTHER]));
  check('annotator does NOT see peer officers by default', !got.includes(ROLES.SOCIAL_CHAIR));
  check('annotator does NOT see pro_consul', !got.includes(ROLES.PRO_CONSUL));
}

// A non-annotator officer sees self + members only (no peers, no upward).
{
  const got = getAssignableRoles(ROLES.SOCIAL_CHAIR, ALL);
  check('officer sees self + members', eqSet(got, [ROLES.SOCIAL_CHAIR, ROLES.BROTHER]));
  check('officer does NOT see peer officers', !got.includes(ROLES.ANNOTATOR));
  check('officer does NOT see president',     !got.includes(ROLES.PRESIDENT));
  check('officer does NOT see pro_consul',    !got.includes(ROLES.PRO_CONSUL));
}

// Member sees only self.
check('member sees only self',
  eqSet(getAssignableRoles(ROLES.BROTHER, ALL), [ROLES.BROTHER]));

// Same-level denied unless an exception allows it.
{
  const ex: AssignmentException[] = [
    { assignerRole: ROLES.SOCIAL_CHAIR, targetRole: ROLES.ANNOTATOR },
  ];
  check('exception adds a same-level role to the assignable set',
    getAssignableRoles(ROLES.SOCIAL_CHAIR, ALL, { exceptions: ex }).includes(ROLES.ANNOTATOR));
}

// Unknown candidate roles are skipped; unknown assigner yields only nothing
// (self is unknown → not added).
{
  const got = getAssignableRoles(ROLES.PRESIDENT, [...ALL, 'archon', 'sentinel']);
  check('unknown candidates excluded', !got.includes('archon') && !got.includes('sentinel'));
  check('unknown assigner → empty set', getAssignableRoles('archon', ALL).length === 0);
}

// No duplicate roles (self also present as a candidate must not double-up).
{
  const got = getAssignableRoles(ROLES.PRESIDENT, [ROLES.PRESIDENT, ...ALL]);
  check('no duplicate roles', new Set(got).size === got.length);
}

// includeSelf:false omits self.
check('includeSelf:false omits self',
  !getAssignableRoles(ROLES.SOCIAL_CHAIR, ALL, { includeSelf: false }).includes(ROLES.SOCIAL_CHAIR));

console.log(`\norgLevels.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
