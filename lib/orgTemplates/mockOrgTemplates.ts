/**
 * orgTemplates/mockOrgTemplates.ts — org-type templates (prototype).
 * PROTOTYPE / mock. Demonstrates the org-agnostic principle: the SAME core
 * primitives (events, tasks, structured responses, roles) get different DEFAULT
 * labels/roles/event-types/reports per org type. Fraternity is template #1;
 * clubs/teams/classes/committees reuse the same engine. Nothing here is
 * persisted; real templates would seed org config (organizations.template).
 */

export interface OrgTemplate {
  id:           string;
  label:        string;          // org type name
  emoji:        string;
  leaderTitle:  string;          // what the top role is called
  roles:        string[];        // default role labels (top → bottom)
  eventKinds:   string[];        // default event types
  defaultReport: boolean;        // does it ship a recurring structured report?
  reportName?:  string;
  blurb:        string;
}

// Role names show the common term first with the org-specific equivalent in
// parentheses where one is widely used (e.g. "President (Consul)" for Greek life).
// Every name is editable in setup; these are just smart starting defaults.
export const ORG_TEMPLATES: OrgTemplate[] = [
  {
    id: 'fraternity',
    label: 'Fraternity',
    emoji: '🏛️',
    leaderTitle: 'President (Consul)',
    roles: ['President (Consul)', 'VP (Pro Consul)', 'Secretary (Annotator)', 'Quaestor (Treasurer)', 'Magister', 'Kustos', 'Tribune', 'Risk Manager', 'Social Chair', 'Recruitment Chair', 'Member (Brother)'],
    eventKinds: ['Chapter meeting', 'E-board meeting', 'Social', 'Recruitment', 'Philanthropy', 'Risk'],
    defaultReport: true,
    reportName: 'Weekly Officer Report',
    blurb: 'Greek chapter defaults — common officer titles with traditional terms (Consul, Quaestor) noted.',
  },
  {
    id: 'sorority',
    label: 'Sorority',
    emoji: '🌸',
    leaderTitle: 'President',
    roles: ['President', 'VP', 'Secretary', 'Treasurer', 'Risk Manager', 'Social Chair', 'Recruitment Chair (Membership)', 'Member (Sister)'],
    eventKinds: ['Chapter meeting', 'E-board meeting', 'Social', 'Recruitment', 'Philanthropy', 'Sisterhood'],
    defaultReport: true,
    reportName: 'Weekly Officer Report',
    blurb: 'Greek chapter defaults — President/VP/Secretary/Treasurer plus chairs; rename to your chapter’s terms.',
  },
  {
    id: 'club',
    label: 'Club / Student org',
    emoji: '🎟️',
    leaderTitle: 'President',
    roles: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Event Coordinator', 'Member'],
    eventKinds: ['General meeting', 'Exec meeting', 'Event', 'Fundraiser'],
    defaultReport: true,
    reportName: 'Weekly Exec Report',
    blurb: 'Classic club structure — exec board, general meetings, events.',
  },
  {
    id: 'business',
    label: 'Business / Company',
    emoji: '💼',
    leaderTitle: 'CEO',
    roles: ['CEO', 'COO', 'CFO', 'CTO', 'VP', 'Manager', 'Employee'],
    eventKinds: ['All-hands', 'Standup', 'Board meeting', 'Review', '1:1'],
    defaultReport: true,
    reportName: 'Weekly Status Report',
    blurb: 'Company defaults — C-suite, managers, all-hands and weekly status.',
  },
  {
    id: 'nonprofit',
    label: 'Nonprofit',
    emoji: '🤝',
    leaderTitle: 'Executive Director',
    roles: ['Executive Director', 'Board Chair', 'Treasurer', 'Secretary', 'Volunteer Coordinator', 'Volunteer'],
    eventKinds: ['Board meeting', 'Fundraiser', 'Volunteer event', 'Community event'],
    defaultReport: true,
    reportName: 'Program Update',
    blurb: 'Nonprofit defaults — board roles, volunteer coordination, fundraisers.',
  },
  {
    id: 'team',
    label: 'Sports team',
    emoji: '🏅',
    leaderTitle: 'Captain',
    roles: ['Captain', 'Co-Captain', 'Head Coach', 'Assistant Coach', 'Player'],
    eventKinds: ['Practice', 'Game', 'Team meeting', 'Workout'],
    defaultReport: false,
    blurb: 'Team defaults — practices, games, attendance-focused.',
  },
  {
    id: 'class',
    label: 'Class / Course',
    emoji: '🎓',
    leaderTitle: 'Instructor',
    roles: ['Instructor', 'TA', 'Student'],
    eventKinds: ['Lecture', 'Office hours', 'Exam', 'Assignment'],
    defaultReport: false,
    blurb: 'Course defaults — lectures, assignments, office hours.',
  },
  {
    id: 'committee',
    label: 'Committee / Board',
    emoji: '📋',
    leaderTitle: 'Chair',
    roles: ['Chair', 'Vice Chair', 'Secretary', 'Member'],
    eventKinds: ['Meeting', 'Work session'],
    defaultReport: true,
    reportName: 'Status Update',
    blurb: 'Committee defaults — meetings, action items, status updates.',
  },
  {
    id: 'other',
    label: 'Other organization',
    emoji: '⚙️',
    leaderTitle: 'Owner',
    roles: ['Owner', 'Admin', 'Member'],
    eventKinds: ['Event', 'Meeting'],
    defaultReport: false,
    blurb: 'Minimal generic defaults — shape it however you want.',
  },
];

export function getOrgTemplate(id: string): OrgTemplate | undefined {
  return ORG_TEMPLATES.find(t => t.id === id);
}
