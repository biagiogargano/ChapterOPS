-- ─── ChapterOPS · Update / change notices ────────────────────────────────────
--
-- In-app "this changed after you may have seen it" notices. Unlike derived
-- reminders (due-soon/overdue), an update notice is EVENT-SOURCED — it records
-- that a change happened, which can't be re-derived from current state. Written
-- when an officer edits/deletes a task or cancels an event.
--
-- Additive (CREATE TABLE only); does not touch events / tasks / rsvps. RLS off
-- (no auth yet). Run once when wiring update notices.

DROP TABLE IF EXISTS update_notices CASCADE;

CREATE TABLE update_notices (
  id               text        PRIMARY KEY,          -- client-generated ('un_…')

  chapter_id       uuid        NOT NULL,

  -- What changed
  entity_type      text        NOT NULL CHECK (entity_type IN ('task','event')),
  entity_id        text        NOT NULL,             -- task id (text) or event id (uuid as text)
  summary          text        NOT NULL,             -- coalesced, e.g. "Date Party updated: time, location"
  severity         text        NOT NULL CHECK (severity IN ('critical','moderate','low')),

  -- Targeting (role-based until auth lands). changed_by_role is excluded by the
  -- emitter, so it never appears in audience_roles.
  audience_roles   text[]      NOT NULL DEFAULT '{}',
  changed_by_role  text,

  -- Per-role acknowledgement (a role taps the notice → added here → it hides).
  acknowledged_by  text[]      NOT NULL DEFAULT '{}',

  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL              -- auto-hide after this (app sets ~7 days)
);

CREATE INDEX update_notices_chapter_idx ON update_notices (chapter_id);
CREATE INDEX update_notices_entity_idx  ON update_notices (entity_id);

ALTER TABLE update_notices DISABLE ROW LEVEL SECURITY;
