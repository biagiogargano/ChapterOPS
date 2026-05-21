/**
 * Shared event store — module-level, persists across navigation within a session.
 *
 * Holds MOCK_EVENTS (seed data) plus any events created by officers at runtime.
 * Every screen that lists or looks up events should read from getAllEvents() rather
 * than importing MOCK_EVENTS directly, so user-created events appear everywhere.
 */

import {
  MOCK_EVENTS,
  type EventAudience,
  type EventKind,
  type MockEvent,
} from './mockEvents';
import {
  addDynamicTask,
  removeDynamicTasksByEvent,
  removeDynamicTaskById,
  type MockTask,
  type TaskUrgency,
} from './mockTasks';
import type { Role } from './roles';

// Re-export types so callers only need one import
export type { EventAudience, EventKind, MockEvent };

// ─── Recurrence ───────────────────────────────────────────────────────────────

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:      'Does not repeat',
  daily:     'Daily',
  weekly:    'Weekly',
  biweekly:  'Every 2 weeks',
  monthly:   'Monthly',
};

// ─── User-created event type ───────────────────────────────────────────────────

/** Event created by an officer during this session (stored as an ISO date string). */
export interface UserCreatedEvent {
  id:            string;
  title:         string;
  kind:          EventKind;
  audience:      EventAudience;
  /** ISO date string "YYYY-MM-DD" — converted to dayOffset on read. */
  dateString:    string;
  time:          string;   // e.g. "8:00 PM"
  location:      string;
  description:   string;
  createdByRole: string;
  recurrence:    RecurrenceType;
  /** Shared id for all events in a recurring series. */
  seriesId?:     string;
  /** ISO date — last date of recurrence. */
  repeatUntil?:  string;
  /** True only for date-style social events that collect date names. */
  requiresDateNames?: boolean;
}

// ─── Role → allowed event kinds ───────────────────────────────────────────────

