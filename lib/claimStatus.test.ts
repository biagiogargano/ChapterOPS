/**
 * Isolated tests for lib/claimStatus.ts — dependency-free harness (no framework).
 * Compile with tsc to a temp dir, run with node; non-zero exit on failure.
 * Mirrors the lib/orgScope.test.ts pattern. Pure (no Supabase loaded).
 */

import { mapClaimStatusToResolution } from './claimStatus';
import type { Membership } from '@/types';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Minimal fixtures — the mapper only inspects memberships.length.
const none: Membership[] = [];
const one:  Membership[] = ([{}] as unknown) as Membership[];

// resolved + memberships present → resolved (carries memberships)
{
  const r = mapClaimStatusToResolution('resolved', one);
  check('resolved + members → kind resolved', r.kind === 'resolved');
  check('resolved carries memberships', r.kind === 'resolved' && r.memberships.length === 1);
}

// resolved + empty re-read → claim_conflict (guard against false resolved)
{
  const r = mapClaimStatusToResolution('resolved', none);
  check('resolved + empty → error claim_conflict',
    r.kind === 'error' && r.reason === 'claim_conflict');
}

// not_on_roster
{
  const r = mapClaimStatusToResolution('not_on_roster', none);
  check('not_on_roster → kind not_on_roster', r.kind === 'not_on_roster');
}

// deterministic error reasons
{
  const cases: Array<[string, string]> = [
    ['ambiguous_email', 'ambiguous_email'],
    ['email_taken',     'email_taken'],
    ['claim_conflict',  'claim_conflict'],
    ['missing_email',   'missing_email'],
  ];
  for (const [status, reason] of cases) {
    const r = mapClaimStatusToResolution(status, none);
    check(`${status} → error ${reason}`, r.kind === 'error' && r.reason === reason);
  }
}

// unauthenticated and unknown → retryable transient
{
  const u = mapClaimStatusToResolution('unauthenticated', none);
  check('unauthenticated → error transient', u.kind === 'error' && u.reason === 'transient');
  const x = mapClaimStatusToResolution('something_unexpected', none);
  check('unknown status → error transient', x.kind === 'error' && x.reason === 'transient');
}

console.log(`\nclaimStatus.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
