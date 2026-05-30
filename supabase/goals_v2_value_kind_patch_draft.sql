-- ════════════════════════════════════════════════════════════════════════════
-- Goals v2 · numeric|text value model · ✅ APPLIED + VERIFIED on alpha (Dashboard).
--   Verified: value_kind/target_text/current_text columns added; create_goal and
--   update_goal each have EXACTLY ONE overload (new text-param signatures) — the
--   old v1 signatures were dropped, so 8-arg numeric calls resolve via defaults.
--
--   Lets a goal be NUMERIC (target/current numbers + progress %) OR TEXT/STATUS
--   (e.g. "Book formal venue", current "Deposit paid, contract pending"). Today the
--   goals table only has numeric target_value/current_value, so non-numeric goals
--   lose their target/current. This adds text columns + a value_kind discriminator,
--   PRESERVING the existing numeric columns and all rows.
--
--   MUST NOT be run until a separate, explicitly-approved apply checkpoint.
--
--   SAFETY:
--     • `add column if not exists` ×3 — idempotent, safe to re-run.
--     • All NULLABLE, value_kind defaults 'numeric' → existing rows keep behaving
--       exactly as today (numeric goals).
--     • No RLS/policy/grant change. No change to the goal RPCs' AUTH. The create/
--       update RPCs gain optional params (below) but keep the same security checks.
--     • Until applied, the client maps defensively (writes text fields only when the
--       goal is text-kind; reads null safely) — numeric goals are unaffected.
--
--   CLIENT GATING: the Goals tab text-value INPUT must stay hidden until this is
--   applied — do not let the UI pretend to save text the DB can't persist.
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ✅ APPLIED + verified on alpha. Safe to re-run (idempotent).

-- ── 1. columns ──────────────────────────────────────────────────────────────────
alter table public.goals
  add column if not exists value_kind   text not null default 'numeric'
    check (value_kind in ('numeric','text')),
  add column if not exists target_text  text,    -- target description (text goals)
  add column if not exists current_text text;    -- current status   (text goals)

-- ── 2. create_goal / update_goal — replace the OLD-signature functions ──────────
-- IMPORTANT: drop the v1 signatures FIRST. We are CHANGING the arg lists (adding
-- optional text params), and `create or replace` cannot change a signature — it
-- would leave the old overload in place, making an 8-named-arg numeric call ambiguous
-- (two candidate functions) and BREAK goal create/update. Dropping the old ones means
-- the new functions are the only overload; an 8-arg call resolves via the new
-- defaults. Safe: the function bodies are fully recreated below.
drop function if exists public.create_goal(text,text,numeric,numeric,text,text,text,uuid);
drop function if exists public.update_goal(uuid,text,numeric,numeric,text);

