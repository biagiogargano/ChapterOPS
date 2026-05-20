/**
 * JoinOrg — stub for joining an existing organization by code. Local input
 * state only; the "Join" button is disabled and performs NO submit/write in
 * C10 (join logic arrives in C13). Not mounted.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export interface JoinOrgProps {
  onBack?: () => void;
}

export default function JoinOrg({ onBack }: JoinOrgProps) {
  const [code, setCode] = useState('');

  return (
    <View style={s.root}>
      <Text style={s.title}>Join an organization</Text>
      <Text style={s.body}>Enter the join code your chapter gave you.</Text>

      <TextInput
        style={s.input}
        placeholder="Join code"
        placeholderTextColor="#475569"
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />

      {/* Disabled in C10 — no submit/write logic yet (C13). */}
      <Pressable style={[s.primary, s.disabled]} disabled>
        <Text style={s.primaryText}>Join</Text>
      </Pressable>

      {onBack && (
        <Pressable style={s.back} onPress={onBack}>
          <Text style={s.backText}>Back</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:       { fontSize: 22, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body:        { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  input:       { alignSelf: 'stretch', backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  primary:     { alignSelf: 'stretch', backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  disabled:    { opacity: 0.4 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  back:        { paddingVertical: 10 },
  backText:    { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
