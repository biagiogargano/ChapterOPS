# RLS Promotion Runbook — Data-Table Row-Level Security

Operational runbook for promoting the **verified data-table RLS** from the
staging/snapshot Supabase project to the alpha/prod project.

**Scope:** the `auth_user_orgs()` helper + RLS on `update_notices`, `events`,
`tasks`, `rsvps`. **Out of scope:** identity tables (`organizations` /
`members` / `positions`), member-keying.

**Operating assumption:** alpha users are authenticated and **mutually trusted
within an org** (RLS enforces the tenant/org boundary, not per-member ownership).

**Principle:** every step is reversible; verify before advancing; apply
**one table at a time**.

> Feature-flag note: the committed repo keeps `AUTH_ENABLED = false` and
> `ORG_SCOPED_DATA = false`. RLS is a database-side concern and is independent
> of these flags. The alpha build sets the flags on via its own env/build — not
> via a repo commit.

---

## 1. Current verification status (staging)

All four data tables that hold chapter content are **RLS-protected and verified
on the staging/snapshot project**, at both the DB level (impersonated SQL) and
the app level (flag-on against staging).

| Table            | Scoping                                  | Staging status        |
|------------------|------------------------------------------|-----------------------|
| `update_notices` | `chapter_id`                             | ✅ Verified (DB + app) |
| `events`         | `chapter_id`                             | ✅ Verified (DB + app) |
| `tasks`          | `chapter_id` (note: `tasks.id` is TEXT)  | ✅ Verified (DB + app) |
| `rsvps`          | via `event_id → events.chapter_id`       | ✅ Verified (DB + app) |
| `organizations` / `members` / `positions` | identity            | ⛔ Deferred (see §11) |

DB verification per table covered: RLS enabled, 4 policies present, cross-org
read = 0, cross-org INSERT rejected, in-org INSERT allowed. App verification
covered: load, create/edit/delete, task-state updates, notice emit/acknowledge,
RSVP submit + excuse/covering/date-name, Phase-3 generated RSVP-review task
persist + cascade-delete, org-switch isolation, empty-org empty state — with no
`row-level security` warnings on legitimate in-org actions.

All four tables share the single `auth_user_orgs()` `SECURITY DEFINER` helper.
Each table's RLS is independently reversible.

---

## 2. Tables protected on staging

- `public.update_notices` — direct `chapter_id` membership check.
- `public.events` — direct `chapter_id` membership check.
- `public.tasks` — direct `chapter_id` membership check (`id` is TEXT; RLS keys
  on `chapter_id`, not `id`).
- `public.rsvps` — **no `chapter_id`**; scoped transitively via
  `EXISTS (events e WHERE e.id = rsvps.event_id AND e.chapter_id ∈ auth_user_orgs())`.

---

## 0. Pre-flight (before any SQL)

- **Take a snapshot / PITR checkpoint** of the alpha project (Dashboard →
  Database → Backups). This is the ultimate rollback.
- Confirm you are in the **alpha/prod** project (not staging); note the project ref.
- Confirm the alpha app build runs with `AUTH_ENABLED = true` +
  `ORG_SCOPED_DATA = true` against this project's URL/anon key.
- Have the **rollback bundle (§5)** open in a separate tab before applying anything.

---

## 3. Recommended promotion sequence

1. **Snapshot** the alpha project (§0).
2. Run **§6 pre-apply checks**; resolve any non-green before proceeding.
3. Apply the **helper** only → verify it exists and (impersonated) returns a
   pilot user's orgs.
4. Apply **`update_notices`** → §7 DB checks → §8 app smoke (notices
   load/emit/ack) → confirm green.
5. Apply **`events`** → §7 DB checks → §8 app smoke (load/create/switch).
6. Apply **`tasks`** → §7 DB checks → §8 app smoke (load/create/state/cascade).
7. Apply **`rsvps`** (last; depends on `events`) → §7 DB checks → §8 app smoke
   (RSVP load/submit/switch).
8. Run the **full §8 app matrix** end-to-end with a multi-membership pilot user.
9. Monitor logs for RLS warnings for a short bake period before widening alpha.

Apply **table-by-table**, not all at once — this localizes any failure to a
single, independently reversible step.

---

## 4. Apply SQL bundle

