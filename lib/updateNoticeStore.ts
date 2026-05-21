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

export interface UpdateNotice {
  id:             string;
  entityType:     'task' | 'event';
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
  entityType:    'task' | 'event';
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
