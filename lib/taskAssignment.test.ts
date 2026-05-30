/**
 * Isolated tests for lib/taskAssignment.ts — dependency-free harness, mirroring
 * lib/orgLevels.test.ts. Verifies the create/edit assignee list per acting role,
 * stable display order, edit-mode current-assignee inclusion, de-duplication,
 * and unknown-role safety.
 */

import {
  getAssigneeRoleOptions,
  ASSIGNEE_CANDIDATE_ROLES,
} from './taskAssignment';
import { ROLES, ROLE_SWITCHER_OPTIONS, type Role } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}
function eq(a: Role[], b: Role[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

const OFFICERS_IN_ORDER: Role[] = [
  ROLES.ANNOTATOR, ROLES.QUAESTOR, ROLES.MAGISTER, ROLES.KUSTOS, ROLES.TRIBUNE,
  ROLES.RISK_MANAGER, ROLES.SOCIAL_CHAIR, ROLES.RECRUITMENT_CHAIR,
  ROLES.PHILANTHROPY_CHAIR, ROLES.SCHOLARSHIP_CHAIR, ROLES.HOUSE_MANAGER,
];

// ── Expected lists per acting role (in canonical display order) ───────────────

// President (owner): self + Pro Consul + all officers + Brother.
check('president list',
  eq(getAssigneeRoleOptions(ROLES.PRESIDENT),
     [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ...OFFICERS_IN_ORDER, ROLES.BROTHER]));

// Pro Consul (executives): self + President(exception) + officers + Brother,
// in precedence order (president first).
check('pro_consul list',
  eq(getAssigneeRoleOptions(ROLES.PRO_CONSUL),
     [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ...OFFICERS_IN_ORDER, ROLES.BROTHER]));

// Annotator (officer): self + President(exception) + Brother (no peer officers).
check('annotator list',
  eq(getAssigneeRoleOptions(ROLES.ANNOTATOR),
     [ROLES.PRESIDENT, ROLES.ANNOTATOR, ROLES.BROTHER]));

// Other officer/chair: self + Brother only.
check('social_chair list',
  eq(getAssigneeRoleOptions(ROLES.SOCIAL_CHAIR), [ROLES.SOCIAL_CHAIR, ROLES.BROTHER]));
check('house_manager list',
  eq(getAssigneeRoleOptions(ROLES.HOUSE_MANAGER), [ROLES.HOUSE_MANAGER, ROLES.BROTHER]));

// Brother (member): self only.
check('brother list', eq(getAssigneeRoleOptions(ROLES.BROTHER), [ROLES.BROTHER]));

// ── Stable display order ──────────────────────────────────────────────────────
{
  const got = getAssigneeRoleOptions(ROLES.PRESIDENT);
  // Order must be a subsequence of ROLE_SWITCHER_OPTIONS.
  let idx = -1;
  const ordered = got.every(r => {
    const i = ROLE_SWITCHER_OPTIONS.indexOf(r);
    const ok = i > idx; idx = i; return ok;
  });
  check('president list follows canonical precedence order', ordered);
}

// ── Self-assignment cannot be lost ────────────────────────────────────────────
check('self always present (officer)', getAssigneeRoleOptions(ROLES.SOCIAL_CHAIR).includes(ROLES.SOCIAL_CHAIR));
check('self always present (brother)', getAssigneeRoleOptions(ROLES.BROTHER).includes(ROLES.BROTHER));
check('self always present (annotator)', getAssigneeRoleOptions(ROLES.ANNOTATOR).includes(ROLES.ANNOTATOR));

// ── No duplicates ─────────────────────────────────────────────────────────────
{
  const got = getAssigneeRoleOptions(ROLES.PRESIDENT);
  check('no duplicate roles', new Set(got).size === got.length);
}

// ── Edit-mode current assignee inclusion ──────────────────────────────────────
// A social_chair editing a task currently assigned to ANNOTATOR (a peer it could
// not normally assign) must still see Annotator selectable.
{
  const got = getAssigneeRoleOptions(ROLES.SOCIAL_CHAIR, { currentAssignee: ROLES.ANNOTATOR });
  check('edit keeps out-of-range current assignee', got.includes(ROLES.ANNOTATOR));
  check('edit still includes self + brother',
    got.includes(ROLES.SOCIAL_CHAIR) && got.includes(ROLES.BROTHER));
  check('edit current-assignee list has no dupes', new Set(got).size === got.length);
}
// currentAssignee 'all' is ignored (never a selectable chip).
check('edit ignores currentAssignee=all',
  !getAssigneeRoleOptions(ROLES.SOCIAL_CHAIR, { currentAssignee: 'all' }).includes('all' as any));
// currentAssignee already in range doesn't duplicate.
{
  const got = getAssigneeRoleOptions(ROLES.PRESIDENT, { currentAssignee: ROLES.BROTHER });
  check('in-range current assignee not duplicated', new Set(got).size === got.length);
}

// ── Custom exceptions flow through ────────────────────────────────────────────
{
  const got = getAssigneeRoleOptions(ROLES.SOCIAL_CHAIR, {
    exceptions: [{ assignerRole: ROLES.SOCIAL_CHAIR, targetRole: ROLES.ANNOTATOR }],
  });
  check('custom exception grants a peer role', got.includes(ROLES.ANNOTATOR));
}

// ── Unknown acting role fails safe ────────────────────────────────────────────
check('unknown acting role → empty', getAssigneeRoleOptions('archon' as Role).length === 0);

// ── Candidate constant integrity ──────────────────────────────────────────────
check('candidate roles = officers + brother',
  ASSIGNEE_CANDIDATE_ROLES.includes(ROLES.BROTHER) &&
  ASSIGNEE_CANDIDATE_ROLES.includes(ROLES.SOCIAL_CHAIR) &&
  !ASSIGNEE_CANDIDATE_ROLES.includes('all' as Role));

console.log(`\ntaskAssignment.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
