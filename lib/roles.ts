export const ROLES = {
  PRESIDENT:          'president',
  PRO_CONSUL:         'pro_consul',
  ANNOTATOR:          'annotator',
  QUAESTOR:           'quaestor',            // Treasurer
  MAGISTER:           'magister',            // New-member educator
  KUSTOS:             'kustos',              // Sergeant-at-arms / property
  TRIBUNE:            'tribune',             // Member advocate
  RISK_MANAGER:       'risk_manager',
  SOCIAL_CHAIR:       'social_chair',
  RECRUITMENT_CHAIR:  'recruitment_chair',
  PHILANTHROPY_CHAIR: 'philanthropy_chair',
  SCHOLARSHIP_CHAIR:  'scholarship_chair',
  HOUSE_MANAGER:      'house_manager',
  BROTHER:            'brother',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  president:          'Consul',
  pro_consul:         'Pro Consul',
  annotator:          'Annotator',
  quaestor:           'Quaestor',
  magister:           'Magister',
  kustos:             'Kustos',
  tribune:            'Tribune',
  risk_manager:       'Risk Manager',
  social_chair:       'Social Chair',
  recruitment_chair:  'Recruitment Chair',
  philanthropy_chair: 'Philanthropy Chair',
  scholarship_chair:  'Scholarship Chair',
  house_manager:      'House Manager',
  brother:            'Brother',
};

export const OFFICER_ROLES: Role[] = [
  ROLES.PRESIDENT,
  ROLES.PRO_CONSUL,
  ROLES.ANNOTATOR,
  ROLES.QUAESTOR,
  ROLES.MAGISTER,
  ROLES.KUSTOS,
  ROLES.TRIBUNE,
  ROLES.RISK_MANAGER,
  ROLES.SOCIAL_CHAIR,
  ROLES.RECRUITMENT_CHAIR,
  ROLES.PHILANTHROPY_CHAIR,
  ROLES.SCHOLARSHIP_CHAIR,
  ROLES.HOUSE_MANAGER,
];

export function isOfficer(role: Role): boolean {
  return OFFICER_ROLES.includes(role);
}

// ─── Role capabilities (current Sigma Chi pack) ───────────────────────────────
// Centralizes the "broad leadership" and "floor (base member) role" concepts that
// were previously hardcoded as inline `president`/`pro_consul`/`brother` checks
// across screens and stores. Values are UNCHANGED — this is the current pack's
// content. Per docs/PRODUCT_BUILDING_PRINCIPLES.md these are exactly the pieces a
// future org-type pack (keyed by organizations.template) should supply; gathering
// them here is the first, behavior-neutral step toward that.

/** Roles with broad, cross-domain authority (manage/approve anything). */
export const LEADERSHIP_ROLES: Role[] = [ROLES.PRESIDENT, ROLES.PRO_CONSUL];

/** The base member role every member holds (the least-privilege floor). */
export const FLOOR_ROLE: Role = ROLES.BROTHER;

/** True if the role has broad leadership authority (e.g. manage/approve anything). */
export function isLeadershipRole(role: Role): boolean {
  return LEADERSHIP_ROLES.includes(role);
}

/** True if the role is the base/floor member role. */
export function isFloorRole(role: Role): boolean {
  return role === FLOOR_ROLE;
}

// Ordered list for the role switcher UI (officers in rough precedence, then brother)
export const ROLE_SWITCHER_OPTIONS: Role[] = [
  ROLES.PRESIDENT,
  ROLES.PRO_CONSUL,
  ROLES.ANNOTATOR,
  ROLES.QUAESTOR,
  ROLES.MAGISTER,
  ROLES.KUSTOS,
  ROLES.TRIBUNE,
  ROLES.RISK_MANAGER,
  ROLES.SOCIAL_CHAIR,
  ROLES.RECRUITMENT_CHAIR,
  ROLES.PHILANTHROPY_CHAIR,
  ROLES.SCHOLARSHIP_CHAIR,
  ROLES.HOUSE_MANAGER,
  ROLES.BROTHER,
];
