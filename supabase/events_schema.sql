-- ─── ChapterOPS · Events + RSVPs schema ──────────────────────────────────────
-- Run this in the Supabase SQL Editor BEFORE running events_seed.sql.
-- Safe to re-run: drops and recreates both tables each time.
-- RLS is disabled — no auth in this app.

-- Drop in dependency order (rsvps → events)
DROP TABLE IF EXISTS rsvps  CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- ─── events ───────────────────────────────────────────────────────────────────

CREATE TABLE events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Org scoping: all demo rows use the same chapter UUID
  chapter_id      uuid        NOT NULL,

  title           text        NOT NULL,

  kind            text        NOT NULL
    CHECK (kind IN ('chapter','eboard','social','academic','recruitment','philanthropy','risk')),

  audience        text        NOT NULL
    CHECK (audience IN ('all','officers','optional')),

  -- Real calendar date — never store dayOffset here (it's computed at runtime)
  event_date      date        NOT NULL,

  time            text        NOT NULL,        -- e.g. "8:00 PM"
  location        text        NOT NULL,
  description     text        NOT NULL DEFAULT '',

  -- Recurrence metadata
  is_recurring    boolean     NOT NULL DEFAULT false,
  series_id       uuid,                        -- shared across all instances in a series
  recurrence      text
    CHECK (recurrence IS NULL OR recurrence IN ('daily','weekly','biweekly','monthly')),
  repeat_until    date,

  created_by_role text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Speed up per-chapter, per-date queries
CREATE INDEX events_chapter_date_idx ON events (chapter_id, event_date);
CREATE INDEX events_series_idx       ON events (series_id) WHERE series_id IS NOT NULL;

-- Disable RLS (no auth)
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- ─── rsvps ────────────────────────────────────────────────────────────────────

CREATE TABLE rsvps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Role string matches the Role type in lib/roles.ts
  role        text        NOT NULL,

  status      text        NOT NULL DEFAULT 'no_response'
    CHECK (status IN ('attending','not_attending','no_response')),

  excuse      text,       -- optional excuse when not attending
  covering    text,       -- optional covering arrangement
  date_name   text,       -- name of date for social events

  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- One RSVP row per (event_instance, role) — recurring series create separate rows
  UNIQUE (event_id, role)
);

CREATE INDEX rsvps_event_idx ON rsvps (event_id);

ALTER TABLE rsvps DISABLE ROW LEVEL SECURITY;
