# Phase 2 — Architecture & Verification Checkpoint

Stable-state record for the auth / org-scoping / RLS work. Implementation notes,
not marketing. The **current architecture checkpoint** is first; the original
flag-on scoped-data verification note is preserved at the end as history.

---

## Current architecture checkpoint (post-`258bc8a`)

### Branch & commit
- Branch: **`phase-2`** (in sync with `origin/phase-2`).
- Latest commit: **`258bc8a`** — "auto-select default org for multi-org users".

### Flags / default-off posture
- Feature flags are **env-overridable** (`lib/flags.ts`), fail-closed:
  - `AUTH_ENABLED   = process.env.EXPO_PUBLIC_AUTH_ENABLED   === 'true'`
  - `ORG_SCOPED_DATA = process.env.EXPO_PUBLIC_ORG_SCOPED_DATA === 'true'`
- **Committed default = OFF.** With the env vars unset (the repo default), both
  resolve to `false` → the app boots into the single-org sandbox, exactly as
  before. Only the exact string `"true"` enables a flag.
- A **flag-on build** is achieved via a local, gitignored env profile
  (`.env.<project>.flagon.local`) — no committed `true`, no code change.
- All auth/scoping/identity paths are inert in committed/flag-off builds.

### RLS / RPC status (live on **staging + alpha**)
- **Data-table RLS:** `events`, `tasks`, `update_notices` scoped by
  `chapter_id IN (auth_user_orgs())`; `rsvps` scoped via the parent event's
  `chapter_id`. SELECT/INSERT/UPDATE/DELETE policies, `TO authenticated`.
- **Identity-table RLS:** `members` (SELECT own rows: `auth_user_id = auth.uid()`),
  `positions` and `organizations` (SELECT: `… IN (auth_user_orgs())`).
  **SELECT policies only** — identity writes are denied to clients and performed
  exclusively by `SECURITY DEFINER` RPCs.
- **Helper:** `auth_user_orgs()` — `SECURITY DEFINER`, pinned `search_path`,
  returns the active orgs for `auth.uid()`; reads `members` regardless of its RLS
  (no recursion).
- **Identity RPCs** (`SECURITY DEFINER`, `search_path` pinned, EXECUTE to
  `authenticated`): `claim_membership_by_email()`, `find_org_by_join_code(p_code)`,
  and the converted `create_organization(...)` / `join_organization_by_code(...)`.
- **App wiring:** `lib/memberService.ts` `resolveIdentity` → fast path +
  `claim_membership_by_email` + the pure `mapClaimStatusToResolution`;
  `findOrgByJoinCode` → `find_org_by_join_code`. The unsafe direct-identity
  helpers (`fetchMembershipsByEmail`, `linkAuthUserToMember`, `emailClaimedByOther`,
  `hasDuplicatePerOrg`, `normalizeEmail`) were removed.

### Multi-org behavior
- **Read/write scoping:** `useActiveDataOrgId` (reads) + the `getDataOrgId`
  holder (writes), kept in sync by `DataBootstrap` (`useLayoutEffect`); the
  org-transition cache reset + the screen-local event-list clear prevent stale
  prior-org data on switch.
- **Org switcher:** Me/Profile lists the user's orgs (when `memberships.length > 1`)
  and switches via `setActiveOrg`.
- **Preferred org persistence:** `setActiveOrg` persists a per-user
  `preferredOrgId` (AsyncStorage, keyed by auth uid); restored on restart.
- **First-time multi-org default:** a multi-org user with **no valid stored
  preference** is auto-routed into a **deterministic default org**
  (`pickDefaultOrg`: org name asc, id tie-breaker) via `setActiveOrg` — instead
  of stranding on the onboarding hub. Stored preference and explicit switches
  take precedence and persist.

### Verified (staging, flag-on; identity RLS live)
- Data-table + identity-table RLS: own-row member isolation, your-orgs-only
  org/position/data visibility, cross-org = 0; RPCs (claim / find / definer
  write) work under RLS.
- Onboarding: first-login claim (`invited → active`), steady-state login,
  `not_on_roster`, join-by-code (positive + negative).
- Multi-org: switcher, per-org role re-derivation (President vs Brother),
  per-org scoped data with no cross-org leakage, preferred-org persistence across
  restart, and the deterministic default-org auto-select for a no-preference
  user. Single-org and flag-off behavior unchanged.
- Alpha (flag-on): steady login, profile/org/role, Calendar/Today/Tasks,
  event/RSVP — all normal; no RLS/`memberService` warnings.

### Intentionally deferred (not blockers; tracked)
- **Member-keying:** not implemented. RLS enforces the **org/tenant boundary
  only** — within an org, role-keyed task/RSVP/notice rows remain mutually
  read/writable. Gates the *breadth* of any rollout (trusted-within-org is fine;
  broader exposure needs member-keying).
- **Display-policy items:** (a) **Issue A** — President's future/`supervising`
  tasks (incl. RM-created "Review RSVP list") aren't surfaced in Today's
  President sections; (b) lightweight **`name_submission`** ("Submit date name")
  appears only at the event, not as a Today/Tasks card. Both are display policy,
  not RLS/data.
- **Managed backups:** Free plan has no PITR; rely on local logical dumps and a
  manual backup cadence before risky changes.
- **`my_chapter_id` / `chapters` / `profiles`:** legacy/unused by the app path;
  no issues observed.
- **Dedicated org picker (Option B):** the `org_select` route still points at the
  onboarding hub; the deterministic default-org auto-select makes this a
  non-blocking polish item.
- **Flag-on-by-default rollout:** committing the flags `true` (or shipping a
  flag-on alpha build to real testers) is an explicit, separate decision — not
  done here.

### Recommended next phase
**Feature development with security guardrails in place.** The data + identity
tenant boundary is now RLS-enforced on both projects, flags are env-gated and
default-off, and multi-org resolution is stable. New feature work (e.g., Phase 3
event-generated task templates already begun, and beyond) can proceed on top of
these guardrails. Before *widening* a real rollout, weigh **member-keying** and
the **display-policy** items; the flag-on-by-default decision remains separate.

---

## Appendix — original Phase 2 scoped-data verification note (historical)

> Recorded earlier in the effort (branch `phase-2` at commit `6db17de`), before
> RLS/RPCs/multi-org work. Kept for history; superseded by the checkpoint above.

### What was tested
Local-only run with **both flags temporarily flipped on** (uncommitted):
`AUTH_ENABLED = true`, `ORG_SCOPED_DATA = true`. Reverted to `false` after the
run; neither flag committed `true`. Org A = demo chapter
(`biagio@alphalambda.org`), Org B created via onboarding.

### Results (all passed)
- Org A event/standalone task **persisted** after a full restart.
- Org B did **not** see Org A's data, and vice versa.
- **No stale data** appeared while switching accounts/orgs.

### What it confirmed (at the time)
Org-scoped reads + writes resolved the same active org and switching no longer
leaked the previous org's cached data — at the **app layer** (RLS had not yet
landed). The "Explicitly NOT done yet" items from that note (RLS, member-keying,
alpha rollout) have since been addressed except where listed as deferred above.
