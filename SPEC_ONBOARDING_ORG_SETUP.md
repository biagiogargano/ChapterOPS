# Product Spec — Onboarding & Org Setup ("built for them, guided")

**PLANNING ONLY.** No schema/RLS/RPC/auth/flags/data-model changes here. Design +
phasing for first-run setup, the invite system, and ownership. Lives on
`feature/questionnaire-reports-planning`; does **not** touch `phase-2`.

Guiding principle (from Biagio): the first person in has an **empty** app and must
be **guided** through setup with **suggested defaults** — it should feel *built for
them*, not "build it yourself from a blank grid." Simple > configurable.

---

## 1. The first-run problem
- Someone **starts** the org with nothing in the app.
- They **might not be the real owner/leader** — they may be setting it up on behalf
  of the CEO/President → must be able to **transfer ownership**.
- They need to **build out the org**: add people, assign roles, form committees —
  but **intuitively**, in plain steps, not via a permissions matrix.

## 2. Suggested structure (defaults, editable)
Offer a ready-made tier structure the org can rename/trim — never force it:
1. **Owner / Main leader** (CEO · President · Consul) — exactly one; full control;
   transferable.
2. **Top executives** (e.g. VP · Pro Consul) — small group.
3. **Officers** (committee chairs).
4. **General members.**

Labels are org-customizable (CEO vs President vs Consul). An org can start minimal
(just owner + members) and grow.

### 2a. Build the tree by ASKING, not a grid (preferred)
Rather than drop a big org-chart grid in the owner's face, **build the hierarchy
through questions**, top-down:
1. "What's **your** role called?" → the root (owner).
2. "**Who reports to** [role]? What are they called?" → add one or more child roles.
3. Repeat the same question for each child, walking **down the chain** until a role
   has no reports or is marked **General members** (a leaf bucket).
4. Options along the way: add **General members** as a catch-all, mark "no one
   reports to them," and (full version) "this role **also reports to** X" so a role
   can have a second manager / roles can cross-link — without ever showing a graph
   editor.
This produces the same tree the Leadership prototype renders, but assembled by
answering simple questions. The grid/graph is only a *result*, never the input.

## 3. Invite system (the core mechanic)
- **Owner invites** people into top roles (e.g. "be our VP").
- **Anyone with a role/committee can invite** people **to their own committee**.
- Invitee **accepts** → joins that committee/role.
- Once they've joined, the inviter can **delegate** to them, and the member **sees
  the relevant info** for that group (their committee's events/tasks/reports).
- Invites are lightweight: by name/email or a shareable join code/link (the app
  already has a join-code path for orgs — extend the same idea to roles/committees).
- States: invited → accepted (or declined/expired). An invite implies the target
  role/committee so acceptance wires up membership + visibility in one step.

This makes the org **self-assembling**: the owner doesn't have to enter everyone;
leaders staff their own committees, bottom-up, after the top is seeded.

## 4. Ownership
- Whoever creates the org is **owner by default**, with a clear **"I'm setting this
  up for someone else → transfer ownership"** option during setup.
- Ownership is transferable later (Settings), with a confirmation + a safeguard so
  an org is never left without an owner.

## 5. First-run flow (guided wizard — keep it short)
1. **Create org** — name (+ optional type/template).
2. **Who's in charge?** — "You're the owner" by default, or **transfer to someone
   you invite** as owner.
3. **Pick a structure** — accept the suggested tiers (editable labels) or start
   minimal. Sensible defaults pre-filled.
4. **Invite your top people** — add a few names/emails to top roles, or skip and do
   it later. Generates invites.
5. **Done** → land in the app already shaped, not empty.

Everything after step 1 is **skippable** with good defaults — the owner is never
blocked from getting in.

## 6. Tutorial / first-use walkthrough
- After setup (and on first login for invited members), a **short coach-mark
  walkthrough** highlights the key surfaces (Today, Calendar, Tasks, create event,
  reports). Skippable, re-openable from Me/Help.
- Goal: most users understand the app without reading anything.

## 7. Dependencies / what's gated (NOT now)
- **Real invites/acceptance, membership writes, ownership transfer, committee
  visibility** all need **auth + identity + schema + RLS** — deferred to the
  post-alpha auth phase (approval required). The app already has org create/join +
  claim-by-email RPCs to build on.
- **Permissions** stay **implicit** for now (see SPEC_PERMISSIONS_CUSTOMIZATION —
  deferred); committee visibility can ride on simple role/committee membership, not
  a permission grid.
- The **prototype** built alongside this spec is **UI-only, mock, non-functional**
  (no real invites sent, nothing persisted) — just to validate the flow/feel.

## 8. Phasing (each its own approved checkpoint)
1. **Spec + UI-only setup-wizard prototype** (this doc + a mock wizard). *(Safe now.)*
2. **Invite + accept data model** (schema/RLS — approval; reuse org join-code path).
3. **Committee membership + relevant-info visibility** (org/committee-scoped reads).
4. **Ownership transfer** (with safeguards).
5. **First-use tutorial** (UI; can be built fairly independently/late).

## 9. Open questions
1. **Committee model:** is a "committee" just everyone reporting to a given officer
   role, or an explicit named group the officer creates and names?
2. **Invite channel:** name/email entry, shareable link/code, or both?
3. **How minimal can step-1 be** — can the owner skip straight into an empty-but-
   usable app and add people entirely later?
4. **Member self-join:** can a member request to join a committee (and the leader
   approves), or invite-only?
5. **Tutorial depth:** one-time coach marks vs an interactive sample task.
