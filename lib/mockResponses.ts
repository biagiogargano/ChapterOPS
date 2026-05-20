/**
 * Mock aggregated responses for tasks that collect multiple member submissions.
 * Used by officer views (Risk Manager, Social Chair, Pro Consul, President) to
 * see all responses in one place — e.g. on the event detail screen.
 *
 * Real implementation would pull from a database; here we hard-code sample data.
 */

// ─── Date party name submissions (tk2) ────────────────────────────────────────

export interface DateSubmission {
  memberName:  string;
  dateName:    string;
  datePhone:   string;
  submittedAt: string;
}

export const DATE_PARTY_SUBMISSIONS: DateSubmission[] = [
  { memberName: 'Alex Torres',    dateName: 'Sofia Reyes',      datePhone: '(555) 201-4401', submittedAt: '9:12 AM' },
  { memberName: 'Marcus Webb',    dateName: 'Jordan Liu',        datePhone: '(555) 318-7720', submittedAt: '9:45 AM' },
  { memberName: 'Dylan Park',     dateName: 'Emma Vasquez',     datePhone: '(555) 422-9934', submittedAt: '10:03 AM' },
  { memberName: 'Caleb Nguyen',   dateName: 'Priya Sharma',     datePhone: '(555) 507-3312', submittedAt: '10:31 AM' },
  { memberName: 'Ethan Brooks',   dateName: 'Naomi Okafor',     datePhone: '(555) 614-8801', submittedAt: '11:07 AM' },
  { memberName: 'Ryan Castillo',  dateName: 'Claire Bennett',   datePhone: '(555) 729-4456', submittedAt: '11:42 AM' },
  { memberName: 'Noah Williams',  dateName: 'Mia Lawson',       datePhone: '(555) 833-0093', submittedAt: '12:15 PM' },
  { memberName: 'Liam Flores',    dateName: 'Ava Mitchell',     datePhone: '(555) 945-2278', submittedAt: '1:02 PM' },
];

// ─── Chapter Meeting RSVP responses (tk1) ─────────────────────────────────────

export type RsvpStatus = 'attending' | 'excused' | 'absent';

export interface RsvpResponse {
  memberName:   string;
  status:       RsvpStatus;
  excuse?:      string;       // provided when status = 'excused'
  covering?:    string;       // provided when covering another officer
  submittedAt?: string;
}

export const CHAPTER_MEETING_RSVPS: RsvpResponse[] = [
  { memberName: 'Biagio Gargano (President)',    status: 'attending',  submittedAt: '8:05 AM' },
  { memberName: 'Alex Torres (Pro Consul)',       status: 'attending',  submittedAt: '8:12 AM' },
  { memberName: 'Marcus Webb',                   status: 'attending',  submittedAt: '8:55 AM' },
  { memberName: 'Dylan Park',                    status: 'excused',    excuse: 'Lab final exam from 6–9 PM.', submittedAt: '9:20 AM' },
  { memberName: 'Caleb Nguyen',                  status: 'excused',    excuse: 'Out-of-state family obligation.', submittedAt: '10:01 AM' },
  { memberName: 'Ethan Brooks',                  status: 'attending',  submittedAt: '10:34 AM' },
  { memberName: 'Ryan Castillo',                 status: 'attending',  submittedAt: '11:11 AM' },
  { memberName: 'Noah Williams',                 status: 'absent' },   // no-show, no RSVP
  { memberName: 'Liam Flores',                   status: 'attending',  submittedAt: '11:59 AM' },
  { memberName: 'Jordan Kim',                    status: 'absent' },
];

// ─── E-Board Meeting RSVP responses (tk_eboard) ───────────────────────────────

export const EBOARD_MEETING_RSVPS: RsvpResponse[] = [
  { memberName: 'Biagio Gargano (President)',    status: 'attending',  submittedAt: '8:00 AM' },
  { memberName: 'Alex Torres (Pro Consul)',       status: 'attending',  submittedAt: '8:07 AM' },
  { memberName: 'Annotator',                     status: 'excused',    excuse: 'Medical appointment.', covering: 'Marcus Webb', submittedAt: '9:00 AM' },
  { memberName: 'Risk Manager',                  status: 'attending',  submittedAt: '9:15 AM' },
  { memberName: 'Social Chair',                  status: 'attending',  submittedAt: '9:30 AM' },
  { memberName: 'Recruitment Chair',             status: 'excused',    excuse: 'University recruiting fair conflict.', covering: 'Dylan Park', submittedAt: '10:00 AM' },
];
