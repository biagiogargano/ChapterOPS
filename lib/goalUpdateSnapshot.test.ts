/**
 * Tests for lib/goalUpdateSnapshot — the durable goal-update form snapshot.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  GOAL_UPDATE_SNAPSHOT_VERSION,
  buildGoalUpdateSnapshot, isGoalUpdateSnapshot, definitionFromSnapshot, goalTitleFromSnapshot,
} from './goalUpdateSnapshot';
import { buildGoalUpdateDefinition } from './goalUpdateDefinition';
import { pickGoalUpdateDefinition, goalUpdateDefinitionId } from './goalUpdateGeneration';
import type { StructuredResponseDefinition } from './structuredResponses';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const goals = [
  { id: 'g1', title: 'Recruit 12' },
  { id: 'g2', title: 'Host 3 socials' },
];
const def = buildGoalUpdateDefinition({ goals, id: 'goalupddef_social_chair__2026-W22', label: 'Social Chair — Weekly Goal Update' });

// ── build: captures version, definition, goal context ─────────────────────────
{
  const snap = buildGoalUpdateSnapshot(def, goals);
  check('snapshot version', snap.v === GOAL_UPDATE_SNAPSHOT_VERSION);
  check('snapshot keeps definition id', snap.definition.id === def.id);
  check('snapshot keeps definition label', snap.definition.label === def.label);
  check('snapshot keeps all questions', snap.definition.questions.length === def.questions.length);
  check('snapshot captures goal context', snap.goals.length === 2 && snap.goals[0].id === 'g1' && snap.goals[0].title === 'Recruit 12');
  // Per-question metadata (agendaSection, allowNoUpdate) survives the clone.
  const help = snap.definition.questions.find(q => q.key === 'goal_g1_help');
  check('snapshot keeps agendaSection tag', !!help && help.agendaSection === 'help_needed');
  const cur = snap.definition.questions.find(q => q.key === 'goal_g1_current');
  check('snapshot keeps allowNoUpdate', !!cur && cur.allowNoUpdate === true);
}

// ── serializable: survives a JSON round-trip unchanged ────────────────────────
{
  const snap = buildGoalUpdateSnapshot(def, goals);
  const round = JSON.parse(JSON.stringify(snap));
  check('snapshot is JSON-serializable', isGoalUpdateSnapshot(round));
  check('round-trip preserves question count', round.definition.questions.length === def.questions.length);
}

// ── no aliasing: mutating the snapshot doesn't touch the source definition ─────
{
  const snap = buildGoalUpdateSnapshot(def, goals);
  snap.definition.questions[0].prompt = 'MUTATED';
  check('snapshot questions are cloned (no aliasing)', def.questions[0].prompt !== 'MUTATED');
}

// ── isGoalUpdateSnapshot: validates shape defensively ─────────────────────────
{
  check('valid snapshot passes', isGoalUpdateSnapshot(buildGoalUpdateSnapshot(def, goals)));
  check('null fails', !isGoalUpdateSnapshot(null));
  check('undefined fails', !isGoalUpdateSnapshot(undefined));
  check('non-object fails', !isGoalUpdateSnapshot('x' as unknown));
  check('wrong version fails', !isGoalUpdateSnapshot({ v: 99, definition: def, goals: [] }));
  check('missing definition fails', !isGoalUpdateSnapshot({ v: 1, goals: [] }));
  check('definition without questions array fails', !isGoalUpdateSnapshot({ v: 1, definition: { id: 'a', label: 'b' }, goals: [] }));
  check('goals not array fails', !isGoalUpdateSnapshot({ v: 1, definition: def, goals: {} }));
}

// ── definitionFromSnapshot: recovers historical definition or null ────────────
{
  const snap = buildGoalUpdateSnapshot(def, goals);
  const recovered = definitionFromSnapshot(snap) as StructuredResponseDefinition;
  check('recovers a definition', !!recovered && recovered.id === def.id);
  check('recovered questions match', recovered.questions.length === def.questions.length);
  check('invalid value → null', definitionFromSnapshot({ not: 'a snapshot' }) === null);
  check('null → null', definitionFromSnapshot(null) === null);
}

// ── historical title lookup is independent of live goals ──────────────────────
{
  const snap = buildGoalUpdateSnapshot(def, goals);
  check('goalTitleFromSnapshot finds historical title', goalTitleFromSnapshot(snap, 'g2') === 'Host 3 socials');
  check('goalTitleFromSnapshot missing → undefined', goalTitleFromSnapshot(snap, 'nope') === undefined);
}

// ── empty goals (check-in-only update) still snapshots cleanly ─────────────────
{
  const ciDef = buildGoalUpdateDefinition({ goals: [], id: 'goalupddef_quaestor__2026-W22' });
  const snap = buildGoalUpdateSnapshot(ciDef, []);
  check('check-in-only snapshot valid', isGoalUpdateSnapshot(snap) && snap.goals.length === 0);
  check('check-in-only keeps the 4 check-in questions', snap.definition.questions.length === 4);
}

// ── pickGoalUpdateDefinition: snapshot preferred, reconstruction fallback ──────
{
  const id = goalUpdateDefinitionId('social_chair', '2026-W22');
  const liveGoals = [{ id: 'g9', title: 'A live goal' }];
  const snap = buildGoalUpdateSnapshot(def, goals);   // def is the W22 social_chair def, 2 goals

  // With a valid snapshot → returns the snapshot's definition (history), NOT current goals.
  const picked = pickGoalUpdateDefinition(snap, id, liveGoals)!;
  check('pick prefers the snapshot definition', picked.id === def.id && picked.questions.length === def.questions.length);
  // It must reflect the SNAPSHOT goals (g1,g2), not the live goal (g9).
  check('pick uses snapshot goals not live goals', picked.questions.some(q => q.key.startsWith('goal_g1_')) && !picked.questions.some(q => q.key.startsWith('goal_g9_')));

  // No snapshot → reconstruct from the supplied current goals.
  const reconstructed = pickGoalUpdateDefinition(null, id, liveGoals)!;
  check('pick reconstructs when no snapshot', reconstructed.questions.some(q => q.key.startsWith('goal_g9_')));

  // Invalid snapshot value → fall back to reconstruction.
  const fallback = pickGoalUpdateDefinition({ bogus: true }, id, liveGoals)!;
  check('pick falls back on invalid snapshot', fallback.questions.some(q => q.key.startsWith('goal_g9_')));

  // Non-goal-update id and no snapshot → null.
  check('pick → null for non-goal-update id + no snapshot', pickGoalUpdateDefinition(null, 'weekly_officer_report', []) === null);
}

console.log(`\ngoalUpdateSnapshot.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
