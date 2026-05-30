# Questionnaire Generation — Manual Trigger UI (BUILT `f8db5f0`)

> **Status: implemented.** This was the design doc for the trigger; it has since
> been approved and wired on the Me tab (President / Pro Consul / Annotator), with
> a native confirm step. The design below matches what shipped. Current state:
> `docs/BUILD_17_NOTES.md`.

How the small UI for manually creating questionnaire tasks works. Governed by
`docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md` (generic core, Sigma Chi as pack).

The backing helper already exists and is generic:
`generateQuestionnaireTasks({ orgId, definitionId, roles, cycle, dueDate })`
(`lib/reportGeneration.ts`) — explicit definition + roles, idempotent, fail-safe.

---

## Recommended surface

**Me tab → Leadership card** (`app/(tabs)/me.tsx`), gated on `isLeadershipRole`.
It already hosts an org-admin action ("Manage event templates") and is
leadership-only, so an admin generation action fits structurally. A future
dedicated "Admin" area could host it instead, but the Leadership card is the
smallest safe surface today.

## Why NOT a "Reports" tab

- A Reports tab would frame this as a fraternity officer-reports system — exactly
  the hardcoding the doctrine forbids. The primitive is questionnaire tasks; they
  live in the normal Tasks lists and complete in Task Detail. There is no separate
  "reports" surface to maintain, and other orgs (a club, a team) would never call
  this "Reports".
- Generation is an occasional admin action, not a daily destination — it does not
  warrant a top-level tab.

## Exact generic copy

| Element | Copy |
|---|---|
| Card row title | **Create questionnaire tasks** |
| Card row subtitle | "Send a check-in or report form to a set of roles for this cycle." |
| Picker title | **Choose a questionnaire** |
| Default selected template | **Weekly Officer Report** (the alpha pack default) |
| Other options | Event Recap, Weekly Team Check-In, Availability / Status Check (from the shared registry) |
| Roles field | "Who should fill this out?" — multi-select roles |
| Cycle/date field | "Due date" + an auto-suggested cycle key |
| Confirm button | **Create tasks** |
| Success toast | "Created N questionnaire tasks." |

The word "report" never appears in the chrome. "Weekly Officer Report" appears
only as the *name of one selectable template*, which is correct.

## How Weekly Officer Report appears as one template

It is the **default-selected** option in the questionnaire picker (because it is
the alpha pack's primary use case), but it sits in the same list as the generic
templates and is generated through the same generic helper. Selecting it is
identical to selecting any other definition — no special-case code path.

## Minimal interaction

1. Leadership taps "Create questionnaire tasks".
2. Pick a questionnaire (Weekly Officer Report pre-selected).
3. Pick roles (default could be all officer roles **only when** the Weekly Officer
   Report is selected — that default is pack content tied to that template, not the
   generic flow).
4. Pick a due date; the screen derives a stable cycle key.
5. Confirm → calls `generateQuestionnaireTasks` → shows the created count.
   Idempotent: re-running the same definition+roles+cycle creates nothing new.

## What is safe for alpha

- The helper is generic, idempotent, and fail-safe; a thin picker + confirm over
  it adds no new data model.
- No scheduler, no recurring jobs, no push — purely an on-demand admin tap.

## What remains gated (do NOT wire until cleared)

1. **Real-user impact (product decision).** A working button creates tasks for real
   officers in the live alpha. Needs explicit approval before wiring.
2. **Device-unverified round trip.** The form + `task_report_submissions` RPC have
   never run on device. Wiring a live generator before that makes the first real
   use also the first test. Verify after a build.
3. **Role multi-select UI.** Needs a small multi-select; reuse `SearchablePicker`
   patterns rather than a new component.

**Outcome:** (1) was approved and the trigger was built (`6c17bb7`) with a confirm
step (`f8db5f0`). It generates the tasks with a fixed Weekly Officer Report default
for officer roles (no role multi-select yet — item 3 deferred; a future
enhancement). (2) remains open: the submission round-trip is still device-unverified
and needs a build.
