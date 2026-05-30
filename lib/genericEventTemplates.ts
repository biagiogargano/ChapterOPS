/**
 * genericEventTemplates.ts — org-NEUTRAL event→task template EXAMPLES.
 *
 * Purpose: prove the event-template engine (lib/eventTemplates) is generic, not
 * fraternity-only. These are real, valid `EventTaskTemplate`s for non-fraternity
 * orgs — a club, a business team, a sports team, a volunteer org, a class — built
 * on exactly the same shape as the Sigma Chi alpha pack (date_party, recruitment,
 * formal, chapter_meeting, eboard_meeting in lib/eventTemplates.EVENT_TEMPLATES).
 *
 * ⚠️ NOT REGISTERED, NOT SURFACED. These are deliberately kept OUT of
 *    `EVENT_TEMPLATES` so they never appear in the template picker, the templates
 *    screen, the create-event preview, kind defaults, or the cascade-delete
 *    enumeration. They add no behavior and are not auto-defaulted. They exist as
 *    typed, tested reference data demonstrating the pack boundary (see
 *    docs/EVENT_TEMPLATES_FOUNDATION.md / PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE).
 *
 * NOTE on roles: `EventTaskSpec.assignedRole`/`reviewerRole` are typed as the
 * current `Role` union (the Sigma Chi pack's roles), so these examples reuse those
 * role *values* as stand-ins (e.g. `president` = the org's top approver,
 * `social_chair` = the organizing officer). When org-type role packs exist, a
 * generic template would reference that pack's roles. The point here is the SHAPE
 * is generic — the role vocabulary is the only pack-specific piece, and it already
 * lives behind the `Role` type, not in this engine.
 *
 * PURE DATA: no React, no stores, no I/O. Reuses the eventTemplates types/builder.
 */

import type { EventTaskTemplate } from './eventTemplates';

/**
 * Club Fundraiser Prep — a student club / org running a fundraiser. Generic
 * analog of the fraternity philanthropy workflow.
 */
export const CLUB_FUNDRAISER_PREP: EventTaskTemplate = {
  id:    'generic_club_fundraiser',
  label: 'Club Fundraiser Prep',
  taskSpecs: [
    {
      key:           'venue',
      title:         'Book the space & logistics for {event}',
      description:   'Reserve the location, confirm timing, and plan setup for {event}.',
      assignedRole:  'social_chair',
      dueOffsetDays: -10,
      requiresApproval: true,
      reviewerRole:  'president',
    },
    {
      key:           'budget',
      title:         'Set the budget & donation targets for {event}',
      description:   'Confirm the budget and fundraising goal for {event}.',
      assignedRole:  'quaestor',
      dueOffsetDays: -7,
      requiresApproval: true,
      reviewerRole:  'president',
    },
    {
      key:           'promo',
      title:         'Promote {event}',
      description:   'Post and share promotion for {event} across the club’s channels.',
      assignedRole:  'social_chair',
      dueOffsetDays: -5,
      requiresApproval: false,
    },
    {
      key:           'recap',
      title:         'Post-event totals & thank-yous for {event}',
      description:   'Record the amount raised and send thank-yous after {event}.',
      assignedRole:  'quaestor',
      dueOffsetDays: 2,
      requiresProof:    true,
      proofType:        'link',
      requiresApproval: false,
    },
  ],
};

/**
 * Team Practice Prep — a sports team / performance group prepping a practice or
 * session. Light, attendance-oriented.
 */
export const TEAM_PRACTICE_PREP: EventTaskTemplate = {
  id:    'generic_team_practice',
  label: 'Team Practice Prep',
  taskSpecs: [
    {
      key:           'plan',
      title:         'Build the session plan for {event}',
      description:   'Outline drills/agenda and goals for {event}.',
      assignedRole:  'president',
      dueOffsetDays: -2,
      requiresApproval: false,
    },
    {
      key:           'equipment',
      title:         'Prep equipment & space for {event}',
      description:   'Confirm gear, field/room, and setup for {event}.',
      assignedRole:  'house_manager',
      dueOffsetDays: -1,
      requiresApproval: false,
    },
    {
      key:           'attendance',
      title:         'Confirm attendance for {event}',
      description:   'Collect availability and confirm who is attending {event}.',
      assignedRole:  'social_chair',
      dueOffsetDays: -1,
      requiresApproval: false,
    },
  ],
};

/**
 * Business Meeting Prep — an operational team / committee / small business
 * meeting. Generic analog of the chapter/e-board meeting templates.
 */
export const BUSINESS_MEETING_PREP: EventTaskTemplate = {
  id:    'generic_business_meeting',
  label: 'Business Meeting Prep',
  taskSpecs: [
    {
      key:           'agenda',
      title:         'Prepare the agenda for {event}',
      description:   'Draft and circulate the agenda for {event}.',
      assignedRole:  'annotator',
      dueOffsetDays: -2,
      requiresApproval: true,
      reviewerRole:  'president',
    },
    {
      key:           'materials',
      title:         'Share pre-read / materials for {event}',
      description:   'Distribute the documents people should review before {event}.',
      assignedRole:  'annotator',
      dueOffsetDays: -1,
      requiresApproval: false,
    },
    {
      key:           'notes',
      title:         'File notes & action items for {event}',
      description:   'Post the meeting notes and action items for {event} and attach the link.',
      assignedRole:  'annotator',
      dueOffsetDays: 1,
      requiresProof:    true,
      proofType:        'link',
      requiresApproval: false,
    },
  ],
};

/**
 * Every org-neutral example. Kept SEPARATE from EVENT_TEMPLATES on purpose — this
 * array is reference/test data only and is intentionally not surfaced anywhere.
 */
export const GENERIC_TEMPLATE_EXAMPLES: EventTaskTemplate[] = [
  CLUB_FUNDRAISER_PREP,
  TEAM_PRACTICE_PREP,
  BUSINESS_MEETING_PREP,
];
