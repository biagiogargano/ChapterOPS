/**
 * Tests for lib/goalUpdateRun — the manual weekly goal-update run.
 *
 * ASYNC suite: exports runAsync() (the run is async). Goals are INJECTED so the test
 * exercises the full build+insert path without a live RPC. Idempotency is verified by
 * running twice against the shared in-memory task store (created → skipped).
 */

import {
  weeklyGoalUpdatePeriodKey, weeklyGoalUpdateWindow, runWeeklyGoalUpdateGeneration,
} from './goalUpdateRun';
import { goalUpdateTaskId } from './goalUpdateGeneration';
import { findTaskById } from './mockTasks';
import type { Goal } from './goals';

function goal(over: Partial<Goal>): Goal {
  return {
    id: 'g', orgId: 'org-run', title: 'T', status: 'active',
    ownerRole: 'social_chair', cadence: 'weekly', ...over,
  } as Goal;
}

export async function runAsync(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const check = (name: string, cond: boolean): void => {
    if (cond) passed++;
    else { failed++; console.error(`  ✗ FAIL: ${name}`); }
  };

  // ── period key: deterministic ISO week, zero-padded ──────────────────────────
  {
    const k1 = weeklyGoalUpdatePeriodKey(new Date(2026, 4, 30)); // 2026-05-30
    check('period key shape YYYY-Www', /^\d{4}-W\d{2}$/.test(k1));
    check('period key deterministic', k1 === weeklyGoalUpdatePeriodKey(new Date(2026, 4, 30)));
    // Early January week padded to 2 digits.
    check('period key zero-pads early weeks', /^\d{4}-W0\d$/.test(weeklyGoalUpdatePeriodKey(new Date(2026, 0, 5))));
  }

  // ── window: opens 4 days out, due 7 days out ─────────────────────────────────
  {
    const w = weeklyGoalUpdateWindow(new Date(2026, 4, 25)); // 2026-05-25
    check('availableAt = now + 4d', w.availableAt === '2026-05-29');
    check('dueAt = now + 7d', w.dueAt === '2026-06-01');
    check('availableAt strictly before dueAt', w.availableAt < w.dueAt);
  }

  // ── empty orgId → nothing ────────────────────────────────────────────────────
  {
    const r = await runWeeklyGoalUpdateGeneration({ orgId: '', now: new Date(2026, 4, 25) });
    check('empty orgId → no-op', r.created === 0 && r.skipped === 0 && r.rolesWithGoals === 0);
  }

  // ── no goals injected (and unconfigured fetch) → nothing created ─────────────
  {
    const r = await runWeeklyGoalUpdateGeneration({ orgId: 'org-run', now: new Date(2026, 4, 25), goals: [] });
    check('no active goals → nothing created', r.created === 0 && r.rolesWithGoals === 0);
  }

  // ── injected goals → one task per role, persisted, idempotent ────────────────
  {
    const now = new Date(2026, 4, 25);
    const period = weeklyGoalUpdatePeriodKey(now);
    const goals: Goal[] = [
      goal({ id: 'r1', ownerRole: 'social_chair', status: 'active' }),
      goal({ id: 'r2', ownerRole: 'social_chair', status: 'active' }), // same role → one task
      goal({ id: 'r3', ownerRole: 'quaestor',     status: 'active' }),
      goal({ id: 'r4', ownerRole: 'quaestor',     status: 'archived' }), // not active
    ];
    const r1 = await runWeeklyGoalUpdateGeneration({ orgId: 'org-run', now, goals });
    check('first run creates one task per role with goals', r1.created === 2);
    check('first run rolesWithGoals = 2', r1.rolesWithGoals === 2);
    check('first run skipped 0', r1.skipped === 0);
    // The tasks landed in the store with the deterministic ids.
    check('social_chair task persisted', !!findTaskById(goalUpdateTaskId('social_chair', period)));
    check('quaestor task persisted', !!findTaskById(goalUpdateTaskId('quaestor', period)));
    // The persisted task carries availableAt + a goal-update definition id.
    const t = findTaskById(goalUpdateTaskId('social_chair', period));
    check('persisted task has availableAt', !!t && t.availableAt === weeklyGoalUpdateWindow(now).availableAt);
    check('persisted task has goal-update def id', !!t && (t.reportDefinitionId ?? '').startsWith('goalupddef_'));

    // ── re-run same week → everything skipped (idempotent) ──
    const r2 = await runWeeklyGoalUpdateGeneration({ orgId: 'org-run', now, goals });
    check('re-run creates nothing', r2.created === 0);
    check('re-run skips both roles', r2.skipped === 2);
    check('re-run rolesWithGoals still 2', r2.rolesWithGoals === 2);
  }

  // ── roles restriction ────────────────────────────────────────────────────────
  {
    const now = new Date(2026, 5, 8); // different week → fresh ids
    const goals: Goal[] = [
      goal({ id: 's1', ownerRole: 'social_chair', status: 'active' }),
      goal({ id: 's2', ownerRole: 'quaestor',     status: 'active' }),
    ];
    const r = await runWeeklyGoalUpdateGeneration({ orgId: 'org-run', now, goals, roles: ['quaestor'] });
    check('roles restriction → only that role', r.created === 1 && r.rolesWithGoals === 1);
  }

  console.log(`\ngoalUpdateRun.test: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
