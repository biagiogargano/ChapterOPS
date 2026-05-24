# Product Spec — Meeting Agenda Auto-Population

**PLANNING ONLY.** No schema/RLS/RPC/auth/flags/data-model/state-machine changes,
no AI. Design for a later, separately-approved build. Lives on
`feature/questionnaire-reports-planning`; does **not** touch `phase-2`. Expands
`PRODUCT_BACKLOG.md` §8.

---

## 1. Idea
Auto-draft a chapter meeting agenda by **aggregating data the app already has** —
events, tasks, RSVPs, and (once it exists) questionnaire/report answers. Mostly a
**read-side** feature: it summarizes existing records into a structured agenda.
**No AI required** — this is deterministic aggregation, not generation.

## 2. Agenda sections (and their data sources)
| Section | Source (existing or planned) | Notes |
|---|---|---|
| **Old business** | Events + tasks from the **past week** (completed / overdue / discussed) | Read events by date window + task states |
| **New business** | **Upcoming** events + tasks (next week) | Read events ahead of today + due-soon tasks |
| **Brother-wide tasks** | Tasks with `assignedRole === 'all'` / chapter-wide | Filter the task store |
| **Officer-report announcements** | Questionnaire answers → "announcements" prompt (**depends on #6**) | Pull submitted weekly-report snapshots |
| **Help-needed items** | Questionnaire answers → "need help?" prompt (**depends on #6**) | Same source |
| **Unresolved action items** | Tasks still open / overdue across the chapter | Reuse Officer-Overview-style chapter-wide read |

## 3. Dependency ordering
- **Feasible now (read-only over existing data):** Old business, New business,
  Brother-wide tasks, Unresolved action items — all derive from events + tasks
  already in the stores.
- **Needs #6 (Questionnaire/Report Tasks) first:** Officer-report announcements and
  Help-needed items — they consume submitted report answers, which don't exist
  until the questionnaire data model ships.
- So: a **v1 agenda** (the four read-only sections) could ship before #6; the
  report-derived sections light up once #6 lands.

## 4. Shape of the feature (future build)
- A **read-only aggregator** (pure functions) that, given a meeting date, computes
  each section from the current event/task/RSVP/(report) data. No writes, no new
  task kind.
- An **Agenda screen** rendering the sections, with each item linking to its source
  event/task (reuse existing card/list patterns).
- Optional later: **export/share** (copy as text / share sheet) so it can be pasted
  into minutes — no Google Docs dependency required.

## 5. What it does NOT do
- **No AI / no natural-language generation** — purely deterministic rollups.
- **No new writes / no schema** in v1 beyond reading existing tables. (The
  report-derived sections inherit whatever #6 defines; no *additional* schema here.)
- **No change to the task state machine** — it only *reads* task states.

## 6. Scope / size
- **v1 (read-only, pre-#6):** medium — one aggregator module + one screen, all over
  existing data. Mostly UI + read logic; low risk.
- **Full version (post-#6):** adds the two report-derived sections once
  questionnaire answers are queryable.

## 7. Open questions
1. **Meeting cadence anchor:** is "the meeting" a specific event kind (e.g.
   `chapter`/`eboard`) the agenda is built around, or a date the user picks?
2. **Time windows:** "past week" / "upcoming" — fixed 7-day windows, or
   configurable / anchored to the previous & next meeting dates?
3. **Who sees/generates it** — officers only, or all brothers (read-only)?
4. **Export format** — in-app view only for v1, or also copy-to-clipboard / share?
5. **Ordering within sections** — by date, by urgency, or by committee?
