/**
 * Isolated tests for lib/structuredResponses.ts — dependency-free harness.
 * Covers definition/answer validation, no-update handling, unsupported-type
 * fail-safe, completeness, and stable question ordering.
 */

import {
  SUPPORTED_QUESTION_TYPES,
  isSupportedQuestionType,
  orderedQuestions,
  validateDefinition,
  validateAnswers,
  isAnswered,
  responseProgress,
  type StructuredResponseDefinition,
  type StructuredAnswerMap,
} from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// A representative weekly-report-style definition.
const def: StructuredResponseDefinition = {
  id: 'weekly_officer_report',
  label: 'Weekly Officer Report',
  questions: [
    { key: 'focus',  prompt: 'This week’s focus?',     type: 'long_text',  order: 1, required: true },
    { key: 'done',   prompt: 'What did you get done?', type: 'long_text',  order: 2, required: true },
    { key: 'help',   prompt: 'Need help with?',        type: 'short_text', order: 3, required: false, allowNoUpdate: true },
    { key: 'announce', prompt: 'Announcements?',       type: 'long_text',  order: 4, required: false, allowNoUpdate: true },
  ],
};

// ── Supported types ───────────────────────────────────────────────────────────
check('supported types = short_text + long_text',
  SUPPORTED_QUESTION_TYPES.join(',') === 'short_text,long_text');
check('short_text supported', isSupportedQuestionType('short_text'));
check('long_text supported',  isSupportedQuestionType('long_text'));
check('select NOT supported (reserved)', isSupportedQuestionType('select') === false);
check('unknown type NOT supported',      isSupportedQuestionType('rating') === false);

// ── Ordering (stable + deterministic) ─────────────────────────────────────────
{
  const shuffled: StructuredResponseDefinition = {
    id: 'x', label: 'X',
    questions: [
      { key: 'b', prompt: 'B', type: 'short_text', order: 2 },
      { key: 'a', prompt: 'A', type: 'short_text', order: 1 },
      { key: 'c', prompt: 'C', type: 'short_text', order: 2 },   // tie with b
    ],
  };
  const ord = orderedQuestions(shuffled).map(q => q.key).join('');
  // a(order1) first; b and c tie at order2, broken by original index → b before c.
  check('ordered by order then original index', ord === 'abc');
  // Pure: input not mutated.
  check('orderedQuestions does not mutate input', shuffled.questions[0].key === 'b');
}

// ── Definition validation ─────────────────────────────────────────────────────
check('valid definition passes', validateDefinition(def).valid === true);
check('missing id fails',
  validateDefinition({ ...def, id: '' }).errors.some(e => /id is required/.test(e)));
check('no questions fails',
  validateDefinition({ id: 'x', label: 'X', questions: [] }).errors.some(e => /at least one question/.test(e)));
check('duplicate keys fail', (() => {
  const d: StructuredResponseDefinition = {
    id: 'd', label: 'D',
    questions: [
      { key: 'k', prompt: 'P1', type: 'short_text', order: 1 },
      { key: 'k', prompt: 'P2', type: 'short_text', order: 2 },
    ],
  };
  return validateDefinition(d).errors.some(e => /duplicate question key/.test(e));
})());
check('empty prompt fails', (() => {
  const d: StructuredResponseDefinition = {
    id: 'd', label: 'D', questions: [{ key: 'k', prompt: '', type: 'short_text', order: 1 }],
  };
  return validateDefinition(d).errors.some(e => /needs a prompt/.test(e));
})());
// Unsupported (reserved) type fails SAFE — reported, not thrown.
check('unsupported question type fails safe', (() => {
  const d: StructuredResponseDefinition = {
    id: 'd', label: 'D', questions: [{ key: 'k', prompt: 'P', type: 'scale', order: 1 }],
  };
  const v = validateDefinition(d);
  return v.valid === false && v.errors.some(e => /unsupported type: scale/.test(e));
})());
check('bad maxLength fails', (() => {
  const d: StructuredResponseDefinition = {
    id: 'd', label: 'D', questions: [{ key: 'k', prompt: 'P', type: 'short_text', order: 1, maxLength: 0 }],
  };
  return validateDefinition(d).errors.some(e => /invalid maxLength/.test(e));
})());

