# ChapterOPS — Product Building Principles

How ChapterOPS should be built going forward.

**Core idea.** For alpha, ChapterOPS must be *immediately useful* for Sigma Chi /
fraternity operations. But the architecture must support many kinds of
organizations long-term — clubs, student orgs, sports teams, businesses,
nonprofits, classes, committees. **Sigma Chi / fraternity is the first (default)
template pack, not the permanent hardcoded core.**

This is not a call to build generic customization UI now. It is a call to keep
the *core primitives* generic while shipping fraternity-flavored *defaults* on
top of them.

---

## 1. Core build principle

- Build alpha features around **real Sigma Chi needs** — solve the actual
  operational problem in front of us, concretely.
- For every Sigma-Chi-specific idea, identify and build the **generic
  org-agnostic primitive underneath it**. Ship the fraternity flavor as default
  *content/config* on that primitive.
- Keep the app usable immediately, but **avoid architecture that only works for
  Sigma Chi**. A feature is acceptable if a club/business/team could use the same
  primitive with different defaults.

If a feature can only be expressed in fraternity terms, it isn't done — find the
primitive.

---

## 2. Core primitives

The app is built around these generic primitives. Everything else should reduce
to a combination of them:

- **organizations** — the tenant boundary (carries a `template`/org-type).
- **roles** — free-text role keys interpreted by the active org pack.
- **members** — a person's membership in one organization.
- **event kinds** — categorize events; per-org-type defaults.
- **events** — operational hubs (what's happening, when, who).
- **tasks** — the accountability layer (assigned, due, tracked).
- **templates** — declarative task sets generated for an event.
- **submissions / proof** — structured/text/link evidence attached to a task.
- **reviews** — a reviewer role approves/rejects a submission.
- **reports / structured responses** — recurring structured-response tasks.
- **agendas** — meeting prep *derived* from events/tasks/reports.
- **notices / notifications** — action-linked updates, not a social feed.

New work should extend or compose these — not introduce a parallel system.

---

## 3. Sigma Chi / fraternity as a default pack

Sigma Chi specifics are **defaults that belong in an org-type "pack"**, selected
by `organizations.template`. They are correct for the alpha org and should stay
shippable — but they are *defaults to abstract later*, not the core.

- **Roles:** Consul / Pro Consul / Quaestor / Magister / Kustos / Tribune /
  chairs → eventually **role defaults** in the fraternity pack, not a permanently
  hardcoded catalog.
- **Event kinds:** chapter meeting / e-board / recruitment / ritual /
  philanthropy → **event-kind defaults** in the pack, not universal assumptions.
- **Templates:** Date Party / Rush / Chapter Meeting / Formal task sets →
  **event-template defaults** in the pack, not one-off hardcoded workflows.
- **Leadership & floor:** "president/pro_consul can manage/approve anything" and
  the "brother" floor role are **concepts** (leadership roles, floor role) that
  should come from the pack (`pack.leadershipRoles`, `pack.floorRole`), not from
  role-key string checks scattered through the code.

The seam already exists: `organizations.template` (`sigma_chi` |
`generic_fraternity` | `club` | `custom`). The long-term step (when multi-org is
actually on the roadmap) is to **load the role/kind/template pack from
`organizations.template`** instead of always using the Sigma Chi catalog.

---

## 4. Translation examples

Every fraternity idea has a generic primitive underneath. Build the primitive;
ship the fraternity word as a default label.

| Sigma Chi idea | Generic primitive |
|---|---|
| "Brother" | member / user / participant (org-type label) |
| "Chapter-wide" | org-wide / member-wide |
| "Rush event" | recruitment event (event kind) |
| "Derby Days" | a philanthropy campaign / event-series **template** |
| "Officer report" | recurring **structured-response task** |
| "Meeting agenda" | agenda **generated** from real events/tasks/reports |
| "Pro Consul approval" | **reviewer-role** approval |
| "Chapter meeting" | a meeting **event** of an org-defined kind |
| "Sober monitors / risk plan" | template-generated tasks owned by a role |

Rule of thumb: if you're typing a fraternity noun into core logic, stop and name
the primitive + the default label instead.

---

## 5. Agenda generation example (the model to follow)

The meeting agenda is the reference example of doing this right:

- Sigma Chi may want sections like **old business, new business, brother-wide
  tasks, officer reports, announcements, and help-needed items**.
- A club, class, sports team, or nonprofit may want **different sections**.
- Therefore the core is an **agenda generator with configurable section rules**,
  fed by generic primitives (events + tasks + later reports) — **not** a
  hardcoded Sigma Chi agenda forever.
- **For alpha, a basic fraternity-flavored agenda is acceptable** *because it is
  built from generic primitives* (`buildAgenda` is a pure function over real
  events/tasks; only a label like "Chapter-wide" is flavored) and can be
  abstracted later by making the section set configurable per org type.

That is the bar: fraternity-flavored output, generic engine underneath.

---

## 6. What to avoid

- **Hardcoding fraternity-only language deep in core logic** (role-key string
  checks, fraternity nouns in shared helpers). Keep flavor at the edges
  (labels/defaults), not the core.
- **Fake customization screens** — UI that looks configurable but is mock-backed.
- **A full permissions grid too early.** Roles-first; capability checks stay
  simple.
- **A full org-tree builder too early.** Tiers/structure stay minimal.
- **Social feed / chat / points / leaderboard.** Communication is action-linked
  notices only; no gamification.
- **Turning every idea into a standalone system.** Reduce it to
  events/tasks/templates/reports/submissions/notices instead of inventing a new
  entity and a new set of screens.

---

## 7. Build rule for Claude / dev work

Before implementing any new feature, answer these — out loud, in the plan:

1. **What is the Sigma Chi alpha use case?** (the concrete problem)
2. **What is the generic primitive underneath it?** (org / role / event / task /
   template / submission / review / report / agenda / notice)
3. **Is this core logic, or a default template/config?** (core stays generic;
   fraternity specifics go in the pack)
4. **Would this still work for a club, class, business team, nonprofit, or sports
   team** with different roles/kinds/labels?
5. **Are we exposing a fake feature, or is it real?** (no mock-backed surfaces in
   alpha; hide unfinished systems)
6. **Can this be built simply now and abstracted later** without a rewrite? (keep
   the abstraction seam clean — e.g. data in registries keyed by org template)

If a feature fails #4 or #6, reshape it before building.

---

## 8. Current acceptable alpha tradeoff

- It is **okay** for build 7/8 to *feel* fraternity-specific. The alpha org is
  Sigma Chi; fraternity labels, kinds, templates, and the role catalog are
  correct content for it.
- It is **not okay** for the core architecture to become impossible to
  generalize — i.e. fraternity concepts welded into shared logic such that a
  Manager/Employee org could never work without a rewrite.
- **Hardcoded Sigma Chi defaults are acceptable only when documented as defaults
  to abstract later** — living in the role/event-kind/template registries (the
  future pack), with the `organizations.template` seam intact.

The current state meets this bar: the data model is org-agnostic, the Sigma Chi
specifics are pack-shaped content, and `organizations.template` is the documented
seam for the eventual multi-org packs. Keep it that way.