-- DECISION: keep numeric the default; a text goal passes p_value_kind='text' +
-- p_target_text/p_current_text. Auth block is IDENTICAL to goals_v1 create_goal.
create or replace function public.create_goal(
  p_title                text,
  p_cadence              text,
  p_target_value         numeric default null,
  p_current_value        numeric default null,
  p_owner_role           text    default null,
  p_update_definition_id text    default null,
  p_reviewer_role        text    default null,
  p_org_id               uuid    default null,
  p_value_kind           text    default 'numeric',
  p_target_text          text    default null,
  p_current_text         text    default null
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
  if p_cadence not in ('daily','weekly','monthly','custom') then raise exception 'bad_cadence'; end if;
  if coalesce(p_value_kind,'numeric') not in ('numeric','text') then raise exception 'bad_value_kind'; end if;

  v_roles    := public.auth_user_roles_for_org(v_org);
  v_is_admin := ('president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles));
  if not (v_is_admin or (p_owner_role is not null and p_owner_role = any(v_roles))) then
    raise exception 'not_authorized';
  end if;

  select m.id into v_member from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active' limit 1;

  insert into public.goals
    (org_id, owner_role, created_by, title, target_value, current_value,
     cadence, update_definition_id, reviewer_role, value_kind, target_text, current_text)
  values
    (v_org, p_owner_role, v_member, p_title, p_target_value, p_current_value,
     p_cadence, p_update_definition_id, p_reviewer_role,
     coalesce(p_value_kind,'numeric'), p_target_text, p_current_text)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_goal(text,text,numeric,numeric,text,text,text,uuid,text,text,text) from public;
grant execute on function public.create_goal(text,text,numeric,numeric,text,text,text,uuid,text,text,text) to authenticated;
-- The old 8-arg create_goal was dropped above, so this 11-arg form is the ONLY
-- create_goal overload. An 8-named-arg numeric call resolves via the new defaults.

-- ── 3. update_goal — gains optional text params (auth unchanged: creator-or-leadership)
create or replace function public.update_goal(
  p_goal_id       uuid,
  p_title         text    default null,
  p_target_value  numeric default null,
  p_current_value numeric default null,
  p_cadence       text    default null,
  p_target_text   text    default null,
  p_current_text  text    default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_org uuid; v_created_by uuid; v_roles text[]; v_member uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select org_id, created_by into v_org, v_created_by from public.goals where id = p_goal_id;
  if v_org is null then raise exception 'goal_not_found'; end if;
  if p_cadence is not null and p_cadence not in ('daily','weekly','monthly','custom') then raise exception 'bad_cadence'; end if;
  v_roles := public.auth_user_roles_for_org(v_org);
  select m.id into v_member from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active' limit 1;
  if not ('president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles)
          or (v_created_by is not null and v_member is not null and v_created_by = v_member)) then
    raise exception 'not_authorized';
  end if;

  update public.goals set
    title         = coalesce(p_title, title),
    target_value  = coalesce(p_target_value, target_value),
    current_value = coalesce(p_current_value, current_value),
    target_text   = coalesce(p_target_text, target_text),
    current_text  = coalesce(p_current_text, current_text),
    cadence       = coalesce(p_cadence, cadence),
    updated_at    = now()
  where id = p_goal_id;
end;
$$;
revoke all on function public.update_goal(uuid,text,numeric,numeric,text,text,text) from public;
grant execute on function public.update_goal(uuid,text,numeric,numeric,text,text,text) to authenticated;

commit;   -- ✅ APPLIED + verified on alpha.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- columns exist
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='goals'
--    and column_name in ('value_kind','target_text','current_text') order by column_name;
--   -- expect: current_text|text|YES ; target_text|text|YES ; value_kind|text|NO|'numeric'
-- -- existing rows default to numeric
-- select count(*) from public.goals where value_kind <> 'numeric';   -- expect 0 right after apply
-- -- RPCs present + SECURITY DEFINER
-- select proname, prosecdef from pg_proc where proname in ('create_goal','update_goal') order by proname;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════════════════
-- This patch DROPS the v1 create_goal/update_goal and creates new-signature ones,
-- so a full rollback must (a) drop the new functions, (b) RE-CREATE the v1 functions
-- from goals_v1_draft.sql (create_goal) + goals_v1_permissions_patch_draft.sql
-- (update_goal — the creator-or-leadership version), then (c) drop the columns.
-- begin;
-- drop function if exists public.update_goal(uuid,text,numeric,numeric,text,text,text);
-- drop function if exists public.create_goal(text,text,numeric,numeric,text,text,text,uuid,text,text,text);
-- -- >>> re-create the v1 create_goal(...,uuid) body from goals_v1_draft.sql here <<<
-- -- >>> re-create the v1 update_goal(uuid,...,text) body from goals_v1_permissions_patch_draft.sql here <<<
-- alter table public.goals drop column if exists current_text;
-- alter table public.goals drop column if exists target_text;
-- alter table public.goals drop column if exists value_kind;
-- commit;
-- ════════════════════════════════════════════════════════════════════════════
