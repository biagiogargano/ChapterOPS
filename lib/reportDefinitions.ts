/**
 * reportDefinitions.ts — concrete report content over the generic
 * structured-response primitive (lib/structuredResponses.ts).
 *
 * FOUNDATION ONLY: plain data + pure lookup. No React, no stores, no Supabase,
 * no I/O, no UI. Nothing user-facing imports this yet. Real submission/persistence
 * needs the deferred `task_report_submissions` table (see
 * docs/STRUCTURED_RESPONSES_FOUNDATION.md §5).
 *
 * GENERIC: a report is just a StructuredResponseDefinition. The weekly officer
 * report below is the ChapterOPS alpha default — a club/class/team would supply
 * its own definition over the same primitive. Sigma Chi flavor lives only in the
 * prompts, not in the model.
 */

import type { StructuredResponseDefinition } from './structuredResponses';

/** Id of the v1 weekly officer report definition. */
export const WEEKLY_OFFICER_REPORT_ID = 'weekly_officer_report';

/**
 * v1 weekly officer report — four short prompts. Two required (accomplishments,
 * goals) so a report always carries substance; two optional with "No update"
 * (blockers, announcements) so quiet weeks aren't friction. Text-only in v1.
 *
 * Generic wording where reasonable ("this period" rather than fraternity jargon)
 * so the same shape reads fine for other orgs.
 */
export const WEEKLY_OFFICER_REPORT: StructuredResponseDefinition = {
  id:    WEEKLY_OFFICER_REPORT_ID,
  label: 'Weekly Officer Report',
  questions: [
    {
      key:    'accomplishments',
      prompt: 'What did you accomplish this week?',
      type:   'long_text',
      order:  1,
      required: true,
      placeholder: 'Wins, progress, things you completed…',
    },
    {
      key:    'goals',
      prompt: 'Goals / priorities for next week?',
      type:   'long_text',
      order:  2,
      required: true,
      placeholder: 'What you plan to focus on next…',
    },
    {
      key:    'blockers',
      prompt: 'Blockers or help needed?',
      type:   'short_text',
      order:  3,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Anything you’re stuck on or need a hand with',
      // Feeds the meeting agenda's "Help needed" section (foundation-only — see
      // lib/agendaContributions.ts; not yet wired into the agenda screen).
      agendaSection: 'help_needed',
    },
    {
      key:    'announcements',
      prompt: 'Announcements for the chapter?',
      type:   'long_text',
      order:  4,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Anything everyone should know',
      // Feeds the meeting agenda's "Announcements" section (foundation-only).
      agendaSection: 'announcement',
    },
  ],
};

/** All registered report definitions (extend as more are added). */
export const REPORT_DEFINITIONS: StructuredResponseDefinition[] = [
  WEEKLY_OFFICER_REPORT,
];

/** Look up a report definition by id, or null if unknown (fail safe). */
export function getReportDefinition(id: string): StructuredResponseDefinition | null {
  return REPORT_DEFINITIONS.find(d => d.id === id) ?? null;
}
