/**
 * orgLevels.ts — org-level (assignment hierarchy) helpers.
 *
 * ⚠️ STATUS: INERT FOUNDATION. Nothing imports this yet, so it changes NO app
 *    behavior. It introduces the generic "org level" concept that a future
 *    assignment-permission slice will consume (replacing the flat
 *    canAssignToAnyOfficer gate). Per docs/PRODUCT_BUILDING_PRINCIPLES.md the
 *    role→level mapping below is the current Sigma Chi PACK DATA, not hardcoded
 *    core logic — a future org template supplies its own mapping over the same
 *    generic level model.
 *
 * Pure module: no React, no stores, no Supabase, no I/O, no side effects. Fully
 * unit-testable in isolation (see lib/orgLevels.test.ts).
 *
 * MODEL
 *   Five ordered levels, highest authority first:
 *     owner > executives > officers > members > advisors
 *   (owner = future app/admin capability; advisors = future view-only role.)
 *
 * ASSIGNMENT RULE (default, no exceptions yet)
 *   • A higher level may assign DOWNWARD (to any strictly-lower level).
 *   • Same-level assignment is DENIED by default (the future exception mechanism
 *     — e.g. Pro Consul → Annotator — will carve out specific same-level pairs).
 *   • Lower → higher is always denied.
 *   • Unknown / unmapped roles fail safe (cannot assign, cannot be assigned).
 */

import { ROLES, type Role } from './roles';

// ─── Levels ───────────────────────────────────────────────────────────────────

export type OrgLevel = 'owner' | 'executives' | 'officers' | 'members' | 'advisors';

/**
 * Levels ordered highest authority → lowest. The index is the rank: a SMALLER
 * index means MORE authority. `owner` and `advisors` are intentionally present
 * even though no current Sigma Chi role maps to them (owner = admin capability;
 * advisors = view-only) — they reserve their place in the hierarchy now.
 */
export const LEVEL_ORDER: OrgLevel[] = ['owner', 'executives', 'officers', 'members', 'advisors'];

/** Numeric rank for a level (0 = most authority). */
export const LEVEL_RANK: Record<OrgLevel, number> = {
  owner:      0,
  executives: 1,
  officers:   2,
  members:    3,
  advisors:   4,
};

// ─── Role → level mapping (current Sigma Chi pack) ────────────────────────────
// Temporary/explicit mapping for the current role catalog. Owner & advisors have
// NO Sigma Chi role yet — that's intentional (see header). Keep this consistent
// with lib/positions.ts ROLE_PRECEDENCE.

export const ROLE_LEVEL: Record<Role, OrgLevel> = {
  // Executives — broad cross-domain leadership.
  [ROLES.PRESIDENT]:          'executives',
  [ROLES.PRO_CONSUL]:         'executives',

  // Officers — annotator (Secretary) + every chair/officer role.
  [ROLES.ANNOTATOR]:          'officers',
  [ROLES.QUAESTOR]:           'officers',
  [ROLES.MAGISTER]:           'officers',
  [ROLES.KUSTOS]:             'officers',
  [ROLES.TRIBUNE]:            'officers',
  [ROLES.RISK_MANAGER]:       'officers',
  [ROLES.SOCIAL_CHAIR]:       'officers',
  [ROLES.RECRUITMENT_CHAIR]:  'officers',
  [ROLES.PHILANTHROPY_CHAIR]: 'officers',
  [ROLES.SCHOLARSHIP_CHAIR]:  'officers',
  [ROLES.HOUSE_MANAGER]:      'officers',

  // Members — the base member role.
  [ROLES.BROTHER]:            'members',
};

const KNOWN_ROLES = new Set<string>(Object.keys(ROLE_LEVEL));

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * The org level for a role, or `null` if the role is unknown/unmapped (fail
 * safe). A future custom role with no mapping returns null rather than throwing.
 */
export function getRoleLevel(role: string): OrgLevel | null {
  return KNOWN_ROLES.has(role) ? ROLE_LEVEL[role as Role] : null;
}

/**
 * Compare two levels by authority.
 *   returns < 0  when assignerLevel has MORE authority than targetLevel (can assign down)
 *   returns 0    when they are the SAME level
 *   returns > 0  when assignerLevel has LESS authority than targetLevel
 * (Mirrors a numeric comparator: rank(assigner) - rank(target).)
 */
export function compareLevels(assignerLevel: OrgLevel, targetLevel: OrgLevel): number {
  return LEVEL_RANK[assignerLevel] - LEVEL_RANK[targetLevel];
}

/**
 * Default assignment permission: may `assignerRole` assign a task to
 * `targetRole`?  Higher level → strictly-lower level only. Same-level is denied
 * by default (exceptions come later). Unknown roles on either side fail safe.
 *
 * Pure + side-effect free; the future assignee-picker slice will consult this.
 *
 * NOTE: this is the EXCEPTION-FREE base rule. To allow specific same-level (or
 * other) pairs, use canAssignWithExceptions(). Kept separate so the default
 * behavior stays unambiguous.
 */
