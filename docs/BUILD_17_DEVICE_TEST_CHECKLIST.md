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

## 7. Quick smoke check (no regressions)
- [ ] **Today** tab: overdue items first, accurate summary line, red header only
      when overdue exists.
- [ ] **Event Detail**: open an event → linked/prep tasks, RSVP, progress count all
      render; agenda card on meeting events.
- [ ] **Tasks** tab: filters (To Do / Done / All) + search behave.

## 8. Push expectations
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
