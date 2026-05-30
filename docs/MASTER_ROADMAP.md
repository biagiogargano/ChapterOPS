# ChapterOPS Master Development + Business Roadmap

**This is the canonical governing roadmap.** When any other doc disagrees on
direction or priority, this wins. Source: user-provided master roadmap (adopted
2026). Companion docs (`NEXT_BUILDABLE_WORK.md`, `PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md`,
the Goals/questionnaire/starter-pack plans) are detail under this.

---

## 1. Product identity
ChapterOPS is **organization-operations software** — not "a Sigma Chi app." Sigma
Chi is the first live alpha/default operating pack. Long-term it serves fraternities/
sororities, student clubs, sports teams, nonprofits, business teams, classes/project
groups, and eventually individuals.

**Value prop:** turn events, responsibilities, goals, updates, and meetings into clear
tasks, structured accountability, and trackable progress — reducing the chaos of
scattered texts, forgotten responsibilities, unclear ownership, and meetings where
nobody knows what happened or what's next.

## 2. Operating model (roles)
- **User** decides product direction, major workflows, whether to spend builds, whether
  to apply Supabase SQL, when to show eBoard, business priorities. Needs exact paste-able
  prompts + clear "test/commit/apply SQL/cut build now" instructions; should not review
  code deeply.
- **Strategist (ChatGPT)** = product strategist, prompt architect, quality gatekeeper,
  roadmap maintainer, "are we doing the right thing?" filter.
- **Claude** = implementation agent: inspect repo, write code, run tests, update docs,
  commit/push. **Work through the roadmap; do NOT stop at every tiny lane.**

### True gates — STOP only for these
1. EAS build / TestFlight submit.
2. Supabase schema/RLS/RPC apply.
3. Product decision affecting permissions, visibility, org model, or business model.
4. Failing tests / unclear bug that can't be safely fixed.
5. No useful safe roadmap work left.

### Do NOT stop for
- "lane complete" · "should I start the next safe lane?" · tiny docs/test/client-only
  follow-ups · obvious continuation within the approved roadmap.

## 3. Build policy (scarce release events)
- **No EAS build** unless the user says exactly **`cut the build`**.
- **No TestFlight submit** unless explicitly approved; if submitted, **private to user only**.
- **No broad eBoard rollout** until private device test passes + critical questionnaire/Goals
  flows work + the build is stable.
- **Build 17 stays private** — it predates the questionnaire-persistence client fix; do
  not distribute to eBoard. Only **1 iOS build remains** this period.
- Build only when a feature bundle needs device testing, native/push/TestFlight behavior
  changed, or RPC-backed UI needs verification. **Never** build for docs, pure helpers,
  SQL drafts, tiny copy, or one small UI tweak. Aim ≤1–2 builds/week; upgrade Expo if needed.

## 4. What went wrong (and the correction)
Built a Goals MVP before confirming it matched the desired system; treated
reports/questionnaires as the main feature instead of a layer under Goals; cut a build
before the correction lane was complete; over-relied on green tests for flows that need
device/schema verification; didn't separate private founder testing / eBoard alpha / broad
release. **Correction:** build less often, bundle meaningful work, private-test first,
eBoard only when useful and not obviously broken, stop "architecture-only" work unless it
supports a real next implementation step.

## 5. Highest priority — stabilize the private build bundle
1. Questionnaire persistence verified in a corrected build.
2. Goals create product-aligned (bulk create, owner selector, clear "update check-in"
   wording, no confusing daily/weekly/monthly).
3. Numeric-only goal values = known limitation.
4. Goals ↔ weekly updates not connected yet.
5. Update windows don't exist yet.
6. Build 17 private; the corrected next build also private to user first.

## 6. Pre-build stabilization roadmap
- **Phase A — Stabilize WITHOUT building.** Repo clean/synced; tsc; pure tests; questionnaire
  persistence mapping + applied SQL patch + honest unavailable state; Goals bulk create +
  owner selector + officer self-create; Goals permissions client/server match; in-app
  notification mirroring; **cadence UI not confusing**; update device checklist. No EAS build.
