/**
 * app/join/index.tsx — self-join form (joiner side of the invite link).
 * PROTOTYPE / mock. Renders exactly the questions the owner enabled (incl. phone),
 * enforces the required ones, and on submit adds the person to the roster so they
 * can be placed in the leadership tree. Nothing saved; dev-only; not in alpha.
 */

import { addInvite } from '@/lib/orgBuild/mockOrgBuild';
import { enabledJoinFields, INVITE_CODE, useJoinFormVersion } from '@/lib/orgBuild/mockJoinForm';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function JoinScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useJoinFormVersion();

  const fields = enabledJoinFields();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => { navigation.setOptions({ title: 'Join the chapter' }); }, [navigation]);

  const missing = fields.filter(f => f.required && !(values[f.id]?.trim()));
  const canSubmit = missing.length === 0;

  function submit() {
    if (!canSubmit) return;
    addInvite(values['name'] ?? '', values['email'] ?? '', values['position'] ?? '');
    router.replace('/setup/tree' as any);   // they're now in the roster, ready to place
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · join via link, nothing saved</Text></View>

        <Text style={s.heading}>Join the chapter</Text>
        <Text style={s.sub}>You were invited via link ({INVITE_CODE}). Fill out the info below to join.</Text>

        {fields.map(f => (
          <View key={f.id} style={s.field}>
            <Text style={s.label}>{f.label}{f.required ? ' *' : ''}</Text>
            <TextInput
              style={s.input}
              placeholder={f.required ? 'Required' : 'Optional'}
              placeholderTextColor="#475569"
              value={values[f.id] ?? ''}
              onChangeText={(t) => setValues(v => ({ ...v, [f.id]: t }))}
              keyboardType={f.keyboard === 'email-address' ? 'email-address' : f.keyboard === 'phone-pad' ? 'phone-pad' : 'default'}
              autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
            />
          </View>
        ))}

        <Pressable style={[s.primary, !canSubmit && s.primaryOff]} onPress={submit} disabled={!canSubmit}>
          <Text style={[s.primaryText, !canSubmit && s.primaryTextOff]}>Join</Text>
        </Pressable>
        {!canSubmit && <Text style={s.hint}>Fill the required fields ({missing.map(m => m.label).join(', ')}).</Text>}

        <Text style={s.footNote}>On join you're added to the roster and can be placed in the leadership tree. The owner controls these questions on the invite-link screen.</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20, lineHeight: 18 },

  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },

  primary:       { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryOff:    { backgroundColor: '#1e293b', borderColor: '#334155' },
  primaryText:   { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  primaryTextOff:{ color: '#475569' },
  hint:          { fontSize: 12, color: '#f59e0b', marginTop: 8, textAlign: 'center' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
