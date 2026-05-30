/**
 * Isolated tests for lib/reportDefinitions.ts — dependency-free harness.
 * Validates the v1 weekly officer report definition over the structured-response
 * primitive: shape valid, required/optional/no-update correct, order stable.
 */

import {
  WEEKLY_OFFICER_REPORT,
  WEEKLY_OFFICER_REPORT_ID,
  REPORT_DEFINITIONS,
  getReportDefinition,
} from './reportDefinitions';
import { validateDefinition, orderedQuestions } from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Definition is valid over the primitive ────────────────────────────────────
{
  const v = validateDefinition(WEEKLY_OFFICER_REPORT);
  check('weekly report definition is valid', v.valid === true);
  if (!v.valid) console.error('   errors:', v.errors);
}
check('id matches the exported constant', WEEKLY_OFFICER_REPORT.id === WEEKLY_OFFICER_REPORT_ID);
check('has 4 questions', WEEKLY_OFFICER_REPORT.questions.length === 4);

// ── Required / optional / no-update flags ─────────────────────────────────────
const byKey = (k: string) => WEEKLY_OFFICER_REPORT.questions.find(q => q.key === k);
check('accomplishments required', byKey('accomplishments')?.required === true);
check('goals required',           byKey('goals')?.required === true);
check('blockers optional',        !byKey('blockers')?.required);
check('announcements optional',   !byKey('announcements')?.required);
check('blockers allow no-update',      byKey('blockers')?.allowNoUpdate === true);
check('announcements allow no-update', byKey('announcements')?.allowNoUpdate === true);
// Required questions intentionally do NOT allow no-update (must carry substance).
check('accomplishments has no no-update', !byKey('accomplishments')?.allowNoUpdate);
check('goals has no no-update',           !byKey('goals')?.allowNoUpdate);

// All v1 questions are text types (no reserved types used).
check('all questions are text types',
  WEEKLY_OFFICER_REPORT.questions.every(q => q.type === 'short_text' || q.type === 'long_text'));

// ── Stable order ──────────────────────────────────────────────────────────────
check('order = accomplishments, goals, blockers, announcements',
  orderedQuestions(WEEKLY_OFFICER_REPORT).map(q => q.key).join(',') ===
    'accomplishments,goals,blockers,announcements');

// ── Registry + lookup ─────────────────────────────────────────────────────────
check('registry includes the weekly report',
  REPORT_DEFINITIONS.some(d => d.id === WEEKLY_OFFICER_REPORT_ID));
check('getReportDefinition resolves known id',
  getReportDefinition(WEEKLY_OFFICER_REPORT_ID) === WEEKLY_OFFICER_REPORT);
check('getReportDefinition unknown → null',
  getReportDefinition('does_not_exist') === null);

console.log(`\nreportDefinitions.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
