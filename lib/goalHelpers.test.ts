/**
 * Isolated tests for lib/goalHelpers.ts — dependency-free harness.
 * Pure helpers over the inert Goal types: bulk prompt parsing, progress math,
 * cadence period bucketing / due logic, and status helpers. Fixed dates → deterministic.
 */

import {
  parseGoalPrompts, goalProgress, goalPeriodKey, isGoalUpdateDue,
  isGoalActive, isGoalCompleted, canArchiveGoal, canManageGoal,
  goalValueKind, goalDisplay,
} from './goalHelpers';
import type { Goal } from './goals';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);

// ── 1. Bulk prompt parsing ────────────────────────────────────────────────────
check('semicolon input', parseGoalPrompts('a; b; c').join('|') === 'a|b|c');
check('newline input', parseGoalPrompts('a\nb\nc').join('|') === 'a|b|c');
check('mixed semicolon + newline', parseGoalPrompts('a; b\nc;d').join('|') === 'a|b|c|d');
check('whitespace trimmed', parseGoalPrompts('  a  ;\t b \n  c ').join('|') === 'a|b|c');
check('empty entries ignored', parseGoalPrompts('a;;\n;b;\n\n').join('|') === 'a|b');
check('empty input → []', parseGoalPrompts('   ').length === 0);
check('non-string-ish empty → []', parseGoalPrompts('').length === 0);
check('exact duplicates de-duped, order preserved',
  parseGoalPrompts('a; b; a; c; b').join('|') === 'a|b|c');
check('near-duplicates (different text) kept',
  parseGoalPrompts('Recruit 10; Recruit 12').length === 2);

// ── 2. Progress math ──────────────────────────────────────────────────────────
{
  const p = goalProgress({ currentValue: 5, targetValue: 10 });
  check('normal: 5/10 = 50%', p.percent === 50 && p.rawPercent === 50 && p.reached === false);
}
{
  const p = goalProgress({ currentValue: 12, targetValue: 10 });
  check('over target: percent clamps to 100', p.percent === 100);
  check('over target: rawPercent > 100', (p.rawPercent ?? 0) === 120);
  check('over target: reached + overTarget true', p.reached === true && p.overTarget === true);
}
{
  const p = goalProgress({ currentValue: 10, targetValue: 10 });
  check('exactly target: reached, not over', p.reached === true && p.overTarget === false && p.percent === 100);
}
check('missing target → not measurable', goalProgress({ currentValue: 5 }).percent === null);
check('missing current → not measurable', goalProgress({ targetValue: 10 }).percent === null);
check('zero target → not measurable (no divide-by-zero)',
  goalProgress({ currentValue: 3, targetValue: 0 }).percent === null);
check('negative target → not measurable', goalProgress({ currentValue: 3, targetValue: -5 }).percent === null);
check('nonfinite values → not measurable',
  goalProgress({ currentValue: NaN as any, targetValue: 10 }).percent === null);

// ── 3. Cadence period keys ────────────────────────────────────────────────────
check('daily period key = ISO date', goalPeriodKey({ cadence: 'daily' }, D(2026, 6, 1)) === '2026-06-01');
check('weekly period key = ISO week', goalPeriodKey({ cadence: 'weekly' }, D(2026, 6, 1)) === '2026-W23');
check('monthly period key = YYYY-MM', goalPeriodKey({ cadence: 'monthly' }, D(2026, 6, 1)) === '2026-06');
check('custom period key buckets by N days',
  goalPeriodKey({ cadence: 'custom', customPeriodDays: 10 }, D(2026, 6, 1)).startsWith('custom:10:'));
check('custom with missing N falls back to daily',
  goalPeriodKey({ cadence: 'custom' }, D(2026, 6, 1)) === '2026-06-01');
{
  // two dates in the same ISO week → same weekly key; next week → different.
  const k1 = goalPeriodKey({ cadence: 'weekly' }, D(2026, 6, 1)); // Mon
  const k2 = goalPeriodKey({ cadence: 'weekly' }, D(2026, 6, 3)); // Wed, same week
  const k3 = goalPeriodKey({ cadence: 'weekly' }, D(2026, 6, 8)); // next Mon
  check('weekly key stable within a week', k1 === k2);
  check('weekly key changes across weeks', k1 !== k3);
}

