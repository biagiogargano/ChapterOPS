/**
 * orgBuild/mockOrgBuild.ts — people invited during org setup.
 * PROTOTYPE / mock. You invite people (name, email, position) BEFORE building the
 * leadership tree, so the tree builder can place real people from your roster
 * instead of typing role names. In-memory only (no real invites/schema).
 */

import { useSyncExternalStore } from 'react';

export interface Invitee {
  id:       string;
  name:     string;
  email:    string;
  position: string;
}

let _seq = 0;
let _invited: Invitee[] = [];

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

export function getInvited(): Invitee[] {
  return _invited;
}

export function addInvite(name: string, email: string, position: string): void {
  const n = name.trim();
  if (!n) return;
  _invited = [..._invited, { id: `inv${_seq++}`, name: n, email: email.trim(), position: position.trim() || 'Member' }];
  _notify();
}

export function removeInvite(id: string): void {
  _invited = _invited.filter(i => i.id !== id);
  _notify();
}

export function clearInvites(): void { _invited = []; _notify(); }

export function useOrgBuildVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
