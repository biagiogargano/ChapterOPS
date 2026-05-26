# ChapterOPS — Prototype Review (for ChatGPT)

Paste this whole file into ChatGPT for a blunt review pass of the **feature-branch
prototypes**. Catch over-complexity, inconsistencies, and anything drifting from
the core model. All of this is **UI/mock, non-persisted** — nothing here is in the
alpha. Branch: `feature/questionnaire-reports-planning`. Alpha (`phase-2`) is
untouched.

## What ChapterOPS is
A chapter/organization management app. **Two primitives: events and tasks.**
Everything else reduces to them: reports = structured-response tasks, attendance/
RSVP = event-linked tasks, reviews = a task state, agendas = derived, polls = a
one-question task template. Goal: sophisticated but **simple, intuitive, org-
agnostic** (fraternity is template #1, not hardcoded). See `PRODUCT_DIRECTION.md`.

## The surfaces (what belongs where)
- **Today** — 3 blocks only: Today's Tasks (review folds in as a labeled task),
  Today's Events, Coming Up. Completed hidden. A small "How it works" button opens
  the walkthrough.
- **Tasks** — one "My tasks" list, filter/sort, completed hidden w/ toggle.
- **Calendar** — month grid + day detail; open tasks only.
- **Create** — 2×2: **CORE = Event/Task** (full strength) vs **COMING LATER =
  Notice/Update + Group** (dimmed, dashed, "PROTOTYPE" tag). No standalone
  Announcements — a Notice is tied to an event/task or an org notice (#9).
- **Me** — minimal: profile, org switcher, **Settings** (nested), sign out. Tap your
  **role** → org structure.
- **Settings** — grouped: Organization / Members & Roles / Templates & Automation /
  Reports & Structured Responses / Notifications / Developer-Prototypes / Account.

## What shipped this round (feature branch)
**Onboarding — ONE intro flow:**
- `/tutorial` rebuilt as an **annotated click-through**: mock screens with highlight
  rings, arrows, and callouts (Today/Calendar/Tasks/Create/Me), advance by Next or
  tapping the highlight; ends with **"Set up my org →"**.
- `/setup` is **roles-first**: Name → Org type → Who's in charge → **Roles & tiers**
  → Invite → Done. No org chart forced in setup.
- Duplicates removed: `/first-run` now redirects to `/tutorial`; the old
  `/leadership` tree is replaced by `/setup/tree`. Distinct screens kept (org-type,
  invite-link, join, manual add, invitee view, org-settings).

**Structure = tiers, not a reporting graph:**
- Roles group into **4 tiers**: Leadership / Executives / Officers / Members. Setup
  lets you include/exclude template roles, add custom roles, and move roles between
  tiers (no fine-grained ranking).
- `/setup/tree` = the structure screen: **members grouped by tier**, color-coded,
  **selectable** (tap → name/role/tier detail). **Owner-only** editing of optional
  reporting lines; everyone else sees it read-only.
- Org-type templates enriched with realistic default roles (Fraternity shows
  President (Consul), Treasurer (Quaestor)…; added Sorority, Business, Nonprofit).

**Color system (constant, app-wide):**
- **Tiers:** Leadership = blue, Executives = green, Officers = red, Members = yellow
  (same for every user).
- **Entities:** Event = per **event-kind** color; **Task = reserved bright yellow
  (#facc15), used ONLY for tasks** and never an event kind; Announcement = amber;
  Group = purple. Applied across Today, Calendar (incl. per-kind month dots),
  Coming Up, Create, roster, agenda, announcements, committee.

**Task creation:**
- **3 task types = response formats** ("How is it completed?"): **Select an answer**
  (covers mark-done / yes-no / RSVP / poll), **Text submission**, **File/photo
  upload**. Everything fits in these three; they map onto the existing
  requiresProof/proofType fields (no new schema). Multi-choice options + real upload
  arrive with structured-response / Proof v1.
- **Review** is a separate orthogonal choice (No review / Needs review → reviewer).
- Due-date calendar collapses to a summary row; fields ordered what/who/when/event.

**Navigation:** global back button now names the screen you're returning to
(e.g. "Today"/"Calendar") instead of "(tabs)". Tab "+ New" buttons are contextual
(Calendar → Create Event prefilled with the selected day; Tasks → Create Task).

## Planning-only (documented, NOT built)
- **Proof v1** (`PROOF_V1_PLAN.md`) — APPROVED direction, **post-TestFlight #2**:
  one attachment/submission (text/photo/file/link/any), private Supabase Storage,
  reviewer view, no new task states. Needs a schema/storage/RLS checkpoint.
- **Action-linked push notifications** (backlog #10) — every push answers what
  changed / why it matters / what action; deep-links; no chat spam.
- **Lightweight teams/committees under roles** (backlog #11) — a leader creates a
  team (Social Committee, Rush Team); **auto-populates the structure** under their
  role; **many-to-many** (Social Chair can also be on Rush Committee); assign tasks/
  events to a whole team. Not in setup, not a chat channel, not a reporting graph.
- **Weekly Reports v1** (#6) — structured-response tasks; the report seed.
- Post-TestFlight order: (1) eBoard TestFlight alpha → (2) Proof v1 → (3) push →
  (4) invite-link onboarding → (5) Weekly Reports v1.

## What I want ChatGPT to pressure-test
1. Are **3 response-format task types** (select-an-answer / text / file-photo) the
   right reduction — does everything really fit, and is "mark done = select an
   answer" intuitive?
2. Is **Review as a separate orthogonal choice** (not bundled with submission)
   clear?
3. **Tiers vs reporting tree:** are 4 fixed tiers right, or too rigid? Should tiers
   be org-type-configurable?
4. **Teams/committees (#11):** does "auto-populate the structure + many-to-many"
   stay simple, or is it the start of an org-graph we said to avoid?
5. **Color system:** is reserving yellow for tasks + per-tier colors + per-event-kind
   colors coherent, or too many color languages at once?
6. Is the **onboarding** (tour → roles-first setup) genuinely "one experience," or
   are there still too many separate setup screens behind it?
7. Biggest risk to "simple + intuitive for a brand-new officer" as these layers grow?
8. Anything here that should be **cut** or that's quietly becoming a second system?

## Guardrails being honored
Feature branch only; alpha (`phase-2`) untouched; every change tsc-clean + pure
tests green (12 suites); no schema/RLS/RPC/auth/flags/task-state-machine/AI; no
Proof v1 / Weekly Reports implementation; prototypes are mock and non-persisted;
no merges.
