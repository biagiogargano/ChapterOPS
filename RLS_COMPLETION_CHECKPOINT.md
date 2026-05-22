# RLS Completion Checkpoint (post-CP-5)

Records the completed Row-Level Security milestone for ChapterOPS: both the
**data tables** and the **identity tables** are RLS-protected on **staging and
alpha**, with all identity writes flowing through `SECURITY DEFINER` RPCs.

> Status snapshot at authoring: repo clean at `341d4ec`; committed flags
> `AUTH_ENABLED = false`, `ORG_SCOPED_DATA = false`; local env pointed at alpha.

---

## 1. Completed RLS posture (summary)
Multi-tenant isolation is now enforced at the database layer (not just the app
layer) for every table that holds chapter data or identity, on both Supabase
projects. Reads are policy-scoped to the authenticated user's org(s); writes to
identity tables are denied to clients and performed only by `SECURITY DEFINER`
RPCs. The work landed across a sequence of small, individually-verified
checkpoints (CP-1 → CP-5).

| Checkpoint | Outcome |
|------------|---------|
| CP-1 | Identity-RLS prerequisite migration plan (`IDENTITY_RLS_MIGRATION_PLAN.md`) |
| CP-2a | Inert pure `mapClaimStatusToResolution` mapper + tests |
| CP-2b/2c | `memberService` wired to RPCs; unsafe direct-identity helpers removed |
| CP-3 | `SECURITY DEFINER` RPCs deployed (+ create/join converted) — staging & alpha |
| CP-4 | Identity-table RLS enabled + verified — staging |
| CP-5 | Identity-table RLS enabled + verified — alpha |

(Data-table RLS — `update_notices`, `events`, `tasks`, `rsvps` — was completed
and verified earlier; see `RLS_PROMOTION_RUNBOOK.md`.)

---

## 2. Tables protected by RLS

| Tables | Scope rule | staging | alpha |
|--------|-----------|---------|-------|
| `update_notices`, `events`, `tasks` | `chapter_id IN (auth_user_orgs())` | ✅ | ✅ |
| `rsvps` | via parent event's `chapter_id` (`EXISTS … events`) | ✅ | ✅ |
| `members` | SELECT own rows: `auth_user_id = auth.uid()` | ✅ | ✅ |
| `positions` | SELECT: `org_id IN (auth_user_orgs())` | ✅ | ✅ |
| `organizations` | SELECT: `id IN (auth_user_orgs())` | ✅ | ✅ |

- Identity tables (`members`/`positions`/`organizations`) have **SELECT policies
  only** — no client INSERT/UPDATE/DELETE policies, so direct writes are denied.
- All policies are scoped `TO authenticated`.
- The shared helper `auth_user_orgs()` is `SECURITY DEFINER` + pinned
  `search_path`, returning the active orgs for `auth.uid()` (status `active`); it
  reads `members` regardless of that table's RLS (no recursion).

---

## 3. RPCs used for identity writes / lookups
All `SECURITY DEFINER`, `search_path = public, pg_temp`, `EXECUTE` to
`authenticated`; deployed on **staging and alpha**:

- **`claim_membership_by_email()`** — first-login claim. Derives uid + verified
  email from the session JWT, claims unclaimed roster rows (activating
  `invited → active`), returns a status string. Replaces the former direct
  `members` reads/UPDATE.
- **`find_org_by_join_code(p_code)`** — pre-membership org discovery by join
  code; returns `{ id, name }` only.
- **`create_organization(...)`** — converted to `SECURITY DEFINER` + pinned
  `search_path` (was `SECURITY INVOKER`).
- **`join_organization_by_code(...)`** — same conversion.

App wiring (committed, CP-2b/2c, `lib/memberService.ts`):
- `resolveIdentity` → fast path + `claim_membership_by_email` + the CP-2a mapper.
- `findOrgByJoinCode` → `find_org_by_join_code` (returns `{ id, name } | null`).
- Removed unsafe direct-identity helpers: `fetchMembershipsByEmail`,
  `hasDuplicatePerOrg`, `emailClaimedByOther`, `linkAuthUserToMember`,
  `normalizeEmail`.

---

