/**
 * Isolated tests for lib/questionnaireCycle.ts — dependency-free harness.
 * Pure date helpers: ISO week numbering, namespaced cycle id, default due date.
 * All reference dates are supplied explicitly (no Date.now()), so results are
 * deterministic.
 */

import { toISODate, isoWeek, weeklyCycleId, defaultWeeklyDueDate } from './questionnaireCycle';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Local-date constructor (matches how the helpers read y/m/d).
const D = (y: number, m: number, day: number) => new Date(y, m - 1, day);

// ── toISODate ─────────────────────────────────────────────────────────────────
check('toISODate pads month/day', toISODate(D(2026, 1, 5)) === '2026-01-05');
check('toISODate full width', toISODate(D(2026, 12, 31)) === '2026-12-31');

// ── isoWeek: known anchors ────────────────────────────────────────────────────
// 2026-01-01 is a Thursday → ISO week 1 of 2026.
{
  const w = isoWeek(D(2026, 1, 1));
  check('2026-01-01 is W1 of 2026', w.year === 2026 && w.week === 1);
}
// 2026-06-01 (Monday) → ISO week 23.
{
  const w = isoWeek(D(2026, 6, 1));
  check('2026-06-01 is W23 of 2026', w.year === 2026 && w.week === 23);
}
// Year-boundary: 2027-01-01 is a Friday → still ISO week 53 of week-year 2026.
{
  const w = isoWeek(D(2027, 1, 1));
  check('2027-01-01 belongs to ISO week-year 2026', w.year === 2026);
}

// ── weeklyCycleId: namespaced + deterministic ─────────────────────────────────
{
  const id = weeklyCycleId('weekly_officer_report', D(2026, 6, 1));
  check('cycle id is template-namespaced with zero-padded week',
    id === 'weekly_officer_report:2026-W23');
  check('same date + template → same id',
    weeklyCycleId('weekly_officer_report', D(2026, 6, 1)) === id);
  check('different template → different id',
    weeklyCycleId('event_recap', D(2026, 6, 1)) !== id);
  // Early-week padding.
  check('week is zero-padded below 10',
    weeklyCycleId('x', D(2026, 1, 1)) === 'x:2026-W01');
}

// ── defaultWeeklyDueDate ──────────────────────────────────────────────────────
check('default due date is 7 days ahead', defaultWeeklyDueDate(D(2026, 6, 1)) === '2026-06-08');
check('due date crosses month boundary', defaultWeeklyDueDate(D(2026, 6, 28)) === '2026-07-05');
check('custom daysAhead respected', defaultWeeklyDueDate(D(2026, 6, 1), 3) === '2026-06-04');

console.log(`\nquestionnaireCycle.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
