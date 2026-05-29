import { useAuth } from '@/lib/auth';
import { AUTH_ENABLED } from '@/lib/flags';
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

/**
 * Root-level password-reset screen (intentionally OUTSIDE the (auth) group so
 * its layout guard won't bounce away while a recovery session is live).
 * Reached via RecoveryLinkHandler after a `type=recovery` deep link establishes
 * a temporary session. After the password is updated we sign out and send the
 * user back to login to sign in fresh with the new password.
 */
export default function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  // Inert when auth is disabled (flag-off builds never deep-link here).
  if (!AUTH_ENABLED) return <Redirect href={'/(tabs)' as any} />;

  async function handleUpdate() {
    if (!password)            { setError('Enter a new password.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    const res = await updatePassword(password);
    if (res.error) { setLoading(false); setError(res.error); return; }
    // Sign out of the temporary recovery session so the user logs in fresh.
    await signOut();
    setLoading(false);
    setDone(true);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <View style={s.inner}>
        <Text style={s.title}>Set a new password</Text>

        {done ? (
          <>
            <Text style={s.subtitle}>Your password has been updated.</Text>
            <View style={s.note}>
              <Text style={s.noteText}>You can now log in with your new password.</Text>
            </View>
            <Pressable style={s.button} onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={s.buttonText}>Continue to login</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.subtitle}>Choose a new password for your account.</Text>

            <TextInput
              style={s.input}
              placeholder="New password"
              placeholderTextColor="#475569"
              secureTextEntry
              value={password}
              onChangeText={t => { setPassword(t); setError(null); }}
            />
            <TextInput
              style={s.input}
              placeholder="Confirm new password"
              placeholderTextColor="#475569"
              secureTextEntry
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(null); }}
            />

            {error && <Text style={s.error}>{error}</Text>}

            <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleUpdate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Update password</Text>}
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
});
