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
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AUTH_ENABLED } from './flags';

/** Result shape for sign-in calls — a controlled error string, never a throw. */
export interface AuthActionResult {
  error: string | null;
}

export interface AuthContextType {
  initialized:          boolean;
  session:              Session | null;
  user:                 User | null;
  signInWithOtp:        (email: string) => Promise<AuthActionResult>;
  signInWithPassword:   (email: string, password: string) => Promise<AuthActionResult>;
  signUp:               (email: string, password: string) => Promise<AuthActionResult>;
  signOut:              () => Promise<void>;
  /** Send a password-recovery email; link returns to the app via deep link. */
  resetPasswordForEmail: (email: string) => Promise<AuthActionResult>;
  /** Update the signed-in (recovery-session) user's password. */
  updatePassword:        (password: string) => Promise<AuthActionResult>;
  /** Establish a session from deep-link recovery/confirmation tokens. */
  setSessionFromTokens:  (accessToken: string, refreshToken: string) => Promise<AuthActionResult>;
}

/**
 * Deep-link redirect target for all auth emails (confirmation + recovery). Built
 * from the app scheme via Linking.createURL so it resolves to
 * `chapterops://auth/callback` in a standalone/TestFlight build (and the
 * exp://.../--/auth/callback dev-client equivalent). The matching URL(s) must be
 * allowlisted in Supabase Auth → URL Configuration → Redirect URLs.
 */
export const AUTH_REDIRECT_URL = Linking.createURL('/auth/callback');

const AUTH_DISABLED = 'Authentication is disabled.';

/**
 * Fallback surface used while AUTH_ENABLED is false. `initialized` is true (the
 * surface is ready), but there is never a session/user. Methods are safe
 * no-ops that return a controlled "auth disabled" error rather than throwing or
 * touching Supabase.
 */
const fallbackAuthSurface: AuthContextType = {
  initialized:           true,
  session:               null,
  user:                  null,
  signInWithOtp:         async () => ({ error: AUTH_DISABLED }),
  signInWithPassword:    async () => ({ error: AUTH_DISABLED }),
  signUp:                async () => ({ error: AUTH_DISABLED }),
  signOut:               async () => {},
  resetPasswordForEmail: async () => ({ error: AUTH_DISABLED }),
  updatePassword:        async () => ({ error: AUTH_DISABLED }),
  setSessionFromTokens:  async () => ({ error: AUTH_DISABLED }),
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
    // emailRedirectTo brings the confirmation link back into the app (deep link)
    // instead of the project Site URL (which is localhost → blank page).
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT_URL,
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  const setSessionFromTokens = useCallback(
    async (accessToken: string, refreshToken: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken,
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const value = useMemo<AuthContextType>(() => ({
    initialized,
    session,
    user: session?.user ?? null,
    signInWithOtp,
    signInWithPassword,
    signUp,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    setSessionFromTokens,
  }), [initialized, session, signInWithOtp, signInWithPassword, signUp, signOut,
       resetPasswordForEmail, updatePassword, setSessionFromTokens]);

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
