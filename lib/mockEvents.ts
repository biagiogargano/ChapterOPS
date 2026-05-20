export type EventKind =
  | 'chapter'       // Chapter meeting — all members
  | 'eboard'        // Executive board meeting — officers
  | 'social'        // Social events, date parties
  | 'academic'      // Study hours, scholarship
  | 'recruitment'   // Recruitment events, Mission 365, hangouts
  | 'philanthropy'  // Service / philanthropy
  | 'risk';         // Risk/safety events
export type EventAudience = 'all' | 'officers' | 'optional';

export interface MockEvent {
  id:          string;
  title:       string;
  kind:        EventKind;
  audience:    EventAudience;
  dayOffset:   number;   // 0 = this Monday
  time:        string;
  location:    string;
  description: string;
  // Optional — present on recurring user-created events
  isRecurring?:  boolean;
  seriesId?:     string;
  recurrence?:   string; // 'weekly' | 'biweekly' | etc.
  // Officer who created it (for edit permission); absent on seed events.
  createdByRole?: string;
  // True only for date-style social events (date party / formal) that collect
  // date names — gates the Date Submissions section. Not every social event.
  requiresDateNames?: boolean;
}

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: 'e1',
    title: 'Chapter Meeting',
    kind: 'chapter',
    audience: 'all',
    dayOffset: 0, // Monday
    time: '8:00 PM',
    location: 'Chapter Room',
    description: 'Weekly all-hands chapter meeting. Attendance is mandatory for all active members. Bring your dues receipt if you haven\'t submitted it yet.',
  },
  {
    id: 'e2',
    title: 'E-Board Meeting',
    kind: 'eboard',
    audience: 'officers',
    dayOffset: 1, // Tuesday
    time: '8:00 PM',
    location: 'Library, Room 204',
    description: 'Executive board sync. Officers review upcoming events, budget items, and action items from the last chapter meeting.',
  },
  {
    id: 'e3',
    title: 'Date Party',
    kind: 'social',
    audience: 'optional',
    dayOffset: 4, // Friday
    time: '9:00 PM',
    location: 'Venue TBD',
    description: 'Semi-formal social. Bring a date or go with a group. Dress code is business casual. Transportation details TBD — watch GroupMe.',
  },
  {
    id: 'e4',
    title: 'Study Hours',
    kind: 'academic',
    audience: 'optional',
    dayOffset: 6, // Sunday
    time: '6:00 PM',
    location: 'Chapter Room',
    description: 'Structured study block. Brothers on academic probation are required. All other members are encouraged to attend.',
  },
];

// Returns the calendar date for an event given this week's Monday
export function getEventDate(dayOffset: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7)); // roll back to Monday
  monday.setHours(0, 0, 0, 0);
  const result = new Date(monday);
  result.setDate(monday.getDate() + dayOffset);
  return result;
}

export const KIND_LABELS: Record<EventKind, string> = {
  chapter:     'Chapter',
  eboard:      'E-Board',
  social:      'Social',
  academic:    'Academic',
  recruitment: 'Recruitment',
  philanthropy:'Philanthropy',
  risk:        'Risk/Safety',
};

export const KIND_COLORS: Record<EventKind, string> = {
  chapter:     '#6366f1',
  eboard:      '#f59e0b',
  social:      '#ec4899',
  academic:    '#22c55e',
  recruitment: '#f97316',
  philanthropy:'#a855f7',
  risk:        '#ef4444',
};

export const KIND_BG: Record<EventKind, string> = {
  chapter:     '#1e1b4b',
  eboard:      '#1c1407',
  social:      '#2d0a1f',
  academic:    '#052e16',
  recruitment: '#1c0a00',
  philanthropy:'#1a0a2e',
  risk:        '#1a0505',
};

export const AUDIENCE_LABEL: Record<EventAudience, string> = {
  all: 'Mandatory',
  officers: 'Officers Only',
  optional: 'Optional',
};

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
