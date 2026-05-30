# Next Buildable Work — ordered index

The single "what's next" list, so sessions stop re-doing finished work. Each item
says: what it is, its gate, and the doc that already plans it. **If something below
is marked done, do not rebuild it — only fix a specific bug or stale doc.**

Keep this doc current: when a lane finishes, move it to "Done" with its commit.

---

## Do NOT revisit (done — bug/stale-doc only)

- Product doctrine + scale principles — `PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md`, `PRODUCT_BUILDING_PRINCIPLES.md`
- Questionnaire/report foundation (primitive, definitions, storage, adapter, Task Detail form, generation trigger + confirm) — `STRUCTURED_RESPONSE_ROADMAP.md`, `REPORTS_V1_STATUS.md`
- Generic questionnaire templates + generic generation — `lib/questionnaireTemplates.ts`, `lib/reportGeneration.ts`
- Agenda contribution foundation (pure) — `lib/agendaContributions.ts`
- Event-template engine + generic unsurfaced examples — `EVENT_TEMPLATES_FOUNDATION.md`, `lib/genericEventTemplates.ts`
- Org-levels / assignment permissions — `ORG_LEVELS_PLAN.md`, `lib/orgLevels.ts`
- Role-pack + setup-pack plan + inert types — `ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md`, `ORG_ONBOARDING_AND_SETUP_PLAN.md`, `lib/rolePack.ts`
- Packaging / GTM plan — `PACKAGING_AND_GTM_PLAN.md`
- Event Detail / Today / Tasks / Create Event polish — audited clean
- Build 17 notes + device-test checklist — `BUILD_17_NOTES.md`, `BUILD_17_DEVICE_TEST_CHECKLIST.md`

---

## Next, in order

### 1. Build 17 device test (when a build is cut) — GATED: EAS build
Verify the questionnaire **submission round-trip** on device (the one thing pure
tests can't cover): submit → persist via `task_report_submissions` RPC → read-only
leadership view → non-reader denial. Follow `BUILD_17_DEVICE_TEST_CHECKLIST.md`.
**Needs an explicit "cut the build"** (2 iOS builds left). Everything else here is
no-build.

### 2. Fix any device/RPC issues found — depends on #1
Triage what the device test surfaces (most likely the RPC round-trip / read
permissions). Scope unknown until #1 runs.

### 3. Questionnaire generation UX polish — only AFTER #1 is stable
Small, real improvements once the round-trip works: e.g. surface the cycle/week the
tasks are for, a role multi-select (deferred in `QUESTIONNAIRE_GENERATION_UI_PLAN.md`),
or a "view this cycle's questionnaire tasks" shortcut. No new system. Not before the
flow is device-verified (don't polish an unverified path).

### 4. Starter-pack / org-setup FOUNDATION (no UI) — no-build, partly Supabase-gated
Turn the planned `SetupPack` (`lib/rolePack.ts`) into a real, tested **registry +
pure loader**: `activePack(template)` returning the Sigma Chi pack for alpha, built
from today's constants — behavior-identical. Screens/helpers can later read the
active pack instead of importing catalogs directly. Pure + tested; **no org-type
picker UI** (that's fake until the loader exists). Custom/org-created roles stay
**Supabase-gated**. Plan: `ORG_ONBOARDING_AND_SETUP_PLAN.md` §6 steps 2–3.

### 5. Agenda integration from questionnaire answers — partly Supabase-gated
Wire the pure `agendaContributions.ts` into the agenda screen: fetch a cycle's
submissions and render the announcement / help-needed sections. The **read path
needs fetching submissions** (uses the existing RPC — verify on device first, #1).
No new schema for the read path.

### 6. Goals / progress layer — design-to-schema — GATED: Supabase
Take `GOALS_PROGRESS_LAYER_PLAN.md` from concept to a concrete schema/RLS/RPC
proposal (`goals` + `goal_progress_updates`), as its own **approved Supabase lane**
(like `REPORTS_V1_PERSISTENCE_PLAN.md` was). Separate from tasks. Do not build the
data layer until approved.

### 7. AI-assisted setup — LAST, gated on #4 working
Suggest a starter pack / templates from a description. Only after deterministic
setup (the pack loader) works. No AI promises before then.

---

## Gating legend
- **no-build**: doable now in dev (pure libs/tests/docs).
- **EAS build**: needs a TestFlight build — explicit "cut the build" only.
- **Supabase**: needs an approved schema/RLS/RPC lane — do not touch Supabase otherwise.

*Index/record only. No code, schema, RLS, RPC, flag, push, or EAS change implied.*
