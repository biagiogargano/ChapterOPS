/**
 * Isolated tests for lib/agendaContributions.ts — dependency-free harness.
 * Verifies pure extraction of agenda-bound answers from structured submissions:
 * only tagged + text-answered questions contribute; "No update"/blank/untagged
 * are dropped; section filtering + multi-submission merge preserve order.
 */

import {
  extractAgendaContributions,
  contributionsForSection,
  mergeAgendaContributions,
  groupAgendaContributions,
} from './agendaContributions';
import { withAnswerValue, withAnswerNoUpdate, type StructuredResponseDefinition } from './structuredResponses';
import { WEEKLY_OFFICER_REPORT } from './reportDefinitions';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Against the real weekly report definition ─────────────────────────────────
// blockers → help_needed, announcements → announcement; accomplishments/goals
// are untagged and must never contribute.
{
  let answers = {};
  answers = withAnswerValue(answers, 'accomplishments', 'Ran 3 events');
  answers = withAnswerValue(answers, 'goals', 'Plan formal');
  answers = withAnswerValue(answers, 'blockers', 'Need budget approval');
  answers = withAnswerValue(answers, 'announcements', 'Dues are due Friday');

  const c = extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers, source: 'Social Chair' });
  check('only the two tagged questions contribute', c.length === 2);
  check('untagged accomplishments excluded', !c.some(x => x.questionKey === 'accomplishments'));
  check('untagged goals excluded',           !c.some(x => x.questionKey === 'goals'));

  const help = contributionsForSection(c, 'help_needed');
  const ann  = contributionsForSection(c, 'announcement');
  check('help_needed pulled from blockers',   help.length === 1 && help[0].text === 'Need budget approval');
  check('announcement pulled from announcements', ann.length === 1 && ann[0].text === 'Dues are due Friday');
  check('source attribution carried through', help[0].source === 'Social Chair' && ann[0].source === 'Social Chair');
  check('contributions follow definition order (blockers#3 before announcements#4)',
    c[0].questionKey === 'blockers' && c[1].questionKey === 'announcements');
}

// ── "No update" and blank tagged answers contribute nothing ───────────────────
{
  let answers = {};
  answers = withAnswerNoUpdate(answers, 'blockers', true);       // explicit no-update
  answers = withAnswerValue(answers, 'announcements', '   ');     // whitespace only
  const c = extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers });
  check('no-update + blank tagged answers → no contributions', c.length === 0);
}

// ── Missing answers → nothing ─────────────────────────────────────────────────
{
  const c = extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers: {} });
  check('empty submission → no contributions', c.length === 0);
}

// ── Source omitted when not supplied ──────────────────────────────────────────
{
  let answers = {};
  answers = withAnswerValue(answers, 'announcements', 'Open house Sunday');
  const c = extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers });
  check('no source → contribution has no source field', c.length === 1 && c[0].source === undefined);
}

// ── Untagged definition contributes nothing ───────────────────────────────────
{
  const plain: StructuredResponseDefinition = {
    id: 'plain', label: 'Plain',
    questions: [{ key: 'note', prompt: 'Note?', type: 'long_text', order: 1 }],
  };
  let answers = {};
  answers = withAnswerValue(answers, 'note', 'Something');
  const c = extractAgendaContributions({ definition: plain, answers });
  check('definition with no agendaSection tags → no contributions', c.length === 0);
}

// ── Merge across submissions preserves order ──────────────────────────────────
{
  const mk = (text: string, source: string) => {
    let answers = {};
    answers = withAnswerValue(answers, 'announcements', text);
    return extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers, source });
  };
  const merged = mergeAgendaContributions([mk('A', 'Pres'), mk('B', 'Treasurer'), []]);
  check('merge flattens all submissions', merged.length === 2);
  check('merge preserves submission order',
    merged[0].text === 'A' && merged[0].source === 'Pres' &&
    merged[1].text === 'B' && merged[1].source === 'Treasurer');
  check('merge of empty lists → empty', mergeAgendaContributions([[], []]).length === 0);
}

// ── groupAgendaContributions: split into render-ready sections, keep order ─────
{
  const mk = (key: string, text: string, source: string) => {
    let answers = {};
    answers = withAnswerValue(answers, key, text);
    return extractAgendaContributions({ definition: WEEKLY_OFFICER_REPORT, answers, source });
  };
  const merged = mergeAgendaContributions([
    mk('announcements', 'Formal is May 30', 'Pres'),
    mk('blockers', 'Need a venue', 'Social'),
    mk('announcements', 'Dues due Friday', 'Quaestor'),
  ]);
  const grouped = groupAgendaContributions(merged);
  check('announcements grouped', grouped.announcements.length === 2);
  check('helpNeeded grouped', grouped.helpNeeded.length === 1);
  check('announcement order preserved', grouped.announcements[0].text === 'Formal is May 30' && grouped.announcements[1].text === 'Dues due Friday');
  check('helpNeeded content', grouped.helpNeeded[0].text === 'Need a venue' && grouped.helpNeeded[0].section === 'help_needed');
  const empty = groupAgendaContributions([]);
  check('empty → both sections empty', empty.announcements.length === 0 && empty.helpNeeded.length === 0);
}

console.log(`\nagendaContributions.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
