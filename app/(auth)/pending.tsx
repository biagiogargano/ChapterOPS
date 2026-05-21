import { useAuth } from '@/lib/auth';
import { useIdentity } from '@/lib/identityStore';
import { useRouteTarget } from '@/lib/useRouteTarget';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Splash from '../../components/auth/Splash';
import ErrorRetry from '../../components/auth/ErrorRetry';

/**
 * Pending — safe terminus for a signed-in user with NO organization membership.
 * It is intentionally NOT the join/create hub (that's C13); it just informs the
 * user and offers Sign Out, so the flow never dead-ends.
 */
export default function PendingScreen() {
  const target = useRouteTarget();
  const { signOut } = useAuth();
  const { retry } = useIdentity();
  const [busy, setBusy] = useState(false);

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
  // target === 'onboarding' | 'org_select' → render the terminus

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    // session clears → target becomes 'login' → guard above redirects to login
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>Almost there</Text>
      <Text style={s.body}>
        You’re signed in, but your account isn’t set up with an organization yet.
        Organization setup is coming soon.
      </Text>

      <Pressable style={[s.button, busy && s.buttonDisabled]} onPress={handleSignOut} disabled={busy}>
        {busy ? <ActivityIndicator color="#94a3b8" /> : <Text style={s.buttonText}>Sign Out</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  title:          { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body:           { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  button:         { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 28, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
});
