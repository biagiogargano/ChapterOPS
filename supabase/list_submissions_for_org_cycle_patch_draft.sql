-- ════════════════════════════════════════════════════════════════════════════
-- DRAFT (UNAPPLIED) · list_submissions_for_org_cycle (agenda contributions read path)
--
--   ⛔ NOT APPLIED. Draft only — do NOT run via CLI. Apply later via the Dashboard
--      SQL Editor on explicit approval, then run the VERIFICATION block.
--
-- WHY:
--   The meeting agenda wants the Help-Needed + Announcements items from EVERY officer's
--   weekly goal-update for a cycle. Today there is only a PER-TASK reader
--   (get_task_report_submission) — no way to read "all of this org's goal-update
--   submissions for week X" in one call. This adds that LIST reader so the agenda compiler
--   (leadership/Annotator) can fetch the cycle's submissions, then the pure
--   lib/agendaContributions (extract + group) turns them into agenda sections.
--
-- WHAT IT RETURNS:
--   One row per goal-update submission for (org, period): task_id, definition_id, answers,
--   definition_snapshot, submitted_role, submitted_at, updated_at — the SAME columns as
--   get_task_report_submission, but as a SET. Goal-update tasks have deterministic ids
--   `goalupdrole_<role>__<period>` (lib/goalUpdateGeneration.goalUpdateTaskId), so the cycle
--   is matched by prefix `goalupdrole_` + suffix `__<period>` (exact via starts_with/right —
--   no LIKE wildcard ambiguity on the underscores).
--
-- SECURITY MODEL (identical posture to reports_v1 / goals_v1):
--   • RLS already ENABLED on task_report_submissions with ZERO policies (deny-by-default).
--     This adds ONLY a SECURITY DEFINER reader — no table grant, no policy.
--   • READ = annotator / president / pro_consul for THAT org. This is a LEADERSHIP/agenda
--     view across ALL officers' submissions (deliberately broader than the per-task reader,
--     which also allows the individual assignee) — an ordinary officer does NOT get the
--     whole chapter's submissions. Returns empty for anyone else.
--   • Does not touch tasks.state or any other object.
--
-- DEPENDENCY: reuses public.auth_user_roles_for_org(uuid) (already live). No new helper.
-- NOTE: returns definition_snapshot, added by task_report_submission_snapshot_patch (applied).
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.list_submissions_for_org_cycle(
  p_org_id uuid,
  p_period text
) returns table (
  task_id             text,
  definition_id       text,
  answers             jsonb,
  definition_snapshot jsonb,
  submitted_role      text,
  submitted_at        timestamptz,
  updated_at          timestamptz
)
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_roles text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_org_id is null or coalesce(p_period,'') = '' then return; end if;

  v_roles := public.auth_user_roles_for_org(p_org_id);

  -- Agenda-compiler read set (leadership/annotator). Else empty.
  if not ('annotator'  = any(v_roles)
          or 'president'  = any(v_roles)
          or 'pro_consul' = any(v_roles)) then
    return;
  end if;

  return query
    select s.task_id, s.definition_id, s.answers, s.definition_snapshot,
           s.submitted_role, s.submitted_at, s.updated_at
    from public.task_report_submissions s
    where s.org_id = p_org_id
      and starts_with(s.task_id, 'goalupdrole_')
      and right(s.task_id, length(p_period) + 2) = '__' || p_period
    order by s.submitted_role;
end;
$$;
revoke all on function public.list_submissions_for_org_cycle(uuid, text) from public;
grant execute on function public.list_submissions_for_org_cycle(uuid, text) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- RPC exists + SECURITY DEFINER
-- select proname, pronargs, prosecdef from pg_proc where proname='list_submissions_for_org_cycle';
--   -- expect: list_submissions_for_org_cycle | 2 | t
-- -- EXECUTE granted to authenticated only
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name='list_submissions_for_org_cycle';
-- -- behavioral (impersonated): as annotator/president/pro_consul → rows for that org+period;
-- --   as an ordinary officer → EMPTY; unauthenticated → exception.
-- -- shape sanity: every task_id starts with 'goalupdrole_' and ends with '__'||period.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; single leaf function)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.list_submissions_for_org_cycle(uuid, text);
-- commit;
-- -- DO NOT drop auth_user_roles_for_org() — shared with goals/reports.
