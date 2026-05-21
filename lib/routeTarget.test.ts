/**
 * Isolated tests for lib/routeTarget.ts — dependency-free harness. Compile with
 * tsc to a temp dir, run with node; non-zero exit on failure. Covers the href
 * mapping for every RouteTarget.
 */

import { hrefForTarget } from './routeTarget';
import type { RouteTarget } from './initRoute';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, got: string, want: string): void {
  if (got === want) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name} — got '${got}', want '${want}'`); }
}

check('tabs',       hrefForTarget('tabs'),       '/(tabs)');
check('login',      hrefForTarget('login'),      '/(auth)/login');
check('onboarding', hrefForTarget('onboarding'), '/(auth)/onboarding');
check('org_select', hrefForTarget('org_select'), '/(auth)/onboarding');
check('error',      hrefForTarget('error'),      '/(auth)/login');
check('splash',     hrefForTarget('splash'),     '/(auth)/login');

// Exhaustiveness: every RouteTarget returns a non-empty href starting with '/'.
const ALL: RouteTarget[] = ['tabs', 'splash', 'login', 'onboarding', 'org_select', 'error'];
for (const t of ALL) {
  const href = hrefForTarget(t);
  check(`shape:${t}`, String(href.startsWith('/') && href.length > 1), 'true');
}

console.log(`\nrouteTarget.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