```sql
-- ============================================================
-- DATA-TABLE RLS — ALPHA PROMOTION (apply on alpha project)
-- Reversible. Identity tables intentionally untouched.
-- ============================================================

-- ---- Helper (idempotent) ----
create or replace function public.auth_user_orgs()
  returns setof uuid
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select m.org_id from public.members m
  where m.auth_user_id = auth.uid() and m.status = 'active'
$$;
revoke all on function public.auth_user_orgs() from public;
grant execute on function public.auth_user_orgs() to authenticated;

-- ---- update_notices ----
alter table public.update_notices enable row level security;
drop policy if exists update_notices_select_org on public.update_notices;
drop policy if exists update_notices_insert_org on public.update_notices;
drop policy if exists update_notices_update_org on public.update_notices;
drop policy if exists update_notices_delete_org on public.update_notices;
create policy update_notices_select_org on public.update_notices for select to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );
create policy update_notices_insert_org on public.update_notices for insert to authenticated
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy update_notices_update_org on public.update_notices for update to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) )
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy update_notices_delete_org on public.update_notices for delete to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );

-- ---- events ----
alter table public.events enable row level security;
drop policy if exists events_select_org on public.events;
drop policy if exists events_insert_org on public.events;
drop policy if exists events_update_org on public.events;
drop policy if exists events_delete_org on public.events;
create policy events_select_org on public.events for select to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );
create policy events_insert_org on public.events for insert to authenticated
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy events_update_org on public.events for update to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) )
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy events_delete_org on public.events for delete to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );

-- ---- tasks (id is TEXT; RLS keys on chapter_id) ----
alter table public.tasks enable row level security;
drop policy if exists tasks_select_org on public.tasks;
drop policy if exists tasks_insert_org on public.tasks;
drop policy if exists tasks_update_org on public.tasks;
drop policy if exists tasks_delete_org on public.tasks;
create policy tasks_select_org on public.tasks for select to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );
create policy tasks_insert_org on public.tasks for insert to authenticated
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy tasks_update_org on public.tasks for update to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) )
  with check ( chapter_id in (select public.auth_user_orgs()) );
create policy tasks_delete_org on public.tasks for delete to authenticated
  using ( chapter_id in (select public.auth_user_orgs()) );

-- ---- rsvps (no chapter_id; scoped via event_id -> events.chapter_id) ----
alter table public.rsvps enable row level security;
drop policy if exists rsvps_select_org on public.rsvps;
drop policy if exists rsvps_insert_org on public.rsvps;
drop policy if exists rsvps_update_org on public.rsvps;
drop policy if exists rsvps_delete_org on public.rsvps;
create policy rsvps_select_org on public.rsvps for select to authenticated
  using ( exists ( select 1 from public.events e
                   where e.id = rsvps.event_id
                     and e.chapter_id in (select public.auth_user_orgs()) ) );
create policy rsvps_insert_org on public.rsvps for insert to authenticated
  with check ( exists ( select 1 from public.events e
                        where e.id = rsvps.event_id
                          and e.chapter_id in (select public.auth_user_orgs()) ) );
create policy rsvps_update_org on public.rsvps for update to authenticated
  using ( exists ( select 1 from public.events e
                   where e.id = rsvps.event_id
                     and e.chapter_id in (select public.auth_user_orgs()) ) )
  with check ( exists ( select 1 from public.events e
                        where e.id = rsvps.event_id
                          and e.chapter_id in (select public.auth_user_orgs()) ) );
create policy rsvps_delete_org on public.rsvps for delete to authenticated
  using ( exists ( select 1 from public.events e
                   where e.id = rsvps.event_id
                     and e.chapter_id in (select public.auth_user_orgs()) ) );
```

---

## 5. Rollback SQL bundle

Roll back in **reverse dependency order** (`rsvps` before `events`, since the
`rsvps` policy reads `events`). Per-table blocks can be run individually.

