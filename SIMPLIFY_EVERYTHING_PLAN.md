# Simplification Plan — "Everything is a task or an event"

**Feature branch only. Docs + UI/mock. No phase-2, no schema/RLS/auth/flags,
no real task-state-machine change, no AI, no persisted systems.**

## The one rule
Everything that can reasonably be represented as a **task** or an **event** should
be. Tasks and events are the two primitives; other "systems" collapse into them:
- **Reports** → a **structured-response task type** (not a separate module).
- **Reviewing someone's work** → a **task with a review state/label** (not a
  separate dashboard/queue).
- **Attendance** → an **event-linked task** (Annotator-owned, opens at start).
- **RSVP** → an **event-linked task/action**.
- **Agenda items** → **derived from** events + tasks + reports (not a standalone,
  hand-maintained list).

User mental model to protect: **"What's happening today?"** and **"What do I need
to do?"** — nothing more on Today.

## Audit — separate section/system → what it should be
| Today / current surface | Status | Should be |
|---|---|---|
| Today "NEEDS FINAL APPROVAL" / "NEEDS MY REVIEW" sections | exists (real) | a **task with a REVIEW label** in Today's tasks |
| Today "CHAPTER ALERTS" (overdue not-mine) | exists (real) | **observation**, not a Today section — lives on Tasks ("below you"), off Today |
| Today per-role section sprawl (brother/officer/annotator/leadership/president) | exists (real) | **one** layout: today's tasks + today's events + coming up |
| Tasks "Chapter Overview" 3-tile glance | removed (prototype) | gone; only "events need prep" kept as a compact link |
| Tasks Mine/To-review/All toggle | removed (prototype) | gone; review folds into one "My tasks" list with REVIEW label |
| Weekly report | done (prototype) | **structured-response task** (response_forms / fields) |
| Attendance | prototyped | **event-linked Annotator task** (opens at start, due ~1h after) |
| RSVP | exists | **event-linked task/action** (already is) |
| Required RSVP vs attendance | done (phase-2) | event setting on the event (audience incl. optional_rsvp) |
| Meeting agenda | prototyped | **read-only derivation** from events/tasks/reports |
| Points/leaderboard, polls, announcements, pinned tab | experiments | NOT core; stay deferred/experimental |

## Today — stays / moves / removed
**Stays on Today (only these three):**
1. **Today's events** — events dated today.
2. **Today's tasks** — my tasks due today/overdue, **including review items shown as
   tasks with a REVIEW label** (not a separate section). RSVP/name quick-actions
   stay (they're event-linked tasks).
3. **Coming up** — this week's upcoming tasks + events.

**Moves to Tasks tab:**
- The full task list, filters/search, "below you · overdue" observation, recently
  reviewed. (Tasks already simplified: one "My tasks" list with REVIEW label.)

**Removed from Today:**
- "Needs final approval", "Needs my review", "Chapter alerts" as **separate
  sections** (review → a task in today's tasks; alerts → observation on Tasks).
- Per-role branch layouts (collapse to one).
- The "needs attention" caption (optional; reduces noise). Card-level reminder
  badges can stay.

## What becomes a task type / event-linked (model)
- **Structured-response task** (reports) — generic `response_forms` model
  (planned, see WEEKLY_REPORT_V1_PLAN.md). v1 = weekly officer report.
- **Event-linked generated tasks** — attendance, RSVP, minutes, safety checklist,
  headcount — derived from an event (see `deriveEventDuties`).
- **Review** — not a new type; a task you can act on as reviewer, surfaced inline
  with a REVIEW label; uses the EXISTING submit/approve states (no new machine).

## What's removed / deferred
- Points/leaderboard, polls, announcements feed, pinned/custom tabs, full
  permissions grid, full org-tree builder, per-committee report templates, AI.

## Implemented (feature branch, UI/mock) — current state
- **Today** → 3 blocks (Today's tasks · Today's events · Coming up). Review items
  render inline as tasks with a REVIEW label; per-role section sprawl + chapter
  alerts removed. **Completed tasks hidden** (open work only).
- **Tasks** → one "My tasks" list; review folds in with a REVIEW label; overdue
  "below you" observation; **completed hidden by default with a "Show completed"
  toggle**; **working sort** (Due date / Type / Event — due-date falls back to
  urgency when a task has no dueAt).
- **Calendar** → day-detail tasks + task dots show **open tasks only** (completed
  hidden), consistent with Today/Tasks.
- **Event detail** → "Tasks this event creates" (events own their tasks). The
  per-event related-task checklist intentionally still shows completed items
  (progress view), unlike the to-do surfaces.
- **Completion** is one shared rule (`lib/taskCompletion.ts`): answered RSVP,
  saved date name, or approved structured/ack/yes-no task.
- **Reports** aligned to the v1 structured-response model; attendance/agenda/
  duties prototypes exist.
- **Prototypes hub** separates core-direction from deferred experiments.

## Still needs product review before any merge to phase-2
- Confirm Today should drop "chapter alerts" entirely (vs a tiny observation note).
- Confirm review items belong in Today's tasks for the reviewer (vs Tasks-only).
- Whether "coming up" includes tasks, events, or both (currently both).
- The real (schema-backed) structured-response task + event-linked generation are
  the actual builds; these prototypes only demonstrate the model.
- Nothing here is wired to real persistence; merge is a separate, approved step.
