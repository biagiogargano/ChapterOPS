-- ════════════════════════════════════════════════════════════════════════════
-- Reports v1 · task_report_submissions (structured-response answers)
--
--   ⚠️  DRAFT — DO NOT RUN YET.  This is a committed migration DRAFT for Reports
--       v1 persistence. It is reviewed/planned but must be applied as a deliberate,
--       separately-greenlit step against the alpha Supabase project (it is a
--       Supabase schema + RLS + RPC change). NOTHING in the app calls these objects
--       yet, so applying this is INERT for existing users.
--
-- WHAT THIS IS (and is not):
--   • The storage boundary for officer reports / structured-response tasks. A
--     report is a normal structured TASK (report_<role>_<cycle>) whose completion
--     is a set of ANSWERS to a fixed question definition (lib/structuredResponses,
--     lib/reportDefinitions). This table holds those answers as jsonb.
--   • SEPARATE from task_submissions (proof) by design — see docs/REPORTS_V1_PLAN
--     and docs/REPORTS_V1_PERSISTENCE_PLAN: proof has a has-proof CHECK and
--     narrower visibility; reports need annotator read access. Sharing the proof
--     table would over-share proof or require fragile row-type branching.
--
-- SECURITY MODEL (intentional):
--   • RLS ENABLED, NO permissive policies (deny-by-default). REVOKE from anon,
--     authenticated. Access ONLY via the SECURITY DEFINER RPCs below.
--   • WRITE = the report task's assigned-role holder, OR president/pro_consul
--     (admin correction). Reviewer/others cannot write.
--   • READ = submitter / annotator / president / pro_consul (BROADER than proof,
--     which excludes the annotator — the reason reports get their own table).
--   • Advisors are excluded (no advisor role mapped yet; view-only later).
--   • Org isolation: RPCs resolve the task's org_id from tasks and check the
--     caller's roles for THAT org via auth_user_roles_for_org(org).
--   • upsert RPC DOES NOT touch tasks.state — workflow state stays owned by the
--     app/taskService updateTaskState path (same rule as proof).
--
-- DEPENDENCY: reuses public.auth_user_roles_for_org(uuid) (already live from
--   proof_v1a_task_submissions.sql). No new helper. auth_user_orgs() untouched.
--
-- Run order (WHEN greenlit): self-contained; run top to bottom.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Table (RLS enabled, NO policies = deny-by-default; clients locked out) ──
create table public.task_report_submissions (
  id             uuid        primary key default gen_random_uuid(),
  task_id        text        not null references public.tasks(id) on delete cascade,
  org_id         uuid        not null,                 -- = tasks.chapter_id (org scoping)
  definition_id  text        not null,                 -- StructuredResponseDefinition id
  answers        jsonb       not null,                 -- serialized StructuredAnswerMap
  submitted_by   uuid,                                  -- members.id (audit; not RLS-keyed)
  submitted_role text,                                  -- role at submit time (audit)
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (task_id),                                      -- ONE submission per report task

  constraint task_report_submissions_answers_object
    check (jsonb_typeof(answers) = 'object'),
  constraint task_report_submissions_definition_present
    check (definition_id <> '')
);

create index task_report_submissions_org_idx on public.task_report_submissions (org_id);

alter table public.task_report_submissions enable row level security;
-- Intentionally NO policies: RLS on + zero policies denies ALL direct client
-- access. Access is exclusively via the definer RPCs below.
revoke all on public.task_report_submissions from anon, authenticated;

-- ── 2. Writer RPC — answers payload ONLY (does NOT touch tasks.state) ──────────
-- Writer = holder of the task's assigned_role, OR president/pro_consul. One row
-- per task (upsert on conflict).
create or replace function public.upsert_task_report_submission(
  p_task_id       text,
  p_definition_id text,
  p_answers       jsonb
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

  -- Resolve the report task's org + assignee role.
  select t.chapter_id, t.assigned_role into v_org, v_assign
  from public.tasks t where t.id = p_task_id;
  if v_org is null then raise exception 'task_not_found'; end if;

  -- Caller's active roles in that org.
  v_roles := public.auth_user_roles_for_org(v_org);

  -- Authorization: assignee-role holder OR president/pro_consul.
  if not (v_assign = any(v_roles)
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  -- Audit: who submitted + which role.
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;
  v_role := case when v_assign = any(v_roles) then v_assign else v_roles[1] end;

  insert into public.task_report_submissions
    (task_id, org_id, definition_id, answers, submitted_by, submitted_role)
  values
    (p_task_id, v_org, p_definition_id, p_answers, v_member, v_role)
  on conflict (task_id) do update
    set definition_id  = excluded.definition_id,
        answers        = excluded.answers,
        submitted_by   = excluded.submitted_by,
        submitted_role = excluded.submitted_role,
        updated_at     = now()
  returning id into v_id;

  -- NOTE: tasks.state is intentionally NOT modified here. The app flips the
  -- report task to 'submitted' via taskService/updateTaskState.
  return v_id;
end;
$$;
revoke all on function public.upsert_task_report_submission(text,text,jsonb) from public;
grant execute on function public.upsert_task_report_submission(text,text,jsonb) to authenticated;

-- ── 3. Reader RPC — submitter / annotator / president / pro_consul only ────────
create or replace function public.get_task_report_submission(p_task_id text)
returns table (
  task_id        text,
  definition_id  text,
  answers        jsonb,
  submitted_role text,
  submitted_at   timestamptz,
  updated_at     timestamptz
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
  if v_org is null then return; end if;          -- unknown task → empty

  v_roles := public.auth_user_roles_for_org(v_org);

  -- Authorization: submitter (assignee), annotator, or leadership. Else empty.
  -- BROADER than proof: the annotator can read reports (compiles the agenda).
  if not (v_assign = any(v_roles)
          or 'annotator'  = any(v_roles)
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    return;
  end if;

  return query
    select s.task_id, s.definition_id, s.answers, s.submitted_role, s.submitted_at, s.updated_at
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
-- -- table exists + RLS on + ZERO policies (deny-by-default)
-- select relname, relrowsecurity from pg_class where relname='task_report_submissions';   -- rls=t
-- select count(*) from pg_policies where schemaname='public' and tablename='task_report_submissions';  -- 0
--
-- -- RPCs exist + SECURITY DEFINER (prosecdef=t)
-- select proname, prosecdef from pg_proc
--  where proname in ('upsert_task_report_submission','get_task_report_submission') order by proname;
--
-- -- EXECUTE granted to authenticated; table NOT directly granted to anon/authenticated
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name in ('upsert_task_report_submission','get_task_report_submission');
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name='task_report_submissions';   -- expect no anon/authenticated rows
--
-- -- constraints present (unique task_id, answers-object, definition-present)
-- select conname, contype from pg_constraint
--  where conrelid='public.task_report_submissions'::regclass order by conname;
--
-- -- behavioral (impersonated): assignee/annotator/president/pro_consul → row;
-- --   any other org member → EMPTY; direct select as authenticated → denied.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; leaf objects, fully reversible)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.get_task_report_submission(text);
-- drop function if exists public.upsert_task_report_submission(text,text,jsonb);
-- drop table    if exists public.task_report_submissions;     -- leaf; FK one-way INTO tasks
-- commit;
-- -- DO NOT drop auth_user_roles_for_org() — shared with proof v1a.
-- -- Dropping this table does NOT affect tasks / task_submissions / events / rsvps.
