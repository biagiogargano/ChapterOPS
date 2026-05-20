import { createContext, useContext, useState, type ReactNode } from 'react';

interface DevAuthContextType {
  devAuthenticated: boolean;
  devSignIn: () => void;
  devSignOut: () => void;
}

const DevAuthContext = createContext<DevAuthContextType>({
  devAuthenticated: false,
  devSignIn: () => {},
  devSignOut: () => {},
});

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [devAuthenticated, setDevAuthenticated] = useState(false);
  return (
    <DevAuthContext.Provider
      value={{
        devAuthenticated,
        devSignIn: () => setDevAuthenticated(true),
        devSignOut: () => setDevAuthenticated(false),
      }}
    >
      {children}
    </DevAuthContext.Provider>
  );
}

export const useDevAuth = () => useContext(DevAuthContext);
