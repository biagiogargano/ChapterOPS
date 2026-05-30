# Org Onboarding & Setup — Plan

How ChapterOPS goes from "Sigma Chi, manually configured" to onboarding many org
types, without building fake setup UI now. Grounded in the **existing** auth/org
code — this is the missing org-type-selection layer, not a from-scratch design.

**Companions (do not duplicate):**
- `docs/ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md` — the role-pack shape (`lib/rolePack.ts`).
- `docs/EVENT_TEMPLATES_FOUNDATION.md` — the template pack boundary.
- `docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md` — primitives + the `organizations.template` seam.

---

## 1. Current alpha reality (what already exists)

The setup path is **already built** and uses real RPCs — it is not greenfield:

| Piece | Where | State |
|---|---|---|
| Onboarding hub (Join / Create / Sign Out) | `app/(auth)/onboarding.tsx` | live |
| Create organization | `app/(auth)/create.tsx` → `createOrganization()` → `create_organization` RPC | live |
| Join by code | `app/(auth)/join.tsx` | live (de-emphasized in alpha; admin-seeded) |
| Sign up / log in | `app/(auth)/signup.tsx`, `login.tsx` | live |
| Org model carries a template | `memberService` `Organization.template: OrgType` | live |
| **The `organizations.template` seam** | `createOrganization(name, template, …)` → `p_template` | **live but always `'sigma_chi'`** |

**What is manually configured / alpha-pack content today:**
- **`create.tsx` hardcodes `'sigma_chi'`** as the template and shows
  "Template: Sigma Chi (default)". The seam accepts any template; the UI never
  offers a choice.
- The new org's **roles, levels, event kinds, and templates** come from the
  always-on Sigma Chi catalog (`lib/roles`, `lib/orgLevels`, `lib/eventTemplates`),
  not from a pack chosen by `template`.
- Alpha orgs are effectively **admin-seeded**; join-by-code exists but is
  de-emphasized.

**What is generic core (already correct):**
- The org/membership/identity model is org-agnostic (`identityStore`,
  `memberService`, `positions`, `orgScope`).
- `organizations.template` is a real column threaded through creation — the
  selection seam exists; only the *value* is fixed.
- Role labels, levels, templates already live in registries (pack-shaped data).

**What blocks onboarding a club/team/business/class/nonprofit later:**
1. **No org-type selection** at create time (always `sigma_chi`).
2. **No pack loader** — nothing reads `organizations.template` to choose which
   role/kind/template pack is active; the app always uses the Sigma Chi catalog
   (the closed `Role` union, direct `OFFICER_ROLES`/`EVENT_TEMPLATES` imports).
3. **Custom roles/labels** need persistence → a Supabase design (gated).

These are the same two seams named in the role-pack plan (§1) — onboarding is
where org-type **selection** plugs into the pack **loader**.

## 2. Future setup flow

A practical sequence built on the existing screens — each step maps to something
that already half-exists:

1. **Create organization** — *(exists)* name + first-officer. Add: **choose org
   type** (the one new field; writes `template` instead of hardcoding `sigma_chi`).
2. **Org-type → pack** — the chosen type selects a pack (roles, kinds, templates,
   questionnaires, agenda sections). *(needs the pack loader)*
3. **Invite members** — *(join-by-code exists)*; promote to real invites later.
4. **Assign roles** — from the pack's role set; the assignment engine
   (`lib/orgLevels`) already works per-pack.
5. **Choose default templates** — pre-checked from the pack; officer can trim.
6. **Optionally customize later** — labels/roles/templates (gated on Supabase).

Steps 1, 3, 4 already have working code; steps 2, 5, 6 are the new pack-driven
parts.

## 3. Org type examples

| Org type (`template`) | First officer | Member word | Example default templates |
|---|---|---|---|
| `sigma_chi` / `generic_fraternity` | Consul / President | Brother / Member | Date Party, Recruitment, Chapter Meeting |
| `club` (student org) | President | Member | Club Fundraiser, Club Meeting |
| `sports_team` | Coach | Player | Team Practice, Game Day |
| `class_project` | Instructor | Student | Project Milestone, Class Session |
| `business_team` | Admin | Contributor | Business Meeting, Sprint Review |
| `nonprofit` | Director | Volunteer | Volunteer Event, Board Meeting |

All map onto the **same** generic levels + the **same** template/questionnaire
engines — only pack data differs.

## 4. What an org-type pack should create

When an org is created with a `template`, its pack supplies (all already exist as
Sigma Chi data — see the role-pack + template-foundation docs):
- **role labels** + **role levels** (`RolePack.roles` / `level`)
- **assignment permissions + exceptions** (`RolePack.assignmentExceptions`)
- **event kinds** (which kinds this org type uses)
- **event task templates** (the pack's `EVENT_TEMPLATES` subset)
- **questionnaire templates** (e.g. Weekly Officer Report vs Weekly Team Check-In)
- **agenda defaults** (the section set `buildAgenda` emits)
- **future goal types** (recruitment / fundraising / attendance / KPI / milestones)

This is exactly the `RolePack` sketch (`lib/rolePack.ts`) plus the template/
questionnaire/agenda registries — a setup pack is the **superset** that bundles
them per org type. See §3 of the type sketch note below.

## 5. What NOT to build yet

- ❌ No **public onboarding UI** / self-serve signup funnel.
- ❌ No **payment / customer onboarding** / billing.
- ❌ No **customization dashboard** (edit roles/labels/templates in-app).
- ❌ No **Supabase schema** changes (custom roles/packs persistence is gated).
- ❌ No **AI setup wizard**.
- ❌ No **role-pack loader** yet (org-type → active pack wiring).
- ❌ Do **not** change `create.tsx` to offer org types yet — that needs the loader
  + packs behind it, or it becomes fake UI (a picker that changes nothing).

## 6. Future implementation sequence

1. **Keep manual alpha setup** — `create.tsx` stays `sigma_chi`; admin-seeded orgs. (now)
2. **Define pack types** — extend the inert `RolePack` into a `SetupPack`
   type-only shape (roles + kinds + templates + questionnaires + agenda). No
   runtime. (small, safe — see §3)
3. **Build the pack registry + loader** — `activePack(organizations.template)`
   returning the Sigma Chi pack for alpha; screens/helpers read the active pack
   instead of importing catalogs directly. Behavior-identical for alpha. (later)
4. **Add org-type selection** to `create.tsx` — write the chosen `template`; the
   loader does the rest. Only after packs exist (else it's fake UI). (later)
5. **Add customization** (labels/roles/templates) — **gated on a Supabase design**
   (where custom packs persist). (later, Supabase)
6. **AI-assisted setup** — suggest a pack/templates from a description; only after
   deterministic setup works. (last)

## 7. Gated / decisions needed

- **Org-type selection UI** is gated on the **pack loader** existing first (no fake
  picker).
- **Custom roles/labels/templates** → **Supabase schema** (persistence) + the
  `Role`-union typing decision (from the role-pack plan §8).
- **Public/self-serve onboarding + billing** → a product/business decision (see the
  packaging plan if/when written), not an alpha concern.

---

*Planning/record only. No app behavior, screen, role, permission, schema, RLS, RPC,
flag, push, or EAS change is implied. The existing onboarding screens and the
`organizations.template` seam are unchanged; this documents how org-type selection
plugs into a future pack loader.*
