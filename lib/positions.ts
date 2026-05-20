/**
 * positions.ts — pure, deterministic helpers for turning a member's role
 * assignments (positions) into an acting role and capability checks.
 *
 * This module is intentionally side-effect free: no I/O, no providers, no
 * stores, no React. It is unit-testable in isolation and is the single source
 * of truth for "given these positions, which role does this member act as."
 *
 * Role strings are interpreted against the current Sigma Chi role system
 * (lib/roles.ts). Unknown role strings (e.g. a future custom role) are ignored
 * defensively with a console.warn — never thrown — so older clients can't crash
 * on roles they don't recognize.
 */

import { type Role, ROLES, OFFICER_ROLES } from './roles';
import type { Position } from '../types';

/**
 * Roles ordered from most → least capability. `deriveActingRole` returns the
 * highest-precedence active role a member holds; every member is at least a
 * 'brother' (the floor).
 */
export const ROLE_PRECEDENCE: Role[] = [
  ROLES.PRESIDENT,
  ROLES.PRO_CONSUL,
  ROLES.ANNOTATOR,
  ROLES.RISK_MANAGER,
  ROLES.SOCIAL_CHAIR,
  ROLES.RECRUITMENT_CHAIR,
  ROLES.BROTHER,
];

const KNOWN_ROLES = new Set<string>(ROLE_PRECEDENCE);

/**
 * Active positions whose role string is recognized by the current role system,
 * mapped to typed Roles. Inactive positions are skipped; unknown role strings
 * are dropped with a warning.
 */
function activeKnownRoles(positions: Position[]): Role[] {
  const out: Role[] = [];
  for (const p of positions) {
    if (!p.isActive) continue;
    if (KNOWN_ROLES.has(p.role)) {
      out.push(p.role as Role);
    } else {
      console.warn(`[positions] ignoring unknown role string: "${p.role}"`);
    }
  }
  return out;
}

/**
 * The single role a member acts as: the highest-precedence active, known role.
 * Empty / inactive-only / all-unknown positions resolve to 'brother'.
 */
export function deriveActingRole(positions: Position[]): Role {
  const roles = activeKnownRoles(positions);
  for (const r of ROLE_PRECEDENCE) {
    if (roles.includes(r)) return r;
  }
  return ROLES.BROTHER;
}

/**
 * Distinct active, known roles a member holds, ordered by precedence and always
 * including 'brother' (the floor). Used by a future "act as" switch.
 */
export function availableRoles(positions: Position[]): Role[] {
  const present = new Set<Role>(activeKnownRoles(positions));
  present.add(ROLES.BROTHER);
  return ROLE_PRECEDENCE.filter(r => present.has(r));
}

/** True if the member holds any active officer position. */
export function isOfficerMember(positions: Position[]): boolean {
  return availableRoles(positions).some(r => OFFICER_ROLES.includes(r));
}
