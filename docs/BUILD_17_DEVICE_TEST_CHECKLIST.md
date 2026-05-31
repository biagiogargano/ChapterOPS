# Corrected Private Build — Device Test Checklist

A do-it-in-order checklist for the **next corrected iOS build** — the private,
founder-only build that supersedes Build 17. **No build is implied by this doc**; it
only describes what to test once that build exists. Purpose: verify the RPC-backed
round-trips pure tests can't cover — **questionnaire persistence, Goals CRUD, and the
weekly goal-update flow** — on a real device.

> ⚠️ **Roll-out caution — read first.**
> - Test on **your phone first**, plus at most **one other device/account** (to check
>   the leadership-reader view). Do **not** ask the eBoard to test yet.
> - Do **not** widen distribution until the **Priority 1** round-trips below pass end
>   to end on device.
> - If a Priority-1 round-trip fails, the bundle is not ready — stop and report, don't widen.
>
> ⛔ **Build 17 is superseded — do not test on it.** Build 17 predates the
>   questionnaire-persistence client fix (commit `981b71e`) and everything after it
>   (text/status goals, weekly goal-update generation, the Goals error-honesty + form
>   fixes). On Build 17 the questionnaire/goal-update forms still show "unavailable"
>   after reload. Only the **next** build verifies §4–§7b. This checklist targets that
>   build.

---

## Priority run order (do in this exact order)
**Priority 1 — MUST pass. These justify the build; any failure blocks even private use:**
1. **Questionnaire round-trip** — generate → fill → submit → **reopen persists** (§2–§5).
2. **Questionnaire read safety** — leadership read-only + non-reader denial + "Not
   submitted yet" (§6).
3. **Weekly goal-update round-trip** — generate → not-open state → (when open) fill →
   submit → **reopen persists** the questions *and* answers (§7b).
4. **Goals CRUD persists** — create / edit / complete / archive, **numeric and
   text/status**, persist across reload (§7).

**Priority 2 — should pass. A failure blocks eBoard rollout, not your private use:**
5. Goals permissions + read-only assigned goals + owner selector + visibility (§7).
6. Goal-assigned in-app notice + the 4 task-action notices + dismiss + actor-exclusion (§7, §9).
7. "Opens <date>" card cue, idempotent re-runs, Goals error honesty + pull-to-refresh (§7, §7b).
8. Durable goal-update **snapshot** survives goal edits (§7b); editable **agenda** generate/
   member-view/finalize (§7c).

**Priority 3 — smoke. Confirm no regressions:**
9. Today / Tasks / Event Detail / starter-pack read surfaces look unchanged (§8).

Pass/fail criteria are at the bottom (**"Pass / fail criteria"**).

---

## 1. Install / update
- [ ] Install the **corrected build** from TestFlight on your phone (it supersedes
      Build 17).
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
      goal; a goal with no target shows no bar (not "NaN%"). *(Text/status goals are now
      supported — see the GOAL TYPE = "Status / outcome" bullet above; numeric-only is no
      longer a limitation.)*
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
- [ ] **Error honesty (write):** if a write RPC fails (e.g. force offline) → an
      **inline/Alert error** appears and **no goal is created/changed** (never a fake
      success).
- [ ] **Error honesty (read) — FIXED:** force offline and open the Goals tab → it shows
      **"Couldn't load goals. Check your connection and try again."** (a real error),
      **not** the misleading "No goals yet." empty state. Restore connection.
- [ ] **Pull-to-refresh:** pull down on the Goals list → it re-reads (list stays
      visible, no full-screen spinner) and clears the error after reconnecting.

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
- [ ] **"Opens <date>" card cue:** before the window opens, the task card (Tasks **and**
      Today) shows **"Opens <date>"** in place of a due label — so it doesn't read as
      something to act on now. (Ordinary tasks still show their normal due label.)
- [ ] **NOT-OPEN window:** open the task as its **assignee** *before* it opens — a
      **"NOT OPEN YET"** notice shows ("Opens <date>") and the form is **read-only**
      (no Submit). (Window opens ~4 days out by default.)
