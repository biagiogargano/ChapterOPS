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

export const ORG_TEMPLATES: OrgTemplate[] = [
  {
    id: 'fraternity',
    label: 'Fraternity / Sorority',
    emoji: '🏛️',
    leaderTitle: 'Consul',
    roles: ['Consul', 'Pro Consul', 'Annotator', 'Risk Manager', 'Social Chair', 'Recruitment Chair', 'Brother'],
    eventKinds: ['Chapter meeting', 'E-board meeting', 'Social', 'Recruitment', 'Philanthropy', 'Risk'],
    defaultReport: true,
    reportName: 'Weekly Officer Report',
    blurb: 'Greek chapter defaults — Sigma Chi terms, chapter meetings, weekly officer reports.',
  },
  {
    id: 'club',
    label: 'Club / Student org',
    emoji: '🎟️',
    leaderTitle: 'President',
    roles: ['President', 'Vice President', 'Treasurer', 'Secretary', 'Member'],
    eventKinds: ['General meeting', 'Exec meeting', 'Event', 'Fundraiser'],
    defaultReport: true,
    reportName: 'Weekly Exec Report',
    blurb: 'Classic club structure — exec board, general meetings, events.',
  },
  {
    id: 'team',
    label: 'Sports team',
    emoji: '🏅',
    leaderTitle: 'Captain',
    roles: ['Captain', 'Co-Captain', 'Coach', 'Player'],
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
    roles: ['Chair', 'Vice Chair', 'Member'],
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
