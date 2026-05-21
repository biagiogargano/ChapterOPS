# Phase 1 — Member Identity & Auth Foundation

Status as of the C14 work. This documents what exists, what is deliberately
unfinished, how to roll back, and what Phase 2 must do before real multi-org
production. It is implementation notes, not marketing.

> **Bottom line:** Phase 1 built a complete, tested auth + identity foundation
> *behind a feature flag*. `AUTH_ENABLED` is **`false`** in committed code, so
> the app still boots straight into the existing role-switch sandbox. Turning
> auth on for real multi-tenant production is **blocked on Phase 2** (org-scoped
> data + RLS).

---

## What Phase 1 completed

- Real Supabase **email/password auth** behind `AUTH_ENABLED`.
- A **member identity layer**: `organizations` / `members` / `positions` tables
  (multi-org-shaped: a user can belong to N orgs).
- **Identity resolution + claim-by-login**: a verified email claims a
  pre-provisioned roster row on first login (atomic, idempotent, race-safe).
- **Router gating** via `decideRoute` + `useRouteTarget` + per-group `<Redirect>`
  guards (no raw components rendered at the navigator root).
- **Onboarding**: join an existing org by code, or create a new org (creator
  becomes President), via transactional Postgres RPCs.
- **Real sign-out** from the Me tab and the auth screens.
- A **compatibility shim** so the entire existing role-based app keeps working
  unchanged: `useDevRole()` now derives its role from identity instead of a
  hand-set value, with the same `{ role, setRole }` contract.
- Role switcher is **`__DEV__`-gated** (no role impersonation in real builds).

## Auth / onboarding features that now work (flag-on, tested locally)

- No session → login screen; wrong credentials → inline error.
- Signup → "confirm email" message (or auto sign-in if confirmation is off).
- Seeded email (e.g. `biagio@alphalambda.org`) → claims member → enters app as
  President.
- Fresh / zero-membership user → onboarding hub (Join / Create / Sign Out).
- Create org → President of the new org, with a generated join code.
- Join by code (e.g. `ALPHA1`) → joins as `brother`.
- Bad code → "not found"; re-join / double submit → idempotent (no duplicates).
- Identity resolution error → escapable ErrorRetry (Retry + Sign Out).
- Sign out from tabs → returns to login.

## Current architecture summary

Provider tree (root `app/_layout.tsx`):

```
AuthProvider                 lib/auth.tsx        — single supabase.auth subscription
  IdentityProvider           lib/identityStore   — session → memberships → activeOrg → actingRole
    DevRoleProvider (shim)    lib/devRoleStore    — frozen useDevRole(); role = identity.actingRole
      Stack (expo-router)     app/_layout.tsx     — always rendered; gating via Redirect in groups
```

- **Flag gate:** `lib/flags.ts` `AUTH_ENABLED`. While `false`, `IdentityProvider`
  is forced into its President fallback (`configuredOverride={false}`) and
  `decideRoute` returns `'tabs'` for everyone → app boots to tabs unchanged.
- **Routing brain:** `lib/initRoute.ts` (`decideRoute`, pure, unit-tested),
  `lib/routeTarget.ts` (`hrefForTarget`, pure), `lib/useRouteTarget.ts` (hook).
- **Route guards:** `app/(tabs)/_layout.tsx` and `app/(auth)/_layout.tsx`, plus
  per-leaf guards in `(auth)/login|signup|onboarding|join|create`.
- **Identity tables / SQL:** `supabase/identity_schema.sql`,
  `supabase/identity_seed.sql`, `supabase/identity_join_code.sql` (RPCs:
  `create_organization`, `join_organization_by_code`).
- **Service adapter:** `lib/memberService.ts` (reads + claim + org-write RPCs),
  pure helper `lib/positions.ts` (role derivation), `lib/identityResolution.ts`
  (active-org selection, fallback identity).

## What still uses shared / mock / demo data

This is the most important limitation to understand:

- **App data is NOT org-scoped.** `eventService` / `taskService` /
  `rsvpService` / update-notices still filter by the **`DEMO_CHAPTER_ID`
  constant**, not the resolved active org. A real signed-in user (any org) sees
  the **demo chapter's** events / tasks / RSVPs.
- **RSVP is keyed by `role`**, not `member_id` (two real members in the same
  role share one RSVP slot).
- **Tasks/notifications are role-targeted**, approvals role-attributed
  ("approved by President", not by a person).
