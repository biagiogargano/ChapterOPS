-- ════════════════════════════════════════════════════════════════════════════
-- Goals v1 · DRAFT — ⛔ DO NOT RUN. NOT APPLIED. NOT VERIFIED. ⛔
--
--   This is an ILLUSTRATIVE draft accompanying docs/GOALS_PERSISTENCE_PLAN.md.
--   It has NOT been applied to any Supabase project and MUST NOT be run until a
--   separate, explicitly-approved apply checkpoint (like reports v1 had). Several
--   choices are still open — see `-- DECISION:` markers and the plan §6.
--
--   Pattern mirrors supabase/reports_v1_task_report_submissions.sql:
--     • RLS ENABLED, NO policies (deny-by-default), REVOKE from anon/authenticated.
--     • Access ONLY via SECURITY DEFINER RPCs.
--     • Org isolation + role checks via the existing auth_user_roles_for_org(uuid).
--
--   GOAL UPDATES: v1 REUSES task_report_submissions (no goal_updates table). An
--   update task carries the goal's update_definition_id and a goal+period task id;
--   its submission row is the update. See plan §1.
-- ════════════════════════════════════════════════════════════════════════════

-- ⛔ DRAFT — the begin/commit is intentionally omitted so this cannot be pasted
--    and run as-is without deliberate edits. Uncomment only at an approved apply.
-- begin;

-- ── 1. goals table (RLS on, NO policies = deny-by-default; clients locked out) ──
create table public.goals (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        not null,                 -- org isolation
  -- DECISION (plan §6.1): support BOTH owner_role and owner_member_id, or role-only?
  owner_role           text,                                  -- pack-shaped role key
  owner_member_id      uuid,                                  -- members.id (person-owned)
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
  -- DECISION (plan §6.7): per-goal visibility list, or RPC-enforced leadership+owner?
  visibility           text,
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
-- DECISION (plan §6.2): who may create — leadership+annotator only (alpha), or any
--   officer / members for personal goals? Draft allows leadership + annotator.
-- DECISION (plan §6.8): single create vs a create_goals(text[]) batch. Draft = single.
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
  v_uid    uuid := auth.uid();
  v_org    uuid := p_org_id;
  v_roles  text[];
  v_member uuid;
  v_id     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(p_title,'') = '' then raise exception 'missing_title'; end if;
  if v_org is null then raise exception 'missing_org'; end if;
  if p_cadence not in ('daily','weekly','monthly','custom') then
    raise exception 'bad_cadence';
  end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  -- Authorization: leadership or annotator (alpha). DECISION §6.2 may widen this.
  if not ('president' = any(v_roles)
          or 'pro_consul' = any(v_roles)
          or 'annotator'  = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

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

-- ── 3. list_goals_for_org / list_my_goals ──────────────────────────────────────
-- Reader = owner (role or member) OR leadership OR annotator. DECISION §6.5 advisors.
create or replace function public.list_goals_for_org(p_org_id uuid)
returns setof public.goals
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_roles text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_org_id is null then return; end if;
  v_roles := public.auth_user_roles_for_org(p_org_id);
  -- Any active member of the org may LIST (RPC returns org-scoped rows); finer
  -- per-goal visibility is a DECISION (§6.7). Draft: leadership/annotator see all,
  -- others see only goals they own.
  if 'president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles) then
    return query select * from public.goals g where g.org_id = p_org_id;
  else
    return query
      select * from public.goals g
      where g.org_id = p_org_id
        and (g.owner_role = any(v_roles)
             or g.owner_member_id in (
               select m.id from public.members m
               where m.auth_user_id = v_uid and m.org_id = p_org_id and m.status = 'active'));
  end if;
end;
$$;
revoke all on function public.list_goals_for_org(uuid) from public;
grant execute on function public.list_goals_for_org(uuid) to authenticated;

-- ── 4. update_goal / complete_goal / archive_goal ──────────────────────────────
-- Writer = owner OR leadership. DECISION §6.4: does completion need reviewer approval?
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
  v_uid uuid := auth.uid();
  v_org uuid;
  v_owner_role text;
  v_owner_member uuid;
  v_roles text[];
  v_is_owner boolean;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, owner_role, owner_member_id into v_org, v_owner_role, v_owner_member
  from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;
  v_roles := public.auth_user_roles_for_org(v_org);
  v_is_owner := (v_owner_role = any(v_roles)) or (v_owner_member in (
    select m.id from public.members m
    where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'));
  if not (v_is_owner or 'president' = any(v_roles) or 'pro_consul' = any(v_roles)) then
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

-- complete_goal / archive_goal: same auth as update_goal; set status + timestamp.
-- (Omitted in the draft body for brevity — they follow update_goal's auth block,
--  setting status='completed'/completed_at=now() or status='archived'/archived_at=now().)
-- DECISION §6.4: if completion needs reviewer approval, complete_goal restricts to
--   reviewer_role / leadership rather than owner.

-- Goal UPDATES: reuse upsert_task_report_submission / get_task_report_submission
-- (no new RPC for v1). See plan §1, §3.

-- commit;   -- ⛔ left commented — DRAFT, DO NOT RUN

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (when/if ever applied — leaf objects, reversible)
-- ════════════════════════════════════════════════════════════════════════════
-- drop function if exists public.update_goal(uuid,text,numeric,numeric,text);
-- drop function if exists public.list_goals_for_org(uuid);
-- drop function if exists public.create_goal(text,text,numeric,numeric,text,text,text,uuid);
-- drop table    if exists public.goals;     -- leaf; no FK INTO it in v1
-- -- DO NOT drop auth_user_roles_for_org() — shared with proof v1a + reports v1.
-- ════════════════════════════════════════════════════════════════════════════
