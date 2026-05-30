/**
 * rolePack.ts — TYPE-ONLY sketch of the future "role pack" shape.
 *
 * ⚠️ INERT FOUNDATION. Nothing imports this; it adds NO runtime code and changes
 *    NO behavior (types are erased at compile time). It exists to pin down the
 *    shape a future org-type pack will take, so the eventual adapter layer (an
 *    `activeRolePack()` keyed by `organizations.template`) has a target. See
 *    docs/ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md.
 *
 * The model: ChapterOPS is generic org-operations software; Sigma Chi is the alpha
 * default pack. A RolePack bundles the per-org-type DATA that is fraternity-flavored
 * today (role labels, the role→level map, the officer/leadership/floor sets, and the
 * assignment exceptions) so it can be swapped per org type without touching the
 * generic engines (lib/orgLevels assignment logic, the template builder, etc.).
 *
 * IMPORTANT: this reuses the EXISTING generic types — `OrgLevel` and
 * `AssignmentException` from lib/orgLevels — rather than inventing parallel ones.
 * It does NOT widen or rename the current `Role` union; `RoleKey` is a string alias
 * documenting that a future pack's role keys are org-defined strings validated
 * against the active pack (the union opens up only when Supabase-backed custom roles
 * land — a gated decision).
 */

import type { OrgLevel, AssignmentException } from './orgLevels';

/**
 * A role key as a pack would express it: an org-defined string (e.g. 'president',
 * 'captain', 'team_lead'). Today the app uses the closed `Role` union from
 * lib/roles; a future pack generalizes to validated strings. Kept as a distinct
 * alias so call sites that are "pack-shaped" read clearly without changing `Role`.
 */
export type RoleKey = string;

/** One role's definition within a pack: how to show it + where it sits. */
export interface PackRole {
  /** Stable role key (org-defined). */
  key:   RoleKey;
  /** Human display label (e.g. 'Consul', 'President', 'Captain'). */
  label: string;
  /** Authority tier — reuses the generic level model (lib/orgLevels.OrgLevel). */
  level: OrgLevel;
}

/**
 * A complete org-type role pack: the data the generic engines need, parameterized
 * per org type and selected by `organizations.template`. Everything here already
 * exists as Sigma Chi constants in lib/roles + lib/orgLevels — a pack just names
 * the bundle so a club/team/business/class/nonprofit can supply its own.
 */
export interface RolePack {
  /** Pack id, aligned with `organizations.template` (e.g. 'sigma_chi', 'club'). */
  id:    string;
  /** Human pack name (e.g. 'Sigma Chi (fraternity)'). */
  label: string;

  /** Every role this pack defines, in display/precedence order. */
  roles: PackRole[];

  /** The base member role every member holds (least privilege). */
  floorRole: RoleKey;
  /** Roles with broad cross-domain authority (manage/approve anything). */
  leadershipRoles: RoleKey[];
  /** Roles considered "officers" (own a domain; can be assigned + assign down). */
  officerRoles: RoleKey[];

  /**
   * Same-level / upward assignment GRANTS that the default downward-only rule would
   * deny (reuses the generic exception type; today: SIGMA_CHI_ASSIGNMENT_EXCEPTIONS).
   * Exceptions only ever grant, never revoke.
   */
  assignmentExceptions: AssignmentException[];

  // Future pack fields (documented in the plan; intentionally optional + unused
  // now so adding them later is non-breaking):
  /** Default event-task template ids this pack ships (lib/eventTemplates). */
  defaultEventTemplateIds?: string[];
  /** Default questionnaire definition ids this pack ships (lib/reportDefinitions). */
  defaultQuestionnaireIds?: string[];
  /** Default agenda section keys this org type's meetings emit. */
  defaultAgendaSections?: string[];
}

/**
 * Convenience: derive a role→level lookup from a pack's roles (the pack analog of
 * lib/orgLevels.ROLE_LEVEL). Pure, type-driven; provided as the obvious shape the
 * adapter layer will want. Inert until something constructs a RolePack.
 */
export type RoleLevelMap = Record<RoleKey, OrgLevel>;

// ─── Setup pack (org-type → bundled defaults) ─────────────────────────────────
// A SetupPack is what `organizations.template` selects at org-creation time: the
// RolePack (roles/levels/exceptions — above) PLUS the small remainder a RolePack
// doesn't already carry, namely the org type's default EVENT KINDS. Template /
// questionnaire / agenda defaults already live on RolePack (its optional
// default*Ids fields), so this deliberately does NOT re-declare them — it composes
// the RolePack rather than duplicating it. See
// docs/ORG_ONBOARDING_AND_SETUP_PLAN.md.
//
// ⚠️ STILL INERT / TYPE-ONLY. Nothing imports this; no loader, no registry, no
//    runtime. It pins the shape `activePack(template)` will return later.

/** The org-type id, aligned with `organizations.template` (e.g. 'sigma_chi', 'club'). */
export type OrgType = string;

/**
 * Everything an org-type pack supplies at setup. The RolePack covers roles, levels,
 * assignment, and (via its optional default*Ids) templates/questionnaires/agenda;
 * SetupPack adds the org type's default event-kind keys and human metadata.
 */
export interface SetupPack {
  /** Org-type id this pack is selected by (`organizations.template`). */
  orgType: OrgType;
  /** Human name (e.g. 'Sigma Chi (fraternity)', 'Student Club'). */
  label:   string;
  /** The role pack: roles, levels, leadership/officer/floor sets, exceptions. */
  rolePack: RolePack;
  /** Default event-kind keys this org type uses (the one thing RolePack omits). */
  defaultEventKinds: string[];
}
