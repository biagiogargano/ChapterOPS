/**
 * Isolated tests for the Me-tab "Create questionnaire tasks" button's LOGIC —
 * dependency-free harness. The button (app/(tabs)/me.tsx QuestionnaireGeneratorCard)
 * composes pure helpers; this exercises that exact composition WITHOUT React, so the
 * generation path is verified before spending an iOS build. (React rendering /
 * Alert / the Supabase submission round-trip still require a device — see
 * docs/BUILD_17_DEVICE_TEST_CHECKLIST.md.)
 *
 * What the button does on confirm (me.tsx):
 *   const now = new Date();
 *   generateQuestionnaireTasks({
 *     orgId, definitionId: WEEKLY_OFFICER_REPORT_ID, roles: OFFICER_ROLES,
 *     cycle: weeklyCycleId(WEEKLY_OFFICER_REPORT_ID, now),
 *     dueDate: defaultWeeklyDueDate(now),
 *   });
 * This test reproduces that with a FIXED reference date (deterministic — no
 * Date.now()) and asserts the wired result.
 */

import { generateQuestionnaireTasks } from './reportGeneration';
import { weeklyCycleId, defaultWeeklyDueDate } from './questionnaireCycle';
import { WEEKLY_OFFICER_REPORT_ID, getQuestionnaireDefinition } from './reportDefinitions';
import { reportTaskId } from './reportTasks';
import { OFFICER_ROLES } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const ORG = 'org-flow-1';
const DEF = WEEKLY_OFFICER_REPORT_ID;

// Reproduce the button's call with a fixed "now" (deterministic).
function pressCreate(orgId: string, ref: Date) {
  return generateQuestionnaireTasks({
    orgId,
    definitionId: DEF,
    roles:        OFFICER_ROLES,
    cycle:        weeklyCycleId(DEF, ref),
    dueDate:      defaultWeeklyDueDate(ref),
  });
}

// ── The selected template resolves (card reads its label) ─────────────────────
check('alpha template resolves to Weekly Officer Report',
  getQuestionnaireDefinition(DEF)?.label === 'Weekly Officer Report');

// ── First press: one task per officer role, with the wired fields ─────────────
{
  const now = new Date(2099, 5, 1); // fixed Mon 2099-06-01 (ISO W22 of 2099)
  const cycle = weeklyCycleId(DEF, now);
  const res = pressCreate(ORG, now);

  check('creates one task per officer role', res.created.length === OFFICER_ROLES.length);
  check('nothing skipped on first press', res.skipped.length === 0);
  check('every created task carries the weekly definition',
    res.created.every(t => t.reportDefinitionId === DEF));
  check('every created task assigned to an officer role',
    res.created.every(t => OFFICER_ROLES.includes(t.assignedRole as any)));
  check('task ids match the wired cycle key',
    OFFICER_ROLES.every(r => res.created.some(t => t.id === reportTaskId(r, cycle))));
  check('due date is 7 days after the reference date',
    res.created.every(t => t.dueAt === defaultWeeklyDueDate(now) && t.dueAt === '2099-06-08'));
  check('generated tasks are structured, no proof, no approval',
    res.created.every(t => t.type === 'structured' && t.requiresProof === false && t.requiresApproval === false));
}

// ── Second press SAME week → idempotent (the "Safe to press again" promise) ───
{
  const now = new Date(2099, 5, 1);
  const again = pressCreate(ORG, now);
  check('re-press same week creates nothing', again.created.length === 0);
  check('re-press same week skips every officer role', again.skipped.length === OFFICER_ROLES.length);
}

// ── Press in a DIFFERENT week → a fresh, distinct set ─────────────────────────
{
  const nextWeek = new Date(2099, 5, 8); // 2099-06-08, ISO W23
  const res = pressCreate(ORG, nextWeek);
  check('different week creates a fresh set', res.created.length === OFFICER_ROLES.length);
  check('different-week cycle key differs',
    weeklyCycleId(DEF, nextWeek) !== weeklyCycleId(DEF, new Date(2099, 5, 1)));
}

console.log(`\nquestionnaireGenerationFlow.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
