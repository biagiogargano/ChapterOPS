/**
 * eventService.ts — thin Supabase adapter for the events + rsvps tables.
 *
 * Rules:
 *  - Does NOT replace eventStore.ts yet. Screens still read from getAllEvents().
 *  - Returns app-native shapes (MockEvent / UserCreatedEvent) so callers don't
 *    need to know about the database schema.
 *  - Every function is wrapped in try/catch and returns a safe default on error
 *    so the app works fine even when Supabase is unconfigured or unreachable.
 *  - No auth, no RLS, no AI, no Google Docs.
 */

import { supabase } from './supabase';
import { dateStringToDayOffset } from './eventStore';
import type { MockEvent, EventKind, EventAudience } from './mockEvents';
import type { UserCreatedEvent, RecurrenceType } from './eventStore';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Chapter UUID used for all demo data. Must match events_seed.sql. */
export const DEMO_CHAPTER_ID = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Returns true only when the env vars look like a real Supabase project URL.
 * Note: EXPO_PUBLIC_SUPABASE_URL must NOT include a "/rest/v1/" suffix —
 * the Supabase client appends that internally.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('/rest/v1') &&   // common misconfiguration guard
    key.length > 10
  );
}

// ─── Row type (matches events_schema.sql) ─────────────────────────────────────

interface EventRow {
  id:              string;
  chapter_id:      string;
  title:           string;
  kind:            EventKind;
  audience:        EventAudience;
  event_date:      string;       // "YYYY-MM-DD" — Supabase returns date columns as strings
  time:            string;
  location:        string;
  description:     string;
  is_recurring:    boolean;
  series_id:       string | null;
  recurrence:      string | null;
  repeat_until:    string | null;
  created_by_role: string | null;
  created_at:      string;
}

// ─── Shape converters ─────────────────────────────────────────────────────────

/**
 * Convert a Supabase event row → MockEvent.
 * dayOffset is computed at runtime from event_date so it's always relative to
 * the current week's Monday, exactly as the rest of the app expects.
 */
function rowToMockEvent(row: EventRow): MockEvent {
  return {
    id:          row.id,
    title:       row.title,
    kind:        row.kind,
    audience:    row.audience,
    dayOffset:   dateStringToDayOffset(row.event_date),
    time:        row.time,
    location:    row.location,
    description: row.description,
    isRecurring: row.is_recurring,
    seriesId:    row.series_id ?? undefined,
    recurrence:  row.recurrence ?? undefined,
  };
}

/**
 * Convert a Supabase event row → UserCreatedEvent.
 * Useful for screens that need the dateString rather than dayOffset.
 */
function rowToUserCreatedEvent(row: EventRow): UserCreatedEvent {
  return {
    id:            row.id,
    title:         row.title,
    kind:          row.kind,
    audience:      row.audience,
    dateString:    row.event_date,
    time:          row.time,
    location:      row.location,
    description:   row.description,
    createdByRole: row.created_by_role ?? '',
    recurrence:    (row.recurrence as RecurrenceType) ?? 'none',
    seriesId:      row.series_id ?? undefined,
    repeatUntil:   row.repeat_until ?? undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all events for the demo chapter, sorted by event_date then title.
 * Returns [] if Supabase is unconfigured or the request fails.
 */
export async function fetchAllEvents(): Promise<MockEvent[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    // Fetch the table, then filter by chapter_id in JS (a server-side
    // .eq('chapter_id', …) matched 0 rows in this environment).
    const { data, error } = await supabase
      .from('events')
      .select('*');

    if (error) {
      console.warn('[eventService] fetchAllEvents error:', error.message);
      return [];
    }

    const rows = (data ?? []) as EventRow[];
    return rows
      .filter(r => r.chapter_id === DEMO_CHAPTER_ID)
      .map(rowToMockEvent)
      .sort((a, b) =>
        a.dayOffset !== b.dayOffset
          ? a.dayOffset - b.dayOffset
          : a.title.localeCompare(b.title),
      );
  } catch (err) {
    console.warn('[eventService] fetchAllEvents threw:', err);
    return [];
  }
}

/**
 * Fetch a single event by UUID.
 * Returns undefined if not found, unconfigured, or request fails.
 */
export async function fetchEventById(id: string): Promise<MockEvent | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('chapter_id', DEMO_CHAPTER_ID)
      .maybeSingle();

    if (error) {
      console.warn('[eventService] fetchEventById error:', error.message);
      return undefined;
    }
    return data ? rowToMockEvent(data as EventRow) : undefined;
  } catch (err) {
    console.warn('[eventService] fetchEventById threw:', err);
    return undefined;
  }
}

/**
 * Insert a single event row into Supabase, using the caller-provided id so the
 * same UUID is used locally (optimistic) and in Supabase.
 * Recurrence expansion (multiple rows per series) is handled by
 * eventStore.addUserEvent — this function inserts exactly one row.
 *
 * Returns the inserted event as MockEvent, or undefined on failure / fallback.
 */
export async function insertEvent(event: UserCreatedEvent): Promise<MockEvent | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        id:              event.id,            // client-generated UUID (shared with local copy)
        chapter_id:      DEMO_CHAPTER_ID,
        title:           event.title,
        kind:            event.kind,
        audience:        event.audience,
        event_date:      event.dateString,
        time:            event.time,
        location:        event.location,
        description:     event.description,
        is_recurring:    !!event.seriesId,
        series_id:       event.seriesId ?? null,
        recurrence:      event.recurrence !== 'none' ? event.recurrence : null,
        repeat_until:    event.repeatUntil ?? null,
        created_by_role: event.createdByRole,
      })
      .select()
      .single();

    if (error) {
      console.warn('[eventService] insertEvent error:', error.message);
      return undefined;
    }
    return rowToMockEvent(data as EventRow);
  } catch (err) {
    console.warn('[eventService] insertEvent threw:', err);
    return undefined;
  }
}

/**
 * Delete a single event by UUID (also cascades to its rsvps rows).
 * Returns true if the delete succeeded (or there was nothing to delete).
 */
export async function removeEvent(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('chapter_id', DEMO_CHAPTER_ID);

    if (error) {
      console.warn('[eventService] removeEvent error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[eventService] removeEvent threw:', err);
    return false;
  }
}

/**
 * Delete all events belonging to a recurring series.
 * The ON DELETE CASCADE in the schema handles rsvp cleanup automatically.
 * Returns true if the delete succeeded.
 */
export async function removeEventSeries(seriesId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('series_id', seriesId)
      .eq('chapter_id', DEMO_CHAPTER_ID);

    if (error) {
      console.warn('[eventService] removeEventSeries error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[eventService] removeEventSeries threw:', err);
    return false;
  }
}

// ─── Re-export converter (used by future wiring layers) ───────────────────────
export { rowToMockEvent, rowToUserCreatedEvent };
