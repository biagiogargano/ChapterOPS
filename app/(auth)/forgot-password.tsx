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

export default function ForgotPasswordScreen() {
  const target = useRouteTarget();
  const { resetPasswordForEmail, signOut } = useAuth();
  const { retry } = useIdentity();
  const router = useRouter();

  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [sent, setSent]     = useState(false);

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
  // target === 'login' (no session) → render the form

  async function handleSend() {
    if (!email) { setError('Enter your email.'); return; }
    setLoading(true);
    setError(null);
    const res = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <View style={s.inner}>
        <Text style={s.title}>Reset password</Text>
        <Text style={s.subtitle}>
          Enter your email and we’ll send you a link to set a new password.
        </Text>

        {sent ? (
          <>
            <View style={s.note}>
              <Text style={s.noteText}>
                Check your email for a reset link. Open it on this device to set a
                new password.
              </Text>
            </View>
            <Pressable style={s.button} onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={s.buttonText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={t => { setEmail(t); setError(null); }}
            />

            {error && <Text style={s.error}>{error}</Text>}

            <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleSend} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send reset link</Text>}
            </Pressable>

            <Pressable style={s.linkRow} onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={s.linkText}>Remembered it? <Text style={s.linkAccent}>Sign in</Text></Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f172a' },
  inner:          { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:          { fontSize: 32, fontWeight: '800', color: '#f8fafc', textAlign: 'center', marginBottom: 2 },
  subtitle:       { fontSize: 15, color: '#94a3b8', textAlign: 'center', marginBottom: 12, lineHeight: 21 },
  input:          { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  error:          { color: '#f87171', fontSize: 13, textAlign: 'center' },
  note:           { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', padding: 14, marginBottom: 4 },
  noteText:       { color: '#cbd5e1', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  button:         { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:        { alignItems: 'center', paddingVertical: 12 },
  linkText:       { color: '#94a3b8', fontSize: 14 },
  linkAccent:     { color: '#818cf8', fontWeight: '700' },
});
