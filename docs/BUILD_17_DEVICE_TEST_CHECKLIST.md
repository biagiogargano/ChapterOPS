# Build 17 — Device Test Checklist

A short, do-it-in-order checklist for when Build 17 is eventually cut. **No build
is implied by this doc.** The point of Build 17 on device is to verify the
**questionnaire submission round-trip** (the one thing pure tests can't cover).

> ⚠️ **Roll-out caution — read first.**
> - **Do NOT ask the whole eBoard to test.** Test on **your phone first**, and at
>   most **one other device/account** (so you can check the leadership-reader view).
> - **Do NOT broadly announce Build 17** until the questionnaire round-trip
>   (sections 4–6 below) works end to end on device.
> - If the round-trip fails, the bundle is not ready — stop and report, don't widen.
>
> ⛔ **Known: questionnaire persistence — column APPLIED, needs a NEW build.** The
>   `tasks.report_definition_id` column (`supabase/task_report_definition_patch_draft.sql`)
>   is **applied + verified on alpha**, and the client mapping shipped in commit
>   `981b71e`. **But Build 17 predates `981b71e`**, so on Build 17 questionnaire tasks
>   still won't persist their definition (you'd see "This questionnaire is
>   unavailable…"). To verify §4–6 end-to-end you need a **new build** that includes
>   `981b71e`. On Build 17 as-is, verifying the honest "unavailable" state is the
>   most you can check.

---

## 1. Install / update
- [ ] Update TestFlight to the new Build 17 on your phone.
- [ ] Launch; confirm you land logged-in on your normal org (no auth regression).

## 2. Me tab — questionnaire card visibility (by role)
- [ ] As **President / Pro Consul / Annotator**: the **"Create questionnaire tasks"**
      card is visible on the Me tab.
- [ ] As a **non-leadership role** (e.g. a chair, or Brother): the card is **not**
      shown. *(Use the sandbox role switcher if testing one account.)*

## 3. Confirmation + idempotent generation
- [ ] Tap **Create questionnaire tasks** → a confirm dialog appears
      ("Create questionnaire tasks?").
- [ ] Tap **Cancel** → nothing is created (no success line, no new tasks).
- [ ] Tap again → **Create tasks** → success line shows a created count.
- [ ] One task per officer role appears in **Tasks**, titled
      "Weekly Officer Report — <role>".
- [ ] Tap **Create tasks** again (same week) → **"No new tasks · N already existed"**
      (idempotent — no duplicates in the list).

## 4. Generated task card appearance
- [ ] Generated cards show title + status badge (To do).
- [ ] **No proof icon** and **no "Reviewed by" label** (questionnaires have neither).

## 5. Fill + submit (the key round-trip)
- [ ] Open a generated task as its **assignee**.
- [ ] Required prompts gate submit; fill them; toggle **"No update"** on an optional
      prompt.
- [ ] Tap **Submit Response** → task flips to **Done**.
- [ ] Reopen the task → your answers persist (came back from the RPC, not just local).

## 6. Read-only leadership view + non-reader safety
- [ ] On a **second leadership account** (President / Pro Consul / Annotator), open
      the submitted task → answers show **read-only** (no edit/submit).
- [ ] On a **non-reader role** (not the assignee, not leadership) → **no answer data**
      is shown (deny-by-default holds).
- [ ] Before any submit, a reader opening the task sees **"Not submitted yet."**

## 7. Goals tab (real persisted CRUD — needs the live RPCs)
The Goals tab is backed by the live Goals v1 RPCs via `lib/goalService`. It is
real/persisted — a failed RPC must show an error, never a fake success.
- [ ] **Goals tab appears** in the tab bar (Target icon, between Tasks and Me).
- [ ] **+ New goal** is shown to **any officer** (leadership + chairs). **Create a
      goal** (title, current, target, a cadence chip) → it **appears in the list**
      after refresh (persisted, not local). A **Brother / non-officer** sees **no
      create form**.
- [ ] **Goal type — numeric:** with **GOAL TYPE = "Measurable number"**, set Current #
      / Target # → the card shows "cur/tgt · NN%" and a progress bar.
- [ ] **Goal type — status/outcome:** with **GOAL TYPE = "Status / outcome"**, enter
      Current status + Target outcome (free text) → the card shows "current → target"
      and **no bar**. Reopen the goal → the text **persisted** (came from the DB).
      Edit it → the text inputs (not number inputs) appear and save.
- [ ] **Bulk create:** enter **multiple titles** (one per line, or separated by `;`)
      → pressing **Create N** creates one goal per title (value fields/cadence/owner
      shared). Partial failure shows "Created X of N…" and still refreshes. (Bulk text
      goals share the same status/outcome for now.)
- [ ] **Goal-assigned notice (in-app, no push):** as **leadership**, create a goal for
      **another** officer role → sign in as that officer → the **Notifications** screen
      shows "New goal assigned: <title>". Tapping it dismisses it and opens the Goals
      tab. Creating a goal for **your own** role notifies **no one**. No push fires.
- [ ] **Owner selector:** as **leadership/Annotator**, the form shows an **OWNER ROLE**
      picker (officer roles) — choose the officer the goal is for. As a non-leadership
      **officer**, no picker — owner is locked to their own role (no "switch role
      first" workaround).
- [ ] **Update check-in (cadence):** the create/edit form shows an **UPDATE CHECK-IN**
      label with **Weekly / Monthly / One-time** chips (default **Weekly**; no "Daily"
      / raw "custom"), plus helper text "This controls how often this goal should be
      reviewed later. It does not create reminders yet." Goal cards show the friendly
      label (Weekly / Monthly / One-time), not raw lowercase.
- [ ] **Current/target + percent + progress bar** render correctly for a measurable
      goal; a goal with no target shows no bar (not "NaN%"). NOTE: goal values are
      **numeric-only** for now (text values are a known v1 limitation, post-build).
- [ ] **Edit** a goal (change current/target/title/cadence) → values **persist** on
      reopen.
- [ ] **Complete** a goal → it leaves the active list. **Archive** a goal (confirm
      dialog) → it leaves the active list.
- [ ] **Leadership vs owner role (visibility):** as leadership, you see **all org
      goals** + an **owner-role filter** (All / per-role chips); as a non-leadership
      **officer**, you see **only goals for your role** (and can create your own). As
      a non-officer, the create form is hidden and you see only your own (likely none).
- [ ] **Permissions v1 (patch SQL APPLIED + verified on alpha —
      `supabase/goals_v1_permissions_patch_draft.sql`):** the SERVER now enforces
      creator-or-leadership management; the client guard (`canManageGoal`) matches it.
  - [ ] As **leadership**, create a goal **for an officer** (its owner role). Sign in
        as that **officer** → the goal is **visible but Edit/Complete/Archive are
        hidden**, with a **"View only — you didn't create this goal"** tag in their
        place (read-only — they didn't create it).
  - [ ] As that **officer**, create your **own** goal → you **can** Edit/Complete/
        Archive it.
- [ ] **Error honesty:** if an RPC fails (e.g. force offline) → an **inline/Alert
      error** appears and **no goal is created/changed**. NOTE: a failed *read*
      currently shows the **"No goals yet."** empty state (the read path returns []
      on error) — if you expect goals and see "No goals yet.", suspect a read error,
      not truly-empty. Flag this if it's confusing in practice.

## 7b. Weekly goal-update generation (manual; needs goals + the live RPCs)
The manual goal-update run creates one update task per officer ROLE that has active
goals. No scheduler, no push. The form is **reconstructed at render** from the role's
live goals (not stored), so it must survive reload.
- [ ] **Card visibility:** as **President / Pro Consul / Annotator**, the **"Create
      weekly goal update tasks"** card shows on the Me tab; a non-leadership role does
      **not** see it.
- [ ] **Pre-req:** create at least one **active goal** for an officer role (e.g. Social
      Chair) — see §7. With **no** active goals, generating shows **"No active goals
      yet — nothing to create."**
- [ ] **Confirm + generate:** tap the card → confirm dialog describes the flow → **Create
      tasks** → result line shows a **created** count (one per officer role with active
      goals). **Cancel** creates nothing.
- [ ] **Idempotent:** tap again the **same week** → **"No new tasks · N already
      existed."** (deterministic per-role/week ids — no duplicates).
- [ ] **Task appears:** in **Tasks**, a **"Weekly goal update"** task appears for the
      officer role; no proof icon, no "Reviewed by".
- [ ] **NOT-OPEN window:** open the task as its **assignee** *before* it opens — a
      **"NOT OPEN YET"** notice shows ("Opens <date>") and the form is **read-only**
      (no Submit). (Window opens ~4 days out by default.)
- [ ] **Form reconstructs (the key check):** once open (or to verify content), the form
      lists **each active goal** for that role (current value / what changed / need help
      / request complete) followed by the **weekly check-in** (accomplishments /
      priorities / blockers / announcements).
- [ ] **Survives reload:** fill + submit (when open) → reopen the task → your answers
      **persist** and the questions are still there (reconstructed from goals + answers
      from the RPC — **not** "This questionnaire is unavailable").
- [ ] **Leadership read:** on a **second leadership account**, open the submitted task →
      the same goal questions render read-only with the answers. *(Known: it reflects
      the role's CURRENT goals — if a goal was archived after submitting, its answer
      persists but isn't shown. History snapshot is a later lane.)*
- [ ] **No push:** generating or submitting a goal update fires **no** push.

## 8. Quick smoke check (no regressions)
- [ ] **Today** tab: overdue items first, accurate summary line, red header only
      when overdue exists.
- [ ] **Event Detail**: open an event → linked/prep tasks, RSVP, progress count all
      render; agenda card on meeting events.
- [ ] **Tasks** tab: filters (To Do / Done / All) + search behave.
- [ ] **Starter-pack read surfaces (behavior-identical for the Sigma Chi alpha — must
      look UNCHANGED):**
  - [ ] **Event Create** → the template picker shows the **same built-in templates**
        in the same order (Date Party / Recruitment / Formal / Chapter Meeting /
        E-Board Meeting), custom templates still listed after.
  - [ ] **Templates screen** (Me → Manage event templates) → the **BUILT-IN** list is
        unchanged.
  - [ ] **Me → Create questionnaire tasks** → still defaults to **Weekly Officer
        Report** for officer roles.
  - [ ] **Create-organization** screen (if reachable) → template label reads
        "Sigma Chi (fraternity) · default".

## 9. Push expectations + in-app notification mirroring
- [ ] **No new push** is expected from questionnaire generation/submission or Goals —
      those flows send nothing. Push **scope is unchanged** (still the 4 task
      responsibility pushes).
- [ ] **In-app mirroring (NEW):** each of the **four task pushes** now also creates an
      in-app **Notifications** item. Test each:
  - [ ] **Task assigned** → as the assignee, the **Notifications** screen shows
        "New task assigned: <title>".
  - [ ] **Submitted for review** → as the reviewer, shows "Task needs your review:
        <title>".
  - [ ] **Approved** → as the assignee, shows "Task approved: <title>".
  - [ ] **Rejected** → as the assignee, shows "Task needs changes: <title>".
  - [ ] **Dismiss** a notification (tap it) → it **disappears** from the list.
  - [ ] **Actor does NOT get their own notification** (e.g. the President who
        approved a task sees no "Task approved" notice for it).
  - [ ] No **all-member / event / RSVP / goal / questionnaire** notifications appear —
        only the four task actions are mirrored.

---

## If everything passes
The questionnaire round-trip is verified. Only then consider a wider (still small)
test group — not a full-eBoard announcement.

## If something fails
Note the exact step + what you saw, and stop the roll-out. Most likely failure
point is **section 5–6** (the RPC round-trip / read permissions) — that's the whole
reason this build exists.

*Checklist only. No EAS/build is implied; cut Build 17 only on an explicit
"cut the build". Current bundled state: `docs/BUILD_17_NOTES.md`.*
