-- ════════════════════════════════════════════════════════════════════════════
-- Goals v1 · DRAFT — ⛔ DO NOT RUN. NOT APPLIED. NOT VERIFIED. ⛔
--
--   APPLY-READY FOR REVIEW. This finishes the Goals v1 storage layer per the MVP
--   product decisions, but it has NOT been applied to any Supabase project and MUST
--   NOT be run until a separate, explicitly-approved apply checkpoint (like reports
--   v1 had: paste → run → run the VERIFICATION queries below → confirm).
--
--   Pattern mirrors supabase/reports_v1_task_report_submissions.sql:
--     • RLS ENABLED, NO policies (deny-by-default), REVOKE from anon/authenticated.
--     • Access ONLY via SECURITY DEFINER RPCs.
--     • Org isolation + role checks via the existing auth_user_roles_for_org(uuid).
--
--   MVP PRODUCT DECISIONS baked in (approved):
--     1. OWNER MODEL: goals are ROLE-owned (owner_role). owner_member_id stays in
--        the table for FUTURE person-owned goals but is NOT used by v1 behavior.
--     2. CREATE: the owner role may create goals for ITSELF; president/pro_consul/
--        annotator may create goals for officer roles. Members cannot create (yet).
--     3. COMPLETE/ARCHIVE: owner role OR president/pro_consul/annotator. NO separate
--        completion-approval workflow in v1.
--     4. BULK CREATE: client loops create_goal (NO create_goals(text[]) RPC).
--     5. VISIBILITY: owner role reads its own goals; president/pro_consul/annotator
--        read all org goals. Advisors excluded. NO per-goal visibility list in v1.
--
--   GOAL UPDATES: v1 REUSES task_report_submissions (no goal_updates table, no
--   submit_goal_update RPC). The update task's submission IS the goal update. See
--   docs/GOALS_PERSISTENCE_PLAN.md §1.
--
--   NOTE: Supabase default privileges will also grant EXECUTE on these RPCs to
--   `anon` (platform default) — SAFE: each RPC rejects unauthenticated callers
--   (auth.uid() null → 'unauthenticated'), and the TABLE has no anon/authenticated
--   grant. Matches the deployed reports v1 / proof v1A posture.
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ⛔ DRAFT: do not run this file until an approved apply checkpoint.

-- ── 1. goals table (RLS on, NO policies = deny-by-default; clients locked out) ──
create table public.goals (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        not null,                 -- org isolation
  -- V1: role-owned (owner_role). owner_member_id reserved for future person-owned.
  owner_role           text,
  owner_member_id      uuid,                                  -- members.id (FUTURE; unused in v1)
  created_by           uuid,                                  -- members.id (audit)
  title                text        not null,
  description          text,
  target_value         numeric,                               -- null = milestone/boolean
  current_value        numeric,                               -- null until measured
  unit                 text,
  cadence              text        not null
    check (cadence in ('daily','weekly','monthly','custom')),
  custom_period_days   integer,                               -- for cadence='custom'
  update_definition_id text,                                  -- StructuredResponseDefinition id
  status               text        not null default 'active'
    check (status in ('active','completed','archived')),
  reviewer_role        text,
  visibility           text,                                  -- reserved; unused in v1
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  archived_at          timestamptz,

  constraint goals_title_present check (title <> '')
);

create index goals_org_idx        on public.goals (org_id);
create index goals_org_status_idx on public.goals (org_id, status);

alter table public.goals enable row level security;
-- Intentionally NO policies: RLS on + zero policies denies ALL direct client
-- access. Access is exclusively via the definer RPCs below.
revoke all on public.goals from anon, authenticated;

