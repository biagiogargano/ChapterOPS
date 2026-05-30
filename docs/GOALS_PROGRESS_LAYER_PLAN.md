# Goals / Progress Tracking — Future Layer Plan (planning only, DO NOT BUILD YET)

> **Superseded framing:** goals are now a **first-class product direction** — see
> `docs/GOALS_FIRST_SYSTEM_PLAN.md` (the goals-first plan + inert `lib/goals.ts`
> types). This doc remains the narrower persistence sketch it cross-references.

The future "goals / progress tracking" layer. **Nothing here is to be built now.**
This exists so the direction is recorded and future sessions don't (a) force goals
into the task model or (b) reinvent it ad hoc. Governed by
`docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md` §5.

---

## Core principle: goals are SEPARATE from tasks

A task is a unit of work that gets **completed** (binary-ish, has an owner + due
date). A goal is a **target tracked over time** that has *progress* — it is never
"done" in the task sense; it moves from 0 → target across many updates. Forcing
goals into the task state machine (assigned/submitted/approved) would distort both.

So: goals are their **own primitive and their own layer**, related to tasks and
questionnaires by reference, not by being one.

## What a goal is (generic)

A goal/progress object would generically carry:
- an **org** + optional **owning role/member**
- a **title** and **metric** (a number with a unit, or a milestone checklist)
- a **target** and a **current value**
- a **timeframe** (start → end, or open-ended)
- a history of **progress updates** (value + timestamp + source)

Generic by design — fraternity examples are pack content, not the model.

| Goal (generic) | Sigma Chi example | Non-fraternity example |
|---|---|---|
| Headcount/recruitment target | Recruitment class size goal | Club membership drive |
| Fundraising total | Philanthropy $ raised | Nonprofit campaign, sports booster |
| Attendance rate | Chapter attendance goal | Team practice attendance |
| Per-officer objective | Officer term goals | Employee quarterly objective |
| KPI check-in | — | Business KPI (revenue, signups) |
| Milestone completion | Committee project milestones | Class project milestones |

## How questionnaires feed goals (the link)

This is why the questionnaire work comes first. A questionnaire answer can
**update a goal's progress** over time:
- A weekly check-in's "amount raised this week" updates a fundraising goal.
- An availability/attendance form rolls up into an attendance goal.
- An officer's weekly report updates that officer's term-goal progress.

Mechanically (future): a question could carry an optional `feedsGoalId` (mirroring
how `agendaSection` already tags answers for agendas), and a pure extractor (like
`agendaContributions.ts`) would turn tagged answers into goal progress updates.
**Not designed in detail yet — do not add the tag now.**

## What would require Supabase (future, gated)

Goals persist over time and are shared org state, so the real layer needs storage:
- a `goals` table (org-scoped, RLS) and a `goal_progress_updates` table (or a
  jsonb history), with SECURITY DEFINER RPCs mirroring the submissions pattern.
- This is a **schema/RLS/RPC change** — a hard stop gate. It must be its own
  approved Supabase lane, planned like `REPORTS_V1_PERSISTENCE_PLAN.md` was.

## What should NOT be built yet

- ❌ No goals data model, table, or RPCs.
- ❌ No goals UI, dashboard, or progress bars.
- ❌ No `feedsGoalId` tag on questions yet.
- ❌ Do not bolt "progress" onto `MockTask` or the task state machine.
- ❌ Do not start this before questionnaire/report tasks work on device.

## When to start

Only after: (1) questionnaire tasks are device-verified and actually used in the
alpha, (2) v2 (answers→agendas/tasks/notices) is proven, and (3) there is a
concrete alpha need for a tracked goal. Then design the goals layer as its own
primitive with its own approved Supabase lane — starting from this doc.
