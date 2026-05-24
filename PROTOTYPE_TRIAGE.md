# Prototype Triage & Narrowing — Planning Report

**Planning only. No code, no merge, no schema.** The prototype set on
`feature/questionnaire-reports-planning` stays unmerged; `phase-2`/alpha untouched.
This narrows the prototypes into roadmap / defer / experiment buckets and proposes
the smallest first slice.

## Locked product direction (from Biagio)
1. **Invite link is the DEFAULT onboarding path**; manual member entry is fallback only.
2. **Questionnaires = a structured task response type** (not a separate system).
3. **Weekly officer report = the first questionnaire use case.**
4. **Meeting agenda** eventually auto-populates from events, tasks, reports,
   announcements, and unresolved action items.
5. **Attendance = an event-linked task**, never an isolated system.
6. **Required RSVP** and **required attendance** are **separate settings**.
7. **Do NOT prioritize** points/leaderboard, full permissions grid, pinned tab,
   or full org-tree builder yet.
8. **Keep it simple — smart defaults first, customization second.**

## ⚠️ Biggest risk (ChatGPT review): configuration creep
A new org must be **useful within ~5 minutes of setup**. Every config surface,
toggle, picker, or "set this up first" step is a liability. Rule of thumb for all
future work: **ship a working default; expose a knob only when a real need is
proven.** If onboarding/settings can't get an org productive in ~5 minutes, it's
too complex. (This is why the permissions grid, full org-tree builder, pinned/
custom tabs, and per-committee templates stay deferred/experimental.)

---

## 1. Near-term roadmap (build after alpha stabilization)
Ordered by foundation value:
1. **Questionnaire / structured-task-response type** — the engine: a task whose
   completion is structured answers (draft → submit snapshot). Unlocks reports +
   later agenda. *Core.*
2. **Weekly officer report** — first use case of the above; recurring task,
   submit-snapshot, notify Annotator/Pro Consul/Consul. *Core.*
3. **Invite-link-first onboarding** — generate a link; configurable join questions
   (incl. phone), required toggles; joiner self-onboards into the roster. Manual
   add demoted to fallback. *Foundational for real orgs.*
4. **Attendance as an event-linked task** — Annotator-owned, opens at event start,
   due ~1h after end, for meetings/mandatory events. *Core, small.*
5. **Required RSVP vs required attendance as separate settings** — one added
   boolean + RSVP-generation rule tweak. *Core, small, self-contained.*
6. **Meeting agenda v1 (read-only)** — aggregate old/new business + brother-wide +
   unresolved from events/tasks; add report-derived announcements/help-needed
   *after* reports land. *Core (read-side).*

## 2. Deferred (valuable, but not first)
- **Org settings / ownership transfer** — needed for real orgs; not the first slice.
- **Welcome tutorial / first-run guided experience** — high value for adoption, can
  be built late and fairly independently (mostly UI).
- **Report detail / Annotator review inbox** — follows once reports persist.
- **Availability / generated time-slot picker** — reusable, but a later use case.
- **My committee / committee model** — depends on membership + visibility (auth phase).
- **Delegation (tree-driven task reassignment)** — depends on member-level
  assignment; defer with the org-structure work.
- **Event automation defaults (per type)** — good "decide once" idea, but adds
  config surface; defer until the generated-task engine exists, then add as
  *defaults*, lightly.

## 3. Remove / treat as experiments only
- **Points & leaderboard** — explicitly deprioritized; engagement gamification is
  not core. Keep as an experiment, don't roadmap.
- **Full permissions grid** — already retired; keep deferred and, when revisited,
  use a simpler model (tiers/toggles), never the grid.
- **Pinned / customizable tabs** — deprioritized; revisit only after the core flows
  are solid and there's evidence users want it.
- **Full org-tree builder** — deprioritized; orgs can start with simple roles +
  invite link. Revisit structure-building later.
- **Quick poll, Announcements** — nice communication extras, not core; experiments.

## 4. Features that risk making the app too complex (watch list)
- **Full permissions grid** (role × resource × level) — the canonical over-complex
  surface; avoid.
- **Full org-tree builder** + "also reports to" cross-links — graph complexity.
- **Customizable tabs / pinned tab** — configuration overhead before value is proven.
- **Per-committee custom report templates** — start with ONE chapter-wide report.
- **Event automation defaults with many toggles** — keep to smart defaults; expose
  few knobs.
- **Points rules customization** — avoid entirely for now.
  *Principle:* anything that asks the user to configure a matrix/graph up front
  fights "simple, smart-defaults-first."

## 5. Fit with the core model (events + tasks)
**Fit well (build through tasks/events):**
- Questionnaire-as-task-response, weekly report (recurring task), attendance
  (event-linked task), RSVP (task; +separate required flags), meeting agenda
  (read-aggregation over events/tasks/reports), delegation (task reassignment),
  event-automation-defaults (shapes generated tasks).

**Do NOT fit the core (standalone surfaces):**
- Points/leaderboard, polls, announcements feed, pinned/custom tabs, permissions
  grid, full org-tree. These are separate systems — treat as experiments, not core.

## 6. Recommended smallest first slice (after alpha stabilization)
**Slice: "Weekly officer report as a structured-response task" — minimum viable.**
Smallest end-to-end vertical that proves the core idea and unlocks the agenda:
- **One** chapter-wide report definition (no per-committee customization yet).
- **Tier-1 prompt types only:** goal (text), current value (number), short/long
  text, and the **"No update"** toggle. (No select/percentage/scheduler yet.)
- **Workflow:** always-editable within a weekly window → **first submit snapshots
  the week** → **notify Annotator + Pro Consul + Consul** → "something must change"
  warning. Later edits roll to next cycle.
- **Recurrence:** reuse the existing recurrence engine for the weekly cadence.
- **Out of scope for the slice:** per-committee templates, agenda wiring, polls,
  permissions, attendance — those follow once this is solid.

Why this first: it validates the **structured-task-response** engine (item 2's
direction), delivers immediate officer value, and is the prerequisite for the
agenda's report-derived sections. It is also the first place a real **schema +
draft/submit state** is introduced — so it should be its own approved schema phase.

**Parallel small slice (independent, also valuable):** invite-link-first onboarding
— it needs auth/membership writes, so it pairs with the same post-alpha auth/schema
phase, but is decoupled from the report work and can proceed alongside.

---

## Sequencing summary
1. Finish **alpha stabilization** (phase-2) → rollout decision.
2. **Auth/schema phase** opens. Within it, smallest slices:
   a. **Weekly officer report** (structured-response task) — the flagship slice.
   b. **Invite-link-first onboarding** — parallel.
3. Then: **attendance-as-task** + **separate RSVP/attendance flags** (small, core).
4. Then: **meeting agenda v1**, growing report-derived sections.
5. Defer the rest; keep experiments out of the roadmap until core flows prove out.
