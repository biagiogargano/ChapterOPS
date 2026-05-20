/**
 * auth.tsx — stable auth context surface.
 *
 * Phase 1, commit C8: interface stabilization ONLY. This defines the auth
 * surface the rest of the app will consume, behind a single AUTH_ENABLED
 * branch. It is NOT mounted in the app tree yet (C11 wires it), and
 * AUTH_ENABLED is false, so this changes no runtime behavior.
 *
 *   if (!AUTH_ENABLED) → fallbackAuthSurface  (initialized=true, no session,
 *                        methods are controlled "auth disabled" no-ops)
 *   else               → RealAuthProvider     (live supabase.auth session)
 *
 * The fallback identity (IdentityProvider, devRoleStore shim) does NOT depend
 * on this surface while the flag is off — they remain fully decoupled.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AUTH_ENABLED } from './flags';

/** Result shape for sign-in calls — a controlled error string, never a throw. */
export interface AuthActionResult {
  error: string | null;
}

export interface AuthContextType {
  initialized:        boolean;
  session:            Session | null;
  user:               User | null;
  signInWithOtp:      (email: string) => Promise<AuthActionResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  signUp:             (email: string, password: string) => Promise<AuthActionResult>;
  signOut:            () => Promise<void>;
}

const AUTH_DISABLED = 'Authentication is disabled.';

/**
 * Fallback surface used while AUTH_ENABLED is false. `initialized` is true (the
 * surface is ready), but there is never a session/user. Methods are safe
 * no-ops that return a controlled "auth disabled" error rather than throwing or
 * touching Supabase.
 */
const fallbackAuthSurface: AuthContextType = {
  initialized:        true,
  session:            null,
  user:               null,
  signInWithOtp:      async () => ({ error: AUTH_DISABLED }),
  signInWithPassword: async () => ({ error: AUTH_DISABLED }),
  signUp:             async () => ({ error: AUTH_DISABLED }),
  signOut:            async () => {},
};

const AuthContext = createContext<AuthContextType>(fallbackAuthSurface);

/**
 * Real auth surface — only rendered when AUTH_ENABLED is true. Subscribes to
 * supabase.auth and exposes the live session/user plus real sign-in/out.
 */
function RealAuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession]         = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setInitialized(true);
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signInWithOtp = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    initialized,
    session,
    user: session?.user ?? null,
    signInWithOtp,
    signInWithPassword,
    signUp,
    signOut,
  }), [initialized, session, signInWithOtp, signInWithPassword, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Single branch point. While AUTH_ENABLED is false this provides the static
 * fallback surface (no hooks, no subscription, no async startup). When the flag
 * is on, it delegates to RealAuthProvider.
 *
 * Note: AuthProvider itself calls no hooks in either branch, so the AUTH_ENABLED
 * branch is safe (RealAuthProvider, a separate component, owns all the hooks).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!AUTH_ENABLED) {
    return <AuthContext.Provider value={fallbackAuthSurface}>{children}</AuthContext.Provider>;
  }
  return <RealAuthProvider>{children}</RealAuthProvider>;
}

export const useAuth = () => useContext(AuthContext);
