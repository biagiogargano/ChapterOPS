# ChapterOPS — Product Architecture & Scale Doctrine

**Read this before building anything.** It is the standing product/architecture
contract for every Claude session on this repo. When a request conflicts with this
doctrine, surface the conflict instead of silently hardcoding.

The one-line rule: **ChapterOPS is organization-operations software. Sigma Chi is
the live alpha and the first default template pack — never the core architecture.**

---

## 1. Business goal

Become **organization operations software** sold to many kinds of organizations.

- **Start narrow:** Sigma Chi Alpha Lambda is the live alpha. Fraternity/chapter
  operations are the first template/default pack.
- **Scale broad:** fraternities, sororities, clubs, student orgs, sports teams,
  nonprofits, classes, small businesses, committees, operational teams.

Every feature must be sellable to at least a few of those with nothing changed but
labels and default content.

## 2. Core product thesis

Organizations struggle with: scattered communication, unclear ownership, missed
tasks, recurring event logistics, weak follow-up, lost institutional memory, rough
leader transitions, poor operational visibility.

ChapterOPS solves this with: **events · tasks · assignments · templates ·
structured responses/questionnaires · reviews/submissions · agendas · notices**,
and eventually **goals/progress tracking** and **AI-assisted setup/workflow
generation**.

## 3. Generic primitives

The core is these generic primitives. Fraternity terms are *examples of default
content*, not the primitive itself.

| Primitive | Generic definition | Sigma Chi alpha example | Non-fraternity example |
|---|---|---|---|
| **Organization** | A tenant that owns members, events, tasks | A chapter (Alpha Lambda) | A club, team, company, class |
| **Member** | A person in an org | "Brother" | Player, employee, student, volunteer |
| **Role** | A named position a member holds | "Consul", "Quaestor" | Captain, Manager, Treasurer, TA |
| **Role level / permissions** | Tier that grants capabilities | president/exec/officer/member | owner/admin/lead/member |
| **Event** | A scheduled happening | Chapter meeting, social | Practice, standup, class, fundraiser |
| **Event kind** | A category of event w/ defaults | "Chapter meeting", "Social" | Game, Meeting, Shift, Lecture |
| **Task** | A unit of work with owner + due date | "Book the venue" | "Submit timesheet", "Bring snacks" |
| **Task assignment** | Who owns a task (by role/person) | Assign to Social Chair | Assign to Shift Lead |
| **Template** | A reusable set of tasks/config | Social event task pack | Game-day checklist, onboarding pack |
| **Generated task** | A task created from a template/event | Auto prep tasks for a social | Auto setup tasks for an event |
| **Submission / proof** | Evidence a task is done | Photo/link proof | Receipt upload, link to doc |
| **Review** | Approval of a submission | Officer approves prep task | Manager approves expense |
| **Structured response / questionnaire task** | A task that asks structured questions and records answers | Weekly Officer Report | Weekly team check-in, reflection quiz, availability form |
| **Report template** | One questionnaire definition | "Weekly Officer Report" | "Sprint retro", "Shift report" |
| **Agenda** | A read-only meeting view built from events/tasks/responses | Chapter meeting agenda | Standup/board-meeting agenda |
| **Notice / notification** | An in-app message about org activity | Task-assigned notice | Shift-changed notice |
| **Goal / progress object** *(future)* | A tracked target updated over time, separate from tasks | Recruitment goal | Fundraising KPI, project milestone |

**Worked example — structured response / questionnaire task:**
- Generic: a task that asks one or more structured questions and records answers.
- Sigma Chi: Weekly Officer Report.
- Business: weekly team check-in.
- Class: reflection quiz.
- Sports: availability / injury / status check.

## 4. Fraternity-specific defaults vs core logic

**Rule: fraternity labels live in default-pack content; core logic uses generic
concepts.**

| Fraternity default (pack content) | Generic core concept |
|---|---|
| "Brother" | member |
| "Consul" / "Quaestor" | role (+ role level) |
| "Chapter meeting" | event kind (meeting) |
| "Weekly Officer Report" | questionnaire / structured-response template |
| "Derby Days" | event-series / campaign template |

If you find yourself writing fraternity vocabulary into a primitive's *type names,
table columns, or branching logic*, stop — that belongs in pack content/labels.
Acceptable today: report-era names already shipped (kept to avoid churn/migration,
see `docs/STRUCTURED_RESPONSE_ROADMAP.md`). Not acceptable: *new* core logic keyed
on fraternity concepts.

## 5. Reports / questionnaires / goals direction

- **Short-term (v1, current):** the generic primitive is the
  structured-response/questionnaire task. Weekly Officer Report is one alpha
  template. Code-complete, device-unverified, no generation trigger yet.
- **Medium-term (v2):** report answers feed **agendas**, spawn **follow-up tasks**
  (help-needed), become **notices/announcements**, and surface **blockers** for
  leadership review. Pure foundation exists (`lib/agendaContributions.ts`).
- **Long-term (v3):** **goals/progress tracking** as its **own layer, separate from
  tasks.** Reports update goals over time. Examples: recruitment progress,
  philanthropy fundraising, attendance goals, officer goals, business KPI
  check-ins, class/project milestones.

Do **not** force goals into the task model early. Do **not** let reports become a
fraternity-only dead end. Detail lives in `docs/STRUCTURED_RESPONSE_ROADMAP.md`.

## 6. Build decision filter

Answer these before building any feature (put the answers in your plan/commit):

1. What is the Sigma Chi / live-alpha use case?
2. What is the generic primitive underneath?
3. Is this **core logic** or **default-pack content**?
4. Would it work for a club, class, business team, nonprofit, or sports team with
   only different labels?
5. Does it create **real persisted behavior**, or fake UI?
6. Does it make the app **easier and clearer**, or just more complex?
7. Is it **safe to build now**, or does it need Supabase / EAS / product approval?

If answer #4 is "no", redesign until it's "yes (with different labels)" or move the
fraternity part into pack content.

## 7. Near-term roadmap (under this doctrine)

1. Finish generic questionnaire/report **architecture alignment** without risky
   renames. *(largely done — aliases, generic copy, roadmap docs.)*
2. **Decide** the minimal manual generation trigger for questionnaire tasks
   (placement + generic copy). Product decision — get approval.
3. Build **one safe manual trigger** for the Weekly Officer Report *as an alpha
   template*, named/copied generically ("Create questionnaire tasks", template =
   Weekly Officer Report) — not a hardcoded fraternity button.
4. **Device-test** the response submission round trip once a build is worth cutting.
5. Build **agenda integration** from structured responses (wire the existing pure
   extraction once the RPC is device-verified).
6. Improve **event-generated tasks/templates** (still generic-first).
7. Later: **goals/progress tracking** layer.
8. Later: **AI-assisted setup**.

## 8. Stop doing this

- ❌ Do not create fraternity-only **core** systems (defaults-as-pack only).
- ❌ Do not rename everything constantly and churn the codebase.
- ❌ Do not build **fake UI** without persistence.
- ❌ Do not build huge **customization screens** too early.
- ❌ Do not burn **EAS builds** for every small change (builds are scarce;
  "cut the build" is required).
- ❌ Do not **overbuild goal tracking** before questionnaire/report tasks actually
  work on device.

---

*Companion docs: `docs/STRUCTURED_RESPONSE_ROADMAP.md` (questionnaire/report/goals
detail), `docs/BUILD_17_NOTES.md` (current bundled state), `docs/EVENT_TEMPLATES_FOUNDATION.md`
(template system). This doctrine governs when they disagree on direction.*
