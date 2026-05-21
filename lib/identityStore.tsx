/**
 * identityStore.tsx — IdentityProvider + useIdentity().
 *
 * Resolves a Supabase auth session into the active organization's membership
 * and the derived acting role, owning all loading/fallback/error phases.
 *
 * Phase 1, commit C12b: the session now comes from AuthProvider (via useAuth),
 * not from an internal supabase.auth subscription — a single auth source. The
 * fallback-first behavior is unchanged: while AUTH_ENABLED is false the layout
 * passes configuredOverride={false}, so the resolution effect short-circuits to
 * the President fallback before any auth value is consulted. The `auth` prop is
 * still injectable for tests. Imports only lib modules (no screens/stores/layouts).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth, type AuthContextType } from './auth';
import {
  isSupabaseConfigured,
  resolveIdentity as defaultResolveIdentity,
  type MemberResolution,
  type ResolutionErrorReason,
} from './memberService';
import { availableRoles as availableRolesOf } from './positions';
import {
  selectActiveOrg,
  membershipForOrg,
  actingRoleFor,
  buildFallbackMembership,
  type IdentityPhase,
} from './identityResolution';
import type { Role } from './roles';
import { ROLES } from './roles';
import type { Membership, Organization, Member, Position } from '@/types';

// ─── Auth input (sourced from AuthProvider via useAuth) ───────────────────────

export interface IdentityAuthUser {
  id:    string;
  email: string;
}

export interface IdentityAuthInput {
  initialized: boolean;
  user:        IdentityAuthUser | null;
  devBypass:   boolean;
}

/** Map the AuthProvider context surface to IdentityProvider's auth input. */
function ctxToAuthInput(ctx: AuthContextType): IdentityAuthInput {
  return {
    initialized: ctx.initialized,
    user:        ctx.user ? { id: ctx.user.id, email: ctx.user.email ?? '' } : null,
    devBypass:   false,
  };
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface IdentityValue {
  phase:          IdentityPhase;
  memberships:    Membership[];
  activeOrgId:    string | null;
  organization:   Organization | null;
  member:         Member | null;
  positions:      Position[];
  actingRole:     Role;            // always valid; 'brother' floor when unresolved
  availableRoles: Role[];
  isFallback:     boolean;
  errorReason:    ResolutionErrorReason | null;
  devRoleOverride:    Role | null;
  setDevRoleOverride: (r: Role | null) => void;
  setActiveOrg:       (orgId: string) => void;   // dormant in MVP
  retry:              () => void;
}

const DEFAULT_VALUE: IdentityValue = {
  phase:          'initializing',
  memberships:    [],
  activeOrgId:    null,
  organization:   null,
  member:         null,
  positions:      [],
  actingRole:     ROLES.BROTHER,
  availableRoles: [ROLES.BROTHER],
  isFallback:     false,
  errorReason:    null,
  devRoleOverride:    null,
  setDevRoleOverride: () => {},
  setActiveOrg:       () => {},
  retry:              () => {},
};

const IdentityContext = createContext<IdentityValue>(DEFAULT_VALUE);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface IdentityProviderProps {
  children: ReactNode;
  /** Inject auth input (tests). When omitted, reads the AuthProvider session via useAuth(). */
  auth?: IdentityAuthInput;
  /** Inject the resolver (tests). Defaults to memberService.resolveIdentity. */
  resolver?: (authUserId: string, email: string) => Promise<MemberResolution>;
  /** Override the configured check (tests). */
  configuredOverride?: boolean;
}

export function IdentityProvider({
  children,
  auth: authProp,
  resolver = defaultResolveIdentity,
  configuredOverride,
}: IdentityProviderProps) {
  // Auth source: the AuthProvider session (the single supabase.auth subscription
  // lives there). useAuth() is called unconditionally; an injected authProp
  // overrides it for tests. IdentityProvider holds NO subscription of its own.
  const ctxAuth = useAuth();
  const auth = authProp ?? ctxToAuthInput(ctxAuth);

  const configured = configuredOverride ?? isSupabaseConfigured();

  // Synchronous fallback seed: when unconfigured, initialize directly to the
  // fallback identity so the very first render is already resolved (President),
  // with no 'brother' floor flash before the resolution effect runs.
  const [initialFallback] = useState<Membership | null>(
    () => (!configured ? buildFallbackMembership() : null),
  );
  const [phase, setPhase]             = useState<IdentityPhase>(() => (initialFallback ? 'fallback' : 'initializing'));
  const [memberships, setMemberships] = useState<Membership[]>(() => (initialFallback ? [initialFallback] : []));
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => (initialFallback ? initialFallback.organization.id : null));
  const [errorReason, setErrorReason] = useState<ResolutionErrorReason | null>(null);
  const [devRoleOverride, setDevRoleOverride] = useState<Role | null>(null);
  const [preferredOrgId, setPreferredOrgId]   = useState<string | null>(null);
  const [resolveNonce, setResolveNonce]       = useState(0);

  // Monotonic request id — guards against stale async resolves overwriting state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const reqId = ++requestIdRef.current;

    const setNonResolved = (p: IdentityPhase) => {
      setMemberships([]);
      setActiveOrgId(null);
      setErrorReason(null);
      setPhase(p);
    };

    const applyFallback = () => {
      const fb = buildFallbackMembership();
      setMemberships([fb]);
      setActiveOrgId(fb.organization.id);
      setErrorReason(null);
      setPhase('fallback');
    };

    // 1. Unconfigured → synthetic fallback identity.
    if (!configured) { applyFallback(); return; }
    // 2. Dev bypass → synthetic fallback identity.
    if (auth.devBypass) { applyFallback(); return; }
    // 3. Auth not initialized yet.
    if (!auth.initialized) { setNonResolved('initializing'); return; }
    // 4. Initialized, no session (InitGate will route to login).
    if (!auth.user) { setNonResolved('initializing'); return; }

    // 5. Session present → resolve membership(s).
    setNonResolved('resolving');
    resolver(auth.user.id, auth.user.email)
      .then((res: MemberResolution) => {
        if (reqId !== requestIdRef.current) return; // stale — a newer effect ran
        if (res.kind === 'resolved') {
          const sel = selectActiveOrg(res.memberships, preferredOrgId);
          setMemberships(res.memberships);
          setActiveOrgId(sel.activeOrgId);
          setErrorReason(null);
          setPhase(sel.phase);
        } else if (res.kind === 'not_on_roster') {
          setMemberships([]); setActiveOrgId(null); setErrorReason(null); setPhase('not_on_roster');
        } else {
          setMemberships([]); setActiveOrgId(null); setErrorReason(res.reason); setPhase('error');
        }
      })
      .catch(() => {
        if (reqId !== requestIdRef.current) return;
        setMemberships([]); setActiveOrgId(null); setErrorReason('transient'); setPhase('error');
      });
  // preferredOrgId intentionally excluded — setActiveOrg applies it directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, auth.devBypass, auth.initialized, auth.user?.id, resolveNonce]);

  // Clear any dev role override when the authenticated user changes (sign-out /
  // account switch) so Account B never inherits Account A's selected dev role.
  // The override is only ever honored in dev/fallback (allowOverride), so this
  // does not affect production role resolution. Inert while AUTH_ENABLED is
  // false: auth.user is always null and its id never changes, so this fires once
  // on mount as a no-op (override already null) and never again.
  useEffect(() => {
    setDevRoleOverride(null);
  }, [auth.user?.id]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeMembership = useMemo(
    () => membershipForOrg(memberships, activeOrgId),
    [memberships, activeOrgId],
  );
  const organization = activeMembership?.organization ?? null;
  const member       = activeMembership?.member ?? null;
  const positions    = useMemo(() => activeMembership?.positions ?? [], [activeMembership]);

  const isFallback    = phase === 'fallback';
  const allowOverride = __DEV__ || isFallback;

  const actingRole = useMemo(
    () => actingRoleFor({ phase, allowOverride, positions, override: devRoleOverride }),
    [phase, allowOverride, positions, devRoleOverride],
  );
  const availableRoles = useMemo(() => availableRolesOf(positions), [positions]);

  const retry = useCallback(() => setResolveNonce(n => n + 1), []);

  const setActiveOrg = useCallback((orgId: string) => {
    setPreferredOrgId(orgId);
    setMemberships(current => {
      if (current.some(m => m.organization.id === orgId)) {
        setActiveOrgId(orgId);
        setPhase('resolved');
      }
      return current;
    });
  }, []);

  const value = useMemo<IdentityValue>(() => ({
    phase,
    memberships,
    activeOrgId,
    organization,
    member,
    positions,
    actingRole,
    availableRoles,
    isFallback,
    errorReason,
    devRoleOverride,
    setDevRoleOverride,
    setActiveOrg,
    retry,
  }), [
    phase, memberships, activeOrgId, organization, member, positions, actingRole,
    availableRoles, isFallback, errorReason, devRoleOverride, setActiveOrg, retry,
  ]);

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

/** Read the current identity. Returns a safe default outside any provider. */
export function useIdentity(): IdentityValue {
  return useContext(IdentityContext);
}
