# Reports V1 — Current Status (Build 17 dev)

Snapshot of what the Reports V1 chain does today and what is intentionally not
built. Record/doc only — no behavior, schema, or EAS change implied.

---

## The full chain (all shipped to `phase-2`, not yet in a build)

1. **Generic primitive** — `lib/structuredResponses.ts`: question/answer types,
   validation, ordering, completeness, "No update", answer-edit helpers. Tested.
2. **Report content** — `lib/reportDefinitions.ts`: the v1 `weekly_officer_report`
   definition (accomplishments + goals required; blockers + announcements optional
   with No-update). Tested.
3. **Report task builder** — `lib/reportTasks.ts`: pure `buildReportTask(...)`,
   deterministic id `report_<role>_<cycle>`, carries `reportDefinitionId`,
   structured / no-proof / no-review. Tested.
4. **Storage** — `task_report_submissions` table + `upsert/get` RPCs, applied +
   verified on alpha (see `docs/REPORTS_V1_PERSISTENCE_PLAN.md`).
5. **Client adapter** — `lib/reportSubmissionService.ts`: fallback-safe
   `upsert/getTaskReportSubmission`. Tested.
6. **Task Detail form** — `app/task/[id].tsx`: a task with `reportDefinitionId`
   renders the structured-response form (assignee) or a read-only view (allowed
   readers); submit → upsert + mark task complete. No proof/review UI.
7. **Controlled generation** — `lib/reportGeneration.ts`:
   `generateReportTasks(...)` / `generateWeeklyOfficerReports(orgId, cycle,
   dueDate)`. Manual, deterministic, idempotent (same role+cycle never
   duplicates). Tested.

## What is usable now

- In **code**, calling `generateWeeklyOfficerReports(orgId, cycle, dueDate)`
  creates one report task per officer role; opening that task in Task Detail
  shows the real, validated, persistent report form; submitting saves answers to
  `task_report_submissions` and marks the task complete; the assignee / annotator
  / president / pro_consul can read the submission via the live RPCs.
- Report tasks render cleanly in Tasks / Today / Event lists with **no
  proof/review language** — verified: the task card's "Reviewed by" label is gated
  on `requiresApproval` and the proof icon on `requiresProof`, both false for
  reports, so only the generic status badge (To do / Done / etc.) shows.

## Generation UI placement — DECISION (gated, documented)

> **UPDATE (`f8db5f0`): the trigger is now WIRED.** A "Create questionnaire tasks"
> card (President / Pro Consul / Annotator) on the Me tab calls the generic
> `generateQuestionnaireTasks` with a native confirm, defaulting to the Weekly
> Officer Report template + officer roles. The section below records the original
> (correct-at-the-time) decision to keep it service-only; it has since been
> approved and built. Current design lives in
> `docs/QUESTIONNAIRE_GENERATION_UI_PLAN.md`; current state in
> `docs/BUILD_17_NOTES.md`.

**Natural surface identified:** the **Leadership card** on the Me screen
(`app/(tabs)/me.tsx`, gated on `isLeadershipRole(role)`) is the right home. It is
already leadership-only and already hosts an org-admin action ("Manage task
templates" → `/templates`), so a "Generate weekly reports" row would fit there
structurally — contrary to the earlier note that "no safe surface exists" (that
reasoning is superseded: the Leadership card is org-admin, not per-user settings).

**Why it is still gated (NOT wired this lane):**

1. **Materially affects real users.** `generateWeeklyOfficerReports(orgId, cycle,
   dueDate)` creates a report task for *every* officer role. In the live alpha,
   a working button means real officers immediately receive report tasks — a
   product decision that affects real users, which is an explicit stop gate.
2. **Unverified path.** The form + `task_report_submissions` RPC round-trip has
   never run on device. Shipping a live trigger before a build is cut makes the
   first real use also the first test.
3. **Needs real input.** Generation requires a stable cycle key + due date; a
   correct trigger needs a small cycle/date input, not a one-tap action — beyond
   the "tiny action" this lane allows.

**Decision (per Reports V1 defaults + roadmap Lane 1):** generation stays
**service/helper-only** (`lib/reportGeneration.ts`); no UI added. When a build is
cut and the RPC round-trip is device-verified, wire a leadership-gated "Generate
weekly reports" row in the Me Leadership card (with a minimal cycle/due-date
input) to `generateWeeklyOfficerReports`. Until then this is the documented,
approved placement — no new screen or Reports tab required.

## Reports → meeting agenda (foundation built, integration deferred)

The strategic loop (Operating Guide step 6) has meeting agendas pull
announcements + help-needed items from submitted reports. The **pure half is
built**:

- `StructuredQuestion.agendaSection?: 'announcement' | 'help_needed'` — a generic
  tag on a question marking that its answer feeds an agenda section.
- The weekly report tags `announcements → announcement` and
  `blockers → help_needed` (`lib/reportDefinitions.ts`).
- `lib/agendaContributions.ts` — pure `extractAgendaContributions(definition,
  answers, source?)` returns the tagged + text-answered contributions in
  definition order; `contributionsForSection` + `mergeAgendaContributions` group
  and combine across officers. "No update" / blank / untagged answers contribute
  nothing. 14 pure tests.

**Why integration is deferred (not wired into `app/agenda/[eventId].tsx`):**
surfacing these on the live agenda means fetching *every* officer's submission
for the cycle — async I/O across the report RPC, which has not been verified on
device. The agenda screen + `buildAgenda` already document report sections as
deferred. Wire them only after the report round-trip is device-verified (post
first build). The data path is now: report answer → `extractAgendaContributions`
→ agenda "Announcements" / "Help needed" sections.

## What remains gated (not built, by design)

- **No scheduler / recurring background generation** — generation is manual; the
  caller supplies the cycle + due date.
- **No reminders / push** for reports.
- **No Reports tab** — completion is via Task Detail; report tasks live in the
  normal Tasks lists.
- **No non-text question types** (select/scale/time reserved in the union only).
- **No live report→agenda wiring** — the pure extraction exists; the agenda
  screen does not yet fetch submissions (needs device-verified RPC first).
- **A new EAS build** is required to exercise the form + RPC round-trip on device.

## Tests
All pure-tested: `structuredResponses` (37), `reportDefinitions` (16),
`reportTasks` (21), `reportSubmissionService` (6), `reportGeneration` (17),
`agendaContributions` (14).

---

*Doc only. No schema/RLS/RPC/EAS/auth/push change implied. The manual generation
trigger is now wired (Me tab, leadership-gated, with a confirm step, `f8db5f0`);
the form + storage are live in code, with the submission round-trip pending a
build. This doc is a point-in-time Reports-V1 record — for current Build 17 state
see `docs/BUILD_17_NOTES.md`.*
