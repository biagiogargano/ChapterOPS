# Identity-Table RLS — Prerequisite Migration Plan (DRAFT)

**Status: DRAFT — NOT APPLIED.** This document contains the SQL prerequisites
that must be in place **before** Row-Level Security can be enabled on the
identity tables (`organizations`, `members`, `positions`). None of this SQL has
been run. Identity-table RLS itself is **not** included here and must not be
enabled until these prerequisites are applied and **rehearsed on a staging
project** (see §7).

---

## 1. Purpose & current blocker state

Data-table RLS (`update_notices`, `events`, `tasks`, `rsvps`) is already live and
verified, scoped via the `auth_user_orgs()` `SECURITY DEFINER` helper. Extending
RLS to the identity tables is blocked because several identity paths in
`lib/memberService.ts` perform **direct reads/writes on rows the caller does not
yet own**, which an `auth.uid()`-scoped policy would reject:

- **First-login email claim** reads unclaimed/foreign `members` rows and UPDATEs
  a row whose `auth_user_id` is still `NULL` (`resolveIdentity`,
  `linkAuthUserToMember`, `emailClaimedByOther`, `fetchMembershipsByEmail`).
- **Join-code discovery** reads a foreign `organizations` row pre-membership
  (`findOrgByJoinCode`).

**Confirmed via read-only catalog inspection:**

| Function | `is_security_definer` | owner | search_path |
|---|---|---|---|
| `public.create_organization` | **false (INVOKER)** | `postgres` | `NULL` |
| `public.join_organization_by_code` | **false (INVOKER)** | `postgres` | `NULL` |

Because both are `SECURITY INVOKER`, their inserts into
`organizations`/`members`/`positions` would be **blocked** once identity RLS is
on. Owner is `postgres` (bypasses RLS), so converting them to `SECURITY DEFINER`
is a viable fix; `search_path` must be pinned at the same time.

**Four prerequisites (this document):**
1. `claim_membership_by_email()` RPC (replaces the direct claim flow).
2. `find_org_by_join_code(p_code)` RPC (replaces the direct join-code read).
3. Convert `create_organization` → `SECURITY DEFINER` + pinned `search_path`.
4. Convert `join_organization_by_code` → `SECURITY DEFINER` + pinned `search_path`.

---

## 2. Draft SQL (NOT APPLIED)

### 2.1 `claim_membership_by_email()` — first-login claim
Takes **no client params** — derives identity from the session (`auth.uid()` +
verified email from the JWT) so it cannot be spoofed. Returns a status string
mirroring the app's `MemberResolution` kinds; the app then re-reads memberships
via the RLS-safe `auth_user_id` path.

```sql
create function public.claim_membership_by_email()
  returns text   -- 'resolved'|'not_on_roster'|'ambiguous_email'|'email_taken'|'claim_conflict'|'unauthenticated'|'missing_email'
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text := lower(auth.jwt() ->> 'email');
  v_unclaimed int;
  v_dup       int;
  v_taken     int;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  if v_email is null or v_email = '' then return 'missing_email'; end if;

  -- Fast path: already linked.
  if exists (select 1 from members where auth_user_id = v_uid) then
    return 'resolved';
  end if;

  -- Unclaimed candidates for this email.
  select count(*) into v_unclaimed
  from members
  where lower(email) = v_email and auth_user_id is null;

  -- Ambiguity: 2+ unclaimed rows in a single org.
  select count(*) into v_dup
  from (
    select org_id
    from members
    where lower(email) = v_email and auth_user_id is null
    group by org_id
    having count(*) > 1
  ) d;
  if v_dup > 0 then return 'ambiguous_email'; end if;

  if v_unclaimed = 0 then
    select count(*) into v_taken
    from members
    where lower(email) = v_email
      and auth_user_id is not null
      and auth_user_id <> v_uid;
    if v_taken > 0 then return 'email_taken'; end if;
    return 'not_on_roster';
  end if;

  -- Guarded link of all unclaimed candidates + activate 'invited' rows.
  update members
     set auth_user_id = v_uid,
         status = case when status = 'invited' then 'active' else status end
   where lower(email) = v_email
     and auth_user_id is null;

  if exists (select 1 from members where auth_user_id = v_uid) then
    return 'resolved';
  end if;
  return 'claim_conflict';
end
$$;

revoke all on function public.claim_membership_by_email() from public;
grant execute on function public.claim_membership_by_email() to authenticated;
```

### 2.2 `find_org_by_join_code(p_code)` — pre-membership discovery
Returns only `id` + `name` (no member lists / no full org row); authenticated
callers only.

```sql
create function public.find_org_by_join_code(p_code text)
  returns table (id uuid, name text)
  language sql
  security definer
  set search_path = public, pg_temp
as $$
  select o.id, o.name
  from organizations o
  where lower(o.join_code) = lower(trim(p_code))
  limit 1
$$;

revoke all on function public.find_org_by_join_code(text) from public;
grant execute on function public.find_org_by_join_code(text) to authenticated;
```

### 2.3 Convert `create_organization` → SECURITY DEFINER + search_path
> ⚠️ Replace `(<ARGS>)` with the exact identity arguments from the read-only
> catalog check (`pg_get_function_identity_arguments`). Expected (confirm types):
> `(p_name text, p_template text, p_auth_user_id uuid, p_email text, p_full_name text)`.

```sql
alter function public.create_organization(<ARGS>) security definer;
alter function public.create_organization(<ARGS>) set search_path = public, pg_temp;
-- owner is already postgres; no owner change needed.
```

