-- ════════════════════════════════════════════════════════════════════════════
-- Proof v1A · task_submissions (text + link proof only)
--
--   ⚠️  DO NOT RUN YET.  This is the committed migration DRAFT for Proof v1A
--       Checkpoint 1. It is reviewed/approved but must be applied as a deliberate,
--       separately-greenlit step against the alpha Supabase project (it is a
--       Supabase change). The current TestFlight build (build 8) does NOT call
--       the RPCs below, so applying this is INERT for existing users — they keep
--       using tasks.proof_content. App wiring comes in a later checkpoint.
--
-- WHAT THIS IS (and is not):
--   • Text/link proof ALREADY persists today via tasks.proof_content (see
--     taskService.updateTaskState). Proof v1A is NOT about basic persistence.
--   • It adds a real, ACCESS-CONTROLLED submission primitive: proof becomes its
--     own row, readable only by the assignee / reviewer / president / pro_consul
--     (NOT org-wide, unlike the current tasks.proof_content blob), and a clean
--     substrate for future reports/structured responses (and, later, file proof).
--
-- SCOPE GUARANTEES (intentional):
--   • Additive only: 1 helper fn + 1 table + 2 RPCs. Nothing else is altered.
--   • Does NOT alter tasks / events / rsvps or their RLS policies.
--   • Does NOT alter auth_user_orgs().
--   • upsert_task_submission DOES NOT touch tasks.state — workflow state stays
--     owned by the existing app/taskService updateTaskState path.
--   • No Storage, no file uploads, no reports.
--
-- Run order (when greenlit): this file is self-contained; run top to bottom.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Role helper ───────────────────────────────────────────────────────────
-- The caller's ACTIVE role strings within an org. Mirrors the existing
-- auth_user_orgs() pattern: SECURITY DEFINER + pinned search_path so it reads
-- positions/members WITHOUT entangling their RLS (no recursion). Reusable.
create or replace function public.auth_user_roles_for_org(p_org uuid)
returns text[]
language sql stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct p.role), '{}')
  from   public.positions p
  join   public.members   m on m.id = p.member_id
  where  m.auth_user_id = auth.uid()
    and  p.org_id       = p_org
    and  p.is_active
    and  m.status       = 'active';
$$;
revoke all on function public.auth_user_roles_for_org(uuid) from public;
grant execute on function public.auth_user_roles_for_org(uuid) to authenticated;

-- ── 2. Table (RLS enabled, NO policies = deny-by-default; clients locked out) ──
create table public.task_submissions (
  id             uuid        primary key default gen_random_uuid(),
  task_id        text        not null references public.tasks(id) on delete cascade,
  org_id         uuid        not null,                 -- = tasks.chapter_id (org scoping)
  submitted_by   uuid,                                  -- members.id (audit; not RLS-keyed)
  submitted_role text,                                  -- role at submit time (audit)
  proof_text     text        not null default '',
  proof_link     text,                                  -- nullable; http/https only
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (task_id),                                      -- ONE submission per task (v1)

  constraint task_submissions_has_proof
    check (coalesce(proof_text,'') <> '' or coalesce(proof_link,'') <> ''),
  constraint task_submissions_link_format
    check (proof_link is null or proof_link ~* '^https?://')
);

create index task_submissions_org_idx on public.task_submissions (org_id);

alter table public.task_submissions enable row level security;
-- Intentionally NO policies: with RLS enabled and zero policies, all DIRECT
-- client access is denied. Access is exclusively via the definer RPCs below.
revoke all on public.task_submissions from anon, authenticated;

