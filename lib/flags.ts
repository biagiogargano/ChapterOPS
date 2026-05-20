/**
 * Feature flags.
 *
 * AUTH_ENABLED gates the Phase 1 member-identity + auth rollout. It stays
 * `false` until the full identity stack is built and verified (see the Phase 1
 * blueprint, commit C12). While false, the app behaves exactly as today.
 *
 * This file intentionally contains no logic — only inert constants.
 */

export const AUTH_ENABLED = false;
