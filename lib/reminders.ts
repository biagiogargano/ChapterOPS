/**
 * reminders.ts — DERIVED reminder helper (Phase B).
 *
 * Reminders are COMPUTE-ON-READ from the current task/event/RSVP state — they
 * are NOT persisted and NOT written anywhere. Each call recomputes "what needs
 * this role's attention right now" from the live stores. Nothing here mutates
 * state.
 *
 * This is DIFFERENT from update notices (lib/updateNoticeStore.ts), which are
 * event-sourced and persisted ("X changed"). A reminder says "X needs action
 * now" and is purely derived.
 *
 * Phase B builds only the data layer — it renders nothing. Phase C will use
 * deriveReminders()/getReminderCount() to label or summarize EXISTING Today
 * cards, never to add a parallel feed (so information is not duplicated).
 */

import { getStoredState } from './devTaskStore';
import { getAllEvents, resolveEventId } from './eventStore';
import {
  dueLabelOf,
  getResponsibilityGroups,
  isOverdue,
  urgencyOf,
} from './mockTasks';
import { getRsvpEntry } from './rsvpStore';
import { isOfficer, type Role } from './roles';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReminderKind =
  | 'rsvp_needed'
  | 'event_today'
  | 'task_due_today'
  | 'task_overdue'
  | 'review_pending'
  | 'resubmit_needed'
  | 'escalation_alert';

export type ReminderSeverity = 'critical' | 'moderate' | 'low';

export interface Reminder {
  kind:       ReminderKind;
  severity:   ReminderSeverity;
  entityType: 'task' | 'event';
  entityId:   string;
  role:       Role;        // the role this reminder is addressed to
  message:    string;      // short, human-facing
  reason:     string;      // supporting detail / why it's surfacing
}

const _sevOrder: Record<ReminderSeverity, number> = { critical: 0, moderate: 1, low: 2 };

function sortReminders(rs: Reminder[]): Reminder[] {
  return [...rs].sort((a, b) => _sevOrder[a.severity] - _sevOrder[b.severity]);
}

// ─── Derivation ─────────────────────────────────────────────────────────────

/**
 * Compute all reminders for a role from current state. Pure read — safe to call
 * on every render. `now` is injectable for testing / consistent comparisons.
 */
export function deriveReminders(role: Role, now: Date = new Date()): Reminder[] {
  const out: Reminder[] = [];

  // ── Tasks (reuse the role buckets; effective state from devTaskStore) ──────
  const { mine, review, alert } = getResponsibilityGroups(
    role,
    t => getStoredState(t.id, t.state),
  );

  // Events already covered by an RSVP/name task (so we don't also emit event_today).
  const coveredEventIds = new Set<string>();

  for (const t of mine) {
    // RSVP / name-submission completion lives in rsvpStore — NOT devTaskStore —
    // so derive these from the RSVP entry (keyed by the resolved event id).
    if (t.lightweightKind === 'rsvp' || t.lightweightKind === 'name_submission') {
      const evId  = resolveEventId(t.linkedEventId ?? t.linkedEvent ?? '');
      coveredEventIds.add(evId);
      const entry = getRsvpEntry(evId, role);

      if (t.lightweightKind === 'rsvp') {
        const mandatory     = t.linkedEventMandatory ?? false;
        const needsCovering = t.requiresCovering ?? false;
        const responded =
          entry.status === 'attending' ||
          (entry.status === 'not_attending' &&
            (!mandatory     || entry.excuse.trim().length   > 0) &&
            (!needsCovering || entry.covering.trim().length > 0));
        if (!responded) {
          out.push({
            kind: 'rsvp_needed', severity: 'moderate',
            entityType: 'task', entityId: t.id, role,
            message: `RSVP for "${t.linkedEvent ?? t.title}"`, reason: 'Response needed',
          });
        }
      } else {
        // name_submission
        if (entry.dateName.trim().length === 0) {
          out.push({
            kind: 'rsvp_needed', severity: 'moderate',
            entityType: 'task', entityId: t.id, role,
            message: `Submit a date name for "${t.linkedEvent ?? t.title}"`, reason: 'Submission needed',
          });
        }
      }
      continue;
    }

    // Structured + other lightweight (acknowledgment / yes_no): devTaskStore state.
    const state = getStoredState(t.id, t.state);
    if (state === 'submitted' || state === 'approved') continue; // done / awaiting reviewer

    if (state === 'rejected') {
      out.push({
        kind: 'resubmit_needed', severity: 'moderate',
        entityType: 'task', entityId: t.id, role,
        message: `"${t.title}" was rejected`, reason: 'Revise and resubmit',
      });
      continue;
    }
    if (isOverdue(t.dueAt, state, now)) {
      out.push({
        kind: 'task_overdue', severity: 'critical',
        entityType: 'task', entityId: t.id, role,
        message: `"${t.title}" is overdue`, reason: dueLabelOf(t, now),
      });
      continue;
    }
    if (urgencyOf(t, now) === 'today') {
      out.push({
        kind: 'task_due_today', severity: 'moderate',
        entityType: 'task', entityId: t.id, role,
        message: `"${t.title}" is due today`, reason: dueLabelOf(t, now),
      });
    }
  }

  for (const t of review) {
    out.push({
      kind: 'review_pending', severity: 'moderate',
      entityType: 'task', entityId: t.id, role,
      message: `"${t.title}" needs your review`, reason: `Submitted by ${t.assignedTo}`,
    });
  }

  for (const t of alert) {
    out.push({
      kind: 'escalation_alert', severity: 'critical',
      entityType: 'task', entityId: t.id, role,
      message: `"${t.title}" is overdue`, reason: `${t.assignedTo} · needs attention`,
    });
  }

  // ── Events happening TODAY (informational) ─────────────────────────────────
  // RSVP "needed" is owned by the RSVP/name tasks above (rsvpStore-driven), so
  // here we only surface today's events that AREN'T already covered by such a
  // task — avoiding double-counting / entityId mismatch.
  const todayOffset = (now.getDay() + 6) % 7;   // 0=Mon … 6=Sun
  for (const ev of getAllEvents()) {
    if (ev.dayOffset !== todayOffset) continue;          // only "today"
    if (coveredEventIds.has(ev.id)) continue;            // an RSVP/name task already covers it
    const relevant =
      ev.audience === 'all' ||
      ev.audience === 'optional' ||
      (ev.audience === 'officers' && isOfficer(role));
    if (!relevant) continue;

    out.push({
      kind: 'event_today', severity: ev.audience === 'all' ? 'moderate' : 'low',
      entityType: 'event', entityId: ev.id, role,
      message: `"${ev.title}" is today`, reason: `${ev.time} · ${ev.location}`,
    });
  }

  return sortReminders(out);
}

/** Convenience for a badge/summary count (Phase C). */
export function getReminderCount(role: Role, now: Date = new Date()): number {
  return deriveReminders(role, now).length;
}
