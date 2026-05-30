/**
 * Isolated tests for lib/taskWindow.ts — dependency-free harness.
 * Pure open-window logic: no-window (always open), not-yet-open, open, overdue.
 * Fixed `now` → deterministic.
 */

import { taskWindowView, isTaskOpen } from './taskWindow';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const NOW = new Date(2026, 5, 5);   // Jun 5 2026, local

// ── No window → always open (today's behavior) ────────────────────────────────
{
  const v = taskWindowView(null, null, NOW);
  check('no window → open_no_window', v.state === 'open_no_window');
  check('no window → canSubmit', v.canSubmit === true);
  check('no window → no label', v.label === '');
}
{
  const v = taskWindowView(null, '2026-06-01', NOW);   // due in the past, no avail
  check('no window, past due → overdue', v.state === 'overdue' && v.canSubmit === true);
}

// ── Not yet open ──────────────────────────────────────────────────────────────
{
  const v = taskWindowView('2026-06-08', '2026-06-12', NOW);   // opens Jun 8 (future)
  check('future availableAt → not_yet_open', v.state === 'not_yet_open');
  check('not_yet_open → cannot submit', v.canSubmit === false);
  check('not_yet_open → "Opens …" label', v.label.startsWith('Opens'));
  check('isTaskOpen false before window', isTaskOpen('2026-06-08', '2026-06-12', NOW) === false);
}

// ── Open (window started, not past due) ───────────────────────────────────────
{
  const v = taskWindowView('2026-06-01', '2026-06-12', NOW);   // opened Jun 1, due Jun 12
  check('past availableAt, before due → open', v.state === 'open' && v.canSubmit === true);
  check('open label mentions due', v.label.includes('due'));
  check('isTaskOpen true in window', isTaskOpen('2026-06-01', '2026-06-12', NOW) === true);
}

// ── Overdue (window started, past due) ────────────────────────────────────────
{
  const v = taskWindowView('2026-06-01', '2026-06-03', NOW);   // opened + due in the past
  check('past availableAt + past due → overdue', v.state === 'overdue');
  check('overdue still submittable', v.canSubmit === true);
}

// ── Boundary: availableAt exactly now → open ──────────────────────────────────
{
  const exactly = new Date(2026, 5, 5, 0, 0, 0);
  const v = taskWindowView('2026-06-05', '2026-06-12', exactly);
  check('availableAt == now → open (not locked)', v.state === 'open' && v.canSubmit === true);
}

// ── Garbage dates fail safe (treated as no bound) ─────────────────────────────
{
  const v = taskWindowView('not-a-date', null, NOW);
  check('invalid availableAt → open_no_window (fail safe)', v.state === 'open_no_window' && v.canSubmit === true);
}

console.log(`\ntaskWindow.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
