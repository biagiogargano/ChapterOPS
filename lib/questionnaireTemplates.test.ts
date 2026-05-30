/**
 * Isolated tests for lib/questionnaireTemplates.ts — dependency-free harness.
 * Proves the generic (non-fraternity) questionnaire definitions are valid, ordered
 * stably, honor required/optional/no-update, and are discoverable through the same
 * registry as the Sigma Chi alpha template (Weekly Officer Report).
 */

import {
  EVENT_RECAP, WEEKLY_TEAM_CHECKIN, AVAILABILITY_CHECK,
  EVENT_RECAP_ID, WEEKLY_TEAM_CHECKIN_ID, AVAILABILITY_CHECK_ID,
  QUESTIONNAIRE_TEMPLATES,
} from './questionnaireTemplates';
import {
  getReportDefinition, getQuestionnaireDefinition,
  QUESTIONNAIRE_DEFINITIONS, WEEKLY_OFFICER_REPORT_ID,
} from './reportDefinitions';
import {
  validateDefinition, orderedQuestions, validateAnswers, responseProgress,
  withAnswerValue, withAnswerNoUpdate,
} from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const ALL = [EVENT_RECAP, WEEKLY_TEAM_CHECKIN, AVAILABILITY_CHECK];

// ── Every definition is structurally valid ────────────────────────────────────
for (const def of ALL) {
  check(`${def.id} validates`, validateDefinition(def).valid);
  check(`${def.id} has a non-empty label`, def.label.trim().length > 0);
  check(`${def.id} has questions`, def.questions.length > 0);
}

// ── Stable question order (by `order`, fully deterministic) ────────────────────
{
  const recap = orderedQuestions(EVENT_RECAP).map(q => q.key);
  check('Event Recap order is summary→wins→issues→followups',
    recap.join(',') === 'summary,wins,issues,followups');
  const checkin = orderedQuestions(WEEKLY_TEAM_CHECKIN).map(q => q.key);
  check('Team Check-In order is progress→priorities→blockers→announcements',
    checkin.join(',') === 'progress,priorities,blockers,announcements');
  // Ordering is pure / repeatable.
  check('ordering is repeatable',
    orderedQuestions(AVAILABILITY_CHECK).map(q => q.key).join(',') ===
    orderedQuestions(AVAILABILITY_CHECK).map(q => q.key).join(','));
}

// ── Required vs optional gating ───────────────────────────────────────────────
{
  // Empty submission → incomplete (each has at least one required question).
  for (const def of ALL) {
    check(`${def.id} empty submission is incomplete`, responseProgress(def, {}).complete === false);
  }
  // Event Recap: only `summary` is required → answering it alone completes.
  let a = withAnswerValue({}, 'summary', 'Solid turnout, ran on time');
  check('Event Recap complete after the one required answer', responseProgress(EVENT_RECAP, a).complete === true);
  check('Event Recap with only summary validates', validateAnswers(EVENT_RECAP, a).valid === true);
}

// ── No-update on an optional question satisfies without text ───────────────────
{
  // Weekly Team Check-In: both required answered, optional blockers = No update.
  let a = {};
  a = withAnswerValue(a, 'progress', 'Shipped the thing');
  a = withAnswerValue(a, 'priorities', 'Start the next thing');
  a = withAnswerNoUpdate(a, 'blockers', true);
  const v = validateAnswers(WEEKLY_TEAM_CHECKIN, a);
  check('Team Check-In valid with No-update on optional blockers', v.valid === true);
  check('Team Check-In complete with required answered', responseProgress(WEEKLY_TEAM_CHECKIN, a).complete === true);
}

// ── No-update on a REQUIRED question is rejected ──────────────────────────────
{
  // availability is required and does NOT allow no-update.
  let a = withAnswerNoUpdate({}, 'availability', true);
  const v = validateAnswers(AVAILABILITY_CHECK, a);
  check('No-update on a required non-allowNoUpdate question is invalid', v.valid === false);
  check('required availability still reported missing',
    responseProgress(AVAILABILITY_CHECK, a).complete === false);
}

// ── Discoverable through the SAME registry as the alpha template ──────────────
{
  for (const id of [EVENT_RECAP_ID, WEEKLY_TEAM_CHECKIN_ID, AVAILABILITY_CHECK_ID]) {
    check(`${id} resolves via getReportDefinition`, getReportDefinition(id)?.id === id);
    check(`${id} resolves via getQuestionnaireDefinition alias`, getQuestionnaireDefinition(id)?.id === id);
  }
  check('alpha Weekly Officer Report still resolves',
    getReportDefinition(WEEKLY_OFFICER_REPORT_ID)?.id === WEEKLY_OFFICER_REPORT_ID);
  check('registry includes the alpha template + all generic templates',
    QUESTIONNAIRE_DEFINITIONS.some(d => d.id === WEEKLY_OFFICER_REPORT_ID) &&
    QUESTIONNAIRE_TEMPLATES.every(t => QUESTIONNAIRE_DEFINITIONS.some(d => d.id === t.id)));
  check('unknown id → null (fail safe)', getQuestionnaireDefinition('nope') === null);
}

// ── Ids are unique across the registry ────────────────────────────────────────
{
  const ids = QUESTIONNAIRE_DEFINITIONS.map(d => d.id);
  check('all registry definition ids are unique', new Set(ids).size === ids.length);
}

console.log(`\nquestionnaireTemplates.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
