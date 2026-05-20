/**
 * initRoute.ts — pure routing decision for the mounted-auth flow (Phase 1).
 *
 * Side-effect free: maps the current auth + identity state to a single route
 * target. This is the single source of truth for "what should the app show
 * right now." InitGate (components/InitGate.tsx) renders the target; this
 * module decides it. No React, no I/O — unit-testable in isolation.
 *
 * NOT wired into the app in C10. AUTH_ENABLED remains false; the first rule
 * short-circuits to 'tabs' so the existing dev/fallback sandbox is unaffected
 * once this is eventually mounted (C11).
 */

import type { IdentityPhase } from './identityResolution';

export type RouteTarget =
  | 'tabs'        // the real app
  | 'splash'      // loading / indeterminate
  | 'login'       // no session — unsigned users blocked
  | 'onboarding'  // signed in, zero memberships → join or create org
  | 'org_select'  // signed in, multiple memberships, none chosen
  | 'error';      // resolution failed (retryable)

export interface InitRouteInputs {
  authEnabled:     boolean;
  authInitialized: boolean;
  hasSession:      boolean;
  identityPhase:   IdentityPhase;
}

/**
 * Decide the route target by strict precedence (first match wins). See the C10
 * spec §3 for the rationale of each rule. Defaults to 'splash' (never 'tabs')
 * on an unrecognized state, so the app is never exposed on an unknown phase.
 */
export function decideRoute(inputs: InitRouteInputs): RouteTarget {
  const { authEnabled, authInitialized, hasSession, identityPhase } = inputs;

  // 1. Auth disabled → straight to the existing sandbox (dev/fallback).
  if (!authEnabled) return 'tabs';

  // 2. Auth state not yet known.
  if (!authInitialized) return 'splash';

  // 3. No session → unsigned users are blocked from the real app.
  if (!hasSession) return 'login';

  // 4–10. Session present: route by identity phase.
  switch (identityPhase) {
    case 'initializing':
    case 'resolving':
      return 'splash';
    case 'error':
      return 'error';
    case 'selecting_org':
      return 'org_select';
    case 'not_on_roster':
      return 'onboarding';   // zero memberships → join/create hub
    case 'resolved':
      return 'tabs';
    case 'fallback':
      return 'tabs';         // defensive; shouldn't occur with flag-on + session
    default:
      return 'splash';       // unknown → never expose the app
  }
}
