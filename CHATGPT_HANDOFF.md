# ChapterOPS — Review Handoff (for ChatGPT)

Paste this whole file into ChatGPT for a review pass. It's a snapshot of where
things stand and the open questions I want pressure-tested. Be blunt; catch bad
ideas and over-complexity.

## Update since last handoff (what shipped + what simplified)
- **Alpha (`phase-2`) shipped 4 fixes** (tested two-device, same-org): server-wins
  pull-to-refresh (events/RSVPs/tasks/states/notices), brothers can be assigned
  tasks, Tasks-tab pull-to-refresh + single-back-after-edit, and required-RSVP-on-
  optional events (new `optional_rsvp` audience; needed a one-line CHECK widen).
- **Feature branch — "everything is a task/event" simplification (UI/mock):**
  - **Today** = only Today's tasks · Today's events · Coming up. Review items show
    inline as tasks with a REVIEW label (no separate review/approval/alert
    sections); per-role sprawl removed; **completed tasks hidden**.
  - **Tasks** = one "My tasks" list (review folds in, REVIEW label) + "below you"
    overdue observation; **completed hidden by default** with a **"Show completed"
    toggle**; **working sort** (Due date / Type / Event).
  - **Calendar** = open tasks + events only (completed hidden) — consistent.
  - **Event detail** = "Tasks this event creates" (events own their tasks).
  - Shared completion rule (`lib/taskCompletion.ts`): answered RSVP, saved date
    name, or approved task.
  - Onboarding: invite-link-first (manual = fallback); org-type templates feed
    default roles/labels; Q&A tree builder places invited people.
  - Prototypes hub separates core-direction from deferred experiments.

## What the app is
A chapter/organization management app. Core primitives: **organizations, events,
tasks, roles, templates, structured responses, automation.** Goal: sophisticated
but **simple and intuitive**; **all power to the user, app teaches them**;
**everything customizable via smart defaults**; must work for **any org type**
(fraternity is template #1, not hardcoded).

## Two branches (kept separate on purpose)
- **`phase-2` = the alpha** (real auth/Supabase, flag-on). Stable. **Not touched**
  by prototype work.
- **`feature/questionnaire-reports-planning` = prototypes + planning.** All the
  new ideas live here as **UI-only, mock, non-persisted** screens. Nothing merged
  to alpha. No schema/RLS/auth/flag/task-state changes anywhere.

## Alpha stabilization (on phase-2)
One fix is **committed locally but NOT pushed**, awaiting a two-device test:
- **Comprehensive server-wins pull-to-refresh.** Manual pull now refetches events,
  RSVPs/date submissions, tasks, task states, and notices so **same-org
  cross-device changes appear** (e.g., a brother changes RSVP yes→no, the Consul
  pulls and sees it). Mount/focus stays local-wins (protects optimistic writes);
  only manual refresh is server-wins. No Realtime, no schema.
- Testing reality: full **two-org remote isolation is deferred** until an Apple
  Developer / EAS-TestFlight build (Expo Go tunnel is unreliable for a remote
  tester). Current testing = **same-org, two accounts** (Consul + Brother) in one
  org.

## Locked product decisions
1. **Generic core, org-agnostic.** Sigma Chi terms (Consul, chapter meeting, etc.)
   come from an **org template**, not core table names. Org type → default roles,
   labels, templates, reports, workflows.
2. **Questionnaires = a structured task-response type** (not a separate system).
3. **Weekly Officer Report = the first seeded template/use case.**
4. **Invite link is the default onboarding path; manual entry is fallback only.**
   Owners shouldn't type everyone in.
5. **Attendance = an event-linked task** (Annotator-owned; opens at event start,
   due ~1h after end), not a standalone system.
6. **Required RSVP is separate from required attendance.**
7. **Permissions kept implicit for now** (the full grid was deemed too complex;
   revisit later as simple tiers or plain-English toggles, never a matrix).
8. **Deferred/experimental, not roadmap:** points/leaderboard, pinned/custom tabs,
   full permissions grid, full org-tree builder, generic polls/surveys/quizzes,
   AI, complex per-committee customization.

## Weekly Officer Report v1 (planned, NOT built; no schema yet)
- Generic **response forms / structured task responses**; Weekly Officer Report is
  the first seeded template.
- v1 input types kept tiny: **short text, long text, number** (current-vs-target /
  progress is **number + JSON config**, not a new type) + a **"No update"** option.
- Workflow: **editable draft → submit final → lock on submit**; **"something must
  change" is a warning, not a hard block**; leadership/reviewer view;
  submitted/missing status.
- Minimal data model sketch (when schema phase is approved): `response_forms`,
  `response_form_fields`, `task_field_responses`, plus `tasks.response_form_id`.
  Status reuses the existing task state machine (assigned=draft, submitted=final;
  no approval gate). No agenda integration, no surveys/polls/quizzes, no AI in v1.

## Prototypes built (feature branch, mock) — for feel, not production
- Onboarding: org-type/template picker (defaults now **feed** the tree builder's
  leader title + invite screen's suggested roles + a "using <type> defaults"
  banner), invite-link-first (manual = fallback), join-via-link form (owner picks
  required questions incl. phone), Q&A tree builder (place invited people),
  welcome walkthrough, org settings + ownership transfer, first-time experience.
- Reports/meetings: weekly report (aligned to v1: 3 input types + no-update,
  lock-on-submit), Annotator review inbox (submitted/missing), report detail,
  meeting agenda (auto-drafts from events/tasks + pulls report announcements/
  help-needed).
- Events: attendance-as-tasks, check-in, RSVP-settings (decoupled attendance vs
  RSVP), availability/time-slot picker, per-event-type automation defaults.
- People: leadership tree + delegation, members & positions editor, my committee.
- (Experiments, deprioritized: points/leaderboard, quick poll, announcements,
  pinned tab.)

## What I want ChatGPT to pressure-test
1. Is the **v1 Weekly Report scope** still too big or about right? Anything to cut?
2. Is the **generic response-form data model** sane and truly org-agnostic? Naming?
3. Is **invite-link-first** the right default, and is the manual fallback handled well?
4. **Attendance-as-an-event-linked-task** model — any holes (timing window, which
   events qualify, auto-close)?
5. **Permissions deferral** — agree to keep implicit now? When we do it, tiers vs
   plain-English toggles vs something else?
6. Anything in the deferred/experimental list that should actually be roadmap, or
   anything in roadmap that should be cut?
7. Biggest risk to "simple + intuitive for a brand-new user" as features grow?
8. Sequencing after alpha: weekly-report slice + invite-link onboarding in
   parallel, then attendance + separate RSVP/attendance flags, then agenda v1 —
   right order?

## Guardrails being honored
Feature branch only; alpha (`phase-2`) untouched; every change tsc-clean + pure
tests green (12 suites); no schema/RLS/RPC/auth/flags/task-state-machine/AI; no
merges; prototypes are mock and non-persisted.
