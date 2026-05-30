-- ════════════════════════════════════════════════════════════════════════════
-- Goals v1 · PERMISSIONS PATCH · DRAFT — ⛔ DO NOT RUN. NOT APPLIED. ⛔
--
--   Tightens WRITE auth on the three goal-mutation RPCs so that an officer can only
--   edit/complete/archive goals THEY personally created — NOT goals merely owned by
--   their role (i.e. goals leadership assigned TO them are read-only to them).
--
--   Applies on top of the already-applied supabase/goals_v1_draft.sql. Re-creates
--   ONLY update_goal / complete_goal / archive_goal via `create or replace` (safe to
--   re-run; does NOT touch the table, list/read RPCs, or create_goal). MUST NOT be
--   run until a separate, explicitly-approved apply checkpoint.
--
--   NEW WRITE RULE (DECISION: Goals permissions v1):
--     allow update/complete/archive iff the caller is leadership/annotator
--       ('president' / 'pro_consul' / 'annotator') in the goal's org,
--     OR the goal's created_by = the caller's active member id in that org.
--     Holding the goal's owner_role is NO LONGER sufficient on its own.
--
--   UNCHANGED: the goals table, RLS/lockdown, list_goals_for_org / list_my_goals
--     (read/view), create_goal, soft-archive behavior (no hard delete),
--     SECURITY DEFINER + org scoping via auth_user_roles_for_org(uuid).
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ⛔ DRAFT: do not run until an approved apply checkpoint.

-- ── update_goal (NEW auth: leadership/annotator OR goal creator) ────────────────
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
  v_created_by uuid;
  v_roles      text[];
  v_member     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, created_by into v_org, v_created_by
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;
  if p_cadence is not null and p_cadence not in ('daily','weekly','monthly','custom') then
    raise exception 'bad_cadence';
  end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;

  -- Leadership/annotator OR the goal's creator. owner_role alone is NOT enough.
  if not ('president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)
          or (v_created_by is not null and v_member is not null and v_created_by = v_member)) then
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

-- ── complete_goal (NEW auth: leadership/annotator OR goal creator) ──────────────
create or replace function public.complete_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_created_by uuid;
  v_roles      text[];
  v_member     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, created_by into v_org, v_created_by
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;

  if not ('president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)
          or (v_created_by is not null and v_member is not null and v_created_by = v_member)) then
    raise exception 'not_authorized';
  end if;

  update public.goals
    set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.complete_goal(uuid) from public;
grant execute on function public.complete_goal(uuid) to authenticated;

-- ── archive_goal (soft archive; NEW auth: leadership/annotator OR goal creator) ──
create or replace function public.archive_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_created_by uuid;
  v_roles      text[];
  v_member     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, created_by into v_org, v_created_by
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;

  if not ('president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator' = any(v_roles)
          or (v_created_by is not null and v_member is not null and v_created_by = v_member)) then
    raise exception 'not_authorized';
  end if;

  -- Soft archive only (no hard delete in v1).
  update public.goals
    set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.archive_goal(uuid) from public;
grant execute on function public.archive_goal(uuid) to authenticated;

commit;   -- ⛔ DRAFT — do not run until an approved apply checkpoint.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- the 3 patched RPCs still exist + SECURITY DEFINER (prosecdef=t)
-- select proname, prosecdef from pg_proc
--  where proname in ('update_goal','complete_goal','archive_goal') order by proname;  -- all t
--
-- -- execute grant unchanged (authenticated; anon platform default safe)
-- select routine_name, grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name in ('update_goal','complete_goal','archive_goal') order by routine_name, grantee;
--
-- -- table grants unchanged (still NO anon/authenticated direct access)
-- select grantee, privilege_type from information_schema.role_table_grants where table_name='goals';
--
-- -- behavioral (impersonated):
-- --   • leadership/annotator → can update/complete/archive ANY org goal.
-- --   • an officer → can update/complete/archive ONLY goals where created_by = their
-- --       member id; a goal owned by their role but created BY leadership → raises
-- --       'not_authorized'.
-- --   • create_goal + list_goals_for_org + list_my_goals behavior UNCHANGED.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (revert the 3 RPCs to the owner_role-based auth from goals_v1_draft.sql)
-- ════════════════════════════════════════════════════════════════════════════
-- To roll back, re-apply the update_goal / complete_goal / archive_goal definitions
-- from supabase/goals_v1_draft.sql (the owner_role-OR-leadership versions). This
-- patch only `create or replace`s those three functions — it adds no table/column,
-- so there is nothing else to drop. The goals table + list/create RPCs are untouched.
-- ════════════════════════════════════════════════════════════════════════════
