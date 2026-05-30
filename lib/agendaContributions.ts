/**
 * agendaContributions.ts — pure extraction of meeting-agenda contributions from
 * structured-response answers (FOUNDATION ONLY).
 *
 * The strategic loop (Operating Guide step 6) has meeting agendas eventually
 * pulling announcements + help-needed items from submitted reports. This module is
 * the deterministic, store-agnostic seam for that: given a definition + a
 * submission's answers, it returns the agenda-bound answers, grouped by the
 * section each question is tagged for (StructuredQuestion.agendaSection).
 *
 * ⚠️ NOT WIRED. Nothing renders this yet. Live integration into the agenda screen
 *    (app/agenda/[eventId].tsx) is deliberately deferred — it needs async fetching
 *    of every officer's submission and on-device verification of the report RPC
 *    round-trip first. This is the pure half, fully testable in isolation.
 *
 * Pure: no React, no stores, no Supabase, no I/O. Never throws. GENERIC — any
 * definition that tags questions with `agendaSection` contributes; reports are
 * just the first caller.
 */

import {
  isAnswered,
  orderedQuestions,
  type AgendaContributionSection,
  type StructuredAnswerMap,
  type StructuredResponseDefinition,
} from './structuredResponses';

/** One agenda-bound answer pulled from a submission. */
export interface AgendaContribution {
  /** Section this contribution belongs to (from the question's tag). */
  section: AgendaContributionSection;
  /** The question key it came from (stable; useful for keys/dedup). */
  questionKey: string;
  /** The submitter's text. Trimmed; always non-empty (empties are dropped). */
  text: string;
  /**
   * Optional attribution the caller supplies (e.g. an officer role label). Carried
   * through verbatim so the agenda can show "— Social Chair"; omitted when unknown.
   */
  source?: string;
}

export interface ExtractContributionsInput {
  definition: StructuredResponseDefinition;
  answers:    StructuredAnswerMap;
  /** Optional attribution stamped onto every contribution from this submission. */
  source?:    string;
}

/**
 * Pull the agenda-bound contributions from one submission, in the definition's
 * display order. A question contributes iff:
 *   • it carries an `agendaSection` tag, AND
 *   • it is genuinely answered with text (a "No update" / blank answer contributes
 *     nothing — quiet weeks don't clutter the agenda).
 * Pure; never throws; returns [] when nothing qualifies.
 */
export function extractAgendaContributions(
  input: ExtractContributionsInput,
): AgendaContribution[] {
  const { definition, answers, source } = input;
  const out: AgendaContribution[] = [];

  for (const q of orderedQuestions(definition)) {
    if (!q.agendaSection) continue;
    const a = answers[q.key];
    // Tagged + answered, but a "No update" carries no text → skip it.
    if (!isAnswered(q, a) || a?.noUpdate) continue;
    const text = (a?.value ?? '').trim();
    if (text.length === 0) continue;

    out.push({
      section: q.agendaSection,
      questionKey: q.key,
      text,
      ...(source ? { source } : {}),
    });
  }

  return out;
}

/** Contributions for one section only (convenience filter over the above). */
export function contributionsForSection(
  contributions: AgendaContribution[],
  section: AgendaContributionSection,
): AgendaContribution[] {
  return contributions.filter(c => c.section === section);
}

/**
 * Merge contributions from MANY submissions (e.g. every officer's weekly report)
 * into one flat, order-preserving list. Caller passes pre-extracted arrays; this
 * just concatenates, keeping each submission's internal order and the order the
 * submissions were given. Pure.
 */
export function mergeAgendaContributions(
  perSubmission: AgendaContribution[][],
): AgendaContribution[] {
  const out: AgendaContribution[] = [];
  for (const list of perSubmission) out.push(...list);
  return out;
}
