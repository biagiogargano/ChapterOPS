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
- [ ] As **leadership/Annotator** (President / Pro Consul / Annotator): **+ New goal**
      is shown. **Create a goal** (title, current, target, a cadence chip) → it
      **appears in the list** after refresh (persisted, not local).
- [ ] **Current/target + percent + progress bar** render correctly for a measurable
      goal; a goal with no target shows no bar (not "NaN%").
- [ ] **Edit** a goal (change current/target/title/cadence) → values **persist** on
      reopen.
- [ ] **Complete** a goal → it leaves the active list. **Archive** a goal (confirm
      dialog) → it leaves the active list.
- [ ] **Leadership vs owner role (visibility):** as leadership, you see **all org
      goals** + an **owner-role filter** (All / per-role chips); as a non-leadership
      **owner role**, you see **only goals for your role**. As an unrelated role, the
      create button is hidden and you see only your own (likely none).
- [ ] **Permissions v1 (REQUIRES the patch SQL applied —
      `supabase/goals_v1_permissions_patch_draft.sql`):**
  - [ ] As **leadership**, create a goal **for an officer** (its owner role). Sign in
        as that **officer** → the goal is **visible but Edit/Complete/Archive are
        hidden** (read-only — they didn't create it).
  - [ ] As that **officer**, create your **own** goal → you **can** Edit/Complete/
        Archive it.
  - [ ] Until the patch is applied, the SERVER still allows owner-role management even
        though the client hides the buttons — so verify the patch is applied first
        (the client guard alone is not the security boundary).
- [ ] **Error honesty:** if an RPC fails (e.g. force offline) → an **inline/Alert
      error** appears and **no goal is created/changed**. NOTE: a failed *read*
      currently shows the **"No goals yet."** empty state (the read path returns []
      on error) — if you expect goals and see "No goals yet.", suspect a read error,
      not truly-empty. Flag this if it's confusing in practice.

## 8. Quick smoke check (no regressions)
- [ ] **Today** tab: overdue items first, accurate summary line, red header only
      when overdue exists.
- [ ] **Event Detail**: open an event → linked/prep tasks, RSVP, progress count all
      render; agenda card on meeting events.
- [ ] **Tasks** tab: filters (To Do / Done / All) + search behave.

## 9. Push expectations
- [ ] **No new push** is expected from questionnaire generation or submission — that
      flow sends nothing. Only test the **existing** task-responsibility pushes
      (from Build 14/15) if you're separately verifying those; Build 17 does not
      change push scope.

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
