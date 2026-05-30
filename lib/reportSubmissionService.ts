/**
 * reportSubmissionService.ts — thin client adapter for report submissions.
 *
 * Wraps the two SECURITY DEFINER RPCs applied on alpha
 * (supabase/reports_v1_task_report_submissions.sql):
 *   • upsert_task_report_submission(p_task_id, p_definition_id, p_answers)
 *   • get_task_report_submission(p_task_id)
 *
 * Mirrors the Proof v1A adapter pattern in taskService.ts:
 *   • never throws — returns safe defaults (false / null);
 *   • no-ops when Supabase is unconfigured (preserves flag-off / dev behavior);
 *   • does NOT touch tasks.state — submitting/marking complete stays the app's
 *     job (Task Detail UI integration, a later step).
 *
 * FOUNDATION/SERVICE ONLY: no UI, no task-state changes, no report-task
 * generation. The answers shape is the StructuredAnswerMap from
 * lib/structuredResponses (validated client-side BEFORE calling upsert).
 */

import { supabase } from './supabase';
import { isSupabaseConfigured } from './memberService';
import type { StructuredAnswerMap } from './structuredResponses';

/** A report submission as returned by get_task_report_submission. */
export interface ReportSubmission {
  taskId:        string;
  definitionId:  string;
  answers:       StructuredAnswerMap;
  submittedRole: string;
  submittedAt:   string;
  updatedAt:     string;
}

/**
 * Write (insert/update) the structured-response answers for a report task via the
 * upsert_task_report_submission RPC. Returns true on success. No-op (false) when
 * Supabase is unconfigured. Never throws. Does NOT change tasks.state.
 *
 * Caller must validate `answers` against the definition (validateAnswers) BEFORE
 * calling — the DB only enforces "answers is a JSON object".
 */
export async function upsertTaskReportSubmission(
  taskId: string,
  definitionId: string,
  answers: StructuredAnswerMap,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!taskId || !definitionId) return false;
  try {
    const { error } = await supabase.rpc('upsert_task_report_submission', {
      p_task_id:       taskId,
      p_definition_id: definitionId,
      p_answers:       answers ?? {},
    });
    if (error) {
      console.warn('[reportSubmissionService] upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[reportSubmissionService] upsert threw:', err);
    return false;
  }
}

/**
 * Read the report submission for a task via the get_task_report_submission RPC.
 * Returns null when there is no row OR the caller isn't authorized (the RPC
 * returns an empty set in both cases). No-op (null) when Supabase is
 * unconfigured. Never throws.
 */
export async function getTaskReportSubmission(taskId: string): Promise<ReportSubmission | null> {
  if (!isSupabaseConfigured()) return null;
  if (!taskId) return null;
  try {
    const { data, error } = await supabase.rpc('get_task_report_submission', { p_task_id: taskId });
    if (error) {
      console.warn('[reportSubmissionService] get error:', error.message);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          task_id?:        string | null;
          definition_id?:  string | null;
          answers?:        unknown;
          submitted_role?: string | null;
          submitted_at?:   string | null;
          updated_at?:     string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      taskId:        row.task_id ?? taskId,
      definitionId:  row.definition_id ?? '',
      // answers is jsonb → already an object from the client; default to empty.
      answers:       (row.answers && typeof row.answers === 'object'
                        ? (row.answers as StructuredAnswerMap)
                        : {}),
      submittedRole: row.submitted_role ?? '',
      submittedAt:   row.submitted_at ?? '',
      updatedAt:     row.updated_at ?? '',
    };
  } catch (err) {
    console.warn('[reportSubmissionService] get threw:', err);
    return null;
  }
}
