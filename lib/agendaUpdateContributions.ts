/**
 * agendaUpdateContributions.ts — turn a cycle's goal-update SUBMISSIONS into grouped agenda
 * contributions (announcements + help-needed). Pure.
 *
 * This is the missing glue between the (drafted) submissions read path
 * (reportSubmissionService.listSubmissionsForOrgCycle) and the agenda document
 * (lib/agendaDocument). On apply of list_submissions_for_org_cycle, the agenda compiler will:
 *   list → agendaContributionsFromSubmissions(list) → assembleAgendaDocument({ contributions })
 *
 * Each submission carries its own durable DEFINITION SNAPSHOT (lib/goalUpdateSnapshot), which
 * tells us which questions are agenda-tagged — so we can extract contributions WITHOUT fetching
 * each role's current goals. A submission with no snapshot is skipped (we can't attribute its
 * questions without goals) — honest omission, never faked.
 *
 * ⚠️ PURE. No React/store/Supabase/I/O. Never throws.
 */

import { definitionFromSnapshot } from './goalUpdateSnapshot';
import {
  extractAgendaContributions, mergeAgendaContributions, groupAgendaContributions,
  type GroupedAgendaContributions,
} from './agendaContributions';
import type { OfficerUpdateLine } from './agendaDocument';
import { ROLE_LABELS, type Role } from './roles';
import type { StructuredAnswerMap } from './structuredResponses';

/** The check-in question whose answer becomes an "Officer Priorities" agenda line.
 *  Matches lib/goalUpdateDefinition's check-in 'priorities' question. */
const PRIORITIES_KEY = 'priorities';

/** The minimal submission shape needed (matches reportSubmissionService.ReportSubmission). */
export interface UpdateSubmissionLike {
  /** Durable definition snapshot (lib/goalUpdateSnapshot value) — required to attribute questions. */
  definitionSnapshot: unknown;
  answers:            StructuredAnswerMap;
  /** Role at submit time → agenda attribution ("— Social Chair"). */
  submittedRole?:     string;
}

/** Friendly attribution from a submitted role key, or undefined. Pure. */
function sourceLabel(role?: string): string | undefined {
  if (!role) return undefined;
  return ROLE_LABELS[role as Role] ?? role;
}

/**
 * Extract + group the agenda contributions (announcements / help-needed) across a cycle's
 * goal-update submissions. Only snapshot-backed submissions contribute; "No update" / blank /
 * untagged answers never surface (via extractAgendaContributions). Pure; never throws.
 */
export function agendaContributionsFromSubmissions(
  submissions: UpdateSubmissionLike[],
): GroupedAgendaContributions {
  const perSubmission = [];
  for (const sub of submissions ?? []) {
    const def = definitionFromSnapshot(sub?.definitionSnapshot);
    if (!def) continue;   // no snapshot → can't attribute without goals → skip (honest)
    perSubmission.push(extractAgendaContributions({
      definition: def,
      answers:    sub.answers ?? {},
      ...(sourceLabel(sub.submittedRole) ? { source: sourceLabel(sub.submittedRole)! } : {}),
    }));
  }
  return groupAgendaContributions(mergeAgendaContributions(perSubmission));
}

/**
 * Pull each officer's "priorities for next period" from a cycle's goal-update submissions, as
 * agenda "Officer Priorities" lines (text + role attribution). Only snapshot-backed
 * submissions with a non-blank, non-"No update" priorities answer contribute. Pure; never
 * throws. (Unlike help-needed/announcements, priorities aren't agenda-tagged questions — they
 * are summarized here directly.)
 */
export function officerPriorityItems(submissions: UpdateSubmissionLike[]): OfficerUpdateLine[] {
  const out: OfficerUpdateLine[] = [];
  for (const sub of submissions ?? []) {
    if (!definitionFromSnapshot(sub?.definitionSnapshot)) continue;   // only snapshot-backed goal updates
    const a = sub.answers?.[PRIORITIES_KEY];
    if (!a || a.noUpdate) continue;
    const text = (a.value ?? '').trim();
    if (!text) continue;
    const source = sourceLabel(sub.submittedRole);
    out.push(source ? { text, source } : { text });
  }
  return out;
}
