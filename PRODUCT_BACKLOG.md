# ChapterOPS — Product Backlog

Planning/direction notes. Not a commitment of order or scope; each item becomes a
scoped checkpoint when picked up. Most template-application work below is
**UI-only / local** (template tasks are deterministic `tmpl_<templateId>_<eventId>_<key>`
MockTasks, so per-template targeting and replace are recoverable from the id with
no schema). Items explicitly marked **server** need schema/RLS/auth.

## 1. Template application choices
- Apply template to **this event only**.
- Apply template to the **entire series**.
- **Add on top** of existing tasks (default; non-destructive).
- **Replace** existing template-generated tasks (scoped to that template's tasks via id prefix).
- **Avoid duplicate / overlapping tasks**:
  - Exact (id-level): re-applying the same template is already idempotent — keep.
  - Semantic (heuristic): same `linkedEventId` + normalized title + assignee → **warn**, don't silently block.
  - Replace should preserve in-progress work — only remove not-yet-acted-on tasks (assigned/rejected), or warn before removing submitted/approved.

## 2. Series behavior choices
- **Replace a series only with explicit confirmation** (destructive; show count of affected occurrences).
- **Add to a series** without destructive replacement (non-destructive default).
- **This-event-only vs entire-series** behavior must stay clear and consistent with the edit/delete prompts.

## 3. Large-selection UX
- Move long button lists toward **searchable dropdown / filter** UI.
- Build one reusable searchable picker and reuse it.
- Priority order:
  1. **Template picker** (event create + Event Detail) — grows fastest with custom templates.
  2. **Event linker** (task create) — already collapsed/filtered; standardize onto the reusable picker.
  3. **Event type / kind** (event create) — small set; opportunistic.
  4. **Assignee / reviewer** (task create + template builder) — small fixed roles today; matters once member-level assignment exists.

## 4. Future AI direction
- Eventually users should describe what they want in **natural language**.
- AI should **draft** events / templates / tasks from that request.
- AI sits **on top of** the deterministic template/task system — it proposes; the existing engine generates. It does **not** replace the deterministic system yet.
- **No AI implementation now** — direction only.

## 5. Deferred server / shared work (needs schema/RLS/auth)
- Org-**shared** templates (persisted, visible chapter-wide).
- Template **permissions** (officers-only; creator restricted to their committee/self).
- **Audit / versioning** (who applied/replaced; which template version an event used).
- Real **role/member-based restrictions** backed by auth/identity.
- **Exclusive officer-role uniqueness:** prevent two members from holding the same
  exclusive officer position in one org unless explicitly allowed. Not implemented
  (no safe UI-only check exists yet) — belongs with positions/permissions + likely
  a DB constraint; defer until the assignment/permissions phase.

## Recommended first safe checkpoint  ✅ DONE
**Apply mode: Add vs Replace (single event), UI-only** — when applying a template to an
event that already has template tasks, prompt **Add on top / Replace template tasks / Cancel**;
Replace removes only that event's not-yet-acted-on `tmpl_` tasks and warns on the rest.
Then extend Add/Replace to the **entire-series** path with an explicit-confirm gate.
*(Shipped: single-event + entire-series Add/Replace, idempotent, with series-delete cascade.)*

---

# 6. Questionnaire / Report Tasks (FUTURE CORE SYSTEM — not implemented)

A new **task kind** where completion means submitting **structured answers to a
questionnaire**, not a proof upload or a one-tap done. This is a major layer, not a
tweak: it needs its own **answer data model** and **workflow** (draft → editable
window → final submit). Documented here for direction; **do not implement yet — no
schema, no task-state-machine, no AI changes now.**

## Use cases
1. Weekly officer reports
2. Polls — just a **task template** (a one-question task, usually to all brothers);
   not a standalone feature. Rides this same engine.
3. Surveys
4. RSVP questionnaires
5. Goal updates
6. Meeting prep
7. (Broader future) class / assignment / quiz-style workflows

## Anchor use case — weekly officer report
- Recurring weekly report task (pairs naturally with the existing template/recurrence engine).
- Officers can **update answers throughout the week**; the submission window may span the weekend.
- **Final submit** confirms answers (locks or snapshots them).
- Example questions: goal/status updates · target value vs current value · a **"No update"** shortcut · "do you need help with anything?" · announcements · "what else are you working on?"

## Question / response types to support (eventually)
- short text · long text · multiple choice · checkbox/multi-select · number · percentage
- **current value vs target value** · date picker · time picker
- **generated time-slot picker** from a start/end range + interval (reusable, e.g., availability)
- poll / vote · file/proof (later)

## Why it's a big phase (dependencies, all deferred)
- **Answer storage** — a structured responses model keyed to the task + responder
  (**data-model change**). Today tasks store proof text/state only.
- **Draft-then-submit workflow** — answers editable until a deadline, then a final
  submit; this is **new task-state-machine behavior** (distinct from submit→approve).
- **Recurrence/window** — reuse the recurrence + template engine for weekly cadence
  and the open/close window.
- **Reusable UI** — a question renderer + the generated time-slot picker (can build on
  the existing `SearchablePicker`/form patterns when the time comes).

# 7. Required RSVP for optional events

- **Decouple two event settings:** "attendance required" and "RSVP required" should be
  **separate** flags. An *optional* event can still **require an RSVP** (head count)
  without making attendance mandatory.
- Touches the **event data model** (a second boolean) + the RSVP-task generation rule
  (currently audience-driven). **Deferred** (data-model change).

# 8. Meeting agenda auto-population

Auto-draft a meeting agenda from existing data:
- **Old business** — past week's events/tasks.
- **New business** — upcoming events/tasks.
- **Brother-wide tasks.**
- **Officer-report announcements** (depends on #6).
- **Help-needed items** (depends on #6's "need help?" answers).
- **Unresolved action items.**
This is largely an **aggregation/read** over events, tasks, and questionnaire answers —
much of it becomes feasible once #6 exists. Mostly read-side; no AI required.

# 9. Action-linked communication, not general messaging

**Planning/direction only — no code, no schema.**

We are considering messaging/texting, but ChapterOPS should **not** become a full
GroupMe/Teams replacement.

## Concern
If ChapterOPS adds general chat, it risks looking like an *upgraded GroupMe/Teams*
instead of something new — and competing on chat is the wrong fight.

## Product principle
**ChapterOPS should not replace group chat. It should turn communication into
organized action.** Every message should hang off a task, event, report, or notice —
never a free-floating conversation.

## Messaging should be action-linked
- **Task comments / clarification** — discussion attached to a specific task.
- **Event updates** — change/cancellation notes tied to an event.
- **Report follow-up comments** — threaded on a submitted report/questionnaire (depends on #6).
- **Announcement notices** tied to events/tasks (not a standalone wall).
- **Reminders / notifications** that always link back to the relevant task/event.

## DECISION: no standalone Announcements feature
We do **not** need a standalone Announcements feature now — it risks becoming a
separate feed/chat. **Replace it with action-linked comments & notices:**
- **Task comment / clarification** — e.g. "Please upload the receipt."
- **Event update / comment** — e.g. "Meeting moved to 7:30."
- **Report follow-up comment** (later, depends on #6).
- **Lightweight org-wide notice** — only when it truly belongs to no task/event,
  e.g. "Dues deadline Friday."
- **Push** associated with the relevant item — e.g. "Your task was rejected" (#10).

The Create tab's old "Announcement" tile is now **"Notice / Update"** (tied to an
event/task, or an org notice). The `/announcements` prototype is kept only to
explore notices — **do not build a general feed/chat or a standalone announcements
module.**

## Avoid for now (explicit non-goals)
- General group chat
- DMs
- Channels
- Reactions
- Social feed
- File-sharing chat
- Anything aimed at replacing GroupMe / Teams

## Possible future direction — external bridges
- Later: **SMS, email, GroupMe, Slack, Teams, push notifications** as *delivery channels*.
- **ChapterOPS remains the source of truth**; outside tools are just where the
  action-linked message gets delivered/echoed. Inbound replies (if ever) route back
  to the originating task/event, not into a generic inbox.

## Dependencies / placement
- Comment threads need a **data model** keyed to the parent task/event/report
  (**server work** — schema/RLS) → defer with the other server items (#5, #6).
- Push/SMS/email bridges are **integration work**, separate from in-app comments;
  sequence after the in-app action-linked comment model exists.

# 10. Action-linked push notifications

**Planning/direction only — no code, no schema, no push setup, no EAS changes yet.**

Push notifications matter, but they should be **action-linked, not noisy**. They
support the core system (tasks, events, RSVPs, reviews, reports, attendance, and
comments/clarifications later) — never general chat or engagement spam.

## Principle — every push answers three questions
1. **What changed?**
2. **Why does it matter to me?**
3. **What action can I take?**

Tapping a notification **deep-links** to the relevant task, event, report, RSVP, or
review — never a generic inbox or feed.

## Good notifications (action-linked)
- Task **assigned to you**
- Task **due soon / overdue**
- Task **submitted for your review**
- Task **approved / rejected**
- Event **time/location changed**
- **RSVP required / RSVP deadline** approaching
- **Attendance task opened**
- **Weekly report due**
- **Comment or clarification** on your task/report (depends on #9)

## Avoid
- General chat spam
- Every minor update
- Leaderboard / points alerts
- Vague announcements
- Any notification that does **not** link to an action

## Dependencies / placement
- Needs **push infrastructure** (Expo push tokens / APNs) — an **integration +
  device-permission** layer, separate from in-app surfaces. Sequence **after** the
  TestFlight/EAS alpha exists (real builds receive push; Expo Go is limited).
- Notification *content* derives from existing task/event/RSVP/review state, so the
  triggers map directly onto the core model — no new product primitives.
- Comment/clarification pushes depend on #9 (action-linked communication).
- **Do not begin push setup or EAS changes for this yet** — direction only.

# 11. Lightweight teams/committees under roles

**Planning/direction only — no code, no schema.**

Instead of forcing a full org tree, a leader/officer can create a **team/committee
under their role** and invite people to join it. Once someone joins, they're part
of that leader's team and can be **assigned tasks/events through the team**. This is
the practical, opt-in alternative to a reporting graph.

## Examples
- Social Chair → **Social Committee**
- Recruitment Chair → **Rush Team**
- Risk Manager → **Risk Team**
- Treasurer → **Finance Team**
- An event lead → a **temporary event team**

## Where it lives (NOT setup)
- **Setup stays simple:** choose org type → pick roles → order into tiers → invite
  members. Teams are **not** created during onboarding.
- Teams/committees are **optional, later** — created from **Settings → Roles &
  structure** or a **leader's role page** ("My Team"). Always opt-in.

## Auto-populates the structure visual
- When a leader creates a team, it **automatically appears in the structure/tree
  view** under that leader's role — no separate "add to the chart" step. Creating a
  team *is* how the structure grows beyond the base tiers.
- The structure visual stays the tier-grouped view; teams render as **groupings
  under their owning role**, not a deep reporting chain.

## Membership is many-to-many (people on multiple teams)
- A person can belong to **several teams at once** — e.g. the **Social Chair is also
  on the Rush Committee**. Membership is a **many-to-many** relationship, not a
  single-parent tree.
- Because of this the structure is **not a strict tree**: render a member who's on
  multiple teams as appearing under each team (or tagged with their teams), never
  forced under one parent. This is the key reason teams beat a reporting graph.

## Good use cases
- **Assign a task to a whole team** (fan-out to its members).
- **Staff an event** with a team.
- Let a **chair manage helpers** without making them "officers."
- Show **"My Team"** for a chair (their members + the team's events/tasks).
- Eventually support **delegation** down to team members and **team-level reports**.

## Explicit non-goals (avoid)
- A **full org-chart builder** during onboarding.
- A **complex reporting graph** ("who reports to whom" as the default).
- Turning teams into **chat channels** (see #9 — communication is action-linked only).
- Forcing **every member to be "below" someone**; flat membership is fine.
- Building a **Teams/Slack clone**.

## Relationship to existing model
- A team is just a **named group of members under a role**; tasks/events assigned to
  a team are still ordinary tasks/events (fan-out by membership) — no new primitive.
- Complements the **tier model** (Leadership/Executives/Officers/Members): tiers give
  the coarse structure; teams give a leader an optional working group, and teams
  auto-populate the structure visual under their role. Neither is a reporting tree.
- The existing **/committee** ("My committee") and **/setup/tree** prototypes already
  hint at this; a real version is **server work** (a **team-membership join table**,
  many-to-many so one member maps to many teams) → defer with the other schema items
  (#5/#6); UI/mock can be explored on the feature branch first.

---

# Post-TestFlight priority order (APPROVED)

The locked sequence once the TestFlight alpha is in officers' hands. Each item below
is a **separate approved checkpoint**; nothing here is built yet, and Proof v1 /
push both require a schema/storage/RLS checkpoint approval before any code.

1. **5–7 officer alpha with the current app** (TestFlight) — see `EBOARD_ALPHA_PLAN.md`.
2. **Proof v1** — schema + Supabase Storage (private bucket) + RLS implementation.
   Direction approved (text/photo/file/link/any, one attachment, reviewer view +
   approve/reject, no new task states). Spec: `PROOF_V1_PLAN.md`. **High priority** —
   text/link-only proof is not enough for real officer tasks.
3. **Action-linked push notifications** (#10 above) — after a real build exists.
4. **Invite-link onboarding** (default onboarding path; manual = fallback).
5. **Weekly Reports v1** (#6 above) — structured-response tasks.

Guardrails unchanged: do **not** build Proof v1, change schema/storage/RLS, or touch
`phase-2` until TestFlight setup starts and the relevant checkpoint is approved.

---

# Roadmap placement (recommendation)

**This is the next major product layer after templates.** Suggested order:
1. **Gate first (in progress / your turn):** finish the **auth/org-scoping flag-on smoke
   test** (sections D–J in `AUTH_SMOKE_TEST.md`) → staging→alpha rollout decision.
   *(Template create/apply/replace + recurrence + searchable pickers are already done;
   the only "template work" left is server/shared templates, which is deferred.)*
2. **Then plan #6 (Questionnaire/Report Tasks)** as its own multi-phase design —
   starting with the answer data model + draft/submit workflow spec (planning), since
   that unlocks #8 (agenda) and the officer-report cadence.
3. **#7 (required RSVP for optional events)** is a smaller, self-contained data-model
   addition that can slot in independently whenever convenient.
4. **#8 (meeting agenda auto-population)** after #6 lands (it consumes report answers).
