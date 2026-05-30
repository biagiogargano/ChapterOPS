/**
 * Isolated tests for lib/goalService.ts — dependency-free harness.
 *
 * ASYNC suite: exports runAsync() which the runner AWAITS and gates on the returned
 * { failed } (a plain async IIFE would resolve AFTER the loop — see the runner §4).
 *
 * In the pure-test runner, EXPO_PUBLIC_SUPABASE_* env is unset → isSupabaseConfigured()
 * is false, so every wrapper must take its FALLBACK-SAFE path: reads → [], mutations
 * → { ok:false, error:'unconfigured' }, and NONE throw. (The authenticated RPC
 * round-trip is exercised on-device, not here.)
 */

import {
  createGoal, listGoalsForOrg, listMyGoals, updateGoal, completeGoal, archiveGoal,
  listGoalsForOrgResult, listMyGoalsResult,
} from './goalService';

export async function runAsync(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const check = (name: string, cond: boolean): void => {
    if (cond) passed++;
    else { failed++; console.error(`  ✗ FAIL: ${name}`); }
  };

  // ── Reads fall back to [] ────────────────────────────────────────────────────
  check('listGoalsForOrg → [] when unconfigured', (await listGoalsForOrg('org-1')).length === 0);
  check('listMyGoals → [] when unconfigured', (await listMyGoals('org-1')).length === 0);
  check('listGoalsForOrg → [] on empty orgId', (await listGoalsForOrg('')).length === 0);
  check('listMyGoals → [] on empty orgId', (await listMyGoals('')).length === 0);

  // ── Error-aware read variants: unconfigured = ok:true empty (not an error) ────
  {
    const r1 = await listGoalsForOrgResult('org-1');
    check('listGoalsForOrgResult → ok:true when unconfigured (legit empty)', r1.ok === true && r1.goals.length === 0);
    check('listGoalsForOrgResult → no error when unconfigured', r1.error === undefined);
    const r2 = await listMyGoalsResult('org-1');
    check('listMyGoalsResult → ok:true when unconfigured', r2.ok === true && r2.goals.length === 0);
    const r3 = await listGoalsForOrgResult('');
    check('listGoalsForOrgResult → ok:true on empty orgId', r3.ok === true && r3.goals.length === 0);
    // The plain wrappers delegate to the result variant and still return [].
    check('listGoalsForOrg delegates → []', (await listGoalsForOrg('org-1')).length === 0);
    check('listMyGoals delegates → []', (await listMyGoals('org-1')).length === 0);
  }

  // ── Mutations return a safe failure ──────────────────────────────────────────
  {
    const r = await createGoal({ orgId: 'org-1', title: 'Recruit 12', cadence: 'weekly' });
    check('createGoal → ok:false when unconfigured', r.ok === false);
    check('createGoal → error unconfigured', r.error === 'unconfigured');
    check('createGoal → no goalId on failure', r.goalId === undefined);
  }
  check('createGoal → ok:false on missing input',
    (await createGoal({ orgId: '', title: '', cadence: 'weekly' })).ok === false);

  check('updateGoal → ok:false when unconfigured', (await updateGoal('g1', { currentValue: 5 })).ok === false);
  check('updateGoal → ok:false on empty id', (await updateGoal('', {})).ok === false);
  check('completeGoal → ok:false when unconfigured', (await completeGoal('g1')).ok === false);
  check('completeGoal → ok:false on empty id', (await completeGoal('')).ok === false);
  check('archiveGoal → ok:false when unconfigured', (await archiveGoal('g1')).ok === false);
  check('archiveGoal → ok:false on empty id', (await archiveGoal('')).ok === false);

  // ── No wrapper throws in fallback mode ───────────────────────────────────────
  let threw = false;
  try {
    await listGoalsForOrg('o');
    await listMyGoals('o');
    await createGoal({ orgId: 'o', title: 't', cadence: 'monthly' });
    await updateGoal('g', { title: 'x' });
    await completeGoal('g');
    await archiveGoal('g');
  } catch { threw = true; }
  check('no wrapper throws in fallback mode', threw === false);

  console.log(`\ngoalService.test: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
