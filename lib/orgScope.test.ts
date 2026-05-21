/**
 * Isolated tests for lib/orgScope.ts — dependency-free harness (no framework).
 * Compile with tsc to a temp dir, run with node; non-zero exit on failure.
 */

import { resolveDataOrgId } from './orgScope';

const proc: { exit(code: number): never } = (globalThis as any).process;

const DEMO = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

let passed = 0;
let failed = 0;
function check(name: string, got: string, want: string): void {
  if (got === want) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name} — got '${got}', want '${want}'`); }
}

// scoped=false → always the fallback, regardless of activeOrgId
check('unscoped + active id  → fallback', resolveDataOrgId('org-x', false, DEMO), DEMO);
check('unscoped + null       → fallback', resolveDataOrgId(null,    false, DEMO), DEMO);

// scoped=true → the active org when present, else fallback
check('scoped + active id    → active',   resolveDataOrgId('org-x', true,  DEMO), 'org-x');
check('scoped + null         → fallback', resolveDataOrgId(null,    true,  DEMO), DEMO);
check('scoped + empty string → fallback', resolveDataOrgId('',      true,  DEMO), DEMO);

console.log(`\norgScope.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
