# Starter-Pack Migration Map

Where the "read app behavior through the active starter pack" migration stands, so
we wire deliberately (not blindly). Practical status map — not a re-statement of the
doctrine (see `PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md` /
`ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md` for the why).

**Legend:** A = safe to wire now (behavior-identical, read-only) · B = stays direct
for now (mutation / low-level / no behavior win) · C = gated on Role-union /
Supabase / product decision.

---

## Wired read sites (behavior-identical, done)

| Site | Reads | Helper | Commit |
|---|---|---|---|
| Create-org template label + value | default pack | `DEFAULT_STARTER_PACK_ID`, `activeStarterPack().label` | `f06e530` |
| Me-tab questionnaire generation | pack questionnaire id + officer roles | `planQuestionnaireGeneration` | `15190b8` |
| Event Create template picker | pack built-in templates | `getTemplateOptionsForOrgTemplate` | `1eaf3df` |
| Templates screen BUILT-IN list | pack built-in templates | `getBuiltInEventTemplatesForOrgTemplate` | `fd79a5a` |

Supporting pure layers: `lib/starterPacks.ts` (registry + `activeStarterPack`),
`lib/rolePackRuntime.ts` (pack-key → runtime `Role` guard),
`lib/templatePackView.ts` (pack built-in templates),
`lib/starterPackValidation.ts` (integrity).

## Remaining direct sites (by category)

| Site | Constant | Cat | Why it stays direct |
|---|---|---|---|
| `event/[id].tsx:608` apply-template picker | `mergedTemplateOptions` | **B** | Event Detail (excluded by the one-site discipline); it APPLIES/REPLACES templates on an existing event — resolution/mutation risk, not a read-only list. Wire only with a proven behavior-identical path + no event/task resolution change. |
| `event/[id].tsx:860` push recipients | `OFFICER_ROLES` / `FLOOR_ROLE` | **B** | Low-level event-audience → push-recipient composition. Routing through a pack changes nothing for alpha and touches push delivery — no behavior win, real risk. |
| `event/create.tsx:113` event audience | `OFFICER_ROLES` / `FLOOR_ROLE` | **B** | Same: builds the event's `visibleTo` audience. Pack-routing is a no-op for alpha; not worth the churn until packs change audiences. |
| `templates/edit.tsx:229` role dropdown | `OFFICER_ROLES` | **B** | The template EDITOR (mutation surface). Authoring, not display. |
| `task/create.tsx:394` reviewer picker | `LEADERSHIP_ROLES` | **C** | Assignment/permission surface. Changing the reviewer/assignee source could alter who can review — needs the Role-union + product decision, not a quiet refactor. |
| `ROLE_LABELS` (8 screens) | label lookup | **C-adjacent** | Already the correct indirection (no screen hardcodes "Brother"/"Consul"). A pack would supply labels only once custom roles are FUNCTIONAL (Role-union open). Until then, the global map is correct and pack-routing it buys nothing. |
| template RESOLUTION (`getTemplateById` / `buildTasksForTemplateId`) | merged templates | **B (keep forever-direct)** | Must resolve ANY built-in or custom id regardless of pack, or existing events/tasks break. This is intentionally pack-agnostic. |

## Next safe implementation step

**None right now.** Every remaining direct site is B or C — there is no read-only,
behavior-identical Category-A site left to wire. The display surfaces that *could*
be wired safely (Event Create picker, Templates built-in list) already are. Forcing
the next wire would mean touching a mutation surface (B) or a permission surface (C)
— both out of scope for behavior-identical work.

So: **stop wiring for now.** The migration's read side is as far as it can safely go
without the gated work below.

## Gated (Role-union / Supabase / product decision)

- **Reviewer/assignee picker** (`task/create.tsx`) and any assignment surface →
  needs the Role-union decision + product sign-off (permission behavior).
- **`ROLE_LABELS` / custom role labels** → functional only once the closed `Role`
  union opens to org-defined keys (**Supabase**-gated persistence; see
  `ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md` §8).
- **Org-type picker / second active pack in setup** → product decision; only real
  after custom roles are functional.
- **Event audience → pack-defined audiences** → only meaningful once a non-`sigma_chi`
  pack is actually active.

## Do not touch before Build 17 device testing

- The wired read sites are behavior-identical but **unverified on device** (no build
  cut since). Do not add MORE pack wiring on top of unverified wiring — it compounds
  what a device test must untangle if something is off.
- Do not wire any **B/C** site as if it were behavior-identical.
- Priority is still **#1 in `NEXT_BUILDABLE_WORK.md`**: cut a build (when approved)
  and verify the questionnaire submission round-trip + that the pack-read surfaces
  render identically. Further pack wiring waits behind that.

---

*Record/status only. No app behavior, role, permission, schema, RLS, RPC, flag,
push, or EAS change is implied.*
