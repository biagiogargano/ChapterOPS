-- ============================================================
-- ChapterOPS Dev Seed Data
-- Run AFTER schema.sql in: Supabase Dashboard → SQL Editor
-- Creates a test chapter + sample events/tasks for local dev.
-- ============================================================

-- 1. Insert a test chapter
insert into public.chapters (id, name, organization)
values (
  '00000000-0000-0000-0000-000000000001',
  'Alpha Chapter',
  'Sigma Chi'
);

-- 2. Sample events (chapter_id matches above, created_by is null for seed data)
insert into public.events (chapter_id, title, description, location, starts_at, ends_at, is_mandatory)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Chapter Meeting',
    'Weekly chapter meeting. Attendance mandatory.',
    'Chapter House – Main Room',
    now() + interval '2 days',
    now() + interval '2 days' + interval '2 hours',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Philanthropy Event',
    'Annual charity fundraiser.',
    'University Quad',
    now() + interval '7 days',
    now() + interval '7 days' + interval '4 hours',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'New Member Education',
    'Pledge class session.',
    'Chapter House – Library',
    now() + interval '4 days',
    now() + interval '4 days' + interval '90 minutes',
    true
  );

-- 3. Sample standalone tasks
insert into public.tasks (chapter_id, title, description, due_at, status)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Book venue for formal',
    'Contact the Riverside Ballroom for spring formal.',
    now() + interval '14 days',
    'pending'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Send alumni newsletter',
    'Draft and send the monthly alumni update.',
    now() + interval '5 days',
    'in_progress'
  );
