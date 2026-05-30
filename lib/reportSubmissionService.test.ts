/**
 * Isolated tests for lib/reportSubmissionService.ts — dependency-free harness.
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
} from './reportSubmissionService';
import type { StructuredAnswerMap } from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

async function run() {
  const answers: StructuredAnswerMap = {
    accomplishments: { key: 'accomplishments', value: 'shipped reports foundation' },
  };

  // ── Fallback-safe writes ────────────────────────────────────────────────────
  check('upsert returns false when unconfigured',
    (await upsertTaskReportSubmission('report_social_chair_2026-W23', 'weekly_officer_report', answers)) === false);

  // Guard rails: missing ids → false, no throw.
  check('upsert false on empty taskId',
    (await upsertTaskReportSubmission('', 'weekly_officer_report', answers)) === false);
  check('upsert false on empty definitionId',
    (await upsertTaskReportSubmission('t1', '', answers)) === false);

  // ── Fallback-safe reads ─────────────────────────────────────────────────────
  check('get returns null when unconfigured',
    (await getTaskReportSubmission('report_social_chair_2026-W23')) === null);
  check('get null on empty taskId',
    (await getTaskReportSubmission('')) === null);

  // ── Never throws (already implied above; explicit guard) ────────────────────
  let threw = false;
  try {
    await upsertTaskReportSubmission('t', 'd', {});
    await getTaskReportSubmission('t');
  } catch { threw = true; }
  check('service never throws', threw === false);

  console.log(`\nreportSubmissionService.test: ${passed} passed, ${failed} failed`);
  proc.exit(failed > 0 ? 1 : 0);
}

void run();
