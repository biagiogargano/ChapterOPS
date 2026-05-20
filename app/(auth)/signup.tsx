import { useAuth } from '@/lib/auth';
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

export default function SignupScreen() {
  const target = useRouteTarget();
  const { signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);

  // ── Leaf guard ──────────────────────────────────────────────────────────────
  if (target === 'tabs')                                   return <Redirect href={'/(tabs)' as any} />;
  if (target === 'onboarding' || target === 'org_select')  return <Redirect href={'/(auth)/pending' as any} />;
  if (target === 'splash' || target === 'error')           return <Splash />;
  // target === 'login' (no session) → render the form

  async function handleSignUp() {
    if (!email || !password)        { setError('Enter your email and password.'); return; }
    if (password.length < 6)        { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)       { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await signUp(email.trim(), password);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    // If the project requires email confirmation, no session is created — guide
    // the user. If confirmation is off, a session exists and the guards redirect.
    setInfo('Account created. Check your email to confirm, then sign in.');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <View style={s.inner}>
        <Text style={s.title}>Create account</Text>
        <Text style={s.subtitle}>Join ChapterOPS.</Text>

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
        <TextInput
          style={s.input}
          placeholder="Confirm password"
          placeholderTextColor="#475569"
          secureTextEntry
          value={confirm}
          onChangeText={t => { setConfirm(t); setError(null); }}
        />

        {error && <Text style={s.error}>{error}</Text>}
        {info  && <Text style={s.info}>{info}</Text>}

        <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign Up</Text>}
        </Pressable>

        <Pressable style={s.linkRow} onPress={() => router.push('/(auth)/login' as any)}>
          <Text style={s.linkText}>Have an account? <Text style={s.linkAccent}>Sign in</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f172a' },
  inner:          { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:          { fontSize: 32, fontWeight: '800', color: '#f8fafc', textAlign: 'center', marginBottom: 2 },
  subtitle:       { fontSize: 15, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  input:          { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  error:          { color: '#f87171', fontSize: 13, textAlign: 'center' },
  info:           { color: '#4ade80', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  button:         { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:        { alignItems: 'center', paddingVertical: 12 },
  linkText:       { color: '#94a3b8', fontSize: 14 },
  linkAccent:     { color: '#818cf8', fontWeight: '700' },
});
