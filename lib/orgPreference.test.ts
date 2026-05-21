/**
 * Isolated tests for lib/orgPreference.ts — dependency-free harness (no
 * framework). Compile with tsc to a temp dir, run with node; non-zero exit on
 * failure. Mirrors the lib/orgScope.test.ts pattern.
 *
 * Scope: only the PURE key builder. The AsyncStorage wrappers are integration
 * surface (verified manually); the test runner stubs the native module so the
 * module is importable under node.
 */

import { preferredOrgKey } from './orgPreference';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Deterministic: same input → same key.
check('key is deterministic', preferredOrgKey('u1') === preferredOrgKey('u1'));

// Exact namespaced value.
check('key has exact namespaced value', preferredOrgKey('u1') === 'chapterops.preferredOrgId.u1');

// Different users → different keys (per-user isolation).
check('different user ids → different keys', preferredOrgKey('u1') !== preferredOrgKey('u2'));

// Namespaced under the chapterops prefix.
check('key is namespaced', preferredOrgKey('abc').startsWith('chapterops.preferredOrgId.'));

console.log(`\norgPreference.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
