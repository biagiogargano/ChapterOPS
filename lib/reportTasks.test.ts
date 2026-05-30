/**
 * Isolated tests for lib/reportTasks.ts — dependency-free harness. Covers the
 * deterministic report-task generator: stable id/title/description/assignee,
 * idempotent ids, unknown-definition fail-safe, and the report-definition tag.
 * Date-relative fields (dueLabel/urgency) are not asserted (they depend on today).
 */

import { buildReportTask, reportTaskId, REPORT_TASK_PREFIX } from './reportTasks';
import { WEEKLY_OFFICER_REPORT_ID, WEEKLY_OFFICER_REPORT } from './reportDefinitions';
import { ROLE_LABELS } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const input = {
  orgId:        'org-1',
  role:         'social_chair' as const,
  cycle:        '2026-W23',
  definitionId: WEEKLY_OFFICER_REPORT_ID,
  dueDate:      '2030-06-07',
};

// ── Deterministic id ──────────────────────────────────────────────────────────
check('reportTaskId = report_<role>_<cycle>',
  reportTaskId('social_chair', '2026-W23') === 'report_social_chair_2026-W23');
check('id carries the report_ prefix',
  reportTaskId('president', 'c').startsWith(REPORT_TASK_PREFIX));

// ── buildReportTask: shape + determinism ──────────────────────────────────────
const t = buildReportTask(input);
check('builds a task for a known definition', t !== null);
if (t) {
  check('task id is deterministic', t.id === 'report_social_chair_2026-W23');
  check('type structured',          t.type === 'structured');
  check('state assigned',           t.state === 'assigned');
  check('assignedRole = input role', t.assignedRole === 'social_chair');
  check('assignedTo = role label',  t.assignedTo === ROLE_LABELS.social_chair);
  check('title includes definition label + role',
    t.title === `${WEEKLY_OFFICER_REPORT.label} — ${ROLE_LABELS.social_chair}`);
  check('description is stable',
    t.description === `Submit your ${WEEKLY_OFFICER_REPORT.label.toLowerCase()} for this cycle.`);
  check('dueAt = input dueDate',    t.dueAt === '2030-06-07');
  check('no proof required',        t.requiresProof === false);
  check('no approval required',     t.requiresApproval === false);
  check('reportDefinitionId tagged', t.reportDefinitionId === WEEKLY_OFFICER_REPORT_ID);
  check('visibleTo includes the assignee',
    t.visibleTo !== 'all' && (t.visibleTo as string[]).includes('social_chair'));
  check('visibleTo includes leadership',
    t.visibleTo !== 'all' && (t.visibleTo as string[]).includes('president'));
}

// Idempotency: same input → identical deterministic output.
{
  const again = buildReportTask(input);
  check('same input → same id', again?.id === t?.id);
  check('same input → same title + description',
    again?.title === t?.title && again?.description === t?.description);
}

// Different role / cycle → different id.
check('different role → different id',
  buildReportTask({ ...input, role: 'president' })?.id === 'report_president_2026-W23');
check('different cycle → different id',
  buildReportTask({ ...input, cycle: '2026-W24' })?.id === 'report_social_chair_2026-W24');

// ── Fail safe: unknown definition → null ──────────────────────────────────────
check('unknown definition → null',
  buildReportTask({ ...input, definitionId: 'nope' }) === null);

console.log(`\nreportTasks.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
