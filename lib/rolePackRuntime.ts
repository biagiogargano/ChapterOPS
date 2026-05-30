/**
 * rolePackRuntime.ts — pure pack-role → runtime-role compatibility layer.
 *
 * THE SCALING BOTTLENECK, made explicit: starter packs (lib/starterPacks) can carry
 * custom role keys as DATA (RoleKey = string — e.g. the club pack's
 * 'vice_president', 'event_chair'), but the runtime engines (lib/orgLevels.ROLE_LEVEL,
 * task assignment, generateQuestionnaireTasks's Role[]) only accept the CLOSED
 * `Role` union from lib/roles. Passing an unsupported pack key into those engines
 * would be a latent bug.
 *
 * This module is the single, explicit guard for that boundary: it says which pack
 * role keys the current runtime supports and which are future-only custom roles, so
 * callers never accidentally forward an unsupported key. Pure — no React, no stores,
 * no I/O, never throws. When the closed `Role` union eventually opens up (the
 * Supabase-gated decision), this is the one place that changes.
 */

import { ROLES, type Role } from './roles';
import type { RolePack } from './rolePack';

/** The set of role keys the current runtime supports (the closed `Role` catalog). */
const RUNTIME_ROLE_KEYS = new Set<string>(Object.values(ROLES));

/** Type guard: is `key` a role the current runtime engines accept? */
export function isRuntimeRoleKey(key: string): key is Role {
  return RUNTIME_ROLE_KEYS.has(key);
}

/** Narrow a pack role key to a runtime `Role`, or null if unsupported (custom). */
export function toRuntimeRole(key: string): Role | null {
  return isRuntimeRoleKey(key) ? key : null;
}

/**
 * Keep only the runtime-supported roles from a list of pack keys, in input order,
 * de-duplicated. Unsupported/custom keys are dropped (never forwarded). Pure.
 */
export function runtimeRolesFromPackRoles(keys: readonly string[]): Role[] {
  const out: Role[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (isRuntimeRoleKey(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/**
 * The unsupported (future-only custom) keys from a list, in input order,
 * de-duplicated. The complement of runtimeRolesFromPackRoles — for diagnostics /
 * "these roles aren't usable yet" reporting. Pure.
 */
export function unsupportedRuntimeRoleKeys(keys: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (!isRuntimeRoleKey(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/** A pack's OFFICER roles that the runtime supports, in pack order, de-duplicated. */
export function packOfficerRuntimeRoles(pack: RolePack): Role[] {
  return runtimeRolesFromPackRoles(pack.officerRoles ?? []);
}

/**
 * True if EVERY role the pack declares (across roles[], floor, leadership, officers)
 * is runtime-supported — i.e. the pack is fully functional through the current
 * engines with no custom-only keys. The Sigma Chi pack is true; the club pack is
 * false (it has custom keys). Pure.
 */
export function packHasOnlyRuntimeRoles(pack: RolePack): boolean {
  const allKeys = [
    ...pack.roles.map(r => r.key),
    pack.floorRole,
    ...pack.leadershipRoles,
    ...pack.officerRoles,
  ];
  return allKeys.every(isRuntimeRoleKey);
}
