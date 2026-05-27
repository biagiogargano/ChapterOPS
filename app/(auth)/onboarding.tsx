import { useAuth } from '@/lib/auth';
import { useIdentity } from '@/lib/identityStore';
import { useRouteTarget } from '@/lib/useRouteTarget';
import { AUTH_ENABLED } from '@/lib/flags';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Splash from '../../components/auth/Splash';
import ErrorRetry from '../../components/auth/ErrorRetry';

/**
 * Onboarding hub — the destination for a signed-in user with no membership.
 * Offers Join / Create / Sign Out (Sign Out keeps the flow from dead-ending).
 */
export default function OnboardingScreen() {
  const target = useRouteTarget();
  const { signOut } = useAuth();
  const { retry } = useIdentity();
  const router = useRouter();

  // ── Leaf guard ──────────────────────────────────────────────────────────────
  if (target === 'tabs')   return <Redirect href={'/(tabs)' as any} />;
  if (target === 'login')  return <Redirect href={'/(auth)/login' as any} />;
  if (target === 'splash') return <Splash />;
  if (target === 'error')
    return (
      <ErrorRetry
        message="We couldn’t load your profile. Check your connection and try again."
        onRetry={retry}
        onSignOut={() => { void signOut(); }}
      />
    );
  // target === 'onboarding' | 'org_select' → render the hub

  return (
    <View style={s.root}>
      <Text style={s.title}>Welcome to ChapterOPS</Text>
      {AUTH_ENABLED ? (
        <Text style={s.body}>We couldn’t find you on a roster. Contact your chapter admin to be added.</Text>
      ) : (
        <Text style={s.body}>You’re signed in. Join your organization or create a new one.</Text>
      )}

      {/* Join-by-code is a real RPC; kept but de-emphasized in alpha (admin-seeded). */}
      <Pressable style={AUTH_ENABLED ? s.secondary : s.primary} onPress={() => router.push('/(auth)/join' as any)}>
        <Text style={AUTH_ENABLED ? s.secondaryText : s.primaryText}>Join with a code</Text>
      </Pressable>

      {/* Self-serve org creation is dev/flag-off only — alpha is admin-seeded, so
          offering it here would risk junk orgs. Hidden when auth is live. */}
      {!AUTH_ENABLED && (
        <Pressable style={s.secondary} onPress={() => router.push('/(auth)/create' as any)}>
          <Text style={s.secondaryText}>Create a new organization</Text>
        </Pressable>
      )}

      <Pressable style={s.signOut} onPress={() => { void signOut(); }}>
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:         { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body:          { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  primary:       { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', alignSelf: 'stretch' },
  primaryText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary:     { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', alignSelf: 'stretch' },
  secondaryText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
  signOut:       { paddingVertical: 12, marginTop: 4 },
  signOutText:   { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
