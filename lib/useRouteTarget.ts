/**
 * useRouteTarget — composes the live auth + identity state into a RouteTarget
 * via the pure decideRoute(). Used by the route-group guards (C12c) to decide
 * whether to render their navigator or <Redirect> elsewhere.
 *
 * While AUTH_ENABLED is false, decideRoute() returns 'tabs' for everyone, so
 * every guard passes through and the app boots straight into the tabs.
 *
 * This is React-coupled (it reads useAuth/useIdentity), so it lives apart from
 * the pure routeTarget.ts. It must be called inside components rendered under
 * AuthProvider + IdentityProvider (i.e., the route-group layouts).
 */

import { useAuth } from './auth';
import { useIdentity } from './identityStore';
import { AUTH_ENABLED } from './flags';
import { decideRoute, type RouteTarget } from './initRoute';

export function useRouteTarget(): RouteTarget {
  const auth     = useAuth();
  const identity = useIdentity();
  return decideRoute({
    authEnabled:     AUTH_ENABLED,
    authInitialized: auth.initialized,
    hasSession:      !!auth.session,
    identityPhase:   identity.phase,
  });
}
