-- ─── ChapterOPS · Events seed ─────────────────────────────────────────────────
-- Run this AFTER events_schema.sql.
-- Idempotent: deletes existing rows for the demo chapter then re-inserts.
-- Uses DATE_TRUNC('week', CURRENT_DATE) which returns the Monday of this week
-- in PostgreSQL, matching the dayOffset=0 anchor used in lib/mockEvents.ts.

-- Demo chapter UUID — matches DEMO_CHAPTER_ID in lib/eventService.ts
DO $$ BEGIN
  PERFORM set_config('app.demo_chapter_id', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', false);
END $$;

-- Clear existing demo data (safe re-run)
DELETE FROM events WHERE chapter_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

-- ─── Insert the 4 MOCK_EVENTS with stable UUIDs ───────────────────────────────
-- Dates are relative to Monday of the current week so they always appear
-- in the app's "This Week" view regardless of when the seed is run.

INSERT INTO events (
  id, chapter_id,
  title, kind, audience,
  event_date, time, location, description,
  is_recurring, series_id, recurrence, repeat_until,
  created_by_role
) VALUES

  -- e1 · Chapter Meeting · dayOffset 0 (Monday)
  (
    'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
    'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0',
    'Chapter Meeting', 'chapter', 'all',
    DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 0,
    '8:00 PM', 'Chapter Room',
    'Weekly all-hands chapter meeting. Attendance is mandatory for all active members. Bring your dues receipt if you haven''t submitted it yet.',
    true,
    '11111111-1111-1111-1111-111111111111',
    'weekly',
    (DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 364)::date,
    'president'
  ),

  -- e2 · E-Board Meeting · dayOffset 1 (Tuesday)
  (
    'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
    'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0',
    'E-Board Meeting', 'eboard', 'officers',
    DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 1,
    '8:00 PM', 'Library, Room 204',
    'Executive board sync. Officers review upcoming events, budget items, and action items from the last chapter meeting.',
    true,
    '22222222-2222-2222-2222-222222222222',
    'weekly',
    (DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 364)::date,
    'president'
  ),

  -- e3 · Date Party · dayOffset 4 (Friday)
  (
    'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
    'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0',
    'Date Party', 'social', 'optional',
    DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 4,
    '9:00 PM', 'Venue TBD',
    'Semi-formal social. Bring a date or go with a group. Dress code is business casual. Transportation details TBD — watch GroupMe.',
    false,
    NULL, NULL, NULL,
    'social_chair'
  ),

  -- e4 · Study Hours · dayOffset 6 (Sunday)
  (
    'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4',
    'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0',
    'Study Hours', 'academic', 'optional',
    DATE_TRUNC('week', CURRENT_DATE::timestamp)::date + 6,
    '6:00 PM', 'Chapter Room',
    'Structured study block. Brothers on academic probation are required. All other members are encouraged to attend.',
    false,
    NULL, NULL, NULL,
    'annotator'
  );

-- Verify
SELECT id, title, event_date, kind, audience FROM events
WHERE chapter_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
ORDER BY event_date;
