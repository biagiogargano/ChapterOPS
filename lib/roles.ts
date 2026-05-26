export const ROLES = {
  PRESIDENT:         'president',
  PRO_CONSUL:        'pro_consul',
  ANNOTATOR:         'annotator',
  QUAESTOR:          'quaestor',     // Treasurer
  MAGISTER:          'magister',     // New-member educator
  KUSTOS:            'kustos',       // Sergeant-at-arms / property
  TRIBUNE:           'tribune',      // Member advocate
  RISK_MANAGER:      'risk_manager',
  SOCIAL_CHAIR:      'social_chair',
  RECRUITMENT_CHAIR: 'recruitment_chair',
  BROTHER:           'brother',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  president:         'Consul',
  pro_consul:        'Pro Consul',
  annotator:         'Annotator',
  quaestor:          'Quaestor',
  magister:          'Magister',
  kustos:            'Kustos',
  tribune:           'Tribune',
  risk_manager:      'Risk Manager',
  social_chair:      'Social Chair',
  recruitment_chair: 'Recruitment Chair',
  brother:           'Brother',
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
];

export function isOfficer(role: Role): boolean {
  return OFFICER_ROLES.includes(role);
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
  ROLES.BROTHER,
];
