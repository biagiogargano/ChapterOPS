/**
 * agendaDocumentService.ts — thin client adapter for the editable meeting agenda.
 *
 * Wraps the three SECURITY DEFINER RPCs applied on alpha
 * (supabase/agenda_documents_patch_draft.sql):
 *   • get_agenda_for_event(p_event_id)        → the agenda row (any active member)
 *   • upsert_agenda_document(p_event_id, p_title, p_sections, p_generated_from)
 *                                              → uuid (president/pro_consul/annotator)
 *   • finalize_agenda_document(p_event_id)     → timestamptz (leadership; locks it)
 *
 * Mirrors lib/goalService + lib/reportSubmissionService:
 *   • never throws — returns safe defaults (null / { ok:false });
 *   • no-ops when Supabase is unconfigured (preserves flag-off / dev behavior);
 *   • a FAILED read is distinguishable from "no agenda" (ok flag), so the UI can show a
 *     real error instead of a misleading empty state.
 *
 * The `sections` payload is a lib/agendaDocument.AgendaDocument (assembled by
 * assembleAgendaDocument, then edited). Stored verbatim as jsonb; read back as an object.
 */

import { supabase } from './supabase';
import { isSupabaseConfigured } from './memberService';
import type { AgendaDocument } from './agendaDocument';

/** One agenda document as returned by get_agenda_for_event. */
export interface AgendaDocumentRow {
  id:            string;
  orgId:         string;
  eventId:       string | null;
  title:         string;
  /** The editable document (jsonb). Raw object; validate shape before relying on it. */
  sections:      AgendaDocument;
  /** Provenance snapshot of what was auto-derived at generate time (jsonb), or null. */
  generatedFrom: unknown;
  /** ISO timestamp when finalized (locked), or null if still editable. */
  finalizedAt:   string | null;
  updatedAt:     string;
}

/** Result of an agenda READ — ok distinguishes a failed read from "no agenda yet". */
export interface AgendaReadResult {
  ok:       boolean;
  document: AgendaDocumentRow | null;
  error?:   string;
}

/** Result of an agenda MUTATION (upsert/finalize). */
export interface AgendaMutationResult {
  ok:           boolean;
  id?:          string;
  finalizedAt?: string;
  error?:       string;
}

function mapRow(row: any): AgendaDocumentRow | null {
  if (!row) return null;
  const sections = (row.sections && typeof row.sections === 'object')
    ? (row.sections as AgendaDocument)
    : ({ v: 1, sections: [] } as AgendaDocument);
  return {
    id:            row.id ?? '',
    orgId:         row.org_id ?? '',
    eventId:       row.event_id ?? null,
    title:         row.title ?? 'Meeting Agenda',
    sections,
    generatedFrom: row.generated_from ?? null,
    finalizedAt:   row.finalized_at ?? null,
    updatedAt:     row.updated_at ?? '',
  };
}

/**
 * Read the agenda document for a meeting event. ok:true with document:null means "no
 * agenda yet"; ok:false means the read failed. Unconfigured → ok:true, null (sandbox).
 * Never throws.
 */
export async function getAgendaDocument(eventId: string): Promise<AgendaReadResult> {
  if (!isSupabaseConfigured()) return { ok: true, document: null };
  if (!eventId) return { ok: true, document: null };
  try {
    const { data, error } = await supabase.rpc('get_agenda_for_event', { p_event_id: eventId });
    if (error) { console.warn('[agendaDocumentService] get error:', error.message); return { ok: false, document: null, error: error.message }; }
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, document: mapRow(row) };
  } catch (err) {
    console.warn('[agendaDocumentService] get threw:', err);
    return { ok: false, document: null, error: String(err) };
  }
}

export interface UpsertAgendaInput {
  eventId:        string;
  title:          string;
  sections:       AgendaDocument;
  /** Optional provenance snapshot (what was auto-derived). */
  generatedFrom?: unknown;
}

/**
 * Create or update the agenda for an event (leadership/annotator; the RPC enforces it
 * and refuses edits to a finalized agenda). Returns { ok, id } or a safe failure. Never
 * throws.
 */
export async function upsertAgendaDocument(input: UpsertAgendaInput): Promise<AgendaMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'unconfigured' };
  if (!input.eventId) return { ok: false, error: 'missing_event' };
  if (!input.sections || typeof input.sections !== 'object') return { ok: false, error: 'invalid_sections' };
  try {
    const { data, error } = await supabase.rpc('upsert_agenda_document', {
      p_event_id:       input.eventId,
      p_title:          input.title ?? '',
      p_sections:       input.sections,
      p_generated_from: input.generatedFrom ?? null,
    });
    if (error) { console.warn('[agendaDocumentService] upsert error:', error.message); return { ok: false, error: error.message }; }
    const id = typeof data === 'string' ? data : (Array.isArray(data) ? data[0] : undefined);
    return { ok: true, id: id ?? undefined };
  } catch (err) {
    console.warn('[agendaDocumentService] upsert threw:', err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Finalize (lock) the agenda for an event (leadership/annotator). Returns { ok,
 * finalizedAt } or a safe failure. Idempotent server-side (keeps the first finalize
 * time). Never throws.
 */
export async function finalizeAgendaDocument(eventId: string): Promise<AgendaMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'unconfigured' };
  if (!eventId) return { ok: false, error: 'missing_event' };
  try {
    const { data, error } = await supabase.rpc('finalize_agenda_document', { p_event_id: eventId });
    if (error) { console.warn('[agendaDocumentService] finalize error:', error.message); return { ok: false, error: error.message }; }
    const at = typeof data === 'string' ? data : (Array.isArray(data) ? data[0] : undefined);
    return { ok: true, finalizedAt: at ?? undefined };
  } catch (err) {
    console.warn('[agendaDocumentService] finalize threw:', err);
    return { ok: false, error: String(err) };
  }
}
