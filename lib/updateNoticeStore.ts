/**
 * updateNoticeStore.ts — in-app "update / change" notices.
 *
 * Event-sourced (a change happened) — NOT a derived reminder. Emitted from the
 * task/event edit & delete flows. Persisted to Supabase via updateNoticeService
 * so a member who reloads still sees that something changed; degrades to a
 * session-only list in mock fallback.
 *
 * Reactive: components call useUpdateNoticesVersion() to re-render on any change
 * (same pattern as rsvpStore). Acknowledgement is per-ROLE (no auth yet).
 */

import { useEffect, useReducer } from 'react';
import { fetchAllNotices, upsertNotice } from './updateNoticeService';

export type UpdateSeverity = 'critical' | 'moderate' | 'low';

/** Entity a notice links to. 'goal' requires the update_notices CHECK widening
 *  (supabase/update_notices_goal_entity_patch_draft.sql) before goal notices persist. */
export type NoticeEntityType = 'task' | 'event' | 'goal';

export interface UpdateNotice {
  id:             string;
  entityType:     NoticeEntityType;
  entityId:       string;
  summary:        string;
  severity:       UpdateSeverity;
  audienceRoles:  string[];
  changedByRole:  string;
  acknowledgedBy: string[];
  createdAt:      string;
  expiresAt:      string;
}

const DEFAULT_EXPIRY_DAYS = 7;

const _notices: UpdateNotice[] = [];

