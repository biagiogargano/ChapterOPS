/**
 * Shared RSVP + response store — module-level, survives navigation within a session.
 *
 * Pass E: added reactive subscription via useRsvpEntry / useRsvpVersion hooks so
 * any call to setRsvpEntry immediately re-renders all subscribed components across
 * every screen — no more stale RSVP status after navigating between tabs.
 */

import { useEffect, useReducer } from 'react';
import { fetchRsvpsForEvent, upsertRsvp } from './rsvpService';

/**
 *
 * KEY CHANGE (Pass D): Keyed by "eventId::role" — NOT eventTitle — so every
 * recurring instance of the same event ("Chapter Meeting" on May 26 vs June 2)
 * gets its own independent RSVP slot.
 *
 * Callers must pass the unique event instance ID (MockEvent.id / UserCreatedEvent.id)
 * rather than the event title.  For seed events the IDs are 'e1'…'e4'.
 */

export type RsvpStatus = 'no_response' | 'attending' | 'not_attending';

export interface RsvpEntry {
  eventId:    string;   // unique event instance ID (was: eventTitle)
  role:       string;
  status:     RsvpStatus;
  excuse:     string;
  covering:   string;
  dateName:   string;   // for "submit date name" tasks (Date Party)
  updatedAt:  string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const _store: Record<string, RsvpEntry> = {};

function _key(eventId: string, role: string): string {
  return `${eventId}::${role}`;
}

function _ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Read one entry; returns a default no_response entry if not found. */
export function getRsvpEntry(eventId: string, role: string): RsvpEntry {
  return (
    _store[_key(eventId, role)] ?? {
      eventId,
      role,
      status:    'no_response',
      excuse:    '',
      covering:  '',
      dateName:  '',
      updatedAt: '',
    }
  );
}

/**
 * Internal: merge patch into the entry and bump updatedAt. NO _notify, NO
 * Supabase write. Used by both setRsvpEntry (which adds those) and
 * hydrateRsvpsFromSupabase (which must NOT push back to Supabase).
 */
function _writeLocal(
  eventId:    string,
  role:       string,
  patch:      Partial<Pick<RsvpEntry, 'status' | 'excuse' | 'covering' | 'dateName'>>,
  timestamp?: string,
): void {
  const k   = _key(eventId, role);
  const cur = getRsvpEntry(eventId, role);
  _store[k] = { ...cur, ...patch, updatedAt: timestamp ?? _ts() };
}

/**
 * Merge partial updates into an entry, creating it if absent.
 * Optimistic flow:
 *   1. mutate local store synchronously
 *   2. notify subscribers — every screen using useRsvpEntry/useRsvpVersion
 *      re-renders instantly
 *   3. fire-and-forget write-through to Supabase (no await; service guards
 *      UUID + config, never throws). Local state is the source of truth even
 *      if the network call fails.
 */
export function setRsvpEntry(
  eventId: string,
  role:    string,
  patch:   Partial<Pick<RsvpEntry, 'status' | 'excuse' | 'covering' | 'dateName'>>,
): void {
  _writeLocal(eventId, role, patch);
  _notify();

  // Push the full merged state, not just the patch — Supabase upsert needs
  // every column or it would null-out fields not in the partial.
  const full = getRsvpEntry(eventId, role);
  void upsertRsvp(eventId, role, {
    status:   full.status,
    excuse:   full.excuse,
    covering: full.covering,
    dateName: full.dateName,
  });
}

/**
 * One-shot hydrate: load every Supabase RSVP row for one event into the local
 * store, then notify subscribers once at the end.
 *
 * Skip-if-present rule: any local entry already in _store wins. This protects
 * the user's optimistic writes from being clobbered by a slightly stale
 * Supabase row, AND keeps the demo seed (e1/e2/e3 mock roster) intact for
 * non-UUID events.
 *
 * No-op for non-UUID event ids (service short-circuits).
 */
export async function hydrateRsvpsFromSupabase(eventId: string): Promise<void> {
  const rows = await fetchRsvpsForEvent(eventId);
  if (rows.length === 0) return;

  let touched = 0;
  for (const r of rows) {
    const k = _key(r.eventId, r.role);
    if (k in _store) continue;   // local write wins
    _store[k] = r;
    touched++;
  }
  if (touched > 0) _notify();
}

/**
 * All non-default entries for a specific event instance.
 * Used by leadership views to see who responded and how.
 */
export function getAllRsvpsForEvent(eventId: string): RsvpEntry[] {
  return Object.values(_store).filter(
    e => e.eventId === eventId && (e.status !== 'no_response' || e.dateName !== ''),
  );
}

// ─── Demo seed ────────────────────────────────────────────────────────────────

type Seed = {
  role:       string;
  status:     RsvpStatus;
  excuse?:    string;
  covering?:  string;
  dateName?:  string;
  updatedAt?: string;
};

function _seed(eventId: string, entries: Seed[]): void {
  for (const e of entries) {
    const k = _key(eventId, e.role);
    _store[k] = {
      eventId,
      role:      e.role,
      status:    e.status,
      excuse:    e.excuse    ?? '',
      covering:  e.covering  ?? '',
      dateName:  e.dateName  ?? '',
      updatedAt: e.updatedAt ?? '',
    };
  }
}

// Seed uses event IDs (e1=Chapter Meeting, e2=E-Board Meeting, e3=Date Party)

// e2 — E-Board Meeting
_seed('e2', [
  { role: 'president',         status: 'attending',     updatedAt: '8:00 AM' },
  { role: 'pro_consul',        status: 'attending',     updatedAt: '8:07 AM' },
  { role: 'annotator',         status: 'attending',     updatedAt: '9:00 AM' },
  { role: 'risk_manager',      status: 'attending',     updatedAt: '9:15 AM' },
  { role: 'social_chair',      status: 'attending',     updatedAt: '9:30 AM' },
  {
    role:      'recruitment_chair',
    status:    'not_attending',
    excuse:    'University recruiting fair conflict.',
    covering:  'Dylan Park',
    updatedAt: '10:00 AM',
  },
]);

// e1 — Chapter Meeting
_seed('e1', [
  { role: 'president',         status: 'attending',     updatedAt: '8:05 AM' },
  { role: 'pro_consul',        status: 'attending',     updatedAt: '8:12 AM' },
  { role: 'annotator',         status: 'attending',     updatedAt: '8:30 AM' },
  { role: 'risk_manager',      status: 'not_attending', excuse: 'Lab final exam from 6–9 PM.',       updatedAt: '9:20 AM' },
  { role: 'social_chair',      status: 'attending',     updatedAt: '9:45 AM' },
  { role: 'recruitment_chair', status: 'not_attending', excuse: 'Out-of-state family obligation.',   updatedAt: '10:01 AM' },
]);

// e3 — Date Party
_seed('e3', [
  { role: 'president',    status: 'attending', dateName: 'Sofia Reyes',  updatedAt: '9:12 AM' },
  { role: 'pro_consul',   status: 'attending', dateName: 'Jordan Liu',   updatedAt: '9:45 AM' },
  { role: 'risk_manager', status: 'attending', dateName: 'Emma Vasquez', updatedAt: '10:03 AM' },
  { role: 'social_chair', status: 'attending', dateName: 'Priya Sharma', updatedAt: '10:31 AM' },
]);

// ─── Reactive subscription ─────────────────────────────────────────────────────
//
// _listeners holds callbacks registered by useRsvpEntry / useRsvpVersion.
// _notify() is called inside setRsvpEntry so every subscribed component re-renders
// immediately after any RSVP write — regardless of which screen performed the write.

const _listeners = new Set<() => void>();

function _notify(): void {
  for (const fn of _listeners) fn();
}

/** Register a callback that fires after every setRsvpEntry call. Returns unsubscribe. */
export function subscribeToRsvpChanges(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/**
 * Reactive hook — returns the current RsvpEntry for (eventId, role) and
 * re-renders the calling component whenever setRsvpEntry is called anywhere.
 *
 * Replaces the anti-pattern:  useState(() => getRsvpEntry(eid, role).status)
 * Which only captures status once at mount and never reflects later changes.
 */
export function useRsvpEntry(eventId: string, role: string): RsvpEntry {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeToRsvpChanges(tick), []);
  return getRsvpEntry(eventId, role);
}

/**
 * Re-renders the calling component whenever any RSVP entry changes.
 * Use in components that display multiple RSVP entries (roster views, summary bars).
 */
export function useRsvpVersion(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeToRsvpChanges(tick), []);
}
