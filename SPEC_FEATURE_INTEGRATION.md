# Spec — How features fit the core (tasks + events)

**PLANNING / UI-first.** No schema/RLS/auth/flags/state-machine changes here.
Principle doc for making every feature feel native to the app instead of a bolt-on
screen. Lives on `feature/questionnaire-reports-planning`; does **not** touch
`phase-2`.

## The principle
Everything should manifest through the two core primitives the app already has —
**events** and **tasks** — so it fits how officers already work. A feature becomes:
- a **task** (assigned to a role, with a due window, optionally linked to an event), and/or
- an **event-triggered** behavior (a task that the event's lifecycle opens/closes).

No new standalone "modes" the user has to discover separately — the work shows up
on Today / Tasks / the event, where they already look.

## Worked example — Attendance
Attendance is **not** a separate screen you go find. It's a **generated task**:
- **Owner:** the **Annotator** (their responsibility).
- **Linked to:** mandatory meetings — **chapter** and **eboard** events, and any
  **mandatory** (audience = all) event.
- **Opens:** when the event **starts** (you can't take attendance early).
- **Due:** about **1 hour after the event ends** (close the record while it's fresh).
- **Completion:** opens the check-in roster; submitting it completes the task and
  records who was present.
- **States over time:** Scheduled (before start) → Open (during the window) →
  Overdue/auto-closed (past due, if not completed).

So the Annotator just sees "Take attendance — Chapter Meeting" appear on Today when
the meeting starts, taps it, marks the room, done. Same task lifecycle as every
other prep task; it simply has an event-driven open time and a relative due time.

## The general pattern (reuse the existing engine)
This is the same machinery as today's generated prep/RSVP tasks, plus two ideas:
1. **Event-relative timing:** a task can open at `event.start` and be due at
   `event.end + offset` (e.g. +1h) — not just a fixed calendar due date.
2. **Role ownership by responsibility:** the generator assigns the task to the
   role that owns that duty (Annotator → attendance/minutes; Risk → safety
   checklist; Social → headcount; etc.).

Other features that should follow this pattern (future):
- **Weekly officer report** → a recurring task per officer (opens Mon, due Sun).
- **Meeting minutes / agenda sign-off** → Annotator task tied to the meeting.
- **Post-event recap / receipts** → owner task due X after the event.

## What's gated (NOT now)
- Real generation needs the **task engine + state machine** (event-relative open/
  due times are new behavior) and persistence — deferred to the schema/state phase.
- The prototype derives attendance tasks from existing mock events **read-only**,
  with mock status, to validate the model. It does not modify the real task engine.

## Open questions
1. Which events qualify for an attendance task by default — only chapter/eboard, or
   any mandatory (audience=all) event? (Prototype: chapter/eboard + audience=all.)
2. Due offset after end — fixed (1h) or org-configurable?
3. Auto-close behavior at due time: lock as "not recorded," or just mark overdue?
4. Should attendance feed the engagement/points + member attendance history?
