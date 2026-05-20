/**
 * Isolated tests for lib/initRoute.ts — dependency-free harness (no framework).
 * Compile with tsc to a temp dir, run with node; non-zero exit on failure.
 * Asserts one case per precedence rule (C10 spec §3).
 */

import { decideRoute, type InitRouteInputs, type RouteTarget } from './initRoute';
import type { IdentityPhase } from './identityResolution';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, got: RouteTarget, want: RouteTarget): void {
  if (got === want) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name} — got '${got}', want '${want}'`); }
}

/** Build inputs with sensible defaults (flag on, initialized, session present). */
function inp(over: Partial<InitRouteInputs>): InitRouteInputs {
  return {
    authEnabled:     true,
    authInitialized: true,
    hasSession:      true,
    identityPhase:   'resolved',
    ...over,
  };
}

// R1 — auth disabled short-circuit → tabs (regardless of everything else)
check('R1 flag off → tabs',
  decideRoute(inp({ authEnabled: false, authInitialized: false, hasSession: false, identityPhase: 'error' })), 'tabs');

// R2 — not initialized → splash
check('R2 not initialized → splash',
  decideRoute(inp({ authInitialized: false })), 'splash');

// R3 — no session → login
check('R3 no session → login',
  decideRoute(inp({ hasSession: false })), 'login');

// R4 — resolving/initializing phase → splash
check('R4 resolving → splash',    decideRoute(inp({ identityPhase: 'resolving' })), 'splash');
check('R4 initializing → splash', decideRoute(inp({ identityPhase: 'initializing' })), 'splash');

// R5 — error → error
check('R5 error → error', decideRoute(inp({ identityPhase: 'error' })), 'error');

// R6 — selecting_org → org_select
check('R6 selecting_org → org_select', decideRoute(inp({ identityPhase: 'selecting_org' })), 'org_select');

// R7 — not_on_roster → onboarding
check('R7 not_on_roster → onboarding', decideRoute(inp({ identityPhase: 'not_on_roster' })), 'onboarding');

// R8 — resolved → tabs
check('R8 resolved → tabs', decideRoute(inp({ identityPhase: 'resolved' })), 'tabs');

// R9 — fallback (defensive) → tabs
check('R9 fallback → tabs', decideRoute(inp({ identityPhase: 'fallback' })), 'tabs');

// R10 — unknown phase → splash (never tabs)
check('R10 unknown phase → splash',
  decideRoute(inp({ identityPhase: ('weird_phase' as IdentityPhase) })), 'splash');

// Precedence sanity: flag-off beats a no-session that would otherwise be login
check('precedence: flag off wins over no-session',
  decideRoute(inp({ authEnabled: false, hasSession: false })), 'tabs');

console.log(`\ninitRoute.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
