import { useAuth } from '@/lib/auth';
import { useIdentity } from '@/lib/identityStore';
import { joinOrganizationByCode } from '@/lib/memberService';
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

/** Derive a temporary display name from the auth email's local-part (MVP). */
function displayNameFrom(email: string): string {
  const local = (email.split('@')[0] ?? '').trim();
  return local.length > 0 ? local : 'Member';
}

export default function JoinOrgScreen() {
  const target = useRouteTarget();
  const { user, signOut } = useAuth();
  const { setActiveOrg, retry } = useIdentity();
  const router = useRouter();

  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

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

  async function handleJoin() {
    if (!user) { setError('You must be signed in.'); return; }
    const email = user.email ?? '';
    if (!email) { setError('Your account has no email.'); return; }
    if (!code.trim()) { setError('Enter a join code.'); return; }
    setLoading(true);
    setError(null);
    const res = await joinOrganizationByCode(code, user.id, email, displayNameFrom(email));
    setLoading(false);

    if (res.kind === 'ok') {
      setActiveOrg(res.orgId);  // prefer the joined org
      retry();                  // re-resolve → membership found → guards redirect to tabs
      return;
    }
    if (res.kind === 'not_found') { setError('No organization found for that code.'); return; }
    setError(res.message);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
      <View style={s.inner}>
        <Text style={s.title}>Join an organization</Text>
        <Text style={s.body}>Enter the join code your chapter gave you.</Text>

        <TextInput
          style={s.input}
          placeholder="Join code"
          placeholderTextColor="#475569"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={t => { setCode(t); setError(null); }}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable style={[s.primary, loading && s.disabled]} onPress={handleJoin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Join</Text>}
        </Pressable>

        <Pressable style={s.back} onPress={() => router.back()}>
          <Text style={s.backText}>Back</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f172a' },
  inner:       { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:       { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body:        { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  input:       { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  error:       { color: '#f87171', fontSize: 13, textAlign: 'center' },
  primary:     { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  disabled:    { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  back:        { alignItems: 'center', paddingVertical: 12 },
  backText:    { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