- **Phase B — Cut corrected PRIVATE build.** Only when A is clean and user says `cut the
  build`. One iOS alpha build; don't submit unless separately approved; private to user; not
  eBoard.
- **Phase C — Private testing** (the §C checklist below).
- **Phase D — Fix private-test blockers.** Only real device issues. If no builds remain, hold
  until next billing period or upgrade Expo.

### Phase C private-test checklist
questionnaire generation · questionnaire task after reload · answer submission · leadership
reading answers · Goals create · bulk create · owner selector · edit/complete/archive ·
leadership-assigned read-only · notifications mirror push · dismiss notifications ·
event/template smoke.

## 7. Feature roadmap (post-stabilization order)
- **D · Goals V1:** text/nonnumeric values (schema decision), progress display for numeric+text,
  update windows, connect Goals → weekly update tasks, goal update history, leadership review.
- **Questionnaire/Weekly Updates V1:** weekly officer update becomes a goal-update/check-in
  task that methodically asks goal updates (current value / no update / what changed / needs
  help / announcements / completion request); reliable definition persistence; leadership read
  view; update window; goal linkage.
- **Tasks:** better create UX, filters/search, event-linked, generated update tasks from goals,
  clear review/proof, notices, eventually recurring.
- **Events:** operational objects — templates, generated tasks, RSVP/attendance, supplies/
  planning, agenda linkage, follow-up, repeating events later.
- **E · Agendas/Meetings:** auto-build old business / new business / needs-help / officer updates
  / announcements / goals needing attention / absent-or-read-minutes tasks.
- **Notifications:** smarter reminders (goal-update due, meeting), settings, avoid spam.
- **F · Starter packs / multi-org:** packs define role labels/levels/permissions/event kinds/
  templates/questionnaire+goal+agenda defaults. Have: Sigma Chi pack, Club pack as data; runtime
  still limited by the closed `Role` union. Future: role-pack loader, real org-type picker, custom
  roles/templates/questionnaires/goals, onboarding wizard.
- **AI (last):** sits on stable primitives (events/tasks/templates/goals/questionnaires/agendas) —
  "create event + tasks," "generate weekly goals per officer," "meeting → tasks," "summarize
  updates into agenda." Not before deterministic workflows work.

## 8. Business roadmap (G)
- **Alpha (Sigma Chi):** prove weekly operating rhythm + officer accountability in one real org.
  Success = officers use it weekly, fewer missed responsibilities, better leadership visibility,
  preferred over texts/spreadsheets. Don't focus on marketing/pricing/public onboarding/AI yet.
- **Private beta (2–5 orgs):** another fraternity/sorority, club, volunteer group, sports team,
  small business, project/class. Manual onboarding; configure packs personally; learn generic vs
  fraternity-specific. No self-serve onboarding yet.
- **Paid pilot:** setup help + small monthly/semester fee + close support. Pricing experiments
  ($20–50/mo small orgs; $100–300/semester student orgs; setup fee larger; free early-beta trial).
  Success = renews, multiple leaders use it, weekly retention.
- **Productization** (after retention proven): onboarding, org-type picker, role setup, template
  selection, billing, invites, admin dashboard, support docs, customer success.
- **Marketing** (not early): Sigma Chi case study, sell outcomes (fewer missed tasks, better
  accountability/meetings, easier events, clearer goals, less chaos) — not features.

## 9. Do-NOT list
Send broken Build 17 to eBoard · spend last build casually · build more major systems before
stabilizing · add AI now · add scheduler now · expand notification scope · apply SQL without
explicit approval · fake onboarding · fake goal-update flow · treat Sigma Chi as the whole
product · write broad docs unless something is actually missing.

## 10. Do-NEXT list
1. Stabilize the correction bundle without building.
2. Apply needed SQL patches through approval.
3. Fix client-only UX issues.
4. Cut one corrected PRIVATE build only when ready (user says `cut the build`).
5. Test privately.
6. Fix blockers.
7. Then decide: eBoard alpha · upgrade Expo · Goals V1 · update windows · goal-linked weekly
   updates · agenda integration.

## North star
> ChapterOPS should become the operating system for small organizations: events, tasks, goals,
> updates, meetings, and accountability in one simple workflow.
