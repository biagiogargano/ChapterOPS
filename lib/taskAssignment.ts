/**
 * taskAssignment.ts — pure derivation of the Create/Edit Task assignee list.
 *
 * Wraps the generic org-level rule (lib/orgLevels.getAssignableRoles) with the
 * two task-screen concerns so the screen carries no testable logic of its own:
 *   1. STABLE DISPLAY ORDER — roles come back in the canonical precedence order
 *      (ROLE_SWITCHER_OPTIONS), not raw candidate order, so the chip row is
 *      predictable regardless of how candidates were passed.
 *   2. EDIT-MODE CURRENT ASSIGNEE — when editing, the task's existing assignee
 *      stays selectable even if it now falls outside the editor's downward set
 *      (e.g. assigned before the org-level rule, or by a higher role), so it is
 *      never silently dropped on save.
 *
 * Pure: no React, no stores, no Supabase, no I/O. Unit-tested in
 * lib/taskAssignment.test.ts.
 */

import { ROLE_SWITCHER_OPTIONS, OFFICER_ROLES, FLOOR_ROLE, type Role } from './roles';
import {
  getAssignableRoles,
  SIGMA_CHI_ASSIGNMENT_EXCEPTIONS,
  type AssignmentException,
} from './orgLevels';

/** Candidate roles offered for assignment (current Sigma Chi pack). */
export const ASSIGNEE_CANDIDATE_ROLES: Role[] = [...OFFICER_ROLES, FLOOR_ROLE];

export interface AssigneeListOptions {
  /** Grant exceptions (defaults to the Sigma Chi alpha list). */
  exceptions?: AssignmentException[];
  /**
   * In edit mode, the existing task's assigned role. When provided, it is always
   * kept in the list (it can't be silently dropped) even if the acting role
   * could not otherwise assign it. 'all' is ignored (broad assignment is not a
   * selectable chip). Omit/undefined for create mode.
   */
  currentAssignee?: Role | 'all';
}

/**
 * The assignee roles the `actingRole` may pick, in canonical display order.
 *
 *   • Always includes the acting role itself (self-assignment).
 *   • Includes every candidate the acting role may assign downward to, plus any
 *     exception-granted candidate (via getAssignableRoles).
 *   • In edit mode, always includes `currentAssignee` (except 'all').
 *   • De-duplicated; ordered by ROLE_SWITCHER_OPTIONS precedence.
 *   • Unknown roles never appear (fail safe, inherited from getAssignableRoles).
 */
export function getAssigneeRoleOptions(
  actingRole: Role,
  options: AssigneeListOptions = {},
): Role[] {
  const { exceptions = SIGMA_CHI_ASSIGNMENT_EXCEPTIONS, currentAssignee } = options;

  const allowed = new Set(
    getAssignableRoles(actingRole, ASSIGNEE_CANDIDATE_ROLES, { exceptions }) as Role[],
  );

  // Edit mode: keep the existing assignee selectable (never 'all').
  if (currentAssignee && currentAssignee !== 'all') {
    allowed.add(currentAssignee);
  }

  // Stable display order. Any allowed role not in the precedence list (shouldn't
  // happen with the current catalog) is appended after, preserving determinism.
  const ordered = ROLE_SWITCHER_OPTIONS.filter(r => allowed.has(r));
  for (const r of allowed) {
    if (!ordered.includes(r)) ordered.push(r);
  }
  return ordered;
}