### 2.4 Convert `join_organization_by_code` → SECURITY DEFINER + search_path
> ⚠️ Replace `(<ARGS>)` with the exact identity arguments. Expected (confirm):
> `(p_code text, p_auth_user_id uuid, p_email text, p_full_name text)`.

```sql
alter function public.join_organization_by_code(<ARGS>) security definer;
alter function public.join_organization_by_code(<ARGS>) set search_path = public, pg_temp;
```

---

## 3. Rollback SQL (DRAFT)

```sql
-- New RPCs: drop them.
drop function if exists public.claim_membership_by_email();
drop function if exists public.find_org_by_join_code(text);

-- Revert the converted functions to their prior state.
-- (Use the SAME exact arg signatures as in §2.3 / §2.4.)
alter function public.create_organization(<ARGS>) security invoker;
alter function public.create_organization(<ARGS>) reset search_path;
alter function public.join_organization_by_code(<ARGS>) security invoker;
alter function public.join_organization_by_code(<ARGS>) reset search_path;
```

> Note: reverting `create_organization` / `join_organization_by_code` to
> `SECURITY INVOKER` is only safe **while identity-table RLS is OFF**. Do not
> revert them to invoker while identity RLS is enabled, or onboarding inserts
> will break. Roll back identity-table RLS first, then these.

---

## 4. App call-site changes needed later (`lib/memberService.ts`)

Not part of this SQL draft; applied in a later checkpoint **after** the RPCs
exist in the target DB.

- `resolveIdentity`: keep the fast path (`fetchMembershipsByAuthUserId`);
  replace the candidate lookup + `emailClaimedByOther` + per-row
  `linkAuthUserToMember` loop with a single
  `supabase.rpc('claim_membership_by_email')`, then map the returned status →
  `MemberResolution` (re-read memberships via `fetchMembershipsByAuthUserId` for
  `'resolved'`).
- `findOrgByJoinCode`: replace the direct `organizations` select with
  `supabase.rpc('find_org_by_join_code', { p_code })`.
- Retire (after confirming no other importers): `linkAuthUserToMember`,
  `emailClaimedByOther`, `fetchMembershipsByEmail` (claim-only usage). These
  would not work under identity RLS anyway.
- **Unchanged:** `fetchMembershipsByAuthUserId`, `fetchOrganization` (by id),
  `fetchPositionsForMember` (by member_id), and the
  `createOrganization` / `joinOrganizationByCode` RPC wrappers.

---

## 5. Verification plan

**Read-only catalog re-check (after applying §2):**
```sql
select p.proname, p.prosecdef as is_security_definer, p.proconfig as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_organization','join_organization_by_code',
                    'claim_membership_by_email','find_org_by_join_code');
-- Expect: all four prosecdef = true; settings contain search_path=public, pg_temp.
```

**Functional (RLS still OFF) — parity vs. current behavior:**
- First-login claim via the RPC: `resolved` for an invited member (and the row
  flips `invited → active`).
- Each status: `not_on_roster`, `ambiguous_email`, `email_taken`,
  `claim_conflict`, `missing_email`.
- `find_org_by_join_code` returns the right org for a valid code; nothing for an
  unknown/blank code.
- Create org / join by code still succeed (now definer).
- Steady-state login (already claimed) via `fetchMembershipsByAuthUserId`.

**After app migration (CP-2 committed), flag-on app smoke (RLS OFF):**
- Onboarding (create + join), first-login claim, multi-org switcher, steady
  login — all behave exactly as today.

**Only AFTER the above pass on staging, enable identity-table RLS and re-run the
full identity matrix (separate checkpoint).**

---

## 6. Risks / blockers

- **Behavioral parity:** `claim_membership_by_email` must replicate the existing
  semantics exactly — `lower()` email matching, per-org ambiguity, `email_taken`,
  the `auth_user_id IS NULL` guard, and `invited → active` activation — or
  first-login resolution regresses (a member silently not claimed → cannot log in).
- **Session-derived identity:** the claim RPC must use `auth.uid()` and
  `auth.jwt()->>'email'` internally — never client params — and keep
  `search_path` pinned, or it becomes a privilege-escalation vector.
- **JWT email dependency:** relies on the access token carrying `email`. Valid
  for the current email-based auth; would not apply to phone/OAuth-without-email.
- **Exact ALTER signatures:** `<ARGS>` in §2.3/§2.4 must match the live function
  signatures (`pg_get_function_identity_arguments`) or the ALTER errors.
- **Rollback ordering:** never revert create/join to `SECURITY INVOKER` while
  identity RLS is enabled (roll back RLS first).
- **Staging connectivity (current):** the staging schema copy is paused, so the
  RLS-enable rehearsal step is blocked. The RPCs/alters are additive and
  behavior-preserving with RLS off, but identity RLS must not be enabled on the
  live project without a staging rehearsal.
- **`members` SELECT = own-rows-only:** a future co-member roster view would need
  a broader, deliberately member-keyed policy (deferred).

---

## 7. ⚠️ Explicit warning

**This SQL is NOT applied.** Creating the RPCs and converting the two functions
to `SECURITY DEFINER` is additive and behavior-preserving **only while
identity-table RLS is OFF**.

**Identity-table RLS (`organizations` / `members` / `positions`) MUST NOT be
enabled until:**
1. these four prerequisites are applied,
2. the app call sites (§4) are migrated and `tsc`/tests pass,
3. the full identity matrix is **rehearsed on a staging project** (currently
   blocked on staging connectivity),
4. and a snapshot + rollback are staged for the production apply.

Enabling identity-table RLS without the above risks **locking real users out of
login and onboarding.**
