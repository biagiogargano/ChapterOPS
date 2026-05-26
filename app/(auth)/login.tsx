import { useAuth } from '@/lib/auth';
import { useIdentity } from '@/lib/identityStore';
import { useRouteTarget } from '@/lib/useRouteTarget';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Splash from '../../components/auth/Splash';
import ErrorRetry from '../../components/auth/ErrorRetry';

export default function LoginScreen() {
  const target = useRouteTarget();
  const { signInWithPassword, signOut } = useAuth();
  const { retry } = useIdentity();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Leaf guard ──────────────────────────────────────────────────────────────
  if (target === 'tabs')                                   return <Redirect href={'/(tabs)' as any} />;
  if (target === 'onboarding' || target === 'org_select')  return <Redirect href={'/(auth)/onboarding' as any} />;
  if (target === 'splash')                                 return <Splash />;
  if (target === 'error')
    return (
      <ErrorRetry
        message="We couldn’t load your profile. Check your connection and try again."
        onRetry={retry}
        onSignOut={() => { void signOut(); }}
      />
    );
  // target === 'login' → render the form

  async function handleSignIn() {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    setError(null);
    const res = await signInWithPassword(email.trim(), password);
    setLoading(false);
    if (res.error) setError(res.error);
    // On success the session updates → IdentityProvider resolves → guards redirect.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <View style={s.inner}>
        <Text style={s.title}>ChapterOPS</Text>
        <Text style={s.subtitle}>Sign in to your account.</Text>

        <View style={s.firstTimeNote}>
          <Text style={s.firstTimeText}>
            First time here? Tap <Text style={s.firstTimeBold}>Sign Up</Text> and use the email
            your chapter admin added for you.
          </Text>
        </View>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={t => { setEmail(t); setError(null); }}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#475569"
          secureTextEntry
          value={password}
          onChangeText={t => { setPassword(t); setError(null); }}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign In</Text>}
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push('/(auth)/signup' as any)}>
          <Text style={s.linkText}>No account? <Text style={s.linkAccent}>Sign up</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f172a' },
  inner:          { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:          { fontSize: 36, fontWeight: '800', color: '#f8fafc', textAlign: 'center', marginBottom: 2 },
  subtitle:       { fontSize: 15, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  firstTimeNote:  { backgroundColor: '#1e1b4b', borderRadius: 10, borderWidth: 1, borderColor: '#4f46e5', padding: 12, marginBottom: 12 },
  firstTimeText:  { color: '#c7d2fe', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  firstTimeBold:  { fontWeight: '800', color: '#a5b4fc' },
  input:          { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  error:          { color: '#f87171', fontSize: 13, textAlign: 'center' },
  button:         { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:        { alignItems: 'center', paddingVertical: 12 },
  linkText:       { color: '#94a3b8', fontSize: 14 },
  linkAccent:     { color: '#818cf8', fontWeight: '700' },
});
