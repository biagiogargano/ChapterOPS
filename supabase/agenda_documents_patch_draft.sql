-- ════════════════════════════════════════════════════════════════════════════
-- DRAFT (UNAPPLIED) · agenda_documents (editable meeting-agenda persistence)
--
--   ⛔ NOT APPLIED. Draft only — do NOT run via CLI. Apply later via the Dashboard
--      SQL Editor on explicit approval, then run the VERIFICATION block.
--
-- WHY:
--   The meeting agenda is currently READ-ONLY and derived live (lib/buildAgenda from
--   events+tasks; lib/agendaGoals + lib/agendaContributions are pure, unwired). There is
--   no way to EDIT it (add manual notes, reorder, mark old/new business, finalize for the
--   meeting) and have it persist. This table is that durable store.
--
-- WHAT IT STORES (mirrors lib/agendaDocument.AgendaDocument):
--   • sections jsonb       — the EDITABLE document: { v, sections:[{key,title,items:[...]}] }.
--                            Generated initially by lib/agendaDocument.assembleAgendaDocument,
--                            then edited by leadership.
--   • generated_from jsonb — provenance snapshot of what was auto-derived at generate time
--                            (so edits don't lose the source, and a re-generate can diff).
--
-- V1 DECISIONS (documented in docs/AGENDA_PERSISTENCE_PLAN.md):
--   • ONE agenda per meeting EVENT (event_id set + UNIQUE). event_id is nullable to allow a
--     future standalone agenda, but v1 always ties to a meeting event.
--   • EDIT = president / pro_consul / annotator (the agenda compiler + broad leadership).
--   • VIEW = ANY active member of the org (the agenda is the meeting document; broad read).
--   • finalized_at locks it for the meeting (becomes the minutes baseline). NOT full
--     versioning in v1 — just created/updated audit + the finalize hook. Minutes attach
--     later (a future minutes jsonb column or agenda_minutes table — out of scope here).
--
-- SECURITY MODEL (identical posture to goals_v1 / reports_v1):
--   • RLS ENABLED, ZERO policies (deny-by-default). REVOKE from anon, authenticated.
--     Access ONLY via the SECURITY DEFINER RPCs below.
--   • Org isolation: RPCs resolve roles via public.auth_user_roles_for_org(org) and gate
--     edit vs view on those roles. tasks/events are untouched.
--
-- DEPENDENCY: reuses public.auth_user_roles_for_org(uuid) (already live). Reads
--   public.events(id uuid, chapter_id uuid) inside the RPCs (late-bound; resolved at call
--   time). NOTE: event_id is a SOFT reference — NO foreign key is declared on it by design,
--   so apply never fails on the events schema. Just confirm the live events table is named
--   `events` and has a `chapter_id` column (it does in the repo schema, both events_schema.sql
--   and schema.sql) before relying on the agenda RPCs at runtime.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Table (RLS on, NO policies = deny-by-default; clients locked out) ───────
create table public.agenda_documents (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,                  -- = events.chapter_id (org scoping)
  event_id        uuid,                                   -- the meeting event (nullable; unique when set)
  title           text        not null default 'Meeting Agenda',
  sections        jsonb       not null default '{"v":1,"sections":[]}'::jsonb,
  generated_from  jsonb,                                  -- provenance snapshot (nullable)
  created_by      uuid,                                   -- members.id (audit)
  updated_by      uuid,                                   -- members.id (audit)
  finalized_at    timestamptz,                            -- locked-for-meeting hook (nullable)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint agenda_documents_sections_object check (jsonb_typeof(sections) = 'object'),
  constraint agenda_documents_genfrom_object  check (generated_from is null or jsonb_typeof(generated_from) = 'object')
);

-- One agenda per meeting event (only enforced for non-null event_id).
create unique index agenda_documents_event_uidx on public.agenda_documents (event_id) where event_id is not null;
create index agenda_documents_org_idx on public.agenda_documents (org_id);

alter table public.agenda_documents enable row level security;
revoke all on public.agenda_documents from anon, authenticated;

-- ── 2. Reader RPC — ANY active member of the org may view the agenda ───────────
create or replace function public.get_agenda_for_event(p_event_id uuid)
returns table (
  id uuid, org_id uuid, event_id uuid, title text,
  sections jsonb, generated_from jsonb, finalized_at timestamptz, updated_at timestamptz
)
language plpgsql stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_roles text[];
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select e.chapter_id into v_org from public.events e where e.id = p_event_id;
  if v_org is null then return; end if;                  -- unknown event → empty

  v_roles := public.auth_user_roles_for_org(v_org);
  if coalesce(array_length(v_roles, 1), 0) = 0 then return; end if;   -- not a member → empty

  return query
    select a.id, a.org_id, a.event_id, a.title,
           a.sections, a.generated_from, a.finalized_at, a.updated_at
    from public.agenda_documents a
    where a.event_id = p_event_id;
end;
$$;
revoke all on function public.get_agenda_for_event(uuid) from public;
grant execute on function public.get_agenda_for_event(uuid) to authenticated;

-- ── 3. Writer RPC — upsert the document; EDIT = leadership/annotator only ──────
-- One row per event (upsert on the partial unique index). Refuses edits once finalized.
create or replace function public.upsert_agenda_document(
  p_event_id        uuid,
  p_title           text,
  p_sections        jsonb,
  p_generated_from  jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_roles  text[];
  v_member uuid;
  v_id     uuid;
  v_final  timestamptz;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'object' then
    raise exception 'sections_must_be_object';
  end if;

  select e.chapter_id into v_org from public.events e where e.id = p_event_id;
  if v_org is null then raise exception 'event_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  if not ('president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  select m.id into v_member
  from public.members m
  where m.auth_user_id = v_uid and m.org_id = v_org and m.status = 'active'
  limit 1;

  -- Block edits to a finalized agenda (it's the meeting/minutes baseline).
  select a.finalized_at into v_final from public.agenda_documents a where a.event_id = p_event_id;
  if v_final is not null then raise exception 'agenda_finalized'; end if;

  insert into public.agenda_documents (org_id, event_id, title, sections, generated_from, created_by, updated_by)
  values (v_org, p_event_id, coalesce(nullif(p_title,''),'Meeting Agenda'), p_sections, p_generated_from, v_member, v_member)
  on conflict (event_id) where event_id is not null do update
    set title          = coalesce(nullif(excluded.title,''), public.agenda_documents.title),
        sections       = excluded.sections,
        generated_from = coalesce(excluded.generated_from, public.agenda_documents.generated_from),
        updated_by     = excluded.updated_by,
        updated_at     = now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.upsert_agenda_document(uuid,text,jsonb,jsonb) from public;
grant execute on function public.upsert_agenda_document(uuid,text,jsonb,jsonb) to authenticated;

-- ── 4. Finalize RPC — lock the agenda for the meeting (leadership/annotator) ───
create or replace function public.finalize_agenda_document(p_event_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_roles text[];
  v_at    timestamptz;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  select e.chapter_id into v_org from public.events e where e.id = p_event_id;
  if v_org is null then raise exception 'event_not_found'; end if;

  v_roles := public.auth_user_roles_for_org(v_org);
  if not ('president' = any(v_roles) or 'pro_consul' = any(v_roles) or 'annotator' = any(v_roles)) then
    raise exception 'not_authorized';
  end if;

  update public.agenda_documents
     set finalized_at = coalesce(finalized_at, now()), updated_at = now()
   where event_id = p_event_id
  returning finalized_at into v_at;

  if v_at is null then raise exception 'agenda_not_found'; end if;
  return v_at;
end;
$$;
revoke all on function public.finalize_agenda_document(uuid) from public;
grant execute on function public.finalize_agenda_document(uuid) to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- table + RLS on + ZERO policies (deny-by-default)
-- select relname, relrowsecurity from pg_class where relname='agenda_documents';                 -- rls=t
-- select count(*) from pg_policies where schemaname='public' and tablename='agenda_documents';   -- 0
-- -- RPCs exist + SECURITY DEFINER
-- select proname, prosecdef from pg_proc
--  where proname in ('get_agenda_for_event','upsert_agenda_document','finalize_agenda_document') order by proname;  -- prosecdef=t
-- -- table NOT directly granted to anon/authenticated
-- select grantee, privilege_type from information_schema.role_table_grants where table_name='agenda_documents';     -- none
-- -- one-agenda-per-event unique index present
-- select indexname from pg_indexes where tablename='agenda_documents';                           -- agenda_documents_event_uidx, _org_idx
-- -- behavioral (impersonated): member → view; president/pro_consul/annotator → edit;
-- --   ordinary officer edit → not_authorized; edit after finalize → agenda_finalized.

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; leaf objects)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop function if exists public.finalize_agenda_document(uuid);
-- drop function if exists public.upsert_agenda_document(uuid,text,jsonb,jsonb);
-- drop function if exists public.get_agenda_for_event(uuid);
-- drop table    if exists public.agenda_documents;   -- leaf; no other object depends on it
-- commit;
-- -- DO NOT drop auth_user_roles_for_org() — shared with goals/reports.
