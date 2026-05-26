/**
 * leadership/hierarchy.ts — pure leadership-tree model for the prototype.
 * PROTOTYPE ONLY. No schema/RLS/auth changes; this is a role-level structure
 * (one role each) to make "who reports to whom" and "who can delegate to whom"
 * explicit. Member-level delegation (a chair → a specific brother on their
 * committee) waits on member-level assignment (a deferred backlog item).
 *
 * Pure (imports only role constants); no React/store coupling, so it's easy to
 * test and reuse. Not wired into phase-2 / the alpha.
 */

import { ROLE_LABELS, type Role } from '@/lib/roles';

/**
 * Who each role reports to (the tree edges). null = top of the chapter.
 * Chairs report to the Pro Consul; general brothers sit under the exec line.
 */
export const REPORTS_TO: Record<Role, Role | null> = {
  president:         null,
  pro_consul:        'president',
  annotator:         'pro_consul',
  quaestor:          'pro_consul',
  magister:          'pro_consul',
  kustos:            'pro_consul',
  tribune:           'pro_consul',
  risk_manager:      'pro_consul',
  social_chair:      'pro_consul',
  recruitment_chair: 'pro_consul',
  brother:           'pro_consul',
};

/**
 * Delegation level (lower = more authority). Delegation flows DOWNWARD: a role
 * can delegate to any role at a strictly higher level number. This lets chairs
 * (level 2) delegate to brothers (level 3) even though they're siblings in the
 * reporting tree.
 */
export const LEADERSHIP_LEVEL: Record<Role, number> = {
  president:         0,
  pro_consul:        1,
  annotator:         2,
  quaestor:          2,
  magister:          2,
  kustos:            2,
  tribune:           2,
  risk_manager:      2,
  social_chair:      2,
  recruitment_chair: 2,
  brother:           3,
};

/** The role this role reports to, or null at the top. */
export function reportsTo(role: Role): Role | null {
  return REPORTS_TO[role];
}

/** Upward chain from a role to the top, inclusive: [role, …, president]. */
export function reportingChain(role: Role): Role[] {
  const chain: Role[] = [role];
  let cur = REPORTS_TO[role];
  while (cur) { chain.push(cur); cur = REPORTS_TO[cur]; }
  return chain;
}

/** Roles that directly report to the given role (tree children). */
export function directReports(role: Role): Role[] {
  return (Object.keys(REPORTS_TO) as Role[]).filter(r => REPORTS_TO[r] === role);
}

/** Can `from` delegate work to `to`? (strictly lower authority level). */
export function canDelegate(from: Role, to: Role): boolean {
  return LEADERSHIP_LEVEL[from] < LEADERSHIP_LEVEL[to];
}

/** All roles `from` may delegate to (everyone below them in authority). */
export function delegableRoles(from: Role): Role[] {
  return (Object.keys(LEADERSHIP_LEVEL) as Role[])
    .filter(to => canDelegate(from, to))
    .sort((a, b) => LEADERSHIP_LEVEL[a] - LEADERSHIP_LEVEL[b]);
}

/** Roles grouped by level, ascending — for rendering the tree top-to-bottom. */
export function rolesByLevel(): { level: number; roles: Role[] }[] {
  const levels = Array.from(new Set(Object.values(LEADERSHIP_LEVEL))).sort((a, b) => a - b);
  return levels.map(level => ({
    level,
    roles: (Object.keys(LEADERSHIP_LEVEL) as Role[])
      .filter(r => LEADERSHIP_LEVEL[r] === level),
  }));
}

/** Display label passthrough so callers don't import two modules. */
export function label(role: Role): string {
  return ROLE_LABELS[role];
}
