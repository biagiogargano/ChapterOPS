/**
 * roster/mockRoster.ts — shared in-memory roster + positions store.
 * PROTOTYPE / UI-first. Models the org's members and their position (role) so the
 * roster editor, settings, and other screens read one source. Mirrors the real
 * members/positions concepts but persists nothing (no schema/RLS/auth). Replaced
 * by Supabase-backed reads/writes in the later, approved schema phase.
 */

import { useSyncExternalStore } from 'react';
import { ROLE_LABELS, ROLE_SWITCHER_OPTIONS, type Role } from '@/lib/roles';

export interface RosterMember {
  id:        string;
  name:      string;
  role:      Role;        // their position
  committee?: string;
}

let _seq = 0;
const mk = (name: string, role: Role, committee?: string): RosterMember =>
  ({ id: `m${_seq++}`, name, role, committee });

let _members: RosterMember[] = [
  mk('Peter Gargano', 'president'),
  mk('Marcus Lee', 'pro_consul'),
  mk('Alex Rivera', 'social_chair', 'Social'),
  mk('Jordan Pike', 'risk_manager', 'Risk'),
  mk('Sam Diaz', 'recruitment_chair', 'Recruitment'),
  mk('Chris Long', 'annotator'),
  mk('Tyler Banks', 'brother'),
  mk('Devin Cole', 'brother'),
  mk('Omar Haddad', 'brother'),
];

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

/** Assignable positions, in display order. */
export const ASSIGNABLE_ROLES: Role[] = ROLE_SWITCHER_OPTIONS;

export function getMembers(): RosterMember[] {
  return _members;
}

export function getMember(id: string): RosterMember | undefined {
  return _members.find(m => m.id === id);
}

/** Members holding a given position (role). */
export function membersWithRole(role: Role): RosterMember[] {
  return _members.filter(m => m.role === role);
}

/** Count per role, for settings/summary surfaces. */
export function roleCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of _members) counts[m.role] = (counts[m.role] ?? 0) + 1;
  return counts;
}

export function setMemberRole(id: string, role: Role): void {
  _members = _members.map(m => (m.id === id ? { ...m, role } : m));
  _notify();
}

export function addMember(name: string, role: Role = 'brother'): void {
  const n = name.trim();
  if (!n) return;
  _members = [..._members, mk(n, role)];
  _notify();
}

export function removeMember(id: string): void {
  _members = _members.filter(m => m.id !== id);
  _notify();
}

/** Label passthrough so screens import one module. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function useRosterVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
