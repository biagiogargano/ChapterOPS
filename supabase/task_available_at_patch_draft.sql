-- ════════════════════════════════════════════════════════════════════════════
-- Tasks · available_at column (update windows) · ✅ APPLIED + VERIFIED on alpha.
--   Verified: available_at timestamptz column added, nullable; 0 non-null rows.
--
--   Adds an optional "available from" timestamp so a task (esp. a weekly update) can
--   be NOT-YET-OPEN before its window starts — officers shouldn't submit at the start
--   of the week for work that happens across it. `due_at` already exists as the
--   deadline; this adds the lower bound.
--
--   MUST NOT be run until a separate, explicitly-approved apply checkpoint.
--
--   SAFETY:
--     • `add column if not exists` — idempotent, safe to re-run.
--     • NULLABLE, no default → existing tasks have available_at = NULL = "always
--       open" (taskWindow.ts returns 'open_no_window'), i.e. exactly today's behavior.
--     • No RLS/policy/grant change. No RPC change required (task rows are written via
--       the existing task insert/update paths; a future generation step sets it).
--     • CLIENT GATING: the "not yet open / locked" UI must stay hidden until this is
--       applied — never fake a lock the data can't persist.
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ✅ APPLIED + verified on alpha. Safe to re-run.

alter table public.tasks
  add column if not exists available_at timestamptz;   -- nullable; null = always open

commit;   -- ✅ APPLIED + verified on alpha.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='tasks' and column_name='available_at';
--   -- expect: available_at | timestamp with time zone | YES
-- select count(*) from public.tasks where available_at is not null;   -- expect 0 right after apply

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (safe; drops only the added column)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- alter table public.tasks drop column if exists available_at;
-- commit;
-- ════════════════════════════════════════════════════════════════════════════