// ── isAnswered ────────────────────────────────────────────────────────────────
const qReq = def.questions[0];                         // required long_text
const qNoUpd = def.questions[2];                       // optional, allowNoUpdate
check('value counts as answered',    isAnswered(qReq, { key: 'focus', value: 'ship it' }) === true);
check('empty value not answered',    isAnswered(qReq, { key: 'focus', value: '   ' }) === false);
check('missing answer not answered', isAnswered(qReq, undefined) === false);
check('no-update counts when allowed',  isAnswered(qNoUpd, { key: 'help', noUpdate: true }) === true);
check('no-update NOT counted when disallowed',
  isAnswered(qReq, { key: 'focus', noUpdate: true }) === false);

// ── validateAnswers ───────────────────────────────────────────────────────────
{
  // All required answered, optionals via no-update → valid.
  const a: StructuredAnswerMap = {
    focus:    { key: 'focus', value: 'recruit' },
    done:     { key: 'done', value: 'tabled twice' },
    help:     { key: 'help', noUpdate: true },
    announce: { key: 'announce', noUpdate: true },
  };
  const v = validateAnswers(def, a);
  check('complete answers valid', v.valid === true && v.missingRequired.length === 0);
}
{
  // Missing a required question.
  const a: StructuredAnswerMap = { focus: { key: 'focus', value: 'x' } };
  const v = validateAnswers(def, a);
  check('missing required reported', v.missingRequired.includes('done') && v.valid === false);
}
{
  // No-update on a question that doesn't allow it → invalid.
  const a: StructuredAnswerMap = {
    focus: { key: 'focus', noUpdate: true },
    done:  { key: 'done', value: 'x' },
  };
  const v = validateAnswers(def, a);
  check('disallowed no-update invalid', v.errors.some(e => /does not allow "No update"/.test(e)));
}
{
  // Value + noUpdate together → invalid.
  const a: StructuredAnswerMap = {
    focus: { key: 'focus', value: 'a' },
    done:  { key: 'done', value: 'b' },
    help:  { key: 'help', value: 'something', noUpdate: true },
  };
  const v = validateAnswers(def, a);
  check('value + no-update invalid', v.errors.some(e => /both a value and "No update"/.test(e)));
}
{
  // Unknown answer key reported.
  const a: StructuredAnswerMap = {
    focus: { key: 'focus', value: 'a' },
    done:  { key: 'done', value: 'b' },
    ghost: { key: 'ghost', value: 'x' },
  };
  const v = validateAnswers(def, a);
  check('unknown answer key reported', v.errors.some(e => /unknown question: ghost/.test(e)));
}
{
  // maxLength enforced.
  const d: StructuredResponseDefinition = {
    id: 'd', label: 'D',
    questions: [{ key: 'k', prompt: 'P', type: 'short_text', order: 1, required: true, maxLength: 3 }],
  };
  const v = validateAnswers(d, { k: { key: 'k', value: 'abcd' } });
  check('maxLength enforced', v.errors.some(e => /exceeds max length 3/.test(e)));
}

// ── responseProgress / completeness ───────────────────────────────────────────
{
  const empty = responseProgress(def, {});
  check('progress: nothing answered', empty.answered === 0 && empty.complete === false);
  check('progress: required count = 2', empty.required === 2);
}
{
  // Both required answered; optionals untouched → complete (gate = required only).
  const a: StructuredAnswerMap = {
    focus: { key: 'focus', value: 'a' },
    done:  { key: 'done', value: 'b' },
  };
  const p = responseProgress(def, a);
  check('progress complete when required done', p.complete === true);
  check('progress answered counts optionals separately', p.answered === 2 && p.total === 4);
}
{
  // Optional no-update counts toward answered but not required gate.
  const a: StructuredAnswerMap = {
    focus: { key: 'focus', value: 'a' },
    done:  { key: 'done', value: 'b' },
    help:  { key: 'help', noUpdate: true },
  };
  const p = responseProgress(def, a);
  check('no-update counts toward answered', p.answered === 3);
  check('still complete', p.complete === true);
}

console.log(`\nstructuredResponses.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
