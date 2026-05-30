-- ════════════════════════════════════════════════════════════════════════════
-- update_notices · allow entity_type 'goal' · ✅ APPLIED + VERIFIED on alpha.
--   Verified: entity_type CHECK now allows ('task','event','goal'); 28 rows intact.
--
--   The in-app Notifications table previously constrained entity_type to ('task',
--   'event'). To show an in-app notice when leadership ASSIGNS a goal to an officer
--   role (roadmap §7, in-app-only — NO push), the constraint must also allow 'goal'
--   so the notice persists and tapping it can navigate to the Goals tab.
--
--   MUST NOT be run until a separate, explicitly-approved apply checkpoint.
--
--   PRODUCT DECISION needed before wiring (does not block the SQL):
--     • Should a goal-assigned notice fire only when leadership creates a goal for a
--       role they DON'T hold (a real "assignment"), or for any officer goal they
--       didn't create? The notice store already excludes the actor; the client emit
--       site decides the trigger. This is IN-APP ONLY — no push, no all-member.
--
--   SAFETY:
--     • Only swaps the CHECK constraint to add 'goal'. Existing rows ('task'/'event')
--       remain valid; no data change. No RLS/policy/grant change.
--     • Idempotent-ish: drops the old constraint if present, re-adds the widened one.
--     • CLIENT GATING: do not emit a 'goal' notice until this is applied — otherwise
--       the insert fails the CHECK and the notice can't persist (half-fake feature).
-- ════════════════════════════════════════════════════════════════════════════

begin;   -- ✅ APPLIED + verified on alpha. Safe to re-run.

alter table public.update_notices
  drop constraint if exists update_notices_entity_type_check;

alter table public.update_notices
  add constraint update_notices_entity_type_check
  check (entity_type in ('task','event','goal'));

commit;   -- ✅ APPLIED + verified on alpha.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run AFTER applying)
-- ════════════════════════════════════════════════════════════════════════════
-- -- the CHECK now allows 'goal'
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid='public.update_notices'::regclass and contype='c';
--   -- expect the entity_type check to include 'goal'
-- -- existing rows still valid (no error means the swap kept them)
-- select count(*) from public.update_notices;   -- unchanged

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (restore the original 'task','event' constraint — only if no 'goal' rows)
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
-- delete from public.update_notices where entity_type = 'goal';   -- if any exist
-- alter table public.update_notices drop constraint if exists update_notices_entity_type_check;
-- alter table public.update_notices
--   add constraint update_notices_entity_type_check check (entity_type in ('task','event'));
-- commit;
-- ════════════════════════════════════════════════════════════════════════════