function _uid(): string {
  return `un_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const _severityRank: Record<UpdateSeverity, number> = { critical: 3, moderate: 2, low: 1 };
function _maxSeverity(a: UpdateSeverity, b: UpdateSeverity): UpdateSeverity {
  return _severityRank[a] >= _severityRank[b] ? a : b;
}

// ─── Reactive subscription ──────────────────────────────────────────────────

const _listeners = new Set<() => void>();
function _notify(): void { for (const fn of _listeners) fn(); }

export function subscribeToNoticeChanges(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** Re-renders the caller whenever any update notice changes. */
export function useUpdateNoticesVersion(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeToNoticeChanges(tick), []);
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

/**
 * Emit (or coalesce) an update notice. Excludes the actor from the audience;
 * no-ops if nobody is left to notify. If a live notice already exists for the
 * same entity, it is REPLACED (merged) rather than stacked — one live notice
 * per entity, so repeated edits don't spam.
 */
export function emitUpdateNotice(params: {
  entityType:    NoticeEntityType;
  entityId:      string;
  summary:       string;
  severity:      UpdateSeverity;
  audienceRoles: string[];
  changedByRole: string;
  expiresInDays?: number;
}): void {
  const audience = Array.from(new Set(params.audienceRoles.filter(r => r && r !== params.changedByRole)));
  if (audience.length === 0) return;   // only the editor was affected → nothing to notify

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + (params.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86_400_000).toISOString();

  // Coalesce: reuse a still-live notice for this entity.
  const existing = _notices.find(n => n.entityId === params.entityId && new Date(n.expiresAt).getTime() > now.getTime());

  let notice: UpdateNotice;
  if (existing) {
    existing.summary        = params.summary;
    existing.severity       = _maxSeverity(existing.severity, params.severity);
    existing.audienceRoles  = audience;
    existing.changedByRole  = params.changedByRole;
    existing.acknowledgedBy = [];          // a fresh change → everyone re-sees it
    existing.createdAt      = now.toISOString();
    existing.expiresAt      = expiresAt;
    existing.entityType     = params.entityType;
    notice = existing;
  } else {
    notice = {
      id:             _uid(),
      entityType:     params.entityType,
      entityId:       params.entityId,
      summary:        params.summary,
      severity:       params.severity,
      audienceRoles:  audience,
      changedByRole:  params.changedByRole,
      acknowledgedBy: [],
      createdAt:      now.toISOString(),
      expiresAt,
    };
    _notices.push(notice);
  }

  _notify();
  void upsertNotice(notice);   // fire-and-forget (no-op in mock fallback)
}

// ─── Task action notices (mirror the 4 task-responsibility pushes) ────────────
// The four task pushes (assigned / submitted-for-review / approved / rejected) are
// sent via pushTokens.sendActionPush. This builds the matching IN-APP notice so the
// same event also appears in Notifications and can be dismissed. SAME audience as the
// push (one concrete role; the store excludes the actor), so no new scope: no
// all-member, no event/RSVP, no goal/questionnaire, no reminders.

export type TaskActionKind = 'assigned' | 'submitted' | 'approved' | 'rejected';

/** Copy per task action — mirrors the push titles. */
const TASK_ACTION_SUMMARY: Record<TaskActionKind, (title: string) => string> = {
  assigned:  t => `New task assigned: ${t}`,
  submitted: t => `Task needs your review: ${t}`,
  approved:  t => `Task approved: ${t}`,
  rejected:  t => `Task needs changes: ${t}`,
};

/** Severity per task action (rejected is the most pressing). */
const TASK_ACTION_SEVERITY: Record<TaskActionKind, UpdateSeverity> = {
  assigned:  'moderate',
  submitted: 'moderate',
  approved:  'low',
  rejected:  'critical',
};

/**
 * Build the emitUpdateNotice params for a task action, or null if there is no
 * concrete audience role (matches the push rule: skip when the target role is
 * missing or 'all'). Pure; never throws. `audienceRole` is the SAME single role the
 * push targets (assignee for assigned/approved/rejected; reviewer for submitted).
 */
export function buildTaskActionNotice(
  kind: TaskActionKind,
  params: { taskId: string; taskTitle: string; audienceRole?: string | null; actorRole: string },
): Parameters<typeof emitUpdateNotice>[0] | null {
  const role = params.audienceRole;
  if (!params.taskId || !role || role === 'all') return null;   // no concrete target → no notice
  return {
    entityType:    'task',
    entityId:      params.taskId,
    summary:       TASK_ACTION_SUMMARY[kind](params.taskTitle),
    severity:      TASK_ACTION_SEVERITY[kind],
    audienceRoles: [role],
    changedByRole: params.actorRole,
  };
}

/**
 * Emit the in-app notice mirroring a task push. No-ops safely (no audience, etc.).
 * Call this right where the matching sendActionPush is fired. Never blocks the
 * caller's task action (emit is synchronous + guarded; persistence is fire-and-forget).
 */
export function emitTaskActionNotice(
  kind: TaskActionKind,
  params: { taskId: string; taskTitle: string; audienceRole?: string | null; actorRole: string },
): void {
  const notice = buildTaskActionNotice(kind, params);
  if (notice) emitUpdateNotice(notice);
}

// ─── Goal-assigned notice (in-app only; GATED on the 'goal' entity_type patch) ──
// When leadership assigns a goal to an officer ROLE, that role should see an in-app
// notice. PURE BUILDER ONLY — NOT wired into the Goals screen yet, because the notice
// table's entity_type CHECK must first be widened to allow 'goal'
// (supabase/update_notices_goal_entity_patch_draft.sql). Emitting before that would
// fail the insert. No push — in-app only. The store excludes the actor, so a goal a
// role creates for itself notifies no one.

/**
 * Build the emitUpdateNotice params for a goal assigned to an owner role, or null
 * when there's no concrete target role (or the actor IS that role — handled by the
 * store too). Pure; never throws.
 */
export function buildGoalAssignedNotice(
  params: { goalId: string; goalTitle: string; ownerRole?: string | null; actorRole: string },
): Parameters<typeof emitUpdateNotice>[0] | null {
  const role = params.ownerRole;
  if (!params.goalId || !role || role === 'all' || role === params.actorRole) return null;
  const t = (params.goalTitle ?? '').trim() || 'a goal';
  return {
    entityType:    'goal',
    entityId:      params.goalId,
    summary:       `New goal for you: ${t}`,
    severity:      'moderate',
    audienceRoles: [role],
    changedByRole: params.actorRole,
  };
}

// ─── Acknowledge ────────────────────────────────────────────────────────────

/** Mark a notice acknowledged for one role (hides it for that role). */
export function acknowledgeNotice(id: string, role: string): void {
  const n = _notices.find(x => x.id === id);
  if (!n || n.acknowledgedBy.includes(role)) return;
  n.acknowledgedBy = [...n.acknowledgedBy, role];
  _notify();
  void upsertNotice(n);
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Live, unacknowledged notices for a role, newest first. */
export function getNoticesForRole(role: string): UpdateNotice[] {
  const now = Date.now();
  return _notices
    .filter(n =>
      n.audienceRoles.includes(role) &&
      !n.acknowledgedBy.includes(role) &&
      new Date(n.expiresAt).getTime() > now,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Hydrate (startup) ────────────────────────────────────────────────────────

/** Load persisted notices into the store (replaces contents). No-op data when
 *  Supabase is unconfigured (session-only fallback). orgId defaults to the demo
 *  chapter; DataBootstrap passes the active org id.
 *
 *  isCurrent (optional, P2f): a freshness guard checked right before the splice,
 *  so a stale hydration (from a previous org) can't overwrite newer notices when
 *  the active org changes. Backward-compatible — omit it for the old behavior. */
export async function hydrateUpdateNotices(
  orgId?: string,
  isCurrent?: () => boolean,
): Promise<void> {
  const rows = await fetchAllNotices(orgId);
  if (rows.length === 0) return;
  if (isCurrent && !isCurrent()) return;   // a newer hydration superseded this one
  _notices.splice(0, _notices.length, ...rows);
  _notify();
}

/**
 * Clear all notices on an org transition so the next org starts clean. Clears
 * data only and notifies subscribers; the listener set is left intact.
 * Not wired into runtime yet (Issue B-1 groundwork).
 */
export function resetNotices(): void {
  _notices.splice(0, _notices.length);
  _notify();
}