// ── 3b. Due logic ─────────────────────────────────────────────────────────────
const activeWeekly: Pick<Goal, 'cadence' | 'customPeriodDays' | 'status'> = { cadence: 'weekly', status: 'active' };
check('due when no prior update', isGoalUpdateDue(activeWeekly, D(2026, 6, 1), null) === true);
check('due when prior update was a different period',
  isGoalUpdateDue(activeWeekly, D(2026, 6, 8), '2026-W23') === true);
check('NOT due when current period already updated',
  isGoalUpdateDue(activeWeekly, D(2026, 6, 1), '2026-W23') === false);
check('completed goal is never due',
  isGoalUpdateDue({ cadence: 'weekly', status: 'completed' }, D(2026, 6, 1), null) === false);
check('archived goal is never due',
  isGoalUpdateDue({ cadence: 'daily', status: 'archived' }, D(2026, 6, 1), null) === false);

// ── 4. Status helpers ─────────────────────────────────────────────────────────
check('isGoalActive', isGoalActive({ status: 'active' }) === true && isGoalActive({ status: 'archived' }) === false);
check('isGoalCompleted', isGoalCompleted({ status: 'completed' }) === true && isGoalCompleted({ status: 'active' }) === false);
check('canArchive active', canArchiveGoal({ status: 'active' }) === true);
check('canArchive completed', canArchiveGoal({ status: 'completed' }) === true);
check('cannot re-archive archived', canArchiveGoal({ status: 'archived' }) === false);

// ── 5. canManageGoal (mirrors the permissions-patch RPC auth) ─────────────────
{
  const g = (createdBy?: string) => ({ createdBy });
  // Leadership/annotator → manage ANY goal regardless of creator.
  check('president manages any goal',  canManageGoal(g('m_other'), 'president', 'm_me') === true);
  check('pro_consul manages any goal', canManageGoal(g('m_other'), 'pro_consul', 'm_me') === true);
  check('annotator manages any goal',  canManageGoal(g('m_other'), 'annotator', 'm_me') === true);
  check('leadership manages even with no createdBy / no memberId',
    canManageGoal(g(undefined), 'president', null) === true);

  // Creator → manages their own goal.
  check('creator manages own goal', canManageGoal(g('m_me'), 'social_chair', 'm_me') === true);

  // Owner role but NOT creator → CANNOT manage (leadership-assigned goal is read-only).
  check('owner-role-but-not-creator cannot manage',
    canManageGoal(g('m_leader'), 'social_chair', 'm_me') === false);

  // Unrelated role, not creator → cannot manage.
  check('unrelated role cannot manage', canManageGoal(g('m_other'), 'brother', 'm_me') === false);

  // Fail safe: missing createdBy or missing memberId → false for non-leadership.
  check('missing createdBy → false (fail safe)', canManageGoal(g(undefined), 'social_chair', 'm_me') === false);
  check('missing currentMemberId → false (fail safe)', canManageGoal(g('m_me'), 'social_chair', null) === false);
  check('missing both → false (fail safe)', canManageGoal(g(undefined), 'social_chair', undefined) === false);
}

// ── 6. goalValueKind + goalDisplay (numeric vs text goals) ────────────────────
check('valueKind defaults numeric when unset', goalValueKind({}) === 'numeric');
check('valueKind numeric explicit', goalValueKind({ valueKind: 'numeric' }) === 'numeric');
check('valueKind text', goalValueKind({ valueKind: 'text' }) === 'text');
{
  const d = goalDisplay({ valueKind: 'numeric', currentValue: 5, targetValue: 10, unit: 'members' });
  check('numeric display: progress present', d.progress !== null && d.progress.percent === 50);
  check('numeric display: value line', d.valueLine === '5/10 members · 50%');
  check('numeric display: kind', d.kind === 'numeric');
}
{
  const d = goalDisplay({ valueKind: 'numeric' });   // no numbers
  check('numeric goal with no numbers → empty value line', d.valueLine === '');
}
{
  const d = goalDisplay({ valueKind: 'text', currentText: 'Deposit paid', targetText: 'Venue booked' });
  check('text display: no progress', d.progress === null);
  check('text display: current → target line', d.valueLine === 'Deposit paid → Venue booked');
  check('text display: kind', d.kind === 'text');
}
{
  const d = goalDisplay({ valueKind: 'text', currentText: 'In progress' });   // only current
  check('text display: only current shown', d.valueLine === 'In progress');
}
check('text goal with no text → empty line', goalDisplay({ valueKind: 'text' }).valueLine === '');

console.log(`\ngoalHelpers.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
