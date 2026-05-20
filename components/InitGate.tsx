/**
 * InitGate — renders the correct subtree for the current auth/identity state.
 *
 * Phase 1, commit C10: SCAFFOLD ONLY. This is exported but NOT imported by
 * app/_layout.tsx and is mounted nowhere, so it has zero runtime effect.
 * Its routing decision comes entirely from the pure decideRoute() (tested in
 * isolation). For non-'tabs' targets it renders placeholder screens; for 'tabs'
 * it renders children.
 *
 * C11 will mount this and replace the placeholder rendering with real
 * expo-router integration (Redirect / route groups). Login + org-select use a
 * Splash placeholder until their real screens land (C12+).
 */

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useIdentity } from '@/lib/identityStore';
import { decideRoute } from '@/lib/initRoute';
import { AUTH_ENABLED } from '@/lib/flags';
import Splash from '@/components/auth/Splash';
import ErrorRetry from '@/components/auth/ErrorRetry';
import OnboardingHub from '@/components/onboarding/OnboardingHub';

export interface InitGateProps {
  children: ReactNode;
}

export default function InitGate({ children }: InitGateProps) {
  const auth     = useAuth();
  const identity = useIdentity();

  const target = decideRoute({
    authEnabled:     AUTH_ENABLED,
    authInitialized: auth.initialized,
    hasSession:      !!auth.session,
    identityPhase:   identity.phase,
  });

  switch (target) {
    case 'tabs':
      return <>{children}</>;
    case 'error':
      return <ErrorRetry onRetry={identity.retry} onSignOut={() => { void auth.signOut(); }} />;
    case 'onboarding':
      // Join/create callbacks are no-ops in C10 (wired in C13).
      return <OnboardingHub onJoin={() => {}} onCreate={() => {}} />;
    case 'login':
    case 'org_select':
    case 'splash':
    default:
      // Placeholder until the real login / org-select screens land (C12+).
      return <Splash />;
  }
}
