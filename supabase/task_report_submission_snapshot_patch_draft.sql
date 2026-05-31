-- ════════════════════════════════════════════════════════════════════════════
-- DRAFT (UNAPPLIED) · task_report_submissions · definition_snapshot column
--
--   ⛔ NOT APPLIED. Draft only — do NOT run via CLI. Apply later via the Dashboard
--      SQL Editor on explicit approval, then run the VERIFICATION block.
--
-- WHY:
--   A goal-update task's questionnaire definition is RECONSTRUCTED at render time from
--   the role's CURRENT active goals (lib/goalUpdateGeneration.reconstructGoalUpdateDefinition).
--   The stored answers (task_report_submissions.answers) survive, keyed by
--   goal_<id>_<field>, but the QUESTIONS / labels / goal titles are re-derived live — so an
--   OLD submitted update re-renders against TODAY's goals. If a goal was archived, renamed,
--   or retargeted after submission, the history no longer matches what the officer answered.
--
--   This patch adds an OPTIONAL durable snapshot of the definition (the exact form +
--   goal context, as submitted). When present, readers render the historical update
--   exactly as it was, with no live goal lookup. The snapshot VALUE is produced
--   client-side by lib/goalUpdateSnapshot.buildGoalUpdateSnapshot (pure, versioned).
--
-- SHAPE (jsonb, matches lib/goalUpdateSnapshot.GoalUpdateSnapshot):
--   { "v": 1,
--     "definition": { "id": "...", "label": "...", "questions": [ {key,prompt,type,order,...} ] },
--     "goals": [ { "id": "...", "title": "..." } ] }
--
-- DESIGN CHOICES (smallest real model):
--   • A single NULLABLE jsonb column on the EXISTING table — NOT a new table. The snapshot
--     is 1:1 with a submission (already unique per task_id), so a side table buys nothing.
--   • Backward compatible: existing rows keep definition_snapshot = NULL; the client falls
--     back to live reconstruction when the snapshot is absent (older submissions, or static
--     questionnaires that are already stable via the registry). NO existing submission is
--     altered or lost.
--   • Keeps the reports security posture EXACTLY: RLS on + zero policies, access only via the
--     SECURITY DEFINER RPCs, write = assignee-role or president/pro_consul, read = assignee /
--     annotator / president / pro_consul. The snapshot is just an extra payload column +
--     an extra return field — no new auth surface.
--   • The upsert RPC gains a 4th param with DEFAULT NULL. The OLD 3-arg signature is DROPPED
--     first (so Postgres keeps exactly ONE overload — same care taken in
--     goals_v2_value_kind_patch_draft.sql to avoid an ambiguous-overload break).
--   • tasks.state is STILL not touched here (unchanged rule).
--
-- DEPENDENCY: reuses public.auth_user_roles_for_org(uuid) (already live). No new helper.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Add the optional snapshot column (nullable; existing rows unaffected) ───
alter table public.task_report_submissions
  add column if not exists definition_snapshot jsonb;

-- Guard: when present it must be a JSON object (mirrors the answers-object check).
-- NOT VALID first so it never rejects/locks existing rows; validate after (instant —
-- all existing rows are NULL, which passes).
alter table public.task_report_submissions
  drop constraint if exists task_report_submissions_snapshot_object;
alter table public.task_report_submissions
  add constraint task_report_submissions_snapshot_object
  check (definition_snapshot is null or jsonb_typeof(definition_snapshot) = 'object')
  not valid;
alter table public.task_report_submissions
  validate constraint task_report_submissions_snapshot_object;

-- ── 2. Replace the writer RPC: accept + store the optional snapshot ────────────
-- Drop the OLD 3-arg signature FIRST so only one overload exists (no ambiguity).
drop function if exists public.upsert_task_report_submission(text, text, jsonb);