export function canAssign(assignerRole: string, targetRole: string): boolean {
  const a = getRoleLevel(assignerRole);
  const t = getRoleLevel(targetRole);
  if (a === null || t === null) return false;   // unknown role → fail safe
  return compareLevels(a, t) < 0;                // strictly higher authority only
}

// ─── Exceptions (future owner-configurable; hardcoded + minimal for now) ──────
// An exception explicitly ALLOWS one assigner-role → target-role pair that the
// default rule would deny (e.g. a specific same-level pair). Exceptions can only
// GRANT, never revoke — they widen what canAssign permits, never narrow it.
//
// ⚠️ TEMPORARY: this list is intentionally EMPTY for now. We are deliberately
//    NOT deciding any same-level grants yet (e.g. Annotator peer-assignment or
//    Pro Consul → Annotator). When the product decision is made, add pairs here;
//    later this becomes owner-configurable data (out of scope today). Keeping it
//    empty means canAssignWithExceptions == canAssign until a decision lands, so
//    nothing changes behavior implicitly.

export interface AssignmentException {
  /** The role doing the assigning. */
  assignerRole: string;
  /** The target role this exception explicitly allows the assigner to assign. */
  targetRole:   string;
  /** Short human note on why this exception exists (audit/clarity). */
  note?:        string;
}

/**
 * Reserved Sigma Chi exception list. EMPTY by design right now (see note above).
 * Example of a FUTURE entry (commented, NOT active):
 *   { assignerRole: ROLES.PRO_CONSUL, targetRole: ROLES.ANNOTATOR, note: '…' }
 */
export const SIGMA_CHI_ASSIGNMENT_EXCEPTIONS: AssignmentException[] = [];

/** True if an explicit exception allows this assigner→target pair. */
function exceptionAllows(
  assignerRole: string,
  targetRole: string,
  exceptions: AssignmentException[],
): boolean {
  return exceptions.some(e => e.assignerRole === assignerRole && e.targetRole === targetRole);
}

/**
 * Assignment permission WITH exception support. Allowed when EITHER the default
 * downward rule permits it OR an explicit exception grants it. Unknown roles
 * still fail safe for the default rule; an exception referencing unknown roles
 * is harmless (it simply matches its own pair). Exceptions only ever GRANT.
 *
 * Pure + side-effect free.
 */
export function canAssignWithExceptions(
  assignerRole: string,
  targetRole: string,
  exceptions: AssignmentException[] = SIGMA_CHI_ASSIGNMENT_EXCEPTIONS,
): boolean {
  if (canAssign(assignerRole, targetRole)) return true;
  return exceptionAllows(assignerRole, targetRole, exceptions);
}

// ─── Assignable-role derivation (pure; future assignee-picker source) ─────────

export interface AssignmentOptions {
  /** Same-level / other grant exceptions (defaults to the Sigma Chi list). */
  exceptions?: AssignmentException[];
  /**
   * Always include the assigner's own role for self-assignment (default true).
   * Self-assignment is a product invariant: an officer can always create a task
   * for themselves even though the default rule denies same-level. Set false
   * only for hypothetical callers that explicitly forbid self-assignment.
   */
  includeSelf?: boolean;
}

/**
 * Derive the roles `assignerRole` may select as assignees, from a candidate set.
 *
 *   • Always includes the assigner's own role (self-assignment), when it is a
 *     known role and includeSelf !== false — even though same-level is otherwise
 *     denied.
 *   • Includes every candidate the assigner may assign DOWNWARD to.
 *   • Includes any candidate an explicit exception grants.
 *   • Excludes unknown/invalid candidate roles (fail safe).
 *   • De-duplicates; preserves the candidate order (with self first if added).
 *
 * Pure: no React, no stores, no Supabase, no I/O. This is the single source of
 * truth a future assignee picker should call instead of the flat
 * canAssignToAnyOfficer gate.
 */
export function getAssignableRoles(
  assignerRole: string,
  candidateRoles: string[],
  options: AssignmentOptions = {},
): string[] {
  const { exceptions = SIGMA_CHI_ASSIGNMENT_EXCEPTIONS, includeSelf = true } = options;

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (r: string) => { if (!seen.has(r)) { seen.add(r); out.push(r); } };

  // Self first (only if it's a known role — unknown roles never qualify).
  if (includeSelf && getRoleLevel(assignerRole) !== null) add(assignerRole);

  for (const r of candidateRoles) {
    if (getRoleLevel(r) === null) continue;                 // unknown candidate → skip
    if (canAssignWithExceptions(assignerRole, r, exceptions)) add(r);
  }

  return out;
}
