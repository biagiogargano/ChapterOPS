# Product Spec — Permissions & Customization ("built for each org")

> **DECISION (2026-05): DEFERRED — keep permissions IMPLICIT for now.** The full
> matrix model below felt overly complicated, and the role×resource×level grid
> prototype was removed. Today's sensible hardcoded role behavior stays as-is.
> When we revisit this, **favor a much simpler model** — e.g. **3 tiers**
> (Member / Officer / Admin-owner) with good defaults, or a short list of
> **plain-English toggles** — NOT a full permission grid. This doc is kept only
> as long-term reference for the eventual (auth/RLS-backed) version.

**PLANNING ONLY.** No schema/RLS/RPC/auth/flags/data-model changes here. This is
the design + phasing for the system that lets each organization shape the app to
itself. Lives on `feature/questionnaire-reports-planning`; does **not** touch
`phase-2`.

> ⚠️ The *enforced* version of this is the **deepest server feature in the app**.
> "Who can edit/view what" is only real when backed by **auth identity + RLS** —
> a client-only toggle is cosmetic and bypassable. So enforcement is gated behind
> the auth/RLS schema phase (explicit approval required). A UI-only prototype can
> precede it to validate the model, but must be clearly labeled non-enforcing.

---

## 1. Vision
The product's differentiator: it must **feel built for each individual
organization** — not a rigid template. Two pillars:

1. **Access control (Google-Docs-style sharing).** The org **owner** (President /
   Consul / founder) decides who can **view** vs **edit** vs **manage** each part
   of the app, per role (and later per member). Nothing feels locked or exposed by
   accident; the owner grants rights like sharing a Doc.
2. **Structural customization.** The structures themselves are editable by the org:
   the **leadership tree**, **report questions**, **event kinds/types**, **task
   templates**, **roles/positions**, etc. An org turns off what it doesn't use and
   shapes what it does — no irrelevant features cluttering the experience.

Goal restated: anyone can adopt it, it never feels limiting, and there are no
features present-but-inapplicable for a given org.

## 2. Access-control model
Mirrors document sharing:

- **Owner** — one role/member with full control, including granting rights. Can
  delegate "manager" rights to others (e.g. Pro Consul).
- **Access levels** per resource: **None → View → Edit → Manage** (Manage = edit +
  grant rights to others on that resource).
- **Subjects:** start at the **role** level (Consul, Pro Consul, chairs, Brother);
  extend to **individual members** once member-level assignment exists.
- **Resources (grantable surfaces):** Events, Tasks, Reports (fill vs review),
  Officer Overview, Leadership tree, Report-question authoring, Meeting agenda,
  Templates, Notices/notifications, RSVP, Members/roster, Permissions itself.
- **Defaults:** ship sensible role defaults (officers edit their domain, Brothers
  view, owner manages all) so a new org works immediately, then the owner tunes.

This naturally subsumes today's hardcoded checks (e.g. `canManageEvent`,
officer-only surfaces) — they become *default rows* in the permission matrix
instead of code constants.

## 3. Structural customization (per org)
- **Leadership tree:** owner edits reporting lines + levels (drives delegation —
  see the leadership prototype). Org-specific titles (Consul vs President).
- **Report questions:** per officer/committee question sets, Annotator-editable
  (already in the questionnaire spec).
- **Roles/positions:** org-defined roles, labels, and which are "officers."
- **Event kinds, task templates, RSVP rules:** org-tunable.
- Principle: every list the app currently hardcodes becomes **org-configurable
  data** with a built-in default.

## 4. Why this is a big, gated phase
- **Enforcement REQUIRES auth + RLS.** Edit/view rights must be checked
  server-side per org per identity, or they're meaningless. This is schema + RLS +
  policy work — the exact category deferred until the post-alpha auth phase.
- **Data model:** a permissions store (subject × resource × level, scoped per org)
  + the customizable-structure tables (tree, roles, question sets, kinds…). Large.
- **Migration of hardcoded checks:** today's role gates move into the permission
  layer carefully, without regressing the alpha.
- **Owner bootstrapping:** who is "owner," how ownership transfers, recovery.

## 5. Phasing (each its own approved checkpoint)
1. **Spec + UI-only prototype** (this doc + a non-enforcing permission-matrix
   screen) — validate the model and UX. *(Safe now.)*
2. **Permission data model + RLS enforcement** (schema phase — approval required;
   the first place auth/RLS changes). Start read-only (resolve effective access),
   then writes.
3. **Migrate existing hardcoded gates** (canManageEvent, officer-only surfaces)
   onto the permission layer behind a flag, verified against the alpha.
4. **Structural customization** surfaces (editable tree, roles, question sets,
   event kinds) — each backed by org-scoped tables + RLS.
5. **Member-level subjects** (per-person grants) once member-level assignment ships.

## 6. Risks / NOT now
- **Do NOT** implement enforcement client-only — it would imply security that
  isn't there. The prototype must be labeled "preview, not enforced."
- **Do NOT** change schema/RLS/RPC/auth/flags or the task state machine in the
  planning/prototype phase.
- **Do NOT** rip out today's role gates until the permission layer is enforced and
  verified — the alpha depends on them.
- Beware **owner lockout** (owner accidentally removes their own Manage rights) —
  the model needs an un-removable owner safeguard.

## 6a. Questions for Biagio (answer before we build the simple version)
1. **Owner identity:** always the top role (President/Consul), a specific person,
   or a transferable "org owner" flag independent of role?
2. **Which simple model:** 3 tiers (Member/Officer/Admin), plain-English toggles
   ("Officers can create events"), or something else?
3. **Granularity:** per-feature enough, or ever per-item ("this one event") sharing?
4. **Access levels:** View/Edit enough, or also a Manage (edit + grant) level?
5. **Defaults out of the box** for a brand-new org (so it's usable pre-tuning)?
6. **Who can change permissions:** owner only, or delegable to top execs?
7. **Committee scoping:** lead auto-edits their committee's items; members view
   their committee only?
8. **Officer baseline:** "officer" = baseline powers, or strictly per-role?
9. **View-but-not-edit / hidden:** what should members see-not-edit (agenda?) and
   what's hidden entirely (other committees' internal tasks?)?
10. **Owner-only surfaces:** which are locked to owner (permissions, roster,
    ownership transfer)?
11. **Role-level first, person-level later** — confirm order?
12. **One-off exceptions** ("this brother can edit events") needed, or
    role/committee-based enough?

## 7. Open questions (model-level)
1. **Owner identity:** is "owner" always the Consul/President position, a specific
   member, or a transferable "org owner" flag independent of role?
2. **Granularity:** is per-**resource** view/edit enough for v1, or do we need
   per-**record** sharing (this one event) like Docs? (Likely resource-level first.)
3. **Levels:** is None/View/Edit/Manage the right ladder, or simpler (View/Edit)?
4. **Defaults:** what's the out-of-the-box matrix so a brand-new org is usable
   before any tuning?
5. **Customization surface:** in-app editor for the tree/roles/questions, or a
   guided setup wizard at org creation?
