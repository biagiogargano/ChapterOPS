/**
 * usePushRegistration — exposes maybeRegisterForPush(), called from the app's
 * "first meaningful action" sites (task detail open, RSVP save) to register this
 * device's Expo push token. Push v1, Stage 3 — registration only, no sends.
 *
 * Gating (so we never prompt at cold launch / login / in the sandbox):
 *   • only when AUTH_ENABLED and identity is a REAL resolved member
 *     (phase 'resolved', not fallback, member present, real active org);
 *   • registerPushToken() itself dedupes to one attempt per session and never
 *     re-prompts after a denial.
 *
 * The returned callback is stable and safe to call repeatedly; extra calls are
 * cheap no-ops once an attempt has happened.
 */

import { useCallback } from 'react';
import { useIdentity } from './identityStore';
import { useActiveDataOrgId } from './useActiveDataOrgId';
import { AUTH_ENABLED } from './flags';
import { registerPushToken } from './pushTokens';

export function usePushRegistration(): { maybeRegisterForPush: () => void } {
  const { phase, isFallback, member } = useIdentity();
  const orgId = useActiveDataOrgId();

  const maybeRegisterForPush = useCallback(() => {
    // Real signed-in member only — never the President fallback / sandbox.
    if (!AUTH_ENABLED) return;
    if (isFallback) return;
    if (phase !== 'resolved') return;
    if (!member) return;
    if (!orgId) return;
    // Fire-and-forget; registerPushToken handles dedupe, permission, and errors.
    void registerPushToken(orgId);
  }, [phase, isFallback, member, orgId]);

  return { maybeRegisterForPush };
}
