# ChapterOPS — Product Direction & Simplified Model

**The canonical map of what ChapterOPS is and where everything lives.** Read this
first; the other docs are details:
- `SIMPLIFY_EVERYTHING_PLAN.md` — the "everything is a task/event" rule + Today audit.
- `PROTOTYPES_OVERVIEW.md` — index of the mock prototype screens.
- `PRODUCT_BACKLOG.md` — deferred/server work and future layers.
- `EBOARD_ALPHA_PLAN.md` / `ALPHA_ROLLOUT.md` — getting it into real hands.

Feature branch only. UI/mock, no persistence, no schema/RLS/auth/flags/task-state
changes, no merge to alpha.

---

## 1. The core model (everything reduces to these)
ChapterOPS is **not** a chat app, a social app, or a dashboard pile. It is a small
set of primitives, and every feature must map back to one of them:

| Primitive | What it is |
|-----------|-----------|
| **Organizations** | The chapter/group. Owns everything else; data is org-scoped. |
| **Events** | Something happening at a time (meeting, social, recruitment…). |
| **Tasks** | Something someone must do. The universal unit of work. |
| **Roles** | Who someone is in the org → what they can do / get assigned. |
| **Templates** | Reusable definitions that generate events + tasks deterministically. |
| **Structured responses** | A task whose completion is *submitting answers to a form* (reports, polls, surveys, goal updates). |
| **Automation** | Rules that generate tasks/events from events, templates, and recurrence. |

**The one rule:** if a feature can be expressed as a task or an event, it **is** one —
not a new module, queue, or dashboard.

## 2. How every major feature maps back
| Feature | It is really… |
|---------|---------------|
| **Reports / Weekly Officer Report** | a **structured-response task** (form fields, draft → submit) |
| **Polls** | just a **task template** — a one-question task (assigned to all brothers); not a feature of its own. Make one from the Task flow. |
| **Surveys / quizzes** | structured-response tasks (deferred; same engine, more fields) |
| **Attendance** | an **event-linked task** (Annotator-owned, opens at event start) |
| **RSVP** | an **event-linked task/action** (headcount; can be required separately) |
| **Reviews / approvals** | a **task in a review state** with a REVIEW label — not a queue |
| **Meeting agenda** | **derived** (read-only) from events + tasks + reports |
| **Reminders / notifications** | pointers that link **back to** a task/event |
| **Messaging (future)** | **action-linked comments** on a task/event/report — never general chat (backlog #9) |
| **Onboarding** | invite link (default) places people into roles; manual entry is fallback |
| **Org type** | smart **defaults** (roles, labels, templates, event types, reports) — not hardcoded Sigma Chi |
| **Teams / committees** | an optional **named group of members under a role** (e.g. Social Committee); auto-populates the structure visual under that role; **many-to-many** (one person can be on several teams); tasks/events assigned to a team fan out to its members — not a new primitive, not a chat channel (backlog #11) |

If something can't be expressed this way, that's a signal it may not belong in the core.

## 3. Where everything lives (the four surfaces)

### Today — "what's happening and what do I need to do" (only 3 blocks)
- **Today's Events** — events dated today.
- **Today's Tasks** — my open tasks due today/overdue, **including review items shown
  inline as tasks with a REVIEW label**. RSVP/date quick-actions stay (event-linked).
- **Coming Up** — this week's upcoming tasks + events.
- **Completed tasks are hidden** (open work only).
- **NOT on Today:** review queues, "chapter alerts", approval sections, per-role
  layouts, points, dashboards, glance tiles, or any standalone section.

### Tasks — the full work surface
- One **"My tasks"** list (review folds in with a REVIEW label).
- **Filters/search**, **sort** (Due date / Type / Event), and a **"below you ·
  overdue"** observation for leadership.
- **Completed hidden by default** with a **"Show completed"** toggle.
- Reports, attendance, RSVP, and review all appear here **as tasks** — not as
  separate tabs.

### Events — events own their tasks
- Event detail shows **"Tasks this event creates"** (attendance, RSVP review, prep).
- RSVP/attendance settings live on the event (incl. required-RSVP-on-optional).
- Templates apply here to generate prep tasks (Add vs Replace, single vs series).
- Agenda is generated from event + task + report data (read-only derivation).

### Me — the single identity/config surface (Settings nested inside)
- **One** profile/identity surface: your profile, org switching, manage templates,
  sign out, and a **Settings** link.
- **Settings is reached from inside Me** (a tap-in, not its own tab): org details &
  ownership, members & positions, leadership structure, report questions, event
  automation, notification prefs — the smart-default configuration.
- The **🧪 Prototype features** hub lives here (sandbox only).
- **NOT** a place for day-to-day work — no task lists or event feeds.

### Create (tab)
- Single officer-gated entry point: **Event / Task** (real) + Announcement / Poll /
  Group (prototype). Keeps "add anything" in one predictable place.

## 4. Deferred / Experimental (NOT core, do not let these creep in)
These are parked. They may return later as scoped checkpoints, but they are **not**
part of the simplified core and must not add tabs/sections to Today:
- **Points / leaderboard / engagement scoring**
- **Pinned / custom tabs** (Pinned already retired from the bar)
- **Full permissions grid / matrix** (permissions stay *implicit*; revisit as simple tiers)
- **Full org-tree builder** (Q&A tree is a prototype; full builder deferred)
- **Surveys / quizzes** (deferred; reuse the structured-response engine later).
  A **poll** is not a separate feature — it's just a **task template** (a
  one-question task). The standalone `/poll` prototype is throwaway.
- **AI** (natural-language → draft events/tasks/templates; proposes only, never replaces the deterministic engine)
- **General messaging / chat / DMs / channels / reactions / feed / file-sharing**
  (see backlog #9 — only *action-linked* comments are ever in scope)

## 5. What still needs product review (before any alpha merge)
- Confirm Today permanently drops "chapter alerts" (vs a tiny observation note).
- Confirm review items belong in Today's tasks for the reviewer (vs Tasks-only).
- Whether "Coming Up" stays tasks **and** events (currently both).
- The real, **schema-backed** structured-response task + event-linked task
  generation are the actual builds; current screens only demonstrate the model.
- Org-agnostic labels (Sigma Chi terms from a template, not core names) — direction
  agreed, prototype paused pending instruction.
- Nothing here is persisted; any merge to `phase-2` is a separate, approved step.

## 6. Guardrails
Feature branch only; `phase-2`/alpha untouched; every change `tsc`-clean +
`test:pure` green (12 suites); no schema/RLS/RPC/auth/flags/task-state-machine/AI/
EAS changes; prototypes are mock and non-persisted; no merges.
