/**
 * Feature flags.
 *
 * AUTH_ENABLED gates the Phase 1 member-identity + auth rollout. ORG_SCOPED_DATA
 * gates the Phase 2 data-scoping rollout (active-org accessor resolves to the
 * resolved active org instead of DEMO_CHAPTER_ID). They are independent.
 *
 * ── Runtime override (env-driven, fail-closed) ────────────────────────────────
 * Each flag is enabled ONLY when its EXPO_PUBLIC_* env var is the exact string
 * "true". This lets a specific build/profile (e.g. a flag-on alpha or staging
 * build) turn them on via env WITHOUT changing committed defaults.
 *
 * Committed default = OFF: when the env var is unset (the normal case in the
 * repo and in any flag-off profile) or is anything other than "true"
 * ("false", "1", "TRUE", "", etc.), the flag is `false` — so committed builds
 * behave exactly as before (single-org sandbox). The strict `=== 'true'` check
 * is intentionally fail-closed: a missing or typo'd env can never accidentally
 * enable auth/scoping.
 *
 * Set via .env (EXPO_PUBLIC_AUTH_ENABLED / EXPO_PUBLIC_ORG_SCOPED_DATA). Metro
 * inlines EXPO_PUBLIC_* at bundle time, so a change needs `npx expo start -c`.
 */

export const AUTH_ENABLED = process.env.EXPO_PUBLIC_AUTH_ENABLED === 'true';

export const ORG_SCOPED_DATA = process.env.EXPO_PUBLIC_ORG_SCOPED_DATA === 'true';
