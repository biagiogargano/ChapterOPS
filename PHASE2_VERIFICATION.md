# Phase 2 — Scoped-Data Verification Note

Records the result of the local flag-on verification of org-scoped data
(read + write + org switching). Implementation notes, not marketing.

## What was tested
Local-only run with **both flags temporarily flipped on** (uncommitted):
`AUTH_ENABLED = true`, `ORG_SCOPED_DATA = true`. Reverted to `false` after the
run; **neither flag is committed `true`**.

Branch `phase-2` at commit `6db17de` ("reset org-scoped caches on org
transition"). Supabase identity tables applied (`identity_schema` +
`identity_seed` + `identity_join_code`); Org A = demo chapter
(`biagio@alphalambda.org`), Org B created via onboarding.

## Results (all passed)
- Org A event **persisted** after a full restart.
- Org A standalone task **persisted** after a full restart.
- Org B did **not** see Org A's data.
- Org B event/task creation worked (scoped to B).
- Org A did **not** see Org B's data.
- **No stale data** appeared while switching accounts/orgs (the org-transition
  cache reset clears the previous org before re-hydrating).

## What this confirms
Org-scoped **reads** (events/tasks/notices via `useActiveDataOrgId` +
`DataBootstrap`) and **writes** (events/tasks/notices via the `getDataOrgId`
holder) resolve the same active org, and switching orgs no longer leaks the
previous org's cached data. Read/write parity and switch-cleanliness hold under
the flag-on path.

## Committed default & guardrails (unchanged)
- `AUTH_ENABLED = false` and `ORG_SCOPED_DATA = false` remain the committed
  defaults; the app boots into the single-org sandbox.
- All Phase 2 scoping is inert while the flags are off.

## Explicitly NOT done yet (do not assume these are in place)
- **No RLS** — the database does not enforce per-org boundaries; isolation is
  app-layer only. This is the gating item before any real multi-tenant exposure.
- **No member-keying** — RSVPs/tasks/notices remain role-keyed, not per-member.
- **No alpha testers / production rollout** — flag-on is for internal/staging
  verification only until RLS lands.
- **Known limitation (Issue C, deferred):** switching to a *genuinely empty*
  real org may briefly show the mock/demo fallback (empty cache → `MOCK_*`
  merge). Not a stale-prior-org leak; a separate gap to close before production.
- **Today "Coming Up" (Issue A, deferred):** a President's future (non-today)
  task does not appear on the Today tab's Coming Up section (pre-existing UX,
  unrelated to scoping).

## Next phases (not started)
RLS policies, then member-keying, then a staged decision on flipping
`ORG_SCOPED_DATA` / `AUTH_ENABLED` on by default — none of which is begun here.
