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
2. Polls
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
