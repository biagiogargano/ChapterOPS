import { type Role, ROLES } from '@/lib/roles';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface DevRoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const DevRoleContext = createContext<DevRoleContextValue>({
  role: ROLES.PRESIDENT,
  setRole: () => {},
});

export function DevRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(ROLES.PRESIDENT);
  return (
    <DevRoleContext.Provider value={{ role, setRole }}>
      {children}
    </DevRoleContext.Provider>
  );
}

export function useDevRole() {
  return useContext(DevRoleContext);
}
