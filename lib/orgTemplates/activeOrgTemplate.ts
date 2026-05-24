/**
 * orgTemplates/activeOrgTemplate.ts — the currently-selected org template.
 * PROTOTYPE / mock. The org-type picker sets this; other onboarding screens read
 * it so the chosen org type actually drives defaults (leader title, suggested
 * roles, event types, report). In-memory; default = fraternity (template #1).
 */

import { useSyncExternalStore } from 'react';
import { ORG_TEMPLATES, getOrgTemplate, type OrgTemplate } from './mockOrgTemplates';

let _activeId = 'fraternity';

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

export function getActiveTemplateId(): string { return _activeId; }
export function getActiveTemplate(): OrgTemplate { return getOrgTemplate(_activeId) ?? ORG_TEMPLATES[0]; }

export function setActiveTemplate(id: string): void {
  if (getOrgTemplate(id)) { _activeId = id; _notify(); }
}

/** Reactive: current template; re-renders on change. */
export function useActiveTemplate(): OrgTemplate {
  useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
  return getActiveTemplate();
}
