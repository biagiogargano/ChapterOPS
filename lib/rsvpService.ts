/**
 * rsvpService.ts — thin Supabase adapter for the rsvps table.
 *
 * Rules (mirror eventService.ts):
 *  - Never throws. Returns safe defaults / void on failure.
 *  - UUID-guarded: rsvps.event_id is a FK to events.id (uuid), so we only call
 *    Supabase when the eventId is itself a UUID. Mock ids ('e1', 'uce_...')
 *    skip the network entirely.
 *  - rsvpStore remains the canonical reactive store. This module only:
 *      (a) hydrates the store from Supabase when an event mounts
 *      (b) writes through to Supabase after the optimistic local update
 *  - No auth, no RLS, no AI, no Google Docs.
 */

import { supabase } from './supabase';
import type { RsvpEntry, RsvpStatus } from './rsvpStore';

// ─── Guards ───────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(s: string): boolean { return UUID_RE.test(s); }

function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('/rest/v1') &&
    key.length > 10
  );
}

// ─── Row shape (matches events_schema.sql · rsvps table) ──────────────────────

interface RsvpRow {
  id:         string;
  event_id:   string;
  role:       string;
  status:     RsvpStatus;
  excuse:     string | null;
  covering:   string | null;
  date_name:  string | null;
  updated_at: string;        // ISO timestamptz
}

// ─── Converters ───────────────────────────────────────────────────────────────

/** Format an ISO timestamp as "h:mm AM" — matches the local store's `_ts()`. */
function isoToTimeOfDay(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch { return ''; }
}

function rowToEntry(row: RsvpRow): RsvpEntry {
  return {
    eventId:   row.event_id,
    role:      row.role,
    status:    row.status,
    excuse:    row.excuse   ?? '',
    covering:  row.covering ?? '',
    dateName:  row.date_name ?? '',
    updatedAt: isoToTimeOfDay(row.updated_at),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch every RSVP row for one event. Returns [] if id isn't a UUID,
 * Supabase isn't configured, or the request fails.
 */
export async function fetchRsvpsForEvent(eventId: string): Promise<RsvpEntry[]> {
  if (!isUUID(eventId))         return [];
  if (!isSupabaseConfigured())  return [];
  try {
    const { data, error } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      console.warn('[rsvpService] fetchRsvpsForEvent error:', error.message);
      return [];
    }
    return (data as RsvpRow[]).map(rowToEntry);
  } catch (err) {
    console.warn('[rsvpService] fetchRsvpsForEvent threw:', err);
    return [];
  }
}

/**
 * Upsert a single RSVP row (event_id + role is the unique key).
 * Fire-and-forget from the caller's perspective — never throws.
 * Silently no-ops for non-UUID event ids (mock/session events).
 */
export async function upsertRsvp(
  eventId: string,
  role:    string,
  entry:   Pick<RsvpEntry, 'status' | 'excuse' | 'covering' | 'dateName'>,
): Promise<void> {
  if (!isUUID(eventId))        return;
  if (!isSupabaseConfigured()) return;
  try {
    // .select() returns the written row so a silent reject (empty array, e.g. RLS)
    // can be surfaced as a warning.
    const { data, error } = await supabase
      .from('rsvps')
      .upsert(
        {
          event_id:   eventId,
          role,
          status:     entry.status,
          excuse:     entry.excuse   || null,
          covering:   entry.covering || null,
          date_name:  entry.dateName || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,role' },
      )
      .select();

    if (error) {
      console.warn('[rsvpService] upsert error:', error.message);
    } else if (!data || data.length === 0) {
      console.warn('[rsvpService] upsert wrote no rows — possible RLS reject on rsvps');
    }
  } catch (err) {
    console.warn('[rsvpService] upsert threw:', err);
  }
}