- [ ] **No plain "Mark Complete" before open:** a not-open goal-update task shows **no**
      generic complete button — only the read-only form (you can't bypass the update).
- [ ] **"HOW THIS WORKS" intro:** as the assignee filling the open form, a short intro
      explains per-goal (current / what changed / need help / request complete), the
      "No update this cycle" toggle, and the weekly check-in.
- [ ] **Form reconstructs (the key check):** once open (or to verify content), the form
      lists **each active goal** for that role (current value / what changed / need help
      / request complete) followed by the **weekly check-in** (accomplishments /
      priorities / blockers / announcements).
- [ ] **Survives reload:** fill + submit (when open) → reopen the task → your answers
      **persist** and the questions are still there (reconstructed from goals + answers
      from the RPC — **not** "This questionnaire is unavailable").
- [ ] **Goal-load failure warns (don't silently drop goals):** force offline, open an
      *open* goal-update task → a **"⚠️ Couldn't load your goals…"** warning shows above
      the form (so you don't submit a check-in-only form thinking you have no goals).
      Reconnect + reopen → the goals appear.
- [ ] **Leadership read:** on a **second leadership account**, open the submitted task →
      the same goal questions render read-only with the answers.
- [ ] **Durable snapshot (NEW — history survives goal edits):** submit a goal update, then
      **edit or archive one of that role's goals** (rename it / change its target). Reopen
      the submitted task (as the submitter or a leadership reader) → it shows a
      **"📌 …from the saved snapshot for that week"** note and renders the goals/questions
      **as they were when submitted** (the renamed/archived goal still appears with its
      original title + your answer) — it does **not** drift to the current goals.
- [ ] **Pre-snapshot fallback:** a goal-update task submitted *before* this build (no stored
      snapshot) still opens — it falls back to reconstructing from current goals (no crash,
      no "unavailable").
- [ ] **No push:** generating or submitting a goal update fires **no** push.

**Known limitations (expected — do NOT file as bugs):**
- **Updates submitted before this build have no snapshot** → they reconstruct from current
  goals (so they can still drift). Only updates submitted on this build onward are
  history-accurate. (Snapshot persistence is now wired; older rows just predate it.)
- **The window is relative to generation time, not calendar-anchored.** availableAt =
  generation + ~4 days, dueAt = +7 days. Whoever runs it first that ISO week sets the
  window; re-runs the same week are idempotent (they don't move it). It is **not**
  pinned to a fixed weekday.

## 7c. Editable meeting agenda (NEW — persisted; needs the live RPCs)
The agenda screen (reached from a **meeting Event Detail** → "Open agenda") now persists a
real document via `agenda_documents`. No fake save.
- [ ] **Preview (no saved agenda):** open the agenda for a chapter/eboard meeting with no
      saved doc → it shows a **live preview** (this week's events + open tasks) labeled
      *"Preview — … not saved yet"* (leadership) / *"… no saved agenda yet"* (member).
- [ ] **Generate (leadership):** as **President / Pro Consul / Annotator**, tap **"Save
      agenda document"** → it persists and the banner flips to **"Saved agenda"**. The
      **Goals Needing Attention** section appears if any active goal is not-started / needs
      a target / ready-to-complete.
- [ ] **Update-derived sections (NEW):** first, have ≥1 officer **submit a weekly goal
      update** (this week) whose **"Announcements"** and/or **"Blockers / help needed"**
      answers have text (and a per-goal "need help"). Then **generate** the agenda → the saved
      doc shows a **HELP NEEDED** and/or **ANNOUNCEMENTS** section with those lines, each
      attributed to the officer's role (e.g. "— Social Chair"). "No update"/blank answers
      contribute nothing.
- [ ] **Saves with no submissions:** with **no** weekly-update submissions for the week,
      generate → the agenda still **saves** and simply has **no** Help Needed / Announcements
      sections (honest omission, no empty placeholders, no error).
- [ ] **Regenerate updates sections:** submit/another update with a new announcement →
      **Regenerate from current** → the agenda's Announcements/Help-Needed reflect the latest
      submissions.
- [ ] **Member view:** on a **non-leadership** account, open the same meeting's agenda →
      the **saved** document renders read-only (no Save/Finalize buttons).
- [ ] **Edit (NEW):** as leadership, tap **"Edit agenda"** → an **"Editing agenda"** banner
      shows and each line becomes editable. **Edit an item's text**, **edit a section title**,
      **+ Add item** (type a manual line), and **×** to remove a line. Tap **Save changes** →
      reopen → the edits **persisted**. **Cancel** discards edits (nothing saved). Empty
      lines / untouched empty sections are dropped on save.
- [ ] **Regenerate confirm:** as leadership, tap **"Regenerate from current"** → a confirm
      dialog warns it **replaces the saved agenda including your edits**; **Cancel** keeps your
      edits; **Regenerate** rebuilds from current events/tasks/goals.
- [ ] **Finalize (lock):** tap **"Finalize (lock)"** → green **"Finalized … read-only"**
      banner; the Edit/Regenerate/Finalize buttons disappear; a further edit attempt is
      refused by the server (`agenda_finalized`).
- [ ] **Member cannot edit:** on a non-leadership account, **no Edit/Regenerate/Finalize/Save**
      buttons appear — view only.
- [ ] **Tap-through (read mode):** event/task agenda items open the event/task; goal items
      open Goals.
- [ ] **Error honesty:** force offline + open a meeting with a saved agenda → it shows
      *"Couldn't load the saved agenda. Showing the live preview."* + **Retry**, not a fake
      blank.
- [ ] **No push:** generating / editing / finalizing an agenda fires **no** push.

**Known agenda limitations (expected):**
- **Update-derived sections use the CURRENT weekly period** (when leadership generates), not
  a meeting-anchored week. If the meeting is for a different week than "now", the
  Announcements/Help-Needed reflect this week's submissions. (Calendar-anchored per-meeting
  cycles are a later decision.)
- **Help-Needed / Announcements come only from snapshot-backed submissions** — updates
  submitted before snapshot persistence shipped contribute nothing (they have no stored
  definition to attribute questions). New submissions are fine.

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
- [ ] **Goal-assigned in-app notice (in-app only, NO push):** the only non-task in-app
      notice is "New goal assigned: <title>" (covered in §7). It must **not** fire a
      push. No **event / RSVP / questionnaire / goal-update-generation** notifications
      appear at all (in-app or push).

---

## Pass / fail criteria

**Blocks even PRIVATE use (Priority 1 — fix before relying on it at all):**
- Questionnaire or goal-update answers **don't persist** after reload (you reopen and
  the form is empty or shows "unavailable").
- A submitted form is **readable by a non-reader**, or a leadership reader **can't** read
  it / can edit it.
- Goals create/edit/complete/archive **fails silently** or shows a **fake success**.
- Any **auth/login regression**, or the app **crashes** on a core screen.

**Blocks EBOARD ROLLOUT (Priority 2 — okay for your own private testing, not for others):**
- Goal **permissions** wrong (an officer can edit a leadership-assigned goal, or can't
  edit their own), or the **owner selector / read-only assigned-goal** tag is missing/wrong.
- **In-app notifications** don't appear/dismiss, the **actor gets their own** notice, or
  an **unexpected** notice type fires (all-member / event / RSVP / goal-push / questionnaire).
- **Idempotency** broken (re-running generation **duplicates** tasks).
- "Opens <date>" cue or **not-open lock** missing (officers can submit before the window).
- Goals **error honesty** regressed (failed read shows "No goals yet." again).

**Acceptable for PRIVATE testing (note it, don't block):**
- The two **known limitations** below (reconstructed-not-snapshotted; relative window).
- Cosmetic copy/spacing nits, slow first load, a one-off transient RPC hiccup that
  succeeds on retry/refresh.
- Anything in **Priority 3 smoke** that is purely visual and not a functional regression.

**If something fails:** note the **exact step + what you saw + the role/account**, and
**stop widening**. Most likely failure points are the **RPC round-trips** (§5, §7b) and
**read permissions** (§6) — the whole reason this build exists. Do not announce to the
eBoard until every Priority 1 + Priority 2 item passes.

**Two known limitations (do NOT panic / do NOT file as bugs):**
- **Goal updates reconstruct CURRENT goals, not a snapshot.** Editing/archiving a goal
  after submission changes what the form/read view shows; the stored answers remain. A
  per-cycle history snapshot is the Phase D lane.
- **The goal-update window is relative to generation time, not calendar-anchored.**
  availableAt = generation + ~4 days, dueAt = +7 days; first run that ISO week sets it.

*Checklist only. No EAS/build is implied by this doc; a build happens only on an explicit
"cut the build" from the user. Build 17 is superseded — do not distribute it.*