-- ── 3. Writer RPC — proof payload ONLY (does NOT touch tasks.state) ────────────
-- Writer = holder of the task's assigned_role, OR president/pro_consul (admin
-- correction). Reviewer is read-only. One row per task (upsert on conflict).
create or replace function public.upsert_task_submission(
  p_task_id    text,
  p_proof_text text,
  p_proof_link text
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

  -- Resolve the task's org + assignee role.
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

  -- Proof + link validation (defense in depth; table CHECKs also enforce).
  if coalesce(p_proof_text,'') = '' and coalesce(p_proof_link,'') = '' then
    raise exception 'empty_proof';
  end if;
  if p_proof_link is not null and p_proof_link !~* '^https?://' then
    raise exception 'bad_link';
  end if;

  -- Audit fields: who submitted + which role.
  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;
  v_role := case when v_assign = any(v_roles) then v_assign else v_roles[1] end;

  insert into public.task_submissions
    (task_id, org_id, submitted_by, submitted_role, proof_text, proof_link)
  values
    (p_task_id, v_org, v_member, v_role, coalesce(p_proof_text,''), nullif(p_proof_link,''))
  on conflict (task_id) do update
    set proof_text     = excluded.proof_text,
        proof_link     = excluded.proof_link,
        submitted_by   = excluded.submitted_by,
        submitted_role = excluded.submitted_role,
        updated_at     = now()
  returning id into v_id;

  -- NOTE: tasks.state is intentionally NOT modified here. Setting
  -- submitted/approved/rejected remains the app/taskService responsibility.
  return v_id;
end;
$$;
revoke all on function public.upsert_task_submission(text,text,text) from public;
grant execute on function public.upsert_task_submission(text,text,text) to authenticated;

-- ── 4. Reader RPC — assignee, reviewer, or leadership only ─────────────────────
create or replace function public.get_task_submission(p_task_id text)
returns table (
  task_id        text,
  proof_text     text,
  proof_link     text,
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
  v_review text;
  v_roles  text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select t.chapter_id, t.assigned_role, t.reviewer_role
    into v_org, v_assign, v_review
  from public.tasks t where t.id = p_task_id;
  if v_org is null then return; end if;          -- unknown task → empty

  v_roles := public.auth_user_roles_for_org(v_org);

  -- Authorization: assignee, reviewer, or leadership. Else empty (no row leak).
  if not (v_assign = any(v_roles)
          or (v_review is not null and v_review = any(v_roles))
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    return;
  end if;

  return query
    select s.task_id, s.proof_text, s.proof_link, s.submitted_role, s.submitted_at, s.updated_at
    from public.task_submissions s
    where s.task_id = p_task_id;
end;
$$;
revoke all on function public.get_task_submission(text) from public;
grant execute on function public.get_task_submission(text) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- table exists + RLS on + ZERO policies (deny-by-default)
-- select relname, relrowsecurity from pg_class where relname = 'task_submissions';        -- rls = t
-- select count(*) from pg_policies where schemaname='public' and tablename='task_submissions';  -- 0
--
-- -- helper + RPCs exist and are SECURITY DEFINER (prosecdef = t)
-- select proname, prosecdef from pg_proc
--  where proname in ('auth_user_roles_for_org','upsert_task_submission','get_task_submission')
--  order by proname;
--
-- -- EXECUTE granted to authenticated; table NOT directly granted to anon/authenticated
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name in ('auth_user_roles_for_org','upsert_task_submission','get_task_submission');
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'task_submissions';   -- expect no anon/authenticated rows
--
-- -- constraints present (unique task_id, has_proof, link_format)
-- select conname, contype from pg_constraint
--  where conrelid = 'public.task_submissions'::regclass order by conname;
--
-- -- one submission per task (expect 0 once data exists)
-- select task_id, count(*) from public.task_submissions group by task_id having count(*) > 1;
--
-- -- org integrity: every row's org_id matches its task's chapter_id (expect 0)
-- select s.id from public.task_submissions s join public.tasks t on t.id = s.task_id
--  where s.org_id <> t.chapter_id;
--
-- -- behavioral (impersonated, CP-4/CP-5 pattern):
-- --   • assignee-role / reviewer-role / president / pro_consul → get_task_submission returns the row
-- --   • any other org member                                  → returns EMPTY
-- --   • direct  select * from task_submissions  as authenticated → 0 rows / denied

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; leaf objects, fully reversible)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.get_task_submission(text);
-- drop function if exists public.upsert_task_submission(text,text,text);
-- drop table    if exists public.task_submissions;     -- leaf; FK is one-way INTO tasks
-- -- Drop the helper ONLY if nothing else has adopted it yet:
-- drop function if exists public.auth_user_roles_for_org(uuid);
-- commit;
-- -- DO NOT drop auth_user_orgs() — shared by all existing data-table + identity policies.
-- -- Dropping task_submissions does NOT affect tasks/events/rsvps (FK is one-way into tasks).
