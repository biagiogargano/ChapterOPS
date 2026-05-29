# ChapterOPS — Live Alpha Operating Plan

How we run ChapterOPS during the live operational alpha. This is not a QA/tester
checklist. It is the operating posture: we use the app for real chapter work and
let real usage surface what to fix next.

Documentation only. No code, schema, RLS, build, or submit changes are implied
by this document.

---

## 1. Alpha mindset

- This is a **live operational alpha**, not a formal testing session.
- eBoard members should use the app **naturally** for events, tasks, and RSVPs —
  the way they'd run the chapter anyway.
- **Feedback is welcome but not required.** Officers are not testers.
- **Real usage is the best test.** The bugs and product gaps worth fixing are the
  ones that show up when people use the app to get actual work done.

## 2. What we use the app for now

- Creating **chapter / eBoard / social / recruitment** events.
- **Assigning officer tasks.**
- Assigning the **same task to multiple officer roles** when useful (each role
  gets its own independent copy to complete).
- **Collecting RSVPs** for events.
- **Submitting and reviewing** tasks.
- Tracking what is **To Do / Done / All** in the Tasks tab.

## 3. What we will not force yet

- No **formal bug reports** from every officer.
- No **push notifications** yet.
- No **Proof v1** photo/file uploads yet.
- No **weekly reports** yet.
- No **full chapter rollout** yet (eBoard first).
- No **full committee / team structure** yet.

## 4. Lightweight feedback method

- If something **breaks**: screenshot it and text Biagio.
- If something is **confusing**: say what **screen** you were on and what you
  **expected** to happen.
- Biagio **collects** the issues and decides what becomes the next build. There
  is no form, no tracker officers have to use, no required cadence.

## 5. Founder / operator workflow

- Biagio uses the app **daily/weekly** to assign real work.
- Biagio **watches where people get confused** during normal use.
- Biagio turns **repeated** confusion into product fixes.
- **Do not chase every tiny one-off complaint immediately** — patterns matter
  more than single reactions. A confusion that shows up once is noise; a
  confusion that shows up repeatedly is a product problem.

## 6. Build release rhythm

- **Build 10 becomes the live alpha build.**
- Only ship a new build for **meaningful fixes**.
- **One alpha update = one clear purpose.** Each build should be explainable in
  a sentence ("fixes the auth email links", "adds push v1").
- **Avoid dumping feature-branch prototypes into alpha.** The feature branch is
  prototype-only; alpha stays on `phase-2` with real, vetted work.

## 7. Current known limitations

- No **push notifications** yet (planned next — see `docs/PUSH_V1_PLAN.md`).
- No **file/photo proof** yet (text/link proof works today).
- **Password / email flows are being stabilized** (custom SMTP + the new
  deep-link recovery/confirmation flow are landing in build 10; redirect URLs
  must be configured in Supabase before testing them).
- **Role-based assignment exists; true per-person assignment comes later.**
  Assigning to a role today means everyone in that role; assigning to multiple
  roles creates one independent task per role.
- **Some data may require pull-to-refresh** to show the latest cross-device
  changes.
- No **general messaging / chat**.

## 8. Next priorities after build 10 stabilizes

1. **Push Notifications v1** — action-linked only (see `docs/PUSH_V1_PLAN.md`).
2. **Proof v1** — photo/file/link/text submissions.
3. **Invite-link onboarding** — easier first-time join for officers/members.
4. **Weekly reports** — as structured-response tasks (see
   `docs/REPORTS_V1_PLAN.md`).

---

*Documentation only. The operating posture above governs how we use and update
the alpha; it does not change app behavior, schema, RLS, or the build/submit
process.*
