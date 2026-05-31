/**
 * Isolated tests for lib/reportSubmissionService.ts — dependency-free harness.
 *
 * This is an ASYNC suite: it exports `runAsync()` which the pure-test runner
 * AWAITS and gates on the returned { failed } count. (A plain async IIFE would
 * resolve AFTER the runner's loop and silently fail to gate failures — see the
 * runner's §4 note.)
 *
 * In the pure-test runner, EXPO_PUBLIC_SUPABASE_* env vars are unset, so
 * isSupabaseConfigured() is false and the service must take its FALLBACK-SAFE
 * path: upsert → false, get → null, never throwing. (The authenticated RPC
 * round-trip is exercised on-device, not here.) This locks in the
 * no-crash/no-op contract that preserves flag-off / dev behavior.
 */

import {
  upsertTaskReportSubmission,
  getTaskReportSubmission,
  listSubmissionsForOrgCycle,
} from './reportSubmissionService';
import type { StructuredAnswerMap } from './structuredResponses';

export async function runAsync(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const check = (name: string, cond: boolean): void => {
    if (cond) passed++;
    else { failed++; console.error(`  ✗ FAIL: ${name}`); }
  };

  const answers: StructuredAnswerMap = {
    accomplishments: { key: 'accomplishments', value: 'shipped reports foundation' },
  };

  // ── Fallback-safe writes ────────────────────────────────────────────────────
  check('upsert returns false when unconfigured',
    (await upsertTaskReportSubmission('report_social_chair_2026-W23', 'weekly_officer_report', answers)) === false);
  check('upsert false on empty taskId',
    (await upsertTaskReportSubmission('', 'weekly_officer_report', answers)) === false);
  check('upsert false on empty definitionId',
    (await upsertTaskReportSubmission('t1', '', answers)) === false);

  // ── Optional snapshot arg: same fallback-safe contract (no throw) ─────────────
  check('upsert with snapshot → false when unconfigured',
    (await upsertTaskReportSubmission('goalupdrole_social_chair__2026-W23', 'goalupddef_social_chair__2026-W23', answers,
      { v: 1, definition: { id: 'goalupddef_social_chair__2026-W23', label: 'X', questions: [] }, goals: [] })) === false);
  check('upsert with undefined snapshot behaves like the 3-arg call',
    (await upsertTaskReportSubmission('t1', 'd1', answers, undefined)) === false);

  // ── Fallback-safe reads ─────────────────────────────────────────────────────
  check('get returns null when unconfigured',
    (await getTaskReportSubmission('report_social_chair_2026-W23')) === null);
  check('get null on empty taskId',
    (await getTaskReportSubmission('')) === null);

  // ── List-for-cycle (draft RPC): [] when unconfigured / bad input ──────────────
  check('listSubmissionsForOrgCycle → [] when unconfigured',
    (await listSubmissionsForOrgCycle('org-1', '2026-W23')).length === 0);
  check('listSubmissionsForOrgCycle → [] on empty orgId',
    (await listSubmissionsForOrgCycle('', '2026-W23')).length === 0);
  check('listSubmissionsForOrgCycle → [] on empty period',
    (await listSubmissionsForOrgCycle('org-1', '')).length === 0);

  // ── Never throws ────────────────────────────────────────────────────────────
  let threw = false;
  try {
    await upsertTaskReportSubmission('t', 'd', {});
    await getTaskReportSubmission('t');
    await listSubmissionsForOrgCycle('o', 'p');
  } catch { threw = true; }
  check('service never throws', threw === false);

  console.log(`\nreportSubmissionService.test: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
