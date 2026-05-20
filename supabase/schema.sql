-- ============================================================
-- ChapterOPS MVP Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ============================================================
-- CHAPTERS
-- A chapter is the top-level organizational unit.
-- All data belongs to a chapter.
-- ============================================================
create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  organization text not null,  -- e.g. "Sigma Chi", "Delta Tau Delta"
  created_at   timestamptz not null default now()
);


-- ============================================================
-- PROFILES
-- One row per member. Extends auth.users (same id).
-- Created automatically on signup via trigger below.
-- ============================================================
create type public.member_role as enum (
  'president',
  'vp',
  'treasurer',
  'secretary',
  'member',
  'pledge'
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  chapter_id  uuid references public.chapters(id) on delete set null,
  full_name   text not null,
  role        public.member_role not null default 'member',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ============================================================
-- EVENTS
-- Chapter events. Supports recurring series via:
--   recurrence_rule     → RRULE string for future scheduler use
--   template_event_id   → links an instance back to its parent template
-- ============================================================
create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  chapter_id         uuid not null references public.chapters(id) on delete cascade,
  created_by         uuid references public.profiles(id) on delete set null,
  title              text not null,
  description        text,
  location           text,
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  is_mandatory       boolean not null default false,
  recurrence_rule    text,     -- e.g. "FREQ=WEEKLY;BYDAY=MO" (populated later)
  template_event_id  uuid references public.events(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);


-- ============================================================
-- TASKS
-- Tasks can be standalone or tied to an event.
-- Assigned to a specific member or left unassigned.
-- ============================================================
create type public.task_status as enum (
  'pending',
  'in_progress',
  'done',
  'cancelled'
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  title       text not null,
  description text,
  due_at      timestamptz,
  status      public.task_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ============================================================
-- RSVPs
-- One row per (event, user) pair. Unique constraint prevents duplicates.
-- note field captures reason for absence or excuse.
-- ============================================================
create type public.rsvp_status as enum (
  'attending',
  'absent',
  'excused',
  'pending'
);

create table public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     public.rsvp_status not null default 'pending',
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);


-- ============================================================
-- INDEXES
-- ============================================================
create index on public.profiles (chapter_id);
create index on public.events   (chapter_id, starts_at);
create index on public.events   (template_event_id);
create index on public.tasks    (chapter_id);
create index on public.tasks    (event_id);
create index on public.tasks    (assigned_to);
create index on public.rsvps    (event_id);
create index on public.rsvps    (user_id);


-- ============================================================
-- UPDATED_AT TRIGGER
-- Automatically stamps updated_at on any row update.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.events
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.rsvps
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- All tables locked down. Users only see their chapter's data.
-- ============================================================
alter table public.chapters enable row level security;
alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.tasks    enable row level security;
alter table public.rsvps    enable row level security;

-- Helper: current user's chapter
create or replace function public.my_chapter_id()
returns uuid language sql stable security definer as $$
  select chapter_id from public.profiles where id = auth.uid()
$$;

-- Helper: is current user an officer?
create or replace function public.is_officer()
returns boolean language sql stable security definer as $$
  select role in ('president', 'vp', 'treasurer', 'secretary')
  from public.profiles where id = auth.uid()
$$;

-- CHAPTERS
create policy "members read their chapter"
  on public.chapters for select
  using (id = public.my_chapter_id());

-- PROFILES
create policy "chapter members read all profiles"
  on public.profiles for select
  using (chapter_id = public.my_chapter_id());

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- EVENTS
create policy "chapter members read events"
  on public.events for select
  using (chapter_id = public.my_chapter_id());

create policy "officers manage events"
  on public.events for all
  using (chapter_id = public.my_chapter_id() and public.is_officer());

-- TASKS
create policy "chapter members read tasks"
  on public.tasks for select
  using (chapter_id = public.my_chapter_id());

create policy "officers manage tasks"
  on public.tasks for all
  using (chapter_id = public.my_chapter_id() and public.is_officer());

create policy "assignee updates own task"
  on public.tasks for update
  using (assigned_to = auth.uid());

-- RSVPs
create policy "users manage own rsvps"
  on public.rsvps for all
  using (user_id = auth.uid());

create policy "officers read all chapter rsvps"
  on public.rsvps for select
  using (
    public.is_officer() and
    exists (
      select 1 from public.events e
      where e.id = rsvps.event_id
        and e.chapter_id = public.my_chapter_id()
    )
  );


-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When a user signs up, insert a skeleton profile row.
-- chapter_id is null until they join or are added to a chapter.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
