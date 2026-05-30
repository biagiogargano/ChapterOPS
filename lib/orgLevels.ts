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
 */
export function canAssign(assignerRole: string, targetRole: string): boolean {
  const a = getRoleLevel(assignerRole);
  const t = getRoleLevel(targetRole);
  if (a === null || t === null) return false;   // unknown role → fail safe
  return compareLevels(a, t) < 0;                // strictly higher authority only
}
