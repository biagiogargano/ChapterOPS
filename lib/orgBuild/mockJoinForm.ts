/**
 * orgBuild/mockJoinForm.ts — configurable "join via link" form.
 * PROTOTYPE / mock. The owner toggles which questions to ask people when they
 * join via an invite link, and which are required. Joiners fill it and land in
 * the roster. In-memory only (no real link/schema). Easier than adding everyone
 * by hand for larger groups.
 */

import { useSyncExternalStore } from 'react';

export interface JoinField {
  id:       string;
  label:    string;
  enabled:  boolean;
  required: boolean;
  /** Always asked + required; can't be turned off (e.g. name). */
  locked?:  boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
}

let _fields: JoinField[] = [
  { id: 'name',        label: 'Full name',           enabled: true,  required: true,  locked: true },
  { id: 'email',       label: 'Email',               enabled: true,  required: true,  keyboard: 'email-address' },
  { id: 'phone',       label: 'Phone number',        enabled: true,  required: false, keyboard: 'phone-pad' },
  { id: 'position',    label: 'Position / role',     enabled: true,  required: true },
  { id: 'pledgeClass', label: 'Pledge class / year', enabled: true,  required: false },
  { id: 'major',       label: 'Major',               enabled: false, required: false },
];

/** Mock shareable invite code/link. */
export const INVITE_CODE = 'SIGMA-7K2';
export const INVITE_LINK = `chapterops.app/join/${INVITE_CODE}`;

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

export function getJoinFields(): JoinField[] { return _fields; }
export function enabledJoinFields(): JoinField[] { return _fields.filter(f => f.enabled); }

export function toggleEnabled(id: string): void {
  _fields = _fields.map(f => f.locked || f.id !== id ? f : { ...f, enabled: !f.enabled, required: !f.enabled ? f.required : false });
  _notify();
}

export function toggleRequired(id: string): void {
  _fields = _fields.map(f => f.locked || f.id !== id || !f.enabled ? f : { ...f, required: !f.required });
  _notify();
}

export function useJoinFormVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
