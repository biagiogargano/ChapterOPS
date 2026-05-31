/**
 * agendaDocument.ts — the editable MEETING-AGENDA DOCUMENT model (pure).
 *
 * buildAgenda (events+tasks), agendaGoals (goals needing attention), and
 * agendaContributions (announcements/help-needed from updates) each produce a slice of a
 * meeting agenda. This module composes those slices into ONE ordered, serializable
 * document — the shape that an editable agenda persists as `sections jsonb` (see the DRAFT
 * supabase/agenda_documents_patch_draft.sql). The assembler is the "generate the draft"
 * step; once persisted, leadership edits the same shape.
 *
 * ⚠️ PURE FOUNDATION — NOT WIRED. Defines the model + assembles a draft from already-pure
 *    inputs. It persists NOTHING: durable storage is the DRAFT (unapplied) agenda_documents
 *    table. Until that is applied + a screen wired, this only types + composes. No editor is
 *    faked. No React, no store, no Supabase. Never throws.
 */

import type { Agenda } from './buildAgenda';
import type { AgendaGoalItem } from './agendaGoals';
import { agendaGoalReasonLabel } from './agendaGoals';
import type { GroupedAgendaContributions } from './agendaContributions';

/** Document schema version (stored with the document; bump on a breaking shape change). */
export const AGENDA_DOCUMENT_VERSION = 1 as const;

/** What an item points at, for nav + provenance. 'note' = a manually-added line. */
export type AgendaDocItemKind = 'event' | 'task' | 'goal' | 'contribution' | 'note';

/** One line in an agenda section. Serializable. */
export interface AgendaDocItem {
  /** Stable id within the document (for React keys / edits). */
  id:     string;
  /** The line text. */
  text:   string;
  /** Optional secondary line (time/place/due/attribution). */
  meta?:  string;
  /** Where it came from (drives nav when refId is set; 'note' = manual). */
  kind:   AgendaDocItemKind;
  /** Optional id of the source entity (event/task/goal) for tap-through. */
  refId?: string;
}

/** One section of the agenda document. */
export interface AgendaDocSection {
  /** Stable section key (canonical sections below; custom sections allowed later). */
  key:   string;
  /** Display title (editable). */
  title: string;
  items: AgendaDocItem[];
}

/** The full editable agenda document (what `sections jsonb` stores). */
export interface AgendaDocument {
  v:        typeof AGENDA_DOCUMENT_VERSION;
  sections: AgendaDocSection[];
}

/** Canonical section order + titles for a weekly meeting. Stable keys. */
export const AGENDA_SECTION_DEFS: { key: string; title: string }[] = [
  { key: 'old_business',    title: 'Old Business' },
  { key: 'new_business',    title: 'New Business' },
  { key: 'open_tasks',      title: 'Open Tasks' },
  { key: 'chapter_wide',    title: 'Chapter-Wide Tasks' },
  { key: 'goals_attention', title: 'Goals Needing Attention' },
  { key: 'help_needed',     title: 'Help Needed' },
  { key: 'announcements',   title: 'Announcements' },
];

export interface AssembleAgendaInput {
  /** From buildAgenda (events + tasks). */
  agenda: Agenda;
  /** From agendaGoals.goalsNeedingAttention (optional — omit if goals not fetched). */
  goalsNeedingAttention?: AgendaGoalItem[];
  /** From agendaContributions.groupAgendaContributions (optional — omit if no submissions). */
  contributions?: GroupedAgendaContributions;
  /**
   * Include canonical sections even when empty (a stable editable skeleton). Default true.
   * Set false to omit empty sections (a tight read-only render).
   */
  includeEmpty?: boolean;
}

/**
 * Assemble a fresh agenda-document DRAFT from the pure slices, in canonical section
 * order. Pure; never throws. Item ids are deterministic (`<sectionKey>:<n>`), so the
 * same inputs always yield the same document (stable React keys; diffable).
 */
export function assembleAgendaDocument(input: AssembleAgendaInput): AgendaDocument {
  const includeEmpty = input.includeEmpty !== false;
  const goalsAttn = input.goalsNeedingAttention ?? [];
  const contrib = input.contributions ?? { announcements: [], helpNeeded: [] };

  const itemsByKey: Record<string, AgendaDocItem[]> = {
    old_business:    input.agenda.oldBusiness.map((e, i) => ({ id: `old_business:${i}`,  text: e.title, meta: e.meta, kind: 'event', refId: e.id })),
    new_business:    input.agenda.newBusiness.map((e, i) => ({ id: `new_business:${i}`,  text: e.title, meta: e.meta, kind: 'event', refId: e.id })),
    open_tasks:      input.agenda.unresolved.map((t, i) =>  ({ id: `open_tasks:${i}`,    text: t.title, meta: t.meta, kind: 'task',  refId: t.id })),
    chapter_wide:    input.agenda.brotherWide.map((t, i) => ({ id: `chapter_wide:${i}`,  text: t.title, meta: t.meta, kind: 'task',  refId: t.id })),
    goals_attention: goalsAttn.map((g, i) =>                ({ id: `goals_attention:${i}`, text: g.title, meta: agendaGoalReasonLabel(g.reason), kind: 'goal', refId: g.goalId })),
    help_needed:     contrib.helpNeeded.map((c, i) =>       ({ id: `help_needed:${i}`,   text: c.text, ...(c.source ? { meta: c.source } : {}), kind: 'contribution', refId: c.questionKey })),
    announcements:   contrib.announcements.map((c, i) =>    ({ id: `announcements:${i}`, text: c.text, ...(c.source ? { meta: c.source } : {}), kind: 'contribution', refId: c.questionKey })),
  };

  const sections: AgendaDocSection[] = [];
  for (const def of AGENDA_SECTION_DEFS) {
    const items = itemsByKey[def.key] ?? [];
    if (items.length === 0 && !includeEmpty) continue;
    sections.push({ key: def.key, title: def.title, items });
  }

  return { v: AGENDA_DOCUMENT_VERSION, sections };
}

/** True when an agenda document has no items in any section. Pure. */
export function isAgendaDocumentEmpty(doc: AgendaDocument): boolean {
  return doc.sections.every(s => s.items.length === 0);
}
