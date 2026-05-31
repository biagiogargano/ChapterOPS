/**
 * Tests for lib/agendaUpdateContributions — cycle submissions → grouped agenda contributions.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import { agendaContributionsFromSubmissions, officerPriorityItems, type UpdateSubmissionLike } from './agendaUpdateContributions';
import { buildGoalUpdateDefinition } from './goalUpdateDefinition';
import { buildGoalUpdateSnapshot } from './goalUpdateSnapshot';
import { assembleAgendaDocument } from './agendaDocument';
import type { Agenda } from './buildAgenda';
import { withAnswerValue, withAnswerNoUpdate, type StructuredAnswerMap } from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// A goal-update definition + its durable snapshot (the agenda-tagged questions live here).
const goals = [{ id: 'g1', title: 'Recruit 12' }];
const def = buildGoalUpdateDefinition({ goals, id: 'goalupddef_social_chair__2026-W22' });
const snapshot = buildGoalUpdateSnapshot(def, goals);

function answers(over: (a: StructuredAnswerMap) => StructuredAnswerMap): StructuredAnswerMap {
  return over({});
}

// ── extracts + groups announcements / help-needed, with role attribution ──────
{
  const a = answers(m => {
    m = withAnswerValue(m, 'announcements', 'Formal is Saturday');
    m = withAnswerValue(m, 'blockers', 'Need a van');
    m = withAnswerValue(m, 'goal_g1_help', 'Need help tabling');
    m = withAnswerValue(m, 'accomplishments', 'Ran 2 events');   // untagged → never contributes
    return m;
  });
  const subs: UpdateSubmissionLike[] = [{ definitionSnapshot: snapshot, answers: a, submittedRole: 'social_chair' }];
  const grouped = agendaContributionsFromSubmissions(subs);
  check('announcements extracted', grouped.announcements.length === 1 && grouped.announcements[0].text === 'Formal is Saturday');
  check('help-needed includes both blockers and per-goal help', grouped.helpNeeded.length === 2);
  check('role attribution applied', grouped.announcements[0].source === 'Social Chair');
  check('untagged accomplishment never contributes',
    !grouped.announcements.concat(grouped.helpNeeded).some(c => c.text === 'Ran 2 events'));
}

// ── "No update" / blank answers contribute nothing ────────────────────────────
{
  const a = answers(m => {
    m = withAnswerNoUpdate(m, 'announcements', true);
    m = withAnswerValue(m, 'blockers', '   ');         // whitespace only
    return m;
  });
  const grouped = agendaContributionsFromSubmissions([{ definitionSnapshot: snapshot, answers: a, submittedRole: 'quaestor' }]);
  check('No update + blank → nothing', grouped.announcements.length === 0 && grouped.helpNeeded.length === 0);
}

// ── snapshot-less submission is skipped (honest omission) ─────────────────────
{
  const a = answers(m => withAnswerValue(m, 'announcements', 'Should not appear'));
  const grouped = agendaContributionsFromSubmissions([
    { definitionSnapshot: null, answers: a, submittedRole: 'president' },        // no snapshot → skip
    { definitionSnapshot: { bogus: true }, answers: a, submittedRole: 'kustos' }, // invalid → skip
  ]);
  check('no-snapshot submissions skipped', grouped.announcements.length === 0 && grouped.helpNeeded.length === 0);
}

// ── merges across multiple submissions, preserving order ──────────────────────
{
  const a1 = answers(m => withAnswerValue(m, 'announcements', 'A from Pres'));
  const a2 = answers(m => withAnswerValue(m, 'announcements', 'B from Treasurer'));
  const grouped = agendaContributionsFromSubmissions([
    { definitionSnapshot: snapshot, answers: a1, submittedRole: 'president' },
    { definitionSnapshot: snapshot, answers: a2, submittedRole: 'quaestor' },
  ]);
  check('merges multiple submissions in order',
    grouped.announcements.length === 2 &&
    grouped.announcements[0].text === 'A from Pres' && grouped.announcements[0].source === 'Consul' &&
    grouped.announcements[1].text === 'B from Treasurer' && grouped.announcements[1].source === 'Quaestor');
}

// ── empty / nullish input ──────────────────────────────────────────────────────
{
  check('empty list → empty groups', (() => { const g = agendaContributionsFromSubmissions([]); return g.announcements.length === 0 && g.helpNeeded.length === 0; })());
  check('nullish list → empty groups (no throw)', (() => { const g = agendaContributionsFromSubmissions(undefined as any); return g.announcements.length === 0 && g.helpNeeded.length === 0; })());
}

// ── integration: submissions → contributions → assembled agenda (as the screen does) ──
const emptyAgenda: Agenda = { oldBusiness: [], newBusiness: [], unresolved: [], brotherWide: [] };
{
  const a = answers(m => {
    m = withAnswerValue(m, 'announcements', 'Formal Saturday');
    m = withAnswerValue(m, 'blockers', 'Need a van');
    return m;
  });
  const contributions = agendaContributionsFromSubmissions([{ definitionSnapshot: snapshot, answers: a, submittedRole: 'social_chair' }]);
  const doc = assembleAgendaDocument({ agenda: emptyAgenda, contributions, includeEmpty: false });
  const keys = doc.sections.map(s => s.key);
  check('assembled doc includes announcements section', keys.includes('announcements'));
  check('assembled doc includes help_needed section', keys.includes('help_needed'));
  check('announcement text + source land in the doc',
    doc.sections.find(s => s.key === 'announcements')!.items[0].text === 'Formal Saturday' &&
    doc.sections.find(s => s.key === 'announcements')!.items[0].meta === 'Social Chair');
}

// ── no submissions → optional sections omitted (honest, not empty placeholders) ──
{
  const contributions = agendaContributionsFromSubmissions([]);
  const doc = assembleAgendaDocument({ agenda: emptyAgenda, contributions, includeEmpty: false });
  check('empty submissions → no help_needed/announcements sections',
    !doc.sections.some(s => s.key === 'help_needed' || s.key === 'announcements'));
  check('empty submissions → empty document (nothing else either)', doc.sections.length === 0);
}

// ── officerPriorityItems: pull 'priorities' from snapshot-backed submissions ──
{
  const a = answers(m => {
    m = withAnswerValue(m, 'priorities', 'Lock the formal venue');
    m = withAnswerValue(m, 'accomplishments', 'Ran 2 events');   // not priorities → ignored
    return m;
  });
  const items = officerPriorityItems([{ definitionSnapshot: snapshot, answers: a, submittedRole: 'social_chair' }]);
  check('officer priorities extracted with attribution', items.length === 1 && items[0].text === 'Lock the formal venue' && items[0].source === 'Social Chair');

  // "No update" / blank / no-snapshot → nothing.
  const noUpd = answers(m => withAnswerNoUpdate(m, 'priorities', true));
  check('No-update priorities → nothing', officerPriorityItems([{ definitionSnapshot: snapshot, answers: noUpd, submittedRole: 'quaestor' }]).length === 0);
  const blank = answers(m => withAnswerValue(m, 'priorities', '   '));
  check('blank priorities → nothing', officerPriorityItems([{ definitionSnapshot: snapshot, answers: blank, submittedRole: 'quaestor' }]).length === 0);
  check('no-snapshot submission → nothing', officerPriorityItems([{ definitionSnapshot: null, answers: a, submittedRole: 'president' }]).length === 0);
  check('empty list → []', officerPriorityItems([]).length === 0);
}

// ── officer priorities land in the assembled agenda ───────────────────────────
{
  const a = answers(m => withAnswerValue(m, 'priorities', 'Recruit chairs'));
  const officerPriorities = officerPriorityItems([{ definitionSnapshot: snapshot, answers: a, submittedRole: 'recruitment_chair' }]);
  const doc = assembleAgendaDocument({ agenda: emptyAgenda, officerPriorities, includeEmpty: false });
  const sec = doc.sections.find(s => s.key === 'officer_updates');
  check('assembled doc includes officer_updates section', !!sec && sec.title === 'Officer Priorities');
  check('officer priority text + source land', !!sec && sec.items[0].text === 'Recruit chairs' && sec.items[0].meta === 'Recruitment Chair');
  // No priorities → section omitted.
  const empty = assembleAgendaDocument({ agenda: emptyAgenda, officerPriorities: [], includeEmpty: false });
  check('no officer priorities → section omitted', !empty.sections.some(s => s.key === 'officer_updates'));
}

console.log(`\nagendaUpdateContributions.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
