# Role Packs & Generic Permissions — Plan

How ChapterOPS scales from "Sigma Chi role catalog" to **many org types with
different role names and default content**, without a rewrite. Practical planning
doc — points at the real code seams and gives a concrete pack shape for later
implementation.

**Companions (do not duplicate):**
- `docs/PRODUCT_BUILDING_PRINCIPLES.md` — the pack philosophy + `organizations.template` seam.
- `docs/ORG_LEVELS_PLAN.md` — the generic level/assignment-permission model (already built + tested in `lib/orgLevels.ts`).
- `docs/EVENT_TEMPLATES_FOUNDATION.md` — the template pack boundary.
- `docs/GOALS_PROGRESS_LAYER_PLAN.md` — the future goals layer.

This doc is the **role-pack** piece those gesture at but none fully enumerate.

---

## 1. Audit — what is pack content vs core today

| Concern | Where | Pack content or core? | Verdict |
|---|---|---|---|
| Role keys + labels (`ROLES`, `ROLE_LABELS`) | `lib/roles.ts` | **Pack content** (Sigma Chi catalog), but typed as the app-wide `Role` union | Acceptable for alpha; the `Role` union is the one thing a pack must eventually parameterize |
| `OFFICER_ROLES`, `LEADERSHIP_ROLES`, `FLOOR_ROLE`, `ROLE_SWITCHER_OPTIONS` | `lib/roles.ts` | **Pack content** — already named as "current Sigma Chi pack" | Acceptable; these are exactly `pack.officerRoles` / `pack.leadershipRoles` / `pack.floorRole` later |
| Generic level model (`OrgLevel`, `canAssign`, exceptions) | `lib/orgLevels.ts` | **Core** (generic), with `ROLE_LEVEL` + `SIGMA_CHI_ASSIGNMENT_EXCEPTIONS` as pack data | Already correct — generic engine, pack-data mapping |
| Assignment gate (`canAssignToAnyOfficer`, `TASK_ASSIGNER_ROLES`) | `lib/roles.ts` + `app/task/create.tsx` | **Pack content** (which roles assign) over generic logic | Acceptable; becomes `pack`-driven later |
| Questionnaire generation default roles | `app/(tabs)/me.tsx` (`OFFICER_ROLES`) | **Pack content** (alpha picks officer roles) | Acceptable; the generic helper already takes explicit roles |
| Event templates + role assignments | `lib/eventTemplates.ts` | **Pack content** (Sigma Chi workflows) on a generic engine | Acceptable; `lib/genericEventTemplates.ts` already proves the engine is generic |
| Role-label UI copy | screens use `ROLE_LABELS[role]` indirection | **Core-safe** — no screen hardcodes "Brother"/"Consul"; all go through the label map | Good — labels already come from one map |

**Embedded-in-core risks (the things a pack must fix):**
1. **The `Role` union is a closed fraternity enum.** Every `assignedRole: Role`
   field (tasks, templates, questionnaires) is typed to the Sigma Chi catalog. A
   different org's roles aren't expressible without widening this type. *This is
   the single biggest seam.*
2. **`OFFICER_ROLES` / `LEADERSHIP_ROLES` / `FLOOR_ROLE` are imported directly**
   by helpers and screens, rather than read from an active pack. Behavior-correct
   today; the future move is to source them from a pack object.

**Acceptable for now (do NOT change):** the closed `Role` union and direct pack
imports are fine for a single-org alpha. They are documented seams, not welded-in
assumptions — labels are already indirected and the level engine is already
generic.

**What blocks selling to other org types later:** only #1 (closed `Role` union)
and #2 (direct pack imports). Both are mechanical refactors behind an adapter, not
redesigns — see §6.

---

## 2. Current alpha role model (Sigma Chi pack)

| Role key | Label | Level (`orgLevels`) |
|---|---|---|
| `president` | Consul | owner |
| `pro_consul` | Pro Consul | executives |
| `annotator` | Annotator | officers |
| `quaestor` / `magister` / `kustos` / `tribune` / `risk_manager` / `social_chair` / `recruitment_chair` / `philanthropy_chair` / `scholarship_chair` / `house_manager` | (chairs/officers) | officers |
| `brother` | Brother | members |
| *(none yet)* | — | advisors (reserved) |

## 3. Generic future model

The level model already exists (`lib/orgLevels.ts`): `owner > executives >
officers > members > advisors`. Generic role *tiers* map onto it:

| Generic tier | Level | Meaning |
|---|---|---|
| Owner / Admin | owner | top authority; manage anything |
| Executive / Manager | executives | broad cross-domain leadership |
| Officer / Lead | officers | owns a domain; assigned + assigns down |
| Member / Contributor | members | base participant (the floor role) |
| Advisor / Observer | advisors | view-only (reserved; no logic yet) |

## 4. Example role-pack mappings

Each org type supplies role keys + labels + a level per role. Same engine, same
levels — only the pack data changes.

