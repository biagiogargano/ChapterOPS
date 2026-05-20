/**
 * devRoleStore.tsx — identity compatibility shim.
 *
 * The public contract is FROZEN: useDevRole() returns { role, setRole } exactly
 * as before, so no consumer (screens/stores) needs to change. What changed is
 * the SOURCE of the role:
 *
 *   • role    ← identity.actingRole   (derived within the active org; 'brother'
 *               floor while unresolved)
 *   • setRole ← identity.setDevRoleOverride (honored only in dev/fallback; a
 *               harmless no-op for role purposes in production resolved state)
 *
 * DevRoleProvider must be mounted BELOW IdentityProvider. While AUTH_ENABLED is
 * false, IdentityProvider is forced into its fallback branch (President, switch
 * enabled), so behavior matches the previous dev sandbox exactly.
 */

import { type Role, ROLES } from '@/lib/roles';
import { useIdentity } from '@/lib/identityStore';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

interface DevRoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const DevRoleContext = createContext<DevRoleContextValue>({
  role: ROLES.PRESIDENT,
  setRole: () => {},
});

export function DevRoleProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();

  const setRole = useCallback(
    (r: Role) => identity.setDevRoleOverride(r),
    [identity.setDevRoleOverride],
  );

  const value = useMemo<DevRoleContextValue>(
    () => ({ role: identity.actingRole, setRole }),
    [identity.actingRole, setRole],
  );

  return <DevRoleContext.Provider value={value}>{children}</DevRoleContext.Provider>;
}

export function useDevRole() {
  return useContext(DevRoleContext);
}
