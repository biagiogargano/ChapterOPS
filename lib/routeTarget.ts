/**
 * routeTarget.ts — pure mapping from a RouteTarget to an expo-router href.
 *
 * Phase 1, commit C12a: inert groundwork. This is the redirect-destination
 * lookup the router guards will use in C12c. It is pure (imports only the
 * RouteTarget type) and imported nowhere yet — zero runtime effect.
 *
 * NOTE: the `useRouteTarget()` hook (which wires useAuth/useIdentity/AUTH_ENABLED
 * → decideRoute) is intentionally NOT added here yet — it belongs with the
 * router guards in C12c. Keeping this module React-free preserves isolated,
 * node-runnable unit testing.
 *
 * Routing is NOT wired in C12a; these hrefs describe intended destinations.
 * 'onboarding'/'org_select' point at a temporary '(auth)/pending' placeholder
 * until the real onboarding group lands in C13. 'splash'/'error' are rendered
 * inline by the guard (loading / ErrorRetry), so their href is a safe fallback
 * only and is not used for an actual redirect.
 */

import type { RouteTarget } from './initRoute';

export function hrefForTarget(target: RouteTarget): string {
  switch (target) {
    case 'tabs':       return '/(tabs)';
    case 'login':      return '/(auth)/login';
    case 'onboarding': return '/(auth)/pending';   // C13 → '/(onboarding)'
    case 'org_select': return '/(auth)/pending';    // C13 → org picker
    case 'error':      return '/(auth)/login';       // fallback; guard renders ErrorRetry inline
    case 'splash':     return '/(auth)/login';       // fallback; guard renders loading inline
    default:           return '/(auth)/login';       // exhaustive safety net
  }
}