| Org type | owner | executives | officers | members | advisors |
|---|---|---|---|---|---|
| **Fraternity (alpha)** | Consul | Pro Consul | Annotator + chairs | Brother | (faculty advisor) |
| **Club / student org** | President | Vice President | Secretary, Treasurer, chairs | Member | Faculty advisor |
| **Sports team** | Coach | Assistant Coach | Captain, Manager | Player | — |
| **Business team** | Admin / Owner | Manager | Team Lead | Contributor | Stakeholder |
| **Class / project** | Instructor | TA | Team Lead | Student | Observer |
| **Nonprofit / volunteer** | Director | Coordinator | Team Lead | Volunteer | Board observer |

The point: every column maps to the **same** five generic levels, so all
permission/assignment logic (`canAssign`, exceptions, `getAssignableRoles`) works
unchanged — only labels + the role→level map differ per pack.

## 5. What a future role pack contains

A pack is plain data selected by `organizations.template`. Shape sketch in
`lib/rolePack.ts` (inert type-only foundation). It bundles:

- **role labels** — `Record<roleKey, displayLabel>`
- **role levels** — `Record<roleKey, OrgLevel>` (reuses the existing `OrgLevel`)
- **officer / leadership / floor sets** — the pack's `officerRoles`,
  `leadershipRoles`, `floorRole`
- **assignment exceptions** — same-level/upward grants (the pack's
  `AssignmentException[]`, today `SIGMA_CHI_ASSIGNMENT_EXCEPTIONS`)
- **default event kinds** — which kinds this org type uses
- **default event task templates** — the pack's `EVENT_TEMPLATES`
- **default questionnaire templates** — e.g. Weekly Officer Report vs Weekly Team Check-In
- **default agenda sections** — the section set `buildAgenda` should emit
- **future goal types** — recruitment / fundraising / attendance / KPI / milestones

Everything above **already exists as Sigma Chi data**; a pack just names the
bundle and lets `organizations.template` choose it.

## 6. Implementation sequence

> **Progress:** steps 1–3 now have real, tested code (no behavior change).
> - `lib/starterPacks.ts` — the pack **registry + loader** (`activeStarterPack`),
>   with `sigma_chi` derived from the live constants.
> - **Second pack `club` added as pure data** (`CLUB_STARTER_PACK`) — a generic
>   student org with **real custom role keys** (`vice_president`, `event_chair`, …),
>   proving the pack DATA layer is genuinely non-fraternity. It is NOT the default,
>   NOT surfaced in onboarding, and only active if an org's `template` is literally
>   `'club'` (org creation still hardcodes `sigma_chi`, so never in alpha).
> - First read site wired behavior-identically (`lib/questionnaireGenerationPlan.ts`).
>
> **Known limitation (the gate, confirmed by the club pack):** the runtime engines
> (`ROLE_LEVEL`, task assignment, `generateQuestionnaireTasks`'s `Role[]`) are keyed
> by the **closed `Role` union**, so club's custom role keys are expressible as DATA
> but not yet FUNCTIONAL through those engines — the resolver filters unknown keys
> and falls back to the alpha officer set. Opening the union to org-defined keys is
> the Supabase-gated step 4 / §8.

1. **Keep the alpha role catalog as-is.** No rename, no behavior change. (now)
2. **Introduce a type/adapter layer:** a `RolePack` interface (sketch added) and an
   `activeRolePack()` accessor that, for alpha, returns the Sigma Chi pack built
   from today's constants. Screens/helpers read `pack.leadershipRoles` etc. instead
   of importing the constants directly. Behavior-identical. (later, behind a seam)
3. **Move default content into packs:** role labels/levels, event kinds, templates,
   questionnaire templates, agenda sections become per-pack registries keyed by
   `organizations.template`. (later)
4. **Add org-specific role config** (custom roles, owner-editable labels/levels)
   **only after a Supabase design is approved** — that's where the closed `Role`
   union opens up to org-defined role keys. (gated on Supabase)

## 7. What NOT to build yet

- ❌ No role-pack **loader** / `activeRolePack()` wiring (step 2 is later).
- ❌ No onboarding / role-customization **UI**.
- ❌ No **Supabase** schema for roles/packs.
- ❌ No **permissions grid** — keep the levels-based rule (it already avoids a grid).
- ❌ **No renaming** the current Sigma Chi role catalog or widening the `Role` union.
- ❌ No new runtime behavior — alpha keeps importing today's constants.

## 8. Gated / decisions needed before building

- Opening the `Role` union to org-defined keys → **Supabase design** (where custom
  roles persist) + a typing decision (`Role` stays a union vs becomes `string`
  validated against the active pack).
- Advisor view-only data-visibility rules (noted already in `ORG_LEVELS_PLAN.md`).
- Whether reviewer eligibility should consider levels (open question, unchanged).

---

*Planning/record only. No app behavior, role rename, permission, schema, RLS, RPC,
flag, push, or EAS change is implied. The `RolePack` sketch in `lib/rolePack.ts`
is inert type-only foundation — nothing imports it.*
