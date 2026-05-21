/**
 * Feature flags.
 *
 * AUTH_ENABLED gates the Phase 1 member-identity + auth rollout. It stays
 * `false` until the full identity stack is built and verified (see the Phase 1
 * blueprint, commit C12). While false, the app behaves exactly as today.
 *
 * ORG_SCOPED_DATA gates the Phase 2 data-scoping rollout. While `false`, the
 * data layer continues to use the DEMO_CHAPTER_ID constant (today's behavior);
 * when `true`, the active-org accessor resolves to the resolved active org.
 * Independent of AUTH_ENABLED.
 *
 * This file intentionally contains no logic — only inert constants.
 */

export const AUTH_ENABLED = false;

export const ORG_SCOPED_DATA = false;