create or replace function public.upsert_task_report_submission(
  p_task_id             text,
  p_definition_id       text,
  p_answers             jsonb,
  p_definition_snapshot jsonb default null          -- NEW (optional; null = no snapshot)
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_assign text;
  v_roles  text[];
  v_member uuid;
  v_role   text;
  v_id     uuid;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if coalesce(p_definition_id,'') = '' then raise exception 'missing_definition'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers_must_be_object';
  end if;
  if p_definition_snapshot is not null and jsonb_typeof(p_definition_snapshot) <> 'object' then
    raise exception 'snapshot_must_be_object';
  end if;

  select t.chapter_id, t.assigned_role into v_org, v_assign
  from public.tasks t where t.id = p_task_id;
  if v_org is null then raise exception 'task_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);

  if not (v_assign = any(v_roles)
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;
  v_role := case when v_assign = any(v_roles) then v_assign else v_roles[1] end;

  insert into public.task_report_submissions
    (task_id, org_id, definition_id, answers, definition_snapshot, submitted_by, submitted_role)
  values
    (p_task_id, v_org, p_definition_id, p_answers, p_definition_snapshot, v_member, v_role)
  on conflict (task_id) do update
    set definition_id       = excluded.definition_id,
        answers             = excluded.answers,
        -- Keep an existing snapshot if a later upsert omits it (don't clobber history).
        definition_snapshot = coalesce(excluded.definition_snapshot, public.task_report_submissions.definition_snapshot),
        submitted_by        = excluded.submitted_by,
        submitted_role      = excluded.submitted_role,
        updated_at          = now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.upsert_task_report_submission(text,text,jsonb,jsonb) from public;
grant execute on function public.upsert_task_report_submission(text,text,jsonb,jsonb) to authenticated;

-- ── 3. Replace the reader RPC: also return the snapshot ────────────────────────
drop function if exists public.get_task_report_submission(text);

create or replace function public.get_task_report_submission(p_task_id text)
returns table (
  task_id             text,
  definition_id       text,
  answers             jsonb,
  definition_snapshot jsonb,                         -- NEW
  submitted_role      text,
  submitted_at        timestamptz,
  updated_at          timestamptz
)
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_assign text;
  v_roles  text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select t.chapter_id, t.assigned_role into v_org, v_assign
  from public.tasks t where t.id = p_task_id;
  if v_org is null then return; end if;

  v_roles := public.auth_user_roles_for_org(v_org);

  if not (v_assign = any(v_roles)
          or 'annotator'  = any(v_roles)
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    return;
  end if;

  return query
    select s.task_id, s.definition_id, s.answers, s.definition_snapshot,
           s.submitted_role, s.submitted_at, s.updated_at
    from public.task_report_submissions s
    where s.task_id = p_task_id;
end;
$$;
revoke all on function public.get_task_report_submission(text) from public;
grant execute on function public.get_task_report_submission(text) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- column present + nullable
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_name='task_report_submissions' and column_name='definition_snapshot';   -- jsonb, YES
--
-- -- snapshot-object constraint present + validated
-- select conname, convalidated from pg_constraint
--  where conrelid='public.task_report_submissions'::regclass
--    and conname='task_report_submissions_snapshot_object';                              -- convalidated=t
--
-- -- EXACTLY ONE overload of each RPC (the new 4-arg upsert; the new get), SECURITY DEFINER
-- select proname, pronargs, prosecdef from pg_proc
--  where proname in ('upsert_task_report_submission','get_task_report_submission')
--  order by proname, pronargs;                                                           -- upsert:4, get:1, prosecdef=t
--
-- -- existing submissions preserved (none lost; snapshots null until re-submitted)
-- select count(*) total, count(definition_snapshot) with_snapshot from public.task_report_submissions;
--
-- -- table still has NO direct anon/authenticated grant (RLS deny-by-default intact)
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name='task_report_submissions';                                           -- expect no anon/authenticated rows

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; restores the pre-patch 3-arg/return-shape RPCs)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.get_task_report_submission(text);
-- drop function if exists public.upsert_task_report_submission(text,text,jsonb,jsonb);
-- -- Re-create the ORIGINAL 3-arg upsert + original get from
-- --   supabase/reports_v1_task_report_submissions.sql (sections 2 and 3) verbatim.
-- alter table public.task_report_submissions
--   drop constraint if exists task_report_submissions_snapshot_object;
-- alter table public.task_report_submissions
--   drop column if exists definition_snapshot;     -- nullable add → safe drop; no data loss for answers
-- commit;
