# ChapterOPS — Packaging & Go-to-Market Plan (early, concise)

How ChapterOPS gets from "live Sigma Chi alpha" to onboarding and eventually
charging other organizations. Deliberately short — this is direction, not a
business plan. Revisit when there's a second real org.

**Companions:** `docs/LIVE_ALPHA_OPERATING_PLAN.md` (how we run the current
alpha), `docs/ORG_ONBOARDING_AND_SETUP_PLAN.md` (the technical setup path),
`docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md` (why the core stays generic).

---

## 1. The maturity path

| Stage | Who | Goal | Gate to exit |
|---|---|---|---|
| **Alpha (now)** | Sigma Chi Alpha Lambda, admin-seeded | Use it for real chapter ops; surface real gaps | Core flows (events/tasks/RSVP/questionnaires) reliable on device |
| **Private beta** | A handful of hand-picked orgs (a club, a team, another chapter) | Prove the same engine works for ≥2 org types with different packs | Org-type packs + pack loader exist; setup is repeatable without code edits |
| **Paid pilot** | 1–3 orgs paying a small fee | Prove someone will pay; learn pricing + support load | Stable multi-org, basic self-serve setup, a support story |
| **Paid product** | Open onboarding | Sell broadly | Billing, self-serve onboarding, customization, reliability/SLA |

Do not skip stages. Each one's exit gate is a real capability, not a date.

## 2. What each stage needs from the product

- **Alpha → beta:** the **org-type pack** work (roles/kinds/templates per
  `organizations.template`) and a **pack loader**. Until a second org type can be
  set up without editing code, beta isn't real. *(planned — see onboarding/role-pack docs)*
- **Beta → paid pilot:** repeatable setup (org-type selection in `create.tsx`),
  light **member-invite** flow, and enough reliability that an outside org trusts
  it for real ops. No billing yet — pilots can be invoiced manually.
- **Paid pilot → product:** **billing/subscriptions**, **self-serve onboarding**,
  in-app **customization** (labels/roles/templates — needs Supabase), and a
  support/feedback channel.

## 3. Pricing posture (early hypotheses — not decisions)

- Likely **per-organization** (a chapter/club/team pays), not per-seat — these orgs
  are budget-sensitive and seat-counting creates friction.
- Possible **tiers** by org size or feature depth (e.g. free small/basic, paid for
  larger orgs or advanced features like goals/AI later).
- Student orgs are price-sensitive and seasonal (officer turnover each year) — keep
  onboarding cheap and **transitions painless** (the institutional-memory pitch).

These are hypotheses to test in the paid pilot, not commitments.

## 4. The wedge (why an org switches to ChapterOPS)

The doctrine's problem list is the pitch: scattered comms, unclear ownership,
missed tasks, weak follow-up, **lost institutional memory across leadership
transitions**. ChapterOPS's differentiator is the **operational loop** (events →
tasks → structured responses → agendas) plus clean **officer/leader transitions** —
not chat or a social feed (explicitly out of scope).

## 5. What NOT to build / decide yet

- ❌ No **billing / payments** integration.
- ❌ No **self-serve signup funnel** or marketing site work.
- ❌ No **pricing page** or committed pricing.
- ❌ No **sales/CRM** tooling.
- ❌ No **multi-org infrastructure** beyond the existing `organizations` model.
- ❌ Do not let GTM pull the product toward fraternity-only features — the
  cross-org packs are what make beta possible.

## 6. Immediate implication for current dev

Keep doing what the architecture lanes are doing: **keep the core generic, ship
Sigma Chi as a pack.** The single most valuable GTM-enabling engineering step is
the **org-type pack + loader** (it unlocks beta). Everything else here
(billing, self-serve, pricing) is later and gated on reaching the paid-pilot stage.

---

*Planning/record only. No code, schema, billing, RLS, RPC, flag, push, or EAS
change is implied. Pricing/stage details are early hypotheses to revisit when a
second real org exists.*
