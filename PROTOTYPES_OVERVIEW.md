# Prototypes Overview (feature branch)

Index of the UI-only, **mock** prototypes built on
`feature/questionnaire-reports-planning`. **None of this touches `phase-2`,
schema, RLS, auth, flags, or the task state machine** — it's all presentation +
local mock state to explore where the app is headed. Open them in the flag-off
sandbox: **Me tab → 🧪 Prototype features** (the `/prototypes` hub).

> See `PRODUCT_DIRECTION.md` for the canonical model and where each of these maps.
> Prototypes are split into **Core-direction** (aligned with the simplified model)
> and **Experiments / Deferred** (parked; must not creep into the core surfaces).

> Everything here enforces nothing and saves nothing. The real, persistent
> versions depend on the auth/identity + schema/RLS phase (approval required).

## Core-direction prototypes (aligned with the model)
These demonstrate features that map cleanly onto events / tasks / structured
responses (see `PRODUCT_DIRECTION.md` §2).

## Onboarding & setup
Distinct screens (duplicates removed — see note at the end):
- **/tutorial** — the **annotated click-through tour** (mock screens with highlight
  rings, arrows, callouts); ends by flowing into the setup wizard.
- **/setup** — the **roles-first** wizard (name → org type → who's in charge → pick
  roles & order into tiers → invite → done; only the name is required).
- **/setup/org-type** — pick org type → preview default roles/events/report.
- **/setup/invite-link** — share a link + configure join questions (owner).
- **/join** — the self-join form a joiner fills out.
- **/setup/invite-people** — manual add (fallback).
- **/invite** — what an invitee sees when invited to a role/committee.
- **/org-settings** — rename org, transfer ownership (also linked from Settings).

## People & structure
- **/setup/tree** — the **canonical org structure** screen: members by tier
  (color-coded, selectable), owner-only reporting-line editor.
- **/delegate** — delegate a task down to a team member.
- **/committee** — a committee's group home (members, events, tasks).
- **/roster** — browse/search members, assign positions.

> **Duplicates removed:** `/first-run` now redirects to `/tutorial` (was a second
> welcome screen); the old `/leadership` tree prototype is dropped in favor of
> `/setup/tree`.

## Reports & meetings
- **/report/weekly** — fill out & submit a weekly report (goal, value, %, select,
  text, "No update"; "something must change" warn; recipient confirmation).
- **/report/inbox** — Annotator review: who submitted / who's missing.
- **/report/detail** — read a submitted report (read-only snapshot).
- **/agenda** — meeting agenda auto-drafted from this week's events & tasks.

## Events
- **/rsvp-optional** — required-RSVP-on-optional-events (decoupled attendance vs
  RSVP, with a live preview).
- **/checkin** — event attendance check-in.
- **/availability** — generated time-slot picker (reusable scheduler).

## Experiments / Deferred (NOT core — parked)
These are explicitly **not** part of the simplified core (`PRODUCT_DIRECTION.md`
§4). They exist as throwaway mocks for feel only; they must not add tabs/sections
to Today/Tasks/Events. Revisit later, if ever, as scoped checkpoints.
- **/announcements** — **reframed as "Event/task updates & notices"** (no standalone
  Announcements feature). Comms are action-linked: task comments, event updates, and
  lightweight org notices only when they belong to no task/event (backlog #9). This
  mock is kept to explore notices — **never a general feed/chat.**
- **/poll** — quick chapter poll with live tallies. *(A poll is just a **task
  template** — a one-question task; not its own feature. This screen is a throwaway
  mock; the real poll = make a task from the Task flow.)*
- **/points** — engagement points + leaderboard. *(Deferred; gamification is not core.)*
- **Pinned / custom tabs** — Pinned has been **retired** from the tab bar (route
  still reachable directly); custom tabs deferred.
- Also deferred (no screens): full permissions grid, full org-tree builder, generic
  surveys/quizzes, AI, general messaging/chat/DMs.

## Specs (planning docs on this branch)
- `QUESTIONNAIRE_REPORTS_PLAN.md` — questionnaire/report tasks.
- `SPEC_ONBOARDING_ORG_SETUP.md` — onboarding, invites, ownership, tutorial.
- `SPEC_REQUIRED_RSVP_OPTIONAL_EVENTS.md` — decoupled RSVP flag.
- `SPEC_MEETING_AGENDA_AUTOPOPULATION.md` — agenda aggregation.
- `SPEC_PERMISSIONS_CUSTOMIZATION.md` — **deferred**; permissions kept implicit for
  now (has a question list to answer before building a simpler version).
- `PRODUCT_DIRECTION.md` — **canonical** simplified model + where everything lives.
- `PRODUCT_BACKLOG.md` — deferred/server work and future layers (incl. #9
  action-linked communication).
- `APPLE_DEVELOPER_EAS_CHECKLIST.md` / `EBOARD_ALPHA_PLAN.md` — path to a real
  iPhone TestFlight alpha for the eBoard.

## Notes / next
- AI assistant ("describe it in natural language → draft it") is intentionally
  **not built** — it's a documented future direction only.
- The permission questions in `SPEC_PERMISSIONS_CUSTOMIZATION.md` §6a are waiting
  on answers.
- Natural next steps: wire the Q&A tree builder into the leadership tree so what
  you build shows up there; "also reports to" secondary lines; multiple
  per-committee report templates.