```sql
-- ============================================================
-- ROLLBACK — disable in reverse dependency order (rsvps first).
-- ============================================================
-- rsvps
drop policy if exists rsvps_select_org on public.rsvps;
drop policy if exists rsvps_insert_org on public.rsvps;
drop policy if exists rsvps_update_org on public.rsvps;
drop policy if exists rsvps_delete_org on public.rsvps;
alter table public.rsvps disable row level security;
-- tasks
drop policy if exists tasks_select_org on public.tasks;
drop policy if exists tasks_insert_org on public.tasks;
drop policy if exists tasks_update_org on public.tasks;
drop policy if exists tasks_delete_org on public.tasks;
alter table public.tasks disable row level security;
-- events  (after rsvps, since rsvps policy reads events)
drop policy if exists events_select_org on public.events;
drop policy if exists events_insert_org on public.events;
drop policy if exists events_update_org on public.events;
drop policy if exists events_delete_org on public.events;
alter table public.events disable row level security;
-- update_notices
drop policy if exists update_notices_select_org on public.update_notices;
drop policy if exists update_notices_insert_org on public.update_notices;
drop policy if exists update_notices_update_org on public.update_notices;
drop policy if exists update_notices_delete_org on public.update_notices;
alter table public.update_notices disable row level security;
-- helper LAST, only on full unwind. Drop FAILS if any policy still references
-- it (a safe guard) — leave it in place otherwise (inert without policies).
-- drop function if exists public.auth_user_orgs();
```

---

## 6. Pre-apply checks (run on ALPHA, before §4)

Prod data differs from staging — re-validate. Each must pass.

```sql
-- a) Helper name not already taken
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname='auth_user_orgs';                      -- expect 0

-- b) members.status distribution (which values grant access?)
select status, count(*) from public.members group by status order by 2 desc;

-- c) Type sanity: chapter_id / id / event_id all uuid
select table_name, column_name, data_type from information_schema.columns
where table_schema='public'
  and ((table_name in ('events','tasks','update_notices') and column_name='chapter_id')
    or (table_name='organizations' and column_name='id')
    or (table_name='rsvps' and column_name='event_id'));

-- d) Orphans / nulls per table (each must be 0)
select 'events' t, count(*) orphans from public.events e
  left join public.organizations o on o.id=e.chapter_id where o.id is null
union all select 'tasks', count(*) from public.tasks x
  left join public.organizations o on o.id=x.chapter_id where o.id is null
union all select 'update_notices', count(*) from public.update_notices n
  left join public.organizations o on o.id=n.chapter_id where o.id is null
union all select 'rsvps_orphan_event', count(*) from public.rsvps r
  left join public.events e on e.id=r.event_id where e.id is null;

select
  (select count(*) from public.events where chapter_id is null)         as ev_null,
  (select count(*) from public.tasks where chapter_id is null)          as tk_null,
  (select count(*) from public.update_notices where chapter_id is null) as un_null,
  (select count(*) from public.rsvps where event_id is null)            as rsvp_null;

-- e) Membership sanity for a known alpha user (repeat per pilot user)
select org_id from public.members where auth_user_id='<ALPHA_USER_ID>' and status='active';
```

**Pre-apply GO requires:** (a) `0`; (b) access-granting members are
`status='active'` — if other statuses must access, **widen the helper first or
STOP**; (c) all `uuid`; (d) **all orphan/null counts = 0**; (e) returns the
expected org(s) for each pilot user.

---

## 7. Post-apply DB verification (impersonated, per table)

For each protected table, with a real `<ALPHA_USER_ID>`, a `<MY_ORG_ID>` they
belong to, and a `<FOREIGN_ORG_ID>` they don't:

```sql
-- structural
select relrowsecurity from pg_class where oid='public.<TABLE>'::regclass;          -- true
select count(*) from pg_policies where schemaname='public' and tablename='<TABLE>'; -- 4

-- read isolation + write enforcement (rolled back)
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<ALPHA_USER_ID>"}';
  select count(*) from public.<TABLE> where chapter_id='<MY_ORG_ID>';      -- > 0
  select count(*) from public.<TABLE> where chapter_id='<FOREIGN_ORG_ID>'; -- 0
  -- foreign insert -> expect RLS rejection; in-org insert -> 1 row (then rollback)
rollback;
```

For `rsvps`, use the event-join read and event-id-based inserts:

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<ALPHA_USER_ID>"}';
  select count(*) from public.rsvps r join public.events e on e.id=r.event_id
    where e.chapter_id='<MY_ORG_ID>';      -- > 0
  select count(*) from public.rsvps;        -- only in-org RSVPs visible
  -- insert with a FOREIGN event_id -> RLS reject; with an in-org event_id -> 1 row
