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

### 4. Starter-pack / org-setup FOUNDATION (no UI) — registry+loader DONE; wiring next
**Registry + pure loader built** (`lib/starterPacks.ts`, 28 tests): `STARTER_PACKS`,
`getStarterPack`, `getStarterPackForOrgTemplate`, `activeStarterPack(template)` (safe
fallback to `sigma_chi`), `isKnownStarterPackId`. The `sigma_chi` pack is *derived
from* the live constants (roles/levels/exceptions/template+questionnaire ids/agenda
sections), so it describes current behavior without changing it. **Not wired** —
nothing imports it yet.
**Sub-step (a) STARTED — first read site wired:** the Me-tab questionnaire card now
reads `{ definitionId, roles }` from the active pack via
`lib/questionnaireGenerationPlan.planQuestionnaireGeneration(org.template)` instead
of hardcoding `WEEKLY_OFFICER_REPORT_ID` + `OFFICER_ROLES`. Behavior-identical for
alpha (sigma_chi + fallback); 15 tests lock that in.
**Still direct (intentional):** assignment/reviewer picker (`task/create.tsx` —
permission risk, Category C), event-audience composition + template picker
(`event/*`, `templates/edit.tsx` — Category B, low-level pack data, no behavior win
yet). **Sub-step (b) DONE:** a second pack `club` exists as pure data
(`CLUB_STARTER_PACK`) with real custom role keys, proving genericity — not default,
not surfaced, not active in alpha. Confirmed the closed-`Role`-union gate: custom
keys are data-expressible but not yet functional through the runtime engines.
**Also done:** the pack→runtime boundary is explicit (`lib/rolePackRuntime.ts`), and
packs are integrity-checked (`lib/starterPackValidation.ts`, test-enforced). The
create-org screen reads its template label/value from the registry
(`DEFAULT_STARTER_PACK_ID`), and the **Event Create template picker** and the **Templates screen BUILT-IN list**
(`templates/index.tsx`, display-only) now read built-in templates from the active
pack via `lib/templatePackView.ts` — behavior-identical for alpha (the sigma_chi
pack lists exactly `EVENT_TEMPLATES`); custom templates still merge/list after.
**Still direct (intentional):** Event Detail's apply-template picker
(`event/[id].tsx`), template EDIT/CREATE (`templates/edit.tsx`, plus the custom
list + edit/duplicate/delete actions — Category B mutation), and template
RESOLUTION (`getTemplateById`/`buildTasksForTemplateId` must resolve any id so no
existing task breaks).
**Read-side wiring is now COMPLETE for safe sites** — see
`docs/STARTER_PACK_MIGRATION_MAP.md`. No behavior-identical Category-A site remains;
every remaining direct site is B (mutation / low-level) or C (Role-union / permission
/ product-gated). **Stop wiring** until Build 17 device testing (#1) verifies the
already-wired reads render identically.
**Next:** (c) org-type selection UI — now meaningfully possible since a second pack
exists, but still gated on the Role-union opening + a real product decision; (d)
opening the `Role` union for custom keys is **Supabase-gated**. Plan:
`ORG_ONBOARDING_AND_SETUP_PLAN.md` §6 steps 2–4.

### 5. Agenda integration from questionnaire answers — partly Supabase-gated
Wire the pure `agendaContributions.ts` into the agenda screen: fetch a cycle's
submissions and render the announcement / help-needed sections. The **read path
needs fetching submissions** (uses the existing RPC — verify on device first, #1).
No new schema for the read path.

### 6. Goals / progress layer — FOUNDATION DONE, **PARKED** (gated)
Goals are now a first-class direction with a deep pure foundation (all behavior-free,
nothing wired/applied):
- Plan + pivot: `GOALS_FIRST_SYSTEM_PLAN.md`, `GOALS_PERSISTENCE_PLAN.md`.
- Types: `lib/goals.ts` (inert). Helpers: `lib/goalHelpers.ts` (36 tests),
  `lib/goalUpdateTasks.ts` pure update-task builder (34 tests).
- Draft (UNAPPLIED) SQL: `supabase/goals_v1_draft.sql`.

**Storage gate CLEARED** — `supabase/goals_v1_draft.sql` is **applied + verified on
alpha** (RLS on, 0 policies, 6 SECURITY DEFINER RPCs, table locked to definer RPCs).
Next safe step is the **client goal service** (`lib/goalService.ts`, fallback-safe
RPC wrappers, pure-testable in dev — no build needed), then the **Goals tab** against
the live RPCs (real/persisted only — never a fake local tab).

Still gated for the tab to be USER-usable: device verification (a build) of the
goal CRUD + the questionnaire/update round-trip. Build/EAS still requires an explicit
"cut the build".

### 7. AI-assisted setup — LAST, gated on #4 working
Suggest a starter pack / templates from a description. Only after deterministic
setup (the pack loader) works. No AI promises before then.

---

## Gating legend
- **no-build**: doable now in dev (pure libs/tests/docs).
- **EAS build**: needs a TestFlight build — explicit "cut the build" only.
- **Supabase**: needs an approved schema/RLS/RPC lane — do not touch Supabase otherwise.

*Index/record only. No code, schema, RLS, RPC, flag, push, or EAS change implied.*
