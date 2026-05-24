# Prototypes Overview (feature branch)

Index of the UI-only, **mock** prototypes built on
`feature/questionnaire-reports-planning`. **None of this touches `phase-2`,
schema, RLS, auth, flags, or the task state machine** — it's all presentation +
local mock state to explore where the app is headed. Open them in the flag-off
sandbox: **Me tab → 🧪 Prototype features** (the `/prototypes` hub).

> Everything here enforces nothing and saves nothing. The real, persistent
> versions depend on the auth/identity + schema/RLS phase (approval required).

## Onboarding & setup
- **/setup** — guided first-run wizard (name → who's in charge → structure →
  invite → done; only the name is required, rest skippable).
- **/setup/tree** — build your org tree by **answering questions** ("who reports to
  you?") instead of a grid.
- **/invite** — what an invitee sees (role/committee, what accepting unlocks).
- **/tutorial** — first-use welcome walkthrough.
- **/org-settings** — rename org, **transfer ownership** (no-orphan confirm), links
  to customize structure/members/reports.

## People & structure
- **/leadership** — leadership tree (reports-to + who-can-delegate), highlights you.
- **/delegate** — delegate a task down the tree (uses the tree's delegation rule).
- **/committee** — a committee's group home (members, events, tasks).
- **/roster** — browse/search members, add a member.

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

## Communication & engagement
- **/announcements** — chapter announcements feed + composer.
- **/poll** — quick chapter poll with live tallies.
- **/points** — engagement points + leaderboard.

## Specs (planning docs on this branch)
- `QUESTIONNAIRE_REPORTS_PLAN.md` — questionnaire/report tasks.
- `SPEC_ONBOARDING_ORG_SETUP.md` — onboarding, invites, ownership, tutorial.
- `SPEC_REQUIRED_RSVP_OPTIONAL_EVENTS.md` — decoupled RSVP flag.
- `SPEC_MEETING_AGENDA_AUTOPOPULATION.md` — agenda aggregation.
- `SPEC_PERMISSIONS_CUSTOMIZATION.md` — **deferred**; permissions kept implicit for
  now (has a question list to answer before building a simpler version).
- `APPLE_DEVELOPER_EAS_CHECKLIST.md` — path to real iPhone alpha (TestFlight).

## Notes / next
- AI assistant ("describe it in natural language → draft it") is intentionally
  **not built** — it's a documented future direction only.
- The permission questions in `SPEC_PERMISSIONS_CUSTOMIZATION.md` §6a are waiting
  on answers.
- Natural next steps: wire the Q&A tree builder into the leadership tree so what
  you build shows up there; "also reports to" secondary lines; multiple
  per-committee report templates.