rollback;
```

**DB GO requires:** every table `relrowsecurity=true`, 4 policies, foreign read
= 0, foreign insert rejected, in-org insert allowed.

---

## 8. Post-apply app verification (alpha build, authenticated)

Run the staging-proven matrices on the alpha project:

- **Load:** Today / Calendar / Tasks / event-detail RSVP panel populate for the
  active org; **no** `[eventService|taskService|updateNoticeService|rsvpService]
  … row-level security` warnings.
- **Write:** create/edit/delete event; create/edit task; **update task state**
  (submit/approve/reject); emit + **acknowledge** a notice; submit/change an RSVP
  (+ excuse/covering/date-name).
- **Phase-3:** create RSVP-enabled event → generated review task persists; delete
  event → review task cascade-deletes.
- **Org-switch isolation:** switch orgs → only the active org's
  events/tasks/notices/rsvps show; no leakage; switch back restores.
- **Empty org:** shows empty state (no mock leak — S1).
- **Multi-membership pilot user:** sees each of their orgs; cannot see a
  non-member org.

**App GO requires:** all pass with zero RLS warnings on legitimate in-org actions.

---

## 9. Go / No-Go criteria

- **GO to apply:** snapshot taken; §6 all green; rollback bundle staged; an alpha
  build pointed at this project ready to test.
- **GO to keep enabled:** §7 **and** §8 fully pass.
- **NO-GO / rollback immediately if:** any pre-apply orphan/null > 0 (fix data
  first); a legitimate in-org read returns empty or write is rejected
  (`row-level security` warning) in the app; any pilot user is locked out of
  their own org's data; onboarding/login regresses.

---

## 10. Risks & failure responses

- **Membership status mismatch** (helper filters `active` only): a non-`active`
  member who should have access sees nothing → widen the helper's status filter,
  re-verify. (Caught by pre-check b.)
- **Orphan/null org refs:** rows become invisible/unwritable → reconcile data
  **before** enabling (pre-check d). If found post-apply, rollback the affected
  table, clean data, re-apply.
- **`rsvps` depends on `events`:** if `events` RLS is ever disabled while `rsvps`
  RLS is on, the `EXISTS` still works (explicit `chapter_id` predicate), but
  rollback order matters — **always roll back `rsvps` before `events`**.
- **Session / `auth.uid()` not populated** (a code path reading without a
  session): returns empty under RLS → rollback that table, investigate the call
  path. Low risk for authenticated alpha.
- **Identity tables still open:** not a regression (deliberately untouched) — see §11.
- **General failure:** run the per-table rollback block; if multiple tables
  misbehave, run the full rollback bundle; if data integrity is in question,
  restore from the §0 snapshot.

---

## 11. What remains UNPROTECTED after promotion

- **Identity tables — `organizations`, `members`, `positions`:** no RLS yet. An
  authenticated user could read other orgs'/members' identity rows directly via
  the API.
- **Intra-org authorization (no member-keying):** within an org, any member can
  read/write any role-keyed task/RSVP/notice row. RLS enforces the **tenant
  (org) boundary only**, not per-member ownership. Acceptable under the
  "trusted within org" assumption.
- **Role-based write restrictions** (e.g., only President edits events) remain
  **app-layer**, not DB-enforced.
- **Calendar org-switch flash:** a pre-existing DataBootstrap render-timing
  artifact, unaffected by RLS.

---

## 12. Known deferred items

| Item                          | Status / gating                                                                 |
|-------------------------------|---------------------------------------------------------------------------------|
| **Identity-table RLS**        | Deferred until the email-claim + join-code paths become `SECURITY DEFINER` RPCs |
| **Email-claim RPC**           | Blocker 1 — `lib/memberService.ts`: `linkAuthUserToMember` + the `resolveIdentity` candidate/`emailClaimedByOther` reads are direct `members` reads/UPDATE on unclaimed/foreign rows; must move behind a `SECURITY DEFINER` RPC before `members` RLS |
| **Join-code RPC**             | Blocker 2 — `lib/memberService.ts`: `findOrgByJoinCode` is a direct pre-membership `organizations` read; must move behind a `SECURITY DEFINER` RPC before `organizations` RLS. (Create/Join writes already use the `create_organization` / `join_organization_by_code` RPCs — verify they are `SECURITY DEFINER`.) |
| **Member-keying**             | Deferred — needed for per-member row ownership (only the assignee completes their task; only the member sets their own RSVP). Requires `member_id`/`user_id` columns + ownership-scoped policies |
| **Calendar org-switch flash** | Deferred UX polish — move the org-transition cache reset in `components/DataBootstrap.tsx` to a pre-paint `useLayoutEffect` so the prior org's cache clears before the next frame |

---

*This document is a runbook only. Applying the SQL is a separate, deliberate
operation performed against the alpha project per §3, with a snapshot taken
first and the rollback bundle staged.*
