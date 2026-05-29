import { useAuth } from '@/lib/auth';
import { AUTH_ENABLED } from '@/lib/flags';
import { Redirect, useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Auth callback / confirmation-success screen. Reached via RecoveryLinkHandler
 * for signup-confirmation (and magic-link) deep links, after the session is
 * established. It's a simple, reassuring landing so users know their email was
 * confirmed instead of seeing a blank localhost page.
 *
 * Continue routes to the app if a session resolved, otherwise to login.
 */
export default function AuthCallbackScreen() {
  const { session } = useAuth();
  const router = useRouter();

  // Inert when auth is disabled (flag-off builds never deep-link here).
  if (!AUTH_ENABLED) return <Redirect href={'/(tabs)' as any} />;

  function handleContinue() {
    if (session) router.replace('/(tabs)' as any);
    else         router.replace('/(auth)/login' as any);
  }

  return (
    <View style={s.container}>
      <View style={s.inner}>
        <Text style={s.check}>✓</Text>
        <Text style={s.title}>Email confirmed</Text>
        <Text style={s.subtitle}>You can now log in.</Text>

        <Pressable style={s.button} onPress={handleContinue}>
          <Text style={s.buttonText}>{session ? 'Continue' : 'Continue to login'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f172a' },
  inner:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 10 },
  check:      { fontSize: 56, color: '#4ade80', fontWeight: '800', marginBottom: 6 },
  title:      { fontSize: 30, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  subtitle:   { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  button:     { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
