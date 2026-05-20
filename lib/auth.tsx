import { supabase } from '@/lib/supabase';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthContextType {
  initialized: boolean;
  authenticated: boolean;
  devSignIn: () => void;
  devSignOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  initialized: false,
  authenticated: false,
  devSignIn: () => {},
  devSignOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState(false);
  const [devAuthenticated, setDevAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
      setInitialized(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        initialized: initialized || devAuthenticated,
        authenticated: session || devAuthenticated,
        devSignIn: () => setDevAuthenticated(true),
        devSignOut: () => setDevAuthenticated(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