## 4. Verified on staging
- **DB:** RLS enabled on the three identity tables; exactly the three SELECT
  policies present; impersonated checks showed own-row member isolation,
  your-orgs-only `organizations`/`positions` visibility, foreign org/positions =
  0; RPCs (`claim`, `find`, and a definer write) all succeed under RLS.
- **App (flag-on, env=staging):** first-login claim (`invited → active`),
  steady-state login (fast path), `not_on_roster` routing, join-by-code positive
  path; data flows (events/tasks/notices/rsvps) load; no RLS/`memberService`
  warnings. (Create-org / bad-code edge tests were limited by an email rate
  limit; create/join RPCs were catalog- and DB-verified.)

---

## 5. Verified on alpha
- **Pre-flight:** local logical safety dump taken (Free plan has no PITR/managed
  backups): `alpha_pre_cp5_backup.sql` (outside the repo).
- **Pre-checks:** alpha real data; `auth_user_orgs()` is `SECURITY DEFINER`; RLS
  off pre-apply; **all claimed users `status = 'active'`** (the go/no-go gate);
  RPC prerequisites all `SECURITY DEFINER`.
- **DB:** RLS enabled + the three SELECT policies; impersonated checks confirmed
  own-row member isolation, your-orgs-only visibility, foreign = 0, RPCs work
  under RLS.
- **App (flag-on, env=alpha):** steady login, profile/org/role, Calendar / Today
  / Tasks, event detail / RSVP — all normal; no RLS/`memberService` warnings.
  Multi-org switcher not exercised (the test account is single-org); identity
  isolation is covered by the DB-level impersonated checks.

---

## 6. Rollback summary (high level)
- **RLS is instantly reversible per table** — each table's policies can be
  dropped and `ROW LEVEL SECURITY` disabled independently, returning to
  app-layer-only scoping with no app change. Roll back `rsvps` before `events`
  (its policy reads `events`); identity tables are independent.
- **RPC conversions** are reversible (`ALTER FUNCTION … SECURITY INVOKER` +
  `RESET search_path`); the new RPCs can be `DROP`ped. Do **not** revert
  create/join to `INVOKER` while identity RLS is enabled (roll back RLS first).
- Do **not** drop `auth_user_orgs()` — data-table and identity policies depend on
  it.
- Alpha safety net beyond the SQL toggles: the `alpha_pre_cp5_backup.sql` logical
  dump.
- Exact rollback SQL is captured in `RLS_PROMOTION_RUNBOOK.md` (data tables) and
  `IDENTITY_RLS_MIGRATION_PLAN.md` (RPCs); the identity-table rollback is the
  per-table drop-policy + disable-RLS block used in CP-4/CP-5.

---

## 7. Deferred (not blockers; tracked separately)
- **Member-keying:** not implemented. RLS enforces the **org/tenant boundary
  only** — within an org, role-keyed task/RSVP/notice rows remain mutually
  read/writable. Per-member ownership needs `member_id`/`user_id` columns +
  ownership-scoped policies.
- **Issue A / President Today display-policy:** President-owned or -visible
  `week`/`supervising` tasks (including RM-created "Review RSVP list" tasks)
  aren't surfaced in Today's President sections. Display policy, not RLS.
- **Lightweight `name_submission` surfacing:** "Submit date name" appears at the
  event (date-submission section), not as a standalone Today/Tasks card. Display
  policy.
- **`my_chapter_id()` / `chapters` / `profiles`:** legacy/unused by the current
  app path; no issues observed. Revisit only if those surfaces are used.

---

## 8. Flags remain OFF by default — rollout is a separate decision
- The committed defaults are **`AUTH_ENABLED = false`** and
  **`ORG_SCOPED_DATA = false`**. The app ships in the single-org sandbox; all
  auth/scoping/RLS-dependent paths are inert in committed builds.
- All flag-on verification in this milestone used **local, uncommitted** flag
  flips, reverted afterward.
- RLS is a database-side guarantee and is **independent of these flags** — it is
  live on alpha regardless, but only matters once a build runs with
  `AUTH_ENABLED`/`ORG_SCOPED_DATA` on.
- **Flipping the flags on by default (a real alpha rollout) is an explicit,
  separate decision** — not part of this checkpoint. Member-keying and the
  display-policy items above should be weighed as part of that decision.

---

*Documentation only. No code, SQL, or flag changes are part of this checkpoint.*
