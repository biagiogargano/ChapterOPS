/**
 * Isolated tests for the report_definition_id ↔ reportDefinitionId mapping in
 * lib/taskService (mockTaskToRow / rowToMockTask). Dependency-free harness; the
 * runner stubs the Supabase client so the module loads without network.
 *
 * Verifies the persistence fix: a questionnaire task's reportDefinitionId now
 * round-trips through the row representation, while ordinary tasks omit the column
 * entirely (so they still insert cleanly even before the column is applied).
 */

import { mockTaskToRow, rowToMockTask } from './taskService';
import type { MockTask } from './mockTasks';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function baseTask(over: Partial<MockTask> = {}): MockTask {
  return {
    id: 't1', title: 'X', type: 'structured', state: 'assigned', urgency: 'week',
    dueLabel: 'Mon', assignedRole: 'social_chair', assignedTo: 'Social Chair',
    visibleTo: ['social_chair'], description: 'd', requiresProof: false,
    requiresApproval: false, createdByRole: 'social_chair',
    ...over,
  };
}

// ── write side: questionnaire task includes report_definition_id ──────────────
{
  const row = mockTaskToRow(baseTask({ reportDefinitionId: 'weekly_officer_report' }));
  check('questionnaire task writes report_definition_id', row.report_definition_id === 'weekly_officer_report');
}

// ── write side: ordinary task OMITS the column (so it inserts pre-patch) ───────
{
  const row = mockTaskToRow(baseTask());
  check('ordinary task omits report_definition_id key', !('report_definition_id' in row));
}

// ── read side: report_definition_id → reportDefinitionId ──────────────────────
{
  const row: any = { ...mockTaskToRow(baseTask({ reportDefinitionId: 'weekly_officer_report' })),
    visible_to_all: false, escalation_chain: [], proof_content: '', rejection_note: '',
    created_at: '', updated_at: '' };
  const t = rowToMockTask(row);
  check('row → reportDefinitionId restored', t.reportDefinitionId === 'weekly_officer_report');
}

// ── read side: absent column (pre-patch) → undefined, no crash ────────────────
{
  const row: any = { ...mockTaskToRow(baseTask()),
    visible_to_all: false, escalation_chain: [], proof_content: '', rejection_note: '',
    created_at: '', updated_at: '' };
  // report_definition_id intentionally absent
  const t = rowToMockTask(row);
  check('absent column → reportDefinitionId undefined (fail safe)', t.reportDefinitionId === undefined);
}

// ── read side: null column → undefined ────────────────────────────────────────
{
  const row: any = { ...mockTaskToRow(baseTask()), report_definition_id: null,
    visible_to_all: false, escalation_chain: [], proof_content: '', rejection_note: '',
    created_at: '', updated_at: '' };
  const t = rowToMockTask(row);
  check('null column → reportDefinitionId undefined', t.reportDefinitionId === undefined);
}

// ── available_at ↔ availableAt mapping ────────────────────────────────────────
{
  const row = mockTaskToRow(baseTask({ availableAt: '2026-06-08' }));
  check('task with window writes available_at', row.available_at === '2026-06-08');
}
{
  const row = mockTaskToRow(baseTask());
  check('ordinary task omits available_at key', !('available_at' in row));
}
{
  const row: any = { ...mockTaskToRow(baseTask({ availableAt: '2026-06-08' })),
    visible_to_all: false, escalation_chain: [], proof_content: '', rejection_note: '',
    created_at: '', updated_at: '' };
  check('row → availableAt restored', rowToMockTask(row).availableAt === '2026-06-08');
}
{
  const row: any = { ...mockTaskToRow(baseTask()), available_at: null,
    visible_to_all: false, escalation_chain: [], proof_content: '', rejection_note: '',
    created_at: '', updated_at: '' };
  check('null available_at → undefined (fail safe)', rowToMockTask(row).availableAt === undefined);
}

console.log(`\ntaskServiceMapping.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
