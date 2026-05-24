/**
 * eventDefaults/mockEventDefaults.ts — per-event-type automation defaults.
 * PROTOTYPE / mock. Lets an org set, once, what each event TYPE auto-generates
 * (agenda + template sections, attendance task, RSVP). The first-run flow asks
 * per-event; this is the persistent "set the rules once" version. In-memory only
 * (no schema). Mirrors the "all power to the user, sensible defaults" principle.
 */

import { useSyncExternalStore } from 'react';

export const AGENDA_SECTIONS = ['Old business', 'New business', 'Officer announcements', 'Help needed', 'Unresolved items'] as const;

export interface EventTypeDefaults {
  autoAgenda:     boolean;
  agendaSections: string[];
  autoAttendance: boolean;
  autoRsvp:       boolean;
}

export interface EventTypeDef { id: string; label: string }
export const EVENT_TYPES: EventTypeDef[] = [
  { id: 'chapter',      label: 'Chapter meeting' },
  { id: 'eboard',       label: 'E-board meeting' },
  { id: 'social',       label: 'Social' },
  { id: 'philanthropy', label: 'Philanthropy' },
  { id: 'recruitment',  label: 'Recruitment' },
  { id: 'academic',     label: 'Academic' },
  { id: 'risk',         label: 'Risk' },
  { id: 'other',        label: 'Other' },
];

function seed(): Record<string, EventTypeDefaults> {
  const meeting = (): EventTypeDefaults => ({ autoAgenda: true, agendaSections: [...AGENDA_SECTIONS.slice(0, 4)], autoAttendance: true, autoRsvp: true });
  const plain = (rsvp: boolean): EventTypeDefaults => ({ autoAgenda: false, agendaSections: [], autoAttendance: false, autoRsvp: rsvp });
  return {
    chapter:      meeting(),
    eboard:       meeting(),
    social:       plain(true),
    philanthropy: plain(true),
    recruitment:  plain(false),
    academic:     plain(false),
    risk:         plain(false),
    other:        plain(false),
  };
}

let _defaults = seed();
const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

export function getDefaults(typeId: string): EventTypeDefaults {
  return _defaults[typeId] ?? { autoAgenda: false, agendaSections: [], autoAttendance: false, autoRsvp: false };
}

export function setDefault<K extends keyof EventTypeDefaults>(typeId: string, key: K, value: EventTypeDefaults[K]): void {
  _defaults = { ..._defaults, [typeId]: { ...getDefaults(typeId), [key]: value } };
  _notify();
}

export function toggleSection(typeId: string, section: string): void {
  const cur = getDefaults(typeId).agendaSections;
  const next = cur.includes(section) ? cur.filter(s => s !== section) : [...cur, section];
  setDefault(typeId, 'agendaSections', next);
}

export function resetEventDefaults(): void { _defaults = seed(); _notify(); }

/** One-line summary of what a type generates, for compact display. */
export function summarize(typeId: string): string {
  const d = getDefaults(typeId);
  const parts: string[] = [];
  if (d.autoAgenda)     parts.push(`agenda (${d.agendaSections.length})`);
  if (d.autoAttendance) parts.push('attendance');
  if (d.autoRsvp)       parts.push('RSVP');
  return parts.length ? parts.join(' · ') : 'nothing auto-generated';
}

export function useEventDefaultsVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
