/**
 * questionnaireTemplates.ts — GENERIC, cross-organization questionnaire
 * definitions over the structured-response primitive (lib/structuredResponses.ts).
 *
 * Per docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md: the questionnaire task is a
 * GENERIC primitive; specific definitions are template/pack content. The Weekly
 * Officer Report (lib/reportDefinitions.ts) is the Sigma Chi ALPHA pack template.
 * The definitions here are deliberately org-neutral — they read sensibly for a
 * club, class, sports team, nonprofit, or business with no wording changes — to
 * prove the system is not officer-report-only.
 *
 * FOUNDATION ONLY: plain data + pure registration. No React, no stores, no
 * Supabase, no I/O, no UI, no task-generation behavior. Discoverable through the
 * shared registry (getReportDefinition / getQuestionnaireDefinition). Text-only v1
 * (short_text / long_text) — matches the primitive's supported types.
 */

import type { StructuredResponseDefinition } from './structuredResponses';

// ─── Ids ──────────────────────────────────────────────────────────────────────

export const EVENT_RECAP_ID          = 'event_recap';
export const WEEKLY_TEAM_CHECKIN_ID  = 'weekly_team_checkin';
export const AVAILABILITY_CHECK_ID   = 'availability_check';

// ─── Definitions ──────────────────────────────────────────────────────────────

/**
 * Event Recap — fill out after an event/activity. Generic: a chapter social, a
 * club fundraiser, a game, a class session, a company offsite all "recap" the
 * same way. One required summary; optional wins / issues / follow-ups.
 */
export const EVENT_RECAP: StructuredResponseDefinition = {
  id:    EVENT_RECAP_ID,
  label: 'Event Recap',
  questions: [
    {
      key:    'summary',
      prompt: 'How did it go overall?',
      type:   'long_text',
      order:  1,
      required: true,
      placeholder: 'Turnout, how it ran, the short version…',
    },
    {
      key:    'wins',
      prompt: 'What went well?',
      type:   'long_text',
      order:  2,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Worth repeating next time',
    },
    {
      key:    'issues',
      prompt: 'What didn’t go well or would you change?',
      type:   'short_text',
      order:  3,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Problems, gaps, things to fix',
      // Surfaces to leadership follow-up / agenda "help needed" later.
      agendaSection: 'help_needed',
    },
    {
      key:    'followups',
      prompt: 'Any follow-ups or announcements?',
      type:   'long_text',
      order:  4,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Thank-yous, next steps, things to share',
      agendaSection: 'announcement',
    },
  ],
};

/**
 * Weekly Team Check-In — a generic weekly status update for any operational team
 * (work team, committee, project group). The org-neutral sibling of the fraternity
 * Weekly Officer Report: progress + priorities required; blockers + announcements
 * optional with No-update.
 */
export const WEEKLY_TEAM_CHECKIN: StructuredResponseDefinition = {
  id:    WEEKLY_TEAM_CHECKIN_ID,
  label: 'Weekly Team Check-In',
  questions: [
    {
      key:    'progress',
      prompt: 'What did you get done this week?',
      type:   'long_text',
      order:  1,
      required: true,
      placeholder: 'Completed work, progress made…',
    },
    {
      key:    'priorities',
      prompt: 'Priorities for next week?',
      type:   'long_text',
      order:  2,
      required: true,
      placeholder: 'What you’ll focus on next',
    },
    {
      key:    'blockers',
      prompt: 'Anything blocking you or where you need help?',
      type:   'short_text',
      order:  3,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Blockers, dependencies, asks',
      agendaSection: 'help_needed',
    },
    {
      key:    'announcements',
      prompt: 'Anything to announce to the team?',
      type:   'long_text',
      order:  4,
      required: false,
      allowNoUpdate: true,
      placeholder: 'News everyone should know',
      agendaSection: 'announcement',
    },
  ],
};

/**
 * Availability / Status Check — a lightweight "are you in, and any status to
 * report" form. Generic: sports availability/injury, shift availability, event
 * RSVP-with-notes, class attendance intent. Text-only in v1 (a future 'select'
 * type would make availability a chip, but the data shape is stable now).
 */
export const AVAILABILITY_CHECK: StructuredResponseDefinition = {
  id:    AVAILABILITY_CHECK_ID,
  label: 'Availability / Status Check',
  questions: [
    {
      key:    'availability',
      prompt: 'Are you available, and when?',
      type:   'short_text',
      order:  1,
      required: true,
      placeholder: 'e.g. Yes / No / Only after 6pm',
    },
    {
      key:    'status',
      prompt: 'Anything to report? (injury, limitation, conflict)',
      type:   'short_text',
      order:  2,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Leave on “No update” if all good',
      agendaSection: 'help_needed',
    },
    {
      key:    'notes',
      prompt: 'Anything else?',
      type:   'long_text',
      order:  3,
      required: false,
      allowNoUpdate: true,
      placeholder: 'Optional notes',
    },
  ],
};

/**
 * The generic questionnaire templates (org-neutral). Kept separate from the
 * fraternity alpha pack (lib/reportDefinitions.WEEKLY_OFFICER_REPORT) so the
 * pack/core split is visible. The shared registry concatenates both.
 */
export const QUESTIONNAIRE_TEMPLATES: StructuredResponseDefinition[] = [
  EVENT_RECAP,
  WEEKLY_TEAM_CHECKIN,
  AVAILABILITY_CHECK,
];
