/**
 * Isolated tests for the role-capability helpers in lib/roles.ts —
 * dependency-free harness (no framework). Mirrors lib/positions.test.ts.
 *
 * These assert the CURRENT Sigma Chi pack's values exactly, so the centralization
 * (LEADERSHIP_ROLES / FLOOR_ROLE / isLeadershipRole / isFloorRole) is provably
 * behavior-neutral vs. the previous inline president/pro_consul/brother checks.
 */

import {
  LEADERSHIP_ROLES,
  FLOOR_ROLE,
  OFFICER_ROLES,
  TASK_ASSIGNER_ROLES,
  ROLES,
  isLeadershipRole,
  isFloorRole,
  isOfficer,
  canAssignToAnyOfficer,
  type Role,
} from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}
function eqArr(a: unknown[], b: unknown[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Leadership = president + pro_consul (unchanged value/order).
check('LEADERSHIP_ROLES = [president, pro_consul]',
  eqArr(LEADERSHIP_ROLES, [ROLES.PRESIDENT, ROLES.PRO_CONSUL]));
check('isLeadershipRole(president)',   isLeadershipRole(ROLES.PRESIDENT) === true);
check('isLeadershipRole(pro_consul)',  isLeadershipRole(ROLES.PRO_CONSUL) === true);
check('isLeadershipRole(annotator) false', isLeadershipRole(ROLES.ANNOTATOR) === false);
check('isLeadershipRole(brother) false',   isLeadershipRole(ROLES.BROTHER) === false);

// Exactly the two leadership roles across the whole catalog.
{
  const ALL: Role[] = [...OFFICER_ROLES, ROLES.BROTHER];
  const leaders = ALL.filter(isLeadershipRole);
  check('exactly president + pro_consul are leadership',
    eqArr(leaders, [ROLES.PRESIDENT, ROLES.PRO_CONSUL]));
}

// Floor role = brother (the base member).
check('FLOOR_ROLE = brother',        FLOOR_ROLE === ROLES.BROTHER);
check('isFloorRole(brother)',        isFloorRole(ROLES.BROTHER) === true);
check('isFloorRole(president) false', isFloorRole(ROLES.PRESIDENT) === false);

// Capability concepts are disjoint from "officer" where expected:
// leadership roles are officers; the floor role is not.
check('leadership roles are officers', LEADERSHIP_ROLES.every(r => isOfficer(r)));
check('floor role is not an officer',  isOfficer(FLOOR_ROLE) === false);

// Task-assigner set = leadership + annotator (can assign to any officer role).
check('TASK_ASSIGNER_ROLES = [president, pro_consul, annotator]',
  eqArr(TASK_ASSIGNER_ROLES, [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ROLES.ANNOTATOR]));
check('canAssignToAnyOfficer(president)',  canAssignToAnyOfficer(ROLES.PRESIDENT) === true);
check('canAssignToAnyOfficer(pro_consul)', canAssignToAnyOfficer(ROLES.PRO_CONSUL) === true);
check('canAssignToAnyOfficer(annotator)',  canAssignToAnyOfficer(ROLES.ANNOTATOR) === true);
check('canAssignToAnyOfficer(social_chair) false', canAssignToAnyOfficer(ROLES.SOCIAL_CHAIR) === false);
check('canAssignToAnyOfficer(brother) false',       canAssignToAnyOfficer(ROLES.BROTHER) === false);
// Annotator can assign but is NOT leadership (no broad approval/management power).
check('annotator is not leadership', isLeadershipRole(ROLES.ANNOTATOR) === false);

console.log(`\nroles.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