- `me.tsx` shows `DEMO_USER` / `DEMO_CHAPTER`, not the resolved member/org.
- Capabilities (`canManageEvent`, `canApproveTask`, etc.) remain **role-based**,
  fed by the shim — identity is real, but authorization is still role-derived.

## Why `AUTH_ENABLED` remains false by default

1. **No RLS.** With auth on but Row-Level Security off, any authenticated user
   could read/write **all** orgs' rows. Unsafe for real multi-tenant use.
2. **Data not org-scoped.** Even signed in, users would see demo-chapter data,
   which is wrong/confusing.

So the committed default stays `false`. Flag-on is appropriate only for
**internal / staging / single-demo-org** testing until Phase 2 lands.

## Rollback strategy (feature flag)

- **Primary kill switch:** set `lib/flags.ts` `AUTH_ENABLED = false` and ship.
  Instantly reverts to the role-switch sandbox; no other change needed.
- **Git:** every Phase 1 commit is isolated and revertible.
- **Database:** the identity tables are **additive**. Leaving them in place with
  the flag off has zero runtime effect (the fallback path never reads them). No
  DB rollback is required to recover the app.
- **Stuck users (flag-on):** every auth/onboarding/error screen offers Sign Out;
  onboarding writes are RPC transactions (no orphan orgs).
- The flag is **compile-time** today → disabling needs a redeploy. A runtime /
  remote flag is a future improvement.

## Known limitations / technical debt (intentional)

- Data not org-scoped (`DEMO_CHAPTER_ID` constant in services).
- RSVP/tasks/notices keyed by role, not member.
- No per-member attribution / audit trail.
- `me.tsx` shows demo identity, not the real member.
- Password-only auth (magic link defined in the surface but unused).
- No multi-org picker (`org_select` routes to the onboarding hub).
- Join codes are static, low-entropy, no expiry/approval.
- Dev compatibility shim still load-bearing (role-based logic depends on it).
- No membership status lifecycle UI (alumni / committees / officer transitions).
- The "DEV MODE · auth bypassed" badge on the Me tab is always shown.

## Why Phase 2 is required before production multi-org rollout

Phase 1 makes identity real but authorization and data are still role/demo-based.
For genuine multi-tenant behavior you need data isolation (org scoping) and
enforcement (RLS) — otherwise different orgs share/leak data. That is Phase 2.

## What Phase 2 likely includes

- Thread the **active `org_id`** through `eventService` / `taskService` /
  `rsvpService` / notices (replace the `DEMO_CHAPTER_ID` constant with resolved
  context).
- **Member-keyed** RSVPs / task ownership; per-member notification read state.
- **Per-member attribution** ("approved by <person>") + basic audit.
- **RLS policies** on all identity + app tables.
- Real `me.tsx` profile; multi-org picker; magic link; membership status gates.
- Eventually retire the dev shim / role switcher once authorization is
  member/position-based.

## What should not be changed casually

- The **role engine** and the frozen `useDevRole()` `{ role, setRole }` contract.
- The **mock/demo fallback** path and `DEMO_CHAPTER_ID` usage (changing it is a
  Phase 2 data-scoping task, not a tweak).
- The **`AUTH_ENABLED` flag mechanism** (it is the rollback guarantee).
- Provider **mount order** (Auth → Identity → DevRole → Stack) and the
  single `onAuthStateChange` subscription in `lib/auth.tsx`.
- `decideRoute` precedence — especially the `!AUTH_ENABLED → 'tabs'` rule that
  keeps the mount inert while the flag is off.

## Current testing status / results

- **Unit (pure, node-run):** `positions` (22), `identityResolution` (21),
  `initRoute` (12), `routeTarget` (12) — all passing.
- **`tsc --noEmit`:** clean across the project.
- **Flag-off regression:** app boots to tabs identically to pre-Phase-1
  (role switch, RSVP, tasks, Event Detail, deep links) — verified manually.
- **Flag-on (local, with identity SQL applied):** login, wrong-credentials,
  signup, seeded-claim → President, zero-membership → onboarding, create org,
  join by code, bad code, idempotent re-join, error→retry, sign-out — all
  verified manually.

## Current security limitations

- **No RLS** — all access control is app-layer only; the database does not
  enforce per-org/per-user boundaries.
- **Static join codes** — 6 chars, no expiry, no approval; anyone with a code
  joins as `brother`.
- **No write authorization at the DB** — onboarding RPCs run without row
  security; trust is client/flag-based.
- **Auth edge cases** not yet hardened at scale: email confirmation policy,
  signup abuse/rate-limiting, removed-user session revocation timing.
- These are acceptable for internal/demo testing only, not production.
