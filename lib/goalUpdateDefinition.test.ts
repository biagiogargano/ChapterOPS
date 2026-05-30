/**
 * Isolated tests for lib/goalUpdateDefinition.ts — dependency-free harness.
 * Verifies the pure goal-linked weekly-update form builder: per-goal questions,
 * namespaced answer keys (round-trip), the appended officer check-in, the zero-goals
 * case, and that the result is a VALID structured-response definition.
 */

import {
  buildGoalUpdateDefinition, goalQuestions, goalFieldKey, parseGoalFieldKey,
  GOAL_UPDATE_FIELDS,
} from './goalUpdateDefinition';
import { validateDefinition, orderedQuestions } from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Key namespacing round-trips ───────────────────────────────────────────────
check('goalFieldKey format', goalFieldKey('g1', 'current') === 'goal_g1_current');
{
  const p = parseGoalFieldKey('goal_g1_help');
  check('parseGoalFieldKey round-trips', !!p && p.goalId === 'g1' && p.field === 'help');
}
check('parse rejects non-goal keys', parseGoalFieldKey('accomplishments') === null);
check('parse rejects bad field', parseGoalFieldKey('goal_g1_nope') === null);
{
  // goalId may contain underscores (e.g. report_…); the greedy capture handles it.
  const p = parseGoalFieldKey('goal_report_social_chair_2026-W23_complete');
  check('parse handles underscored goalId', !!p && p.field === 'complete' && p.goalId === 'report_social_chair_2026-W23');
}

// ── Per-goal question block ───────────────────────────────────────────────────
{
  const qs = goalQuestions({ id: 'g1', title: 'Recruit 12' }, 1);
  check('4 questions per goal', qs.length === GOAL_UPDATE_FIELDS.length);
  check('current is required', qs[0].key === 'goal_g1_current' && qs[0].required === true);
  check('help tagged help_needed', qs.find(q => q.key === 'goal_g1_help')?.agendaSection === 'help_needed');
  check('prompts include the goal title', qs.every(q => q.prompt.includes('Recruit 12')));
}

// ── Full definition with goals + check-in ─────────────────────────────────────
{
  const def = buildGoalUpdateDefinition({
    id: 'goal_update_social_chair_2026-W23',
    goals: [{ id: 'g1', title: 'Recruit 12' }, { id: 'g2', title: 'Book venue' }],
  });
  check('definition validates', validateDefinition(def).valid === true);
  check('label defaults to Weekly Update', def.label === 'Weekly Update');
  // 2 goals × 4 + 4 check-in = 12 questions.
  check('question count = goals×4 + check-in', def.questions.length === 2 * 4 + 4);
  check('includes both goals', def.questions.some(q => q.key === 'goal_g1_current') && def.questions.some(q => q.key === 'goal_g2_current'));
  check('includes check-in', def.questions.some(q => q.key === 'accomplishments'));
  // ordered, unique
  const keys = orderedQuestions(def).map(q => q.key);
  check('all keys unique', new Set(keys).size === keys.length);
  check('goals come before check-in', keys.indexOf('goal_g2_complete') < keys.indexOf('accomplishments'));
}

// ── Zero goals → still a valid check-in-only definition ───────────────────────
{
  const def = buildGoalUpdateDefinition({ id: 'gu_empty', goals: [] });
  check('zero goals still validates', validateDefinition(def).valid === true);
  check('zero goals = just the 4 check-in questions', def.questions.length === 4);
}

// ── includeCheckIn:false → goals only ─────────────────────────────────────────
{
  const def = buildGoalUpdateDefinition({ id: 'gu_goals_only', goals: [{ id: 'g1', title: 'X' }], includeCheckIn: false });
  check('goals-only definition has 4 questions', def.questions.length === 4);
  check('goals-only has no accomplishments', !def.questions.some(q => q.key === 'accomplishments'));
}

console.log(`\ngoalUpdateDefinition.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
