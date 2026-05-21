/**
 * orgPreference.ts — per-user "last selected org" persistence.
 *
 * ⚠️ STATUS: Step 1 groundwork only. This module is INERT — nothing imports it
 *    yet. A later checkpoint wires it into identityStore (write on explicit org
 *    selection; async read when a multi-org account lands in 'selecting_org').
 *
 * Multi-org accounts choose an active org at runtime, but that choice currently
 * lives only in React state, so a restart drops it and the app can land in a
 * different org. This stores the choice in AsyncStorage, keyed PER AUTHENTICATED
 * USER, so the preference survives restart and never leaks between accounts on
 * the same device.
 *
 * Design (approved):
 *   • key = `chapterops.preferredOrgId.${userId}` (namespaced + per-user);
 *   • saved only on explicit selection (the future setActiveOrg wiring);
 *   • NOT cleared on sign-out / account switch — per-user keying keeps each
 *     account's last org for next login. clearPreferredOrg exists only for
 *     housekeeping a stale/invalid stored value the caller detects later;
 *   • a stored org no longer in the user's memberships is ignored by
 *     selectActiveOrg's existing validity check — this module just stores/reads.
 *
 * All wrappers NEVER throw: on any storage error they degrade to today's
 * behavior (get → null; set/clear → no-op), so a storage failure can never crash
 * identity resolution. Flag-off/fallback never calls these (no auth user).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'chapterops.preferredOrgId.';

/** Pure: the per-user storage key. */
export function preferredOrgKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Read the user's last selected org id, or null on miss / any error. */
export async function getPreferredOrg(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(preferredOrgKey(userId));
  } catch {
    return null;
  }
}

/** Persist the user's selected org id. Best-effort; swallows storage errors. */
export async function setPreferredOrg(userId: string, orgId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(preferredOrgKey(userId), orgId);
  } catch {
    // best-effort persistence — ignore
  }
}

/** Remove the user's stored org id (housekeeping for a stale value). */
export async function clearPreferredOrg(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(preferredOrgKey(userId));
  } catch {
    // best-effort — ignore
  }
}
