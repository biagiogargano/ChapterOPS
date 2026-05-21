/**
 * updateNoticeService.ts — thin Supabase adapter for update_notices.
 * Fallback-safe (returns [] / no-ops when unconfigured), mirroring the other
 * services. Backing table: supabase/update_notices_schema.sql.
 */

import { supabase } from './supabase';
import { DEMO_CHAPTER_ID } from './eventService';
import type { UpdateNotice, UpdateSeverity } from './updateNoticeStore';

function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.startsWith('https://') && !url.includes('/rest/v1') && key.length > 10;
}

interface NoticeRow {
  id:               string;
  chapter_id:       string;
  entity_type:      'task' | 'event';
  entity_id:        string;
  summary:          string;
  severity:         UpdateSeverity;
  audience_roles:   string[];
  changed_by_role:  string | null;
  acknowledged_by:  string[];
  created_at:       string;
  expires_at:       string;
}

function rowToNotice(r: NoticeRow): UpdateNotice {
  return {
    id:             r.id,
    entityType:     r.entity_type,
    entityId:       r.entity_id,
    summary:        r.summary,
    severity:       r.severity,
    audienceRoles:  r.audience_roles ?? [],
    changedByRole:  r.changed_by_role ?? '',
    acknowledgedBy: r.acknowledged_by ?? [],
    createdAt:      r.created_at,
    expiresAt:      r.expires_at,
  };
}

function noticeToRow(n: UpdateNotice): Record<string, unknown> {
  return {
    id:              n.id,
    chapter_id:      DEMO_CHAPTER_ID,
    entity_type:     n.entityType,
    entity_id:       n.entityId,
    summary:         n.summary,
    severity:        n.severity,
    audience_roles:  n.audienceRoles,
    changed_by_role: n.changedByRole || null,
    acknowledged_by: n.acknowledgedBy,
    created_at:      n.createdAt,
    expires_at:      n.expiresAt,
  };
}

/** Fetch all notices for an org (defaults to the demo chapter). [] when unconfigured / failed. */
export async function fetchAllNotices(orgId: string = DEMO_CHAPTER_ID): Promise<UpdateNotice[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('update_notices')
      .select('*')
      .eq('chapter_id', orgId);

    if (error) {
      console.warn('[updateNoticeService] fetchAllNotices error:', error.message);
      return [];
    }
    return (data as NoticeRow[]).map(rowToNotice);
  } catch (err) {
    console.warn('[updateNoticeService] fetchAllNotices threw:', err);
    return [];
  }
}

/** Insert or update a notice (used for emit + acknowledgement). Never throws. */
export async function upsertNotice(notice: UpdateNotice): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await supabase
      .from('update_notices')
      .upsert(noticeToRow(notice), { onConflict: 'id' });
    if (error) {
      console.warn('[updateNoticeService] upsertNotice error:', error.message);
    }
  } catch (err) {
    console.warn('[updateNoticeService] upsertNotice threw:', err);
  }
}
