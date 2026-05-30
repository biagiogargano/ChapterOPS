# Build 16 — Change Notes (bundled, not yet cut)

Build 16 is a bundled release in development on `phase-2`. Build 15 remains the
live TestFlight alpha. This doc lists what Build 16 contains so it can be
manually tested before cutting. No EAS build has been made.

Base: live Build 15 = commit `2e0bb51` ("record build 15 number").

---

## Theme

Two things: (1) **assignment permissions / org levels** make task assignment
safer and role-aware; (2) **clarity polish** across task completion/review and
Event Detail. No new systems, no schema, no notification-scope change.

## What changed (user-visible)

### Assignment permissions (Create/Edit Task)
- The **assignee list is now role-based** via a tested org-level rule:
  - President → self, Pro Consul, all officers/chairs, Brother
  - Pro Consul → self, President (alpha exception), officers/chairs, Brother
  - Annotator → self, President (alpha exception), Brother *(no peer officers)*
  - Other officer/chair → self, Brother
  - Brother → self only
- Assignee chips appear in **canonical display order**.
- **Self-assignment is always allowed.**
- **Edit mode keeps the task's current assignee selectable** even if it now falls
  outside the editor's range (prevents silently dropping it on save).
- **Help text** under "Assign to" explains the options for your role.

### Task completion / proof / review clarity
- Reviewing a **review-required task that has no proof** now shows
  "READY FOR REVIEW — the assignee marked this complete…" instead of a
  misleading empty "SUBMITTED PROOF / No content provided" box.
- Rejection feedback is **assignee-facing**: labeled "WHAT TO FIX" for the
  assignee (reviewers see "YOUR REJECTION NOTE"), with a clear fallback line if
  no note was left.
- The **awaiting-review status names the reviewer**:
  "Submitted — awaiting review by <Reviewer>".

### Event Detail
- The **About section is hidden when the event has no description** (no empty
  "ABOUT" header).

## What did NOT change
- Reviewer picker logic, task cloning/completion state machine, proof mechanics.
- Push notification scope/audiences (still the 4 task responsibility pushes).
- Auth/RLS/RPC/flags, Supabase schema, org-scoping.
- No new task types, templates, reports, file/photo proof, or event systems.

## Tests
- `npx tsc --noEmit` → clean.
- `npm run test:pure` → 18 suites pass, including the pure assignment helpers:
  - `orgLevels.test` (levels + exceptions + assignable derivation)
  - `taskAssignment.test` (per-role assignee lists, ordering, edit-mode, safety)

## Known risks / notes
- The assignment change is a **real-user permission change**: Annotator loses
  peer-officer assignment; every officer/chair gains Brother assignment. This is
  intended per the approved org-level rules.
- Advisor level is defined but **not wired** (no role maps to it; no view-only
  restriction yet) — out of scope for Build 16.
- Cross-org push delivery fix (`send_push`) is already deployed server-side and
  applies to live builds independent of Build 16.

## Smallest manual test list (before cutting)
1. **President create-task** → chips: self, Pro Consul, all officers, Brother (in order).
2. **Annotator create-task** → chips: self, President, Brother (no peer chairs).
3. **A chair create-task** → chips: self + Brother; help text reads sensibly.
4. **Edit a task** whose assignee is outside your range → that assignee stays selectable, not dropped on save.
5. **Submit a review-required task** → status names the reviewer; reviewer screen shows proof OR the "ready for review" line; reject with a note → assignee sees "WHAT TO FIX".
6. **Open an event with no description** → no empty "ABOUT" section.

## Status
Bundled, checks green, **not cut**. Ready for the manual pass above, then a
separately-approved EAS Build 16.
