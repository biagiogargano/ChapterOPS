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
import { getAllEvents } from './eventStore';
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

  for (const t of mine) {
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

  // ── Events + RSVP (this week, today onward) ────────────────────────────────
  const todayOffset = (now.getDay() + 6) % 7;   // 0=Mon … 6=Sun
  for (const ev of getAllEvents()) {
    if (ev.dayOffset < todayOffset || ev.dayOffset > 6) continue;   // only the rest of this week
    const isToday      = ev.dayOffset === todayOffset;
    const rsvpRequired = ev.audience === 'all' || (ev.audience === 'officers' && isOfficer(role));
    const relevant     = rsvpRequired || ev.audience === 'optional';

    // RSVP needed wins over a plain "today" notice for the same event.
    if (rsvpRequired && getRsvpEntry(ev.id, role).status === 'no_response') {
      out.push({
        kind: 'rsvp_needed', severity: isToday ? 'critical' : 'moderate',
        entityType: 'event', entityId: ev.id, role,
        message: `RSVP for "${ev.title}"`,
        reason: isToday ? 'Today — response needed' : 'This week — response needed',
      });
      continue;
    }

    if (isToday && relevant) {
      out.push({
        kind: 'event_today', severity: ev.audience === 'all' ? 'moderate' : 'low',
        entityType: 'event', entityId: ev.id, role,
        message: `"${ev.title}" is today`, reason: `${ev.time} · ${ev.location}`,
      });
    }
  }

  return sortReminders(out);
}

/** Convenience for a badge/summary count (Phase C). */
export function getReminderCount(role: Role, now: Date = new Date()): number {
  return deriveReminders(role, now).length;
}
