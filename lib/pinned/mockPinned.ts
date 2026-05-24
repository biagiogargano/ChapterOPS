/**
 * pinned/mockPinned.ts — user-customizable "pinned" shortcuts (prototype).
 * PROTOTYPE / mock. Backs a Pinned tab: quick access to things you use a lot —
 * e.g. your weekly report. Add/remove freely. Conceptually role-gated (not
 * everyone needs it). In-memory only; no schema. Feature branch.
 */

import { useSyncExternalStore } from 'react';

export interface PinItem { id: string; title: string; sub: string; route: string }

/** Everything that can be pinned (the catalog the "+ Add" sheet picks from). */
export const PINNABLE: PinItem[] = [
  { id: 'report',  title: 'Weekly report',   sub: 'Fill out & submit your report', route: '/report/weekly' },
  { id: 'inbox',   title: 'Reports review',  sub: 'Who submitted / who is missing', route: '/report/inbox' },
  { id: 'agenda',  title: 'Meeting agenda',  sub: 'Auto-drafted agenda',            route: '/agenda' },
  { id: 'attend',  title: 'Attendance',      sub: 'Attendance tasks for meetings',  route: '/attendance' },
  { id: 'poll',    title: 'Quick poll',      sub: 'Chapter vote',                   route: '/poll' },
  { id: 'announce',title: 'Announcements',   sub: 'Chapter notices',                route: '/announcements' },
  { id: 'leaders', title: 'Leadership tree', sub: 'Reporting + delegation',         route: '/leadership' },
  { id: 'roster',  title: 'Members',         sub: 'Roster & positions',             route: '/roster' },
];

let _pinnedIds: string[] = ['report'];   // weekly report pinned by default

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

export function getPinned(): PinItem[] {
  return _pinnedIds.map(id => PINNABLE.find(p => p.id === id)).filter((p): p is PinItem => !!p);
}
export function isPinned(id: string): boolean { return _pinnedIds.includes(id); }

export function pin(id: string): void {
  if (!_pinnedIds.includes(id) && PINNABLE.some(p => p.id === id)) { _pinnedIds = [..._pinnedIds, id]; _notify(); }
}
export function unpin(id: string): void {
  _pinnedIds = _pinnedIds.filter(x => x !== id);
  _notify();
}

export function usePinnedVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
