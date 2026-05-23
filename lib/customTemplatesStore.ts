/**
 * customTemplatesStore.ts — user-built event templates (v1: local).
 *
 * Lets officers create/edit/delete their own event→task templates in the app.
 * v1 persists LOCALLY (AsyncStorage, per device) — no schema, no backend. A
 * later phase can swap this storage layer for a Supabase table so templates are
 * shared org-wide; the builder UI and the merge/resolve API stay the same.
 *
 * In-memory model + reactive notify (mirrors devTaskStore): reads are synchronous
 * off `_custom`; writes update memory, notify subscribers, then persist async
 * (fire-and-forget). Built-in templates (lib/eventTemplates) remain read-only
 * defaults; this module MERGES built-in + custom for pickers and resolution.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useReducer } from 'react';
import {
  EVENT_TEMPLATES,
  NO_TEMPLATE,
  buildTasksFromTemplateObject,
  type EventTaskTemplate,
  type EventTemplateInput,
} from './eventTemplates';
import type { MockTask } from './mockTasks';

const STORAGE_KEY = 'chapterops.customTemplates';

let _custom: EventTaskTemplate[] = [];

// ─── Reactive subscription ──────────────────────────────────────────────────
const _listeners = new Set<() => void>();
function _notify(): void { for (const fn of _listeners) fn(); }

export function subscribeToCustomTemplates(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** Re-render the caller whenever the custom-template set changes. */
export function useCustomTemplatesVersion(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeToCustomTemplates(tick), []);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Load persisted custom templates into memory (call once at startup). */
export async function hydrateCustomTemplates(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) { _custom = parsed; _notify(); }
  } catch { /* ignore corrupt/unavailable storage — fall back to empty */ }
}

function _persist(): void {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_custom));
}

// ─── CRUD (synchronous in-memory + async persist) ─────────────────────────────

export function getCustomTemplates(): EventTaskTemplate[] {
  return _custom;
}

/** Deterministic-ish unique id for a new custom template. */
export function newCustomTemplateId(): string {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Create or update a custom template (matched by id). */
export function saveCustomTemplate(t: EventTaskTemplate): void {
  const i = _custom.findIndex(x => x.id === t.id);
  if (i >= 0) _custom = _custom.map(x => (x.id === t.id ? t : x));
  else        _custom = [..._custom, t];
  _notify();
  _persist();
}

export function deleteCustomTemplate(id: string): void {
  _custom = _custom.filter(x => x.id !== id);
  _notify();
  _persist();
}

// ─── Merge / resolve (built-in + custom) ──────────────────────────────────────

export function getMergedTemplates(): EventTaskTemplate[] {
  return [...EVENT_TEMPLATES, ..._custom];
}

export function getTemplateById(id: string): EventTaskTemplate | undefined {
  return getMergedTemplates().find(t => t.id === id);
}

export function isBuiltInTemplate(id: string): boolean {
  return EVENT_TEMPLATES.some(t => t.id === id);
}

/** Picker options across built-in + custom, with the "None" sentinel first. */
export function mergedTemplateOptions(): { id: string; label: string }[] {
  return [{ id: NO_TEMPLATE, label: 'None' }, ...getMergedTemplates().map(t => ({ id: t.id, label: t.label }))];
}

/** Resolve any template id (built-in or custom) and build its tasks. Pure-ish. */
export function buildTasksForTemplateId(id: string, event: EventTemplateInput): MockTask[] {
  const t = getTemplateById(id);
  return t ? buildTasksFromTemplateObject(t, event) : [];
}

/** Reset (org transition / tests). Clears memory + notifies; leaves listeners. */
export function resetCustomTemplates(): void {
  _custom = [];
  _notify();
}
