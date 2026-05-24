/**
 * permissions/mockPermissions.ts — UI-only mock for the org-owner permission
 * matrix. PROTOTYPE ONLY (see SPEC_PERMISSIONS_CUSTOMIZATION.md).
 *
 * ⚠️ ENFORCES NOTHING. This is an in-memory model so the owner can SEE and tune
 * who-can-view/edit-what, to validate the UX. Real enforcement needs auth + RLS
 * (deferred). Not wired into phase-2 / the alpha.
 */

import { useSyncExternalStore } from 'react';
import type { Role } from '@/lib/roles';

/** Google-Docs-style access ladder. */
export type AccessLevel = 'none' | 'view' | 'edit' | 'manage';

export const ACCESS_ORDER: AccessLevel[] = ['none', 'view', 'edit', 'manage'];
export const ACCESS_LABEL: Record<AccessLevel, string> = {
  none: 'No access', view: 'View', edit: 'Edit', manage: 'Manage',
};

/** Grantable surfaces (resources). */
export interface ResourceDef { id: string; label: string; }
export const RESOURCES: ResourceDef[] = [
  { id: 'events',     label: 'Events' },
  { id: 'tasks',      label: 'Tasks' },
  { id: 'reports',    label: 'Weekly reports' },
  { id: 'agenda',     label: 'Meeting agenda' },
  { id: 'leadership', label: 'Leadership tree' },
  { id: 'questions',  label: 'Report questions' },
  { id: 'templates',  label: 'Templates' },
  { id: 'members',    label: 'Members / roster' },
  { id: 'permissions',label: 'Permissions' },
];

/** Roles shown as columns (subjects). Owner row is implicit (always manage). */
export const SUBJECT_ROLES: Role[] = [
  'pro_consul', 'annotator', 'risk_manager', 'social_chair', 'recruitment_chair', 'brother',
];

/** The owner role (always full manage; can't be locked out). */
export const OWNER_ROLE: Role = 'president';

type Matrix = Record<string, Partial<Record<Role, AccessLevel>>>; // resourceId → role → level

// Sensible defaults so a new org is usable before any tuning.
function defaultMatrix(): Matrix {
  const m: Matrix = {};
  for (const r of RESOURCES) {
    m[r.id] = {};
    for (const role of SUBJECT_ROLES) {
      // Officers edit operational surfaces; brothers view; sensitive surfaces locked.
      const officer = role !== 'brother';
      if (r.id === 'permissions')      m[r.id][role] = role === 'pro_consul' ? 'view' : 'none';
      else if (r.id === 'members')     m[r.id][role] = officer ? 'view' : 'none';
      else if (r.id === 'questions')   m[r.id][role] = role === 'annotator' ? 'edit' : (officer ? 'view' : 'none');
      else if (r.id === 'leadership')  m[r.id][role] = role === 'pro_consul' ? 'edit' : 'view';
      else                             m[r.id][role] = officer ? 'edit' : 'view';
    }
  }
  return m;
}

let _matrix: Matrix = defaultMatrix();
const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

/** Effective access for a (resource, role). Owner always manages. */
export function getAccess(resourceId: string, role: Role): AccessLevel {
  if (role === OWNER_ROLE) return 'manage';
  return _matrix[resourceId]?.[role] ?? 'none';
}

/** Owner sets a cell. Owner role can't be downgraded (lockout safeguard). */
export function setAccess(resourceId: string, role: Role, level: AccessLevel): void {
  if (role === OWNER_ROLE) return;            // owner stays manage
  _matrix[resourceId] = { ...(_matrix[resourceId] ?? {}), [role]: level };
  _notify();
}

/** Cycle a cell to the next level (tap-to-advance UX). */
export function cycleAccess(resourceId: string, role: Role): void {
  const cur = getAccess(resourceId, role);
  const next = ACCESS_ORDER[(ACCESS_ORDER.indexOf(cur) + 1) % ACCESS_ORDER.length];
  setAccess(resourceId, role, next);
}

export function resetPermissions(): void { _matrix = defaultMatrix(); _notify(); }

export function usePermissionsVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