-- ── 2. create_goal ─────────────────────────────────────────────────────────────
-- Auth (DECISION #2): the OWNER role may create for itself (p_owner_role is one of
-- the caller's active roles), OR president/pro_consul/annotator may create for any
-- officer role. Members cannot create.
create or replace function public.create_goal(
  p_title                text,
  p_cadence              text,
  p_target_value         numeric default null,
  p_current_value        numeric default null,
  p_owner_role           text    default null,
  p_update_definition_id text    default null,
  p_reviewer_role        text    default null,
  p_org_id               uuid    default null               -- caller's active org
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_org       uuid := p_org_id;
  v_roles     text[];
  v_member    uuid;
  v_id        uuid;
  v_is_admin  boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(p_title,'') = '' then raise exception 'missing_title'; end if;
  if v_org is null then raise exception 'missing_org'; end if;
  if p_cadence not in ('daily','weekly','monthly','custom') then
    raise exception 'bad_cadence';
  end if;

  v_roles    := public.auth_user_roles_for_org(v_org);
  v_is_admin := ('president' = any(v_roles)
                 or 'pro_consul' = any(v_roles)
                 or 'annotator' = any(v_roles));

  -- Owner-for-self OR admin (leadership/annotator). DECISION #2.
  if not (v_is_admin
          or (p_owner_role is not null and p_owner_role = any(v_roles))) then
    raise exception 'not_authorized';
  end if;

  -- Audit: who created.
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;

  insert into public.goals
    (org_id, owner_role, created_by, title, target_value, current_value,
     cadence, update_definition_id, reviewer_role)
  values
    (v_org, p_owner_role, v_member, p_title, p_target_value, p_current_value,
     p_cadence, p_update_definition_id, p_reviewer_role)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_goal(text,text,numeric,numeric,text,text,text,uuid) from public;
grant execute on function public.create_goal(text,text,numeric,numeric,text,text,text,uuid) to authenticated;

-- ── 3. list_goals_for_org ──────────────────────────────────────────────────────
-- Reader (DECISION #5): president/pro_consul/annotator read ALL org goals; any other
-- member reads only goals they own (owner_role in their roles). Advisors excluded.
create or replace function public.list_goals_for_org(p_org_id uuid)
returns setof public.goals
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_roles text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_org_id is null then return; end if;
  v_roles := public.auth_user_roles_for_org(p_org_id);

  if 'president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles) then
    return query select * from public.goals g where g.org_id = p_org_id;
  else
    return query
      select * from public.goals g
      where g.org_id = p_org_id
        and g.owner_role = any(v_roles);
  end if;
end;
$$;
revoke all on function public.list_goals_for_org(uuid) from public;
grant execute on function public.list_goals_for_org(uuid) to authenticated;

-- ── 4. list_my_goals — goals the caller OWNS in an org (owner_role) ─────────────
-- Cleaner client path than filtering list_goals_for_org. V1 is role-owned, so "mine"
-- = goals whose owner_role is one of the caller's active roles in that org.
create or replace function public.list_my_goals(p_org_id uuid)
returns setof public.goals
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_roles text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_org_id is null then return; end if;
  v_roles := public.auth_user_roles_for_org(p_org_id);

  return query
    select * from public.goals g
    where g.org_id = p_org_id
      and g.owner_role = any(v_roles);
end;
$$;
revoke all on function public.list_my_goals(uuid) from public;
grant execute on function public.list_my_goals(uuid) to authenticated;

-- ── 5. update_goal ─────────────────────────────────────────────────────────────
-- Writer (DECISION #3): owner role OR president/pro_consul/annotator.
create or replace function public.update_goal(
  p_goal_id       uuid,
  p_title         text    default null,
  p_target_value  numeric default null,
  p_current_value numeric default null,
  p_cadence       text    default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_owner_role text;
  v_roles      text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, owner_role into v_org, v_owner_role
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;
  if p_cadence is not null and p_cadence not in ('daily','weekly','monthly','custom') then
    raise exception 'bad_cadence';
  end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  if not ((v_owner_role is not null and v_owner_role = any(v_roles))
          or 'president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  update public.goals set
    title         = coalesce(p_title, title),
    target_value  = coalesce(p_target_value, target_value),
    current_value = coalesce(p_current_value, current_value),
    cadence       = coalesce(p_cadence, cadence),
    updated_at    = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.update_goal(uuid,text,numeric,numeric,text) from public;
grant execute on function public.update_goal(uuid,text,numeric,numeric,text) to authenticated;

-- ── 6. complete_goal — set status='completed' + completed_at ───────────────────
-- Auth (DECISION #3): owner role OR president/pro_consul/annotator. No approval flow.
create or replace function public.complete_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_owner_role text;
  v_roles      text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, owner_role into v_org, v_owner_role
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  if not ((v_owner_role is not null and v_owner_role = any(v_roles))
          or 'president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  update public.goals
    set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.complete_goal(uuid) from public;
grant execute on function public.complete_goal(uuid) to authenticated;

-- ── 7. archive_goal — set status='archived' + archived_at ──────────────────────
-- Auth (DECISION #3): owner role OR president/pro_consul/annotator.
create or replace function public.archive_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_owner_role text;
  v_roles      text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, owner_role into v_org, v_owner_role
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  if not ((v_owner_role is not null and v_owner_role = any(v_roles))
          or 'president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  update public.goals
    set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.archive_goal(uuid) from public;
grant execute on function public.archive_goal(uuid) to authenticated;

-- Goal UPDATES: reuse upsert_task_report_submission / get_task_report_submission
-- (no new table, no new RPC for v1). See docs/GOALS_PERSISTENCE_PLAN.md §1, §3.

commit;   -- ⛔ DRAFT — do not run until an approved apply checkpoint.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying — mirrors reports v1)
-- ════════════════════════════════════════════════════════════════════════════
-- -- table exists + RLS on + ZERO policies (deny-by-default)
-- select relname, relrowsecurity from pg_class where relname='goals';                 -- rls=t
-- select count(*) from pg_policies where schemaname='public' and tablename='goals';   -- 0
--
-- -- all 6 RPCs exist + SECURITY DEFINER (prosecdef=t)
-- select proname, prosecdef from pg_proc
--  where proname in ('create_goal','list_goals_for_org','list_my_goals',
--                    'update_goal','complete_goal','archive_goal')
--  order by proname;                                                                  -- all prosecdef=t
--
-- -- EXECUTE granted to authenticated; TABLE not directly granted to anon/authenticated
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name in ('create_goal','list_goals_for_org','list_my_goals',
--                         'update_goal','complete_goal','archive_goal');
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name='goals';                          -- expect NO anon/authenticated rows
--
-- -- constraints present (title non-empty, cadence + status CHECKs)
-- select conname, contype from pg_constraint
--  where conrelid='public.goals'::regclass order by conname;
--
-- -- empty reads safe (impersonated): leadership/annotator → all org rows; an owner
-- --   role → only its own; any other member → EMPTY; direct select as authenticated
-- --   → denied (RLS, no policy). list_my_goals on an org with no owned goals → 0 rows.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; leaf objects, fully reversible)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.archive_goal(uuid);
-- drop function if exists public.complete_goal(uuid);
-- drop function if exists public.update_goal(uuid,text,numeric,numeric,text);
-- drop function if exists public.list_my_goals(uuid);
-- drop function if exists public.list_goals_for_org(uuid);
-- drop function if exists public.create_goal(text,text,numeric,numeric,text,text,text,uuid);
-- drop table    if exists public.goals;     -- leaf; no FK INTO it in v1
-- commit;
-- -- DO NOT drop auth_user_roles_for_org() — shared with proof v1a + reports v1.
-- -- Dropping goals does NOT affect tasks / task_report_submissions / events / rsvps.
-- ════════════════════════════════════════════════════════════════════════════
