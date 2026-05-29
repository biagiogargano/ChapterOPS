-- ════════════════════════════════════════════════════════════════════════════
-- Push v1 · push_tokens (Expo push token registry)
--
--   ⚠️  DRAFT — DO NOT RUN YET.  This is a committed migration DRAFT for Push v1
--       (Checkpoint A). It is reviewed/staged but must be applied as a deliberate,
--       separately-greenlit step against the alpha Supabase project (it is a
--       Supabase schema + RLS change). NOTHING in the app calls these objects yet,
--       so applying this is INERT for existing build-12 users.
--
-- WHAT THIS IS:
--   • A per-(auth user + device) registry of Expo push tokens, org-scoped, so a
--     server-side Edge Function (send_push) can fan out an action-linked push to
--     the right members' devices.
--
-- SECURITY MODEL (intentional):
--   • RLS ENABLED, owner-only writes via a SECURITY DEFINER RPC that stamps
--     auth.uid(). A user may upsert/delete ONLY their own token rows.
--   • Clients can NEVER read OTHER users' tokens. There is no permissive SELECT
--     policy. The only reader is the send_push Edge Function, which uses the
--     SERVICE-ROLE key (bypasses RLS) entirely server-side.
--   • No secrets live here. The service-role key is an Edge Function env var,
--     never in SQL or the repo.
--
-- SCOPE GUARANTEES:
--   • Additive only: 1 table + 1 RPC. Nothing else is altered.
--   • Does NOT alter tasks / events / rsvps / members / positions or their RLS.
--   • Does NOT change task/event state machines.
--
-- DEPENDENCY: only the existing public.members table (org membership). The RPC's
--   membership gate checks for an ACTIVE members row (NOT officer roles), so plain
--   members can register tokens too. No dependency on the proof_v1a helper.
--
-- Run order (WHEN greenlit): this file is self-contained; run top to bottom.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Table (RLS enabled, owner-scoped) ──────────────────────────────────────
create table public.push_tokens (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null,                 -- the member's active org
  member_id     uuid,                                  -- members.id (audit / targeting)
  auth_user_id  uuid        not null,                  -- owner = auth.uid()
  expo_token    text        not null,                  -- 'ExponentPushToken[...]'
  platform      text,                                  -- 'ios' | 'android' (informational)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (expo_token),                                 -- one row per device token
  constraint push_tokens_expo_format
    check (expo_token ~ '^ExponentPushToken\[.+\]$' or expo_token ~ '^ExpoPushToken\[.+\]$')
);

create index push_tokens_org_idx   on public.push_tokens (org_id);
create index push_tokens_owner_idx on public.push_tokens (auth_user_id);

alter table public.push_tokens enable row level security;

-- Owner-only direct access. Even so, all WRITES go through the RPC below; this
-- policy is the floor (a user can only ever touch their own rows). There is NO
-- policy granting any user SELECT on another user's row — cross-user reads are
-- impossible from a client. The Edge Function reads via the service role.
revoke all on public.push_tokens from anon, authenticated;

create policy push_tokens_owner_select
  on public.push_tokens for select
  using (auth_user_id = auth.uid());

create policy push_tokens_owner_delete
  on public.push_tokens for delete
  using (auth_user_id = auth.uid());

grant select, delete on public.push_tokens to authenticated;
-- NB: no INSERT/UPDATE grant to clients — writes happen only via the
-- SECURITY DEFINER RPC, so the owner stamping can't be spoofed.

-- ── 2. Writer RPC — upsert the caller's own token (stamps auth.uid()) ──────────
-- Owner = auth.uid(). The caller cannot write a row for anyone else. org_id /
-- member_id are resolved from the caller's own active membership.
create or replace function public.upsert_push_token(
  p_expo_token text,
  p_platform   text,
  p_org        uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_member uuid;
  v_id     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(p_expo_token,'') = '' then raise exception 'empty_token'; end if;

  -- Caller must actually be an ACTIVE member of the org they claim. We gate on
  -- MEMBERSHIP (members table), not officer roles — a plain member (no position)
  -- must still be able to register a device token. This also resolves the
  -- member_id we store for audit/targeting.
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = p_org and m.status = 'active'
  limit 1;
  if v_member is null then raise exception 'not_in_org'; end if;

  insert into public.push_tokens (org_id, member_id, auth_user_id, expo_token, platform)
  values (p_org, v_member, v_uid, p_expo_token, nullif(p_platform,''))
  on conflict (expo_token) do update
    set org_id       = excluded.org_id,
        member_id    = excluded.member_id,
        auth_user_id = excluded.auth_user_id,
        platform     = excluded.platform,
        updated_at   = now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.upsert_push_token(text,text,uuid) from public;
grant execute on function public.upsert_push_token(text,text,uuid) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- table exists + RLS on
-- select relname, relrowsecurity from pg_class where relname = 'push_tokens';   -- rls = t
-- -- exactly the two owner policies, NO cross-user select
-- select polname, cmd from pg_policies where schemaname='public' and tablename='push_tokens';
-- -- RPC exists and is SECURITY DEFINER
-- select proname, prosecdef from pg_proc where proname = 'upsert_push_token';   -- t
-- -- clients have no INSERT/UPDATE grant on the table
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'push_tokens';   -- expect only select/delete for authenticated
-- -- behavioral: a second user must NOT see another user's token row (returns 0)

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; leaf objects)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.upsert_push_token(text,text,uuid);
-- drop table    if exists public.push_tokens;
-- commit;
-- -- DO NOT drop auth_user_roles_for_org() here — it is shared with proof_v1a.
