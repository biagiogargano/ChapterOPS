/**
 * templatePackView.ts — pure "which built-in event templates does this org's pack
 * ship?" view, read through the active starter pack.
 *
 * The event-template picker historically lists ALL built-in EVENT_TEMPLATES merged
 * with the org's local custom templates. This module is the pack-aware read side:
 * a pack's built-in templates are EVENT_TEMPLATES filtered to the pack's
 * `defaultEventTemplateIds`, in the pack's listed order. For the Sigma Chi alpha the
 * pack lists exactly EVENT_TEMPLATES (all 5, same order), so the result is IDENTICAL
 * to today. A pack that lists NO template ids falls back to the full built-in set
 * (an unconfigured pack doesn't hide templates).
 *
 * IMPORTANT — behavior-identical seam: this only affects which BUILT-IN options are
 * listed. It does NOT change template RESOLUTION (getTemplateById /
 * buildTasksForTemplateId stay able to resolve ANY built-in or custom id, so no
 * existing task/event breaks), custom-template merging, or generated-task behavior.
 * Generic EXAMPLE templates (lib/genericEventTemplates) are NOT in EVENT_TEMPLATES,
 * so they can never appear here.
 *
 * PURE: no React, no stores, no I/O. Custom templates are passed in by the caller
 * (the store stays the owner of custom state); this module never reaches into it.
 */

import { EVENT_TEMPLATES, NO_TEMPLATE, type EventTaskTemplate } from './eventTemplates';
import { activeStarterPack } from './starterPacks';
import type { SetupPack } from './rolePack';

/** Built-in templates a starter pack ships, in pack order. Empty pack list → all. */
export function eventTemplatesForStarterPack(pack: SetupPack): EventTaskTemplate[] {
  const ids = pack.rolePack.defaultEventTemplateIds;
  if (!ids || ids.length === 0) return [...EVENT_TEMPLATES];   // unconstrained → all built-ins
  // Filter to the pack's ids, preserving the pack's listed order; drop any id that
  // isn't a real built-in (fail safe — never invents a template).
  const byId = new Map(EVENT_TEMPLATES.map(t => [t.id, t]));
  const out: EventTaskTemplate[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) out.push(t);
  }
  return out;
}

/** The built-in template ids a starter pack ships (ids only). */
export function eventTemplateIdsForStarterPack(pack: SetupPack): string[] {
  return eventTemplatesForStarterPack(pack).map(t => t.id);
}

/** Built-in templates for an org `template` value (unknown/missing → sigma_chi). */
export function getBuiltInEventTemplatesForOrgTemplate(template?: string | null): EventTaskTemplate[] {
  return eventTemplatesForStarterPack(activeStarterPack(template));
}

/**
 * Picker options for an org template: "None" sentinel, then the pack's built-in
 * templates, then the caller-supplied custom templates (preserving today's
 * built-ins-before-custom order). Pure — the caller passes custom templates (e.g.
 * from customTemplatesStore.getCustomTemplates()).
 */
export function getTemplateOptionsForOrgTemplate(
  template: string | null | undefined,
  customTemplates: EventTaskTemplate[] = [],
): { id: string; label: string }[] {
  const builtIns = getBuiltInEventTemplatesForOrgTemplate(template);
  return [
    { id: NO_TEMPLATE, label: 'None' },
    ...builtIns.map(t => ({ id: t.id, label: t.label })),
    ...customTemplates.map(t => ({ id: t.id, label: t.label })),
  ];
}
