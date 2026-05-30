-- ════════════════════════════════════════════════════════════════════════════
-- Tasks · report_definition_id column · DRAFT — ⛔ DO NOT RUN. NOT APPLIED. ⛔
--
--   Adds a single nullable column so a questionnaire/report task can PERSIST which
--   structured-response definition it collects. Today MockTask.reportDefinitionId
--   is NOT written by taskService.mockTaskToRow and there is no column for it, so on
--   any Supabase round-trip (generate → reload, or another user fetching) the field
--   is lost → the Task Detail questionnaire form disappears and the task falls back
--   to generic "Save & Complete". This column fixes the persistence side.
--
--   MUST NOT be run until a separate, explicitly-approved apply checkpoint.
--
--   SAFETY:
--     • `add column if not exists` — idempotent, safe to re-run.
--     • NULLABLE, no default, no constraint → existing task rows are UNAFFECTED
--       (they simply have report_definition_id = NULL, exactly as today).
--     • No RLS/policy/grant change — `tasks` keeps its existing access model.
--     • Until this is applied, the client maps defensively (writes the field only
--       when present; reads null safely) — ordinary tasks keep working and
--       questionnaire tasks degrade to the honest "unavailable" state.
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ⛔ DRAFT: do not run until an approved apply checkpoint.

alter table public.tasks
  add column if not exists report_definition_id text;   -- nullable; StructuredResponseDefinition id

commit;   -- ⛔ DRAFT — do not run until an approved apply checkpoint.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- column exists, is text, is nullable
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema='public' and table_name='tasks' and column_name='report_definition_id';
--   -- expect: report_definition_id | text | YES
--
-- -- existing rows unaffected (all NULL right after the add)
-- select count(*) as non_null_report_def
--   from public.tasks where report_definition_id is not null;   -- expect 0 immediately after apply
--
-- -- no RLS/grant change (sanity: tasks table grants unchanged from before)
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name='tasks' order by grantee, privilege_type;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; drops only the added column)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- alter table public.tasks drop column if exists report_definition_id;
-- commit;
-- -- Dropping the column does NOT affect any other task field, RLS, or other tables.
-- ════════════════════════════════════════════════════════════════════════════