export const ROLE_ALLOWED_KINDS: Record<Role, EventKind[]> = {
  president:         ['chapter', 'eboard', 'social', 'academic', 'recruitment', 'philanthropy', 'risk'],
  pro_consul:        ['chapter', 'eboard', 'social', 'academic', 'recruitment', 'philanthropy', 'risk'],
  annotator:         ['chapter', 'eboard'],
  social_chair:      ['social', 'philanthropy'],
  risk_manager:      ['social', 'risk'],
  recruitment_chair: ['recruitment'],
  brother:           [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

const _userEvents: UserCreatedEvent[] = [];

/**
 * RFC4122-v4-format UUID. Used as the id for created events so the SAME id is
 * used locally (optimistic) and in Supabase — enabling dedup + delete-by-id.
 * Math.random is fine here: these are demo record ids, not security tokens.
 */
function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Date utilities ────────────────────────────────────────────────────────────

/**
 * Returns Monday of the current week at midnight.
 * Uses the same formula as getEventDate() in mockEvents.ts so dayOffset values
 * are comparable between seed events and user-created events.
 */
function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/**
 * Convert an ISO date string ("YYYY-MM-DD") to a dayOffset relative to this
 * week's Monday — the same unit used by MockEvent.dayOffset.
 */
export function dateStringToDayOffset(dateString: string): number {
  const monday    = getMondayOfCurrentWeek();
  const eventDate = new Date(dateString + 'T00:00:00');
  const diffMs    = eventDate.getTime() - monday.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** Advance an ISO date string by N days. */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Advance an ISO date string by N months. */
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return isoDate(d);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generate all recurrence dates from startDate up to (inclusive) repeatUntil.
 * Returns at most 52 instances to prevent runaway loops.
 */
function generateRecurrenceDates(
  startDate:   string,
  recurrence:  RecurrenceType,
  repeatUntil: string,
): string[] {
  if (recurrence === 'none') return [startDate];

  const dates: string[] = [];
  let current = startDate;
  let limit   = 52; // safety cap

  while (current <= repeatUntil && limit-- > 0) {
    dates.push(current);
    if      (recurrence === 'daily')    current = addDays(current, 1);
    else if (recurrence === 'weekly')   current = addDays(current, 7);
    else if (recurrence === 'biweekly') current = addDays(current, 14);
    else if (recurrence === 'monthly')  current = addMonths(current, 1);
  }

  return dates;
}

// ─── RSVP task generation ────────────────────────────────────────────────────

const OFFICERS: Role[] = [
  'president', 'pro_consul', 'annotator',
  'risk_manager', 'social_chair', 'recruitment_chair',
];

/**
 * If the event is mandatory or officers-only AND falls within this week (dayOffset 0-6),
 * generate a placeholder RSVP task and add it to the dynamic task store.
 */
function maybeGenerateRsvpTask(event: UserCreatedEvent, dayOffset: number): void {
  // Only generate for this week; optional events don't require RSVP
  if (dayOffset < 0 || dayOffset > 6) return;
  if (event.audience === 'optional')  return;

  const isOfficersOnly = event.audience === 'officers';
  const todayOffset    = (new Date().getDay() + 6) % 7;
  const urgency: TaskUrgency = dayOffset === todayOffset ? 'today' : 'week';

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dueLabel = urgency === 'today'
    ? 'Today — RSVP required'
    : `RSVP by ${dayNames[dayOffset] ?? '?'}`;

  const task: MockTask = {
    id:                   `task_rsvp_${event.id}`,
    title:                `RSVP for ${event.title}`,
    type:                 'lightweight',
    lightweightKind:      'rsvp',
    linkedEventMandatory: true,
    requiresCovering:     isOfficersOnly,
    requiresApproval:     true,
    reviewerRole:         'annotator',
    state:                'assigned',
    urgency,
    dueLabel,
    assignedRole:         'all',
    assignedTo:           isOfficersOnly ? 'All Officers' : 'All Members',
    visibleTo:            isOfficersOnly ? OFFICERS : 'all',
    linkedEvent:          event.title,
    linkedEventId:        event.id,   // per-instance key for rsvpStore
    description:          `RSVP for ${event.title}. ${isOfficersOnly ? 'Officer attendance required.' : 'Attendance is mandatory for all members.'}`,
  };

  addDynamicTask(task);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a new officer-created event (and any recurring instances) into the local
 * session store, generating RSVP tasks for mandatory/officer events this week.
 *
 * Ids (and the series id) are client-generated UUIDs so the screen can persist
 * the SAME ids to Supabase via insertEvent(). Returns ALL created instances
 * (first element is the primary event) so the caller can persist each one.
 */
export function addUserEvent(
  event: Omit<UserCreatedEvent, 'id' | 'seriesId'>,
): UserCreatedEvent[] {
  const dates = event.recurrence !== 'none' && event.repeatUntil
    ? generateRecurrenceDates(event.dateString, event.recurrence, event.repeatUntil)
    : [event.dateString];

  const seriesId = dates.length > 1 ? _uuid() : undefined;
  const created: UserCreatedEvent[] = [];

  for (const dateString of dates) {
    const id  = _uuid();
    const e: UserCreatedEvent = { ...event, id, dateString, seriesId };
    _userEvents.push(e);
    created.push(e);

    const offset = dateStringToDayOffset(dateString);
    maybeGenerateRsvpTask(e, offset);
  }

  return created;
}

/** Raw user-created events (no mock seed). Used for store introspection only. */
export function getUserEvents(): UserCreatedEvent[] {
  return [..._userEvents];
}

/**
 * Delete a single event instance by id.
 * Removes it from the local session store AND the Supabase cache (optimistic),
 * plus any auto-generated RSVP task tied to this event id. The Supabase row
 * removal itself is fired by the caller (event detail screen) via removeEvent().
 */
export function deleteEvent(id: string): void {
  _deletedIds.add(id);   // tombstone — survives a racing refetch this session
  const idx = _userEvents.findIndex(e => e.id === id);
  if (idx >= 0) _userEvents.splice(idx, 1);
  if (_supabaseEvents) _supabaseEvents = _supabaseEvents.filter(e => e.id !== id);
  removeDynamicTaskById(`task_rsvp_${id}`);
}

/**
 * Delete all events in a recurring series, plus their generated RSVP tasks.
 * Clears both the local store and the Supabase cache (optimistic). The Supabase
 * row removal is fired by the caller via removeEventSeries().
 */
export function deleteEventSeries(seriesId: string): void {
  _deletedSeriesIds.add(seriesId);   // tombstone — guards against a racing refetch
  // Collect titles for task removal (titles may repeat)
  const toDelete = _userEvents.filter(e => e.seriesId === seriesId);
  for (const e of toDelete) {
    removeDynamicTaskById(`task_rsvp_${e.id}`);
  }
  for (let i = _userEvents.length - 1; i >= 0; i--) {
    if (_userEvents[i].seriesId === seriesId) _userEvents.splice(i, 1);
  }
  if (_supabaseEvents) _supabaseEvents = _supabaseEvents.filter(e => e.seriesId !== seriesId);
}

/** Editable fields for an officer-created event (recurrence rule is NOT edited). */
export interface UpdateEventInput {
  title:       string;
  kind:        EventKind;
  audience:    EventAudience;
  dateString:  string;
  time:        string;
  location:    string;
  description: string;
}

/**
 * Update a created event's editable fields. Preserves id, seriesId, recurrence,
 * repeatUntil, and createdByRole (no recurring-rule editing). Updates the local
 * _userEvents entry and the Supabase cache optimistically. Returns the updated
 * UserCreatedEvent so the caller can persist it via eventService.updateEvent.
 */
export function updateUserEvent(id: string, input: UpdateEventInput): UserCreatedEvent | undefined {
  const current = findEventById(id);
  if (!current) return undefined;

  const existingUce = _userEvents.find(e => e.id === id);
  const updated: UserCreatedEvent = {
    id,
    title:         input.title,
    kind:          input.kind,
    audience:      input.audience,
    dateString:    input.dateString,
    time:          input.time,
    location:      input.location,
    description:   input.description,
    // Preserved (never edited here):
    createdByRole:     existingUce?.createdByRole ?? current.createdByRole ?? '',
    recurrence:        existingUce?.recurrence ?? ((current.recurrence as RecurrenceType | undefined) ?? 'none'),
    seriesId:          existingUce?.seriesId ?? current.seriesId,
    repeatUntil:       existingUce?.repeatUntil,
    requiresDateNames: existingUce?.requiresDateNames ?? current.requiresDateNames,
  };

  const ui = _userEvents.findIndex(e => e.id === id);
  if (ui >= 0) _userEvents[ui] = updated;
  if (_supabaseEvents) {
    const ci = _supabaseEvents.findIndex(e => e.id === id);
    if (ci >= 0) _supabaseEvents[ci] = toMockEvent(updated);
  }
  return updated;
}

/**
 * Apply SHARED editable fields (title/kind/audience/time/location/description) to
 * every occurrence in a recurring series. Each occurrence keeps its OWN date,
 * id, recurrence metadata, and RSVP state — date is intentionally NOT applied to
 * the series (use updateUserEvent for a single occurrence's date). Updates the
 * local store + Supabase cache; the caller persists via eventService.updateEventSeries.
 */
export function updateUserEventSeries(seriesId: string, input: UpdateEventInput): void {
  for (let i = 0; i < _userEvents.length; i++) {
    if (_userEvents[i].seriesId === seriesId) {
      _userEvents[i] = {
        ..._userEvents[i],
        title:       input.title,
        kind:        input.kind,
        audience:    input.audience,
        time:        input.time,
        location:    input.location,
        description: input.description,
        // dateString preserved per occurrence
      };
    }
  }
  if (_supabaseEvents) {
    _supabaseEvents = _supabaseEvents.map(e =>
      e.seriesId === seriesId
        ? {
            ...e,
            title:       input.title,
            kind:        input.kind,
            audience:    input.audience,
            time:        input.time,
            location:    input.location,
            description: input.description,
          }
        : e,
    );
  }
}

// ─── Supabase event cache + id resolution ──────────────────────────────────────
//
// When Supabase events are loaded (by the root layout / Calendar / Today), they
// are cached here and become the base dataset for getAllEvents()/findEventById().
// MOCK_EVENTS are only used as a fallback when the cache is empty.
//
// Because the rest of the app references seed events by their mock ids
// ('e1'..'e4') — e.g. RSVP tasks carry linkedEventId='e1' — we also build a
// mock-id → Supabase-UUID map (matched by title) so those references can be
// resolved to the real Supabase event id via resolveEventId().

let _supabaseEvents: MockEvent[] | null = null;        // null = not yet loaded
const _mockIdToSupabaseId: Record<string, string> = {};

// Session tombstones: ids/series the user optimistically deleted. A focus
// refetch can race ahead of the async Supabase delete and return a row we just
// removed; filtering against these keeps the cache from "un-deleting" it.
const _deletedIds       = new Set<string>();
const _deletedSeriesIds = new Set<string>();

/**
 * Clear all org-scoped event state (Supabase cache, optimistic user events,
 * id map, and session tombstones). Used on an org transition so the next org's
 * hydration starts clean. Data-only — there are no event subscribers to notify
 * (screens re-read getAllEvents() on focus / DataBootstrap re-hydration).
 *
 * Not wired into runtime yet (Issue B-1 groundwork).
 */
export function resetOrgScopedEvents(): void {
  _supabaseEvents = null;
  _userEvents.length = 0;
  for (const k of Object.keys(_mockIdToSupabaseId)) delete _mockIdToSupabaseId[k];
  _deletedIds.clear();
  _deletedSeriesIds.clear();
}

/** Called by screens after fetching events from Supabase. No-op on empty input. */
export function setSupabaseEventCache(events: MockEvent[]): void {
  if (!events || events.length === 0) return;          // keep mock fallback

  // Drop anything the user deleted this session (guards the delete→refetch race).
  const filtered = events.filter(
    e => !_deletedIds.has(e.id) && !(e.seriesId && _deletedSeriesIds.has(e.seriesId)),
  );
  _supabaseEvents = filtered;

  // Rebuild the mock-id → supabase-id map by matching titles against MOCK_EVENTS.
  for (const key of Object.keys(_mockIdToSupabaseId)) delete _mockIdToSupabaseId[key];
  for (const mock of MOCK_EVENTS) {
    const match = filtered.find(e => e.title === mock.title);
    if (match) _mockIdToSupabaseId[mock.id] = match.id;
  }
}

/** True once a non-empty Supabase event set has been cached. */
export function hasSupabaseEvents(): boolean {
  return _supabaseEvents !== null;
}

/**
 * Map a mock seed id ('e1'..'e4') to its Supabase UUID when the cache is loaded.
 * Returns the id unchanged for UUIDs, user-created ids, or when no mapping
 * exists (mock fallback). This is the single point every RSVP key / event
 * navigation should pass its event id through.
 */
export function resolveEventId(id: string): string {
  return _mockIdToSupabaseId[id] ?? id;
}

// Seed events are never user-deletable. They are the 4 MOCK_EVENTS, identified
// either by their mock id ('e1'..'e4') or by their mapped Supabase UUID.
const _seedMockIds = new Set(MOCK_EVENTS.map(e => e.id));

/**
 * True if `id` belongs to an officer-created event (i.e. NOT one of the 4 seed
 * events). Used to decide whether to show the Delete button. Works after reload
 * because _mockIdToSupabaseId is rebuilt from the cache on load.
 */
export function isUserCreatedEvent(id: string): boolean {
  if (_seedMockIds.has(id)) return false;                          // 'e1'..'e4'
  if (Object.values(_mockIdToSupabaseId).includes(id)) return false; // seed Supabase UUIDs
  return true;
}

/**
 * Edit permission: an officer-created event is editable by the creator role or
 * by BROAD leadership (president / pro_consul). Seed events are never editable.
 */
export function canManageEvent(event: MockEvent, role: Role): boolean {
  if (!isUserCreatedEvent(event.id)) return false;
  if (role === 'president' || role === 'pro_consul') return true;
  return event.createdByRole === role;
}

// ─── Read functions ───────────────────────────────────────────────────────────

/**
 * Convert a UserCreatedEvent to MockEvent shape so it is compatible with every
 * existing screen that expects MockEvent (event detail, calendar, today).
 */
export function toMockEvent(e: UserCreatedEvent): MockEvent {
  return {
    id:          e.id,
    title:       e.title,
    kind:        e.kind,
    audience:    e.audience,
    dayOffset:   dateStringToDayOffset(e.dateString),
    time:        e.time,
    location:    e.location,
    description: e.description,
    isRecurring: !!e.seriesId,
    seriesId:    e.seriesId,
    recurrence:  e.recurrence !== 'none' ? e.recurrence : undefined,
    createdByRole: e.createdByRole,
    requiresDateNames: e.requiresDateNames,
  };
}

/**
 * All events (seed + user-created) as MockEvent[], sorted by dayOffset then title.
 * This is the single source of truth every screen should read.
 */
export function getAllEvents(): MockEvent[] {
  // Prefer the Supabase cache when loaded; otherwise fall back to MOCK_EVENTS.
  const base = _supabaseEvents ?? MOCK_EVENTS;
  // Dedup: a freshly-created event lives in _userEvents (optimistic) AND, once
  // persisted + re-fetched, in the Supabase cache under the same UUID. Drop the
  // local copy when the cache already has that id.
  const baseIds = new Set(base.map(e => e.id));
  const userMapped = _userEvents
    .map(toMockEvent)
    .filter(e => !baseIds.has(e.id));
  return [...base, ...userMapped].sort((a, b) =>
    a.dayOffset !== b.dayOffset
      ? a.dayOffset - b.dayOffset
      : a.title.localeCompare(b.title),
  );
}

/**
 * Look up any event by ID — searches seed/Supabase events and user-created ones.
 * Falls back to resolveEventId() so a legacy mock id ('e1') still resolves to
 * the corresponding Supabase event once the cache is loaded.
 */
export function findEventById(id: string): MockEvent | undefined {
  const all = getAllEvents();
  return all.find(e => e.id === id) ?? all.find(e => e.id === resolveEventId(id));
}
