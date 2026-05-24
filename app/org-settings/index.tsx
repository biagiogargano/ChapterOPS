/**
 * app/org-settings/index.tsx — org settings + ownership transfer prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md §4). Rename the org, transfer
 * ownership (with a no-orphan confirm), and jump to the customizable structures.
 * Local mock state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const PEOPLE = ['Marcus Lee (Pro Consul)', 'Alex Rivera (Social Chair)', 'Chris Long (Annotator)'];

export default function OrgSettingsScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [name, setName]   = useState('Sigma Chi — Beta Chapter');
  const [owner, setOwner] = useState('You (Consul)');

  useEffect(() => { navigation.setOptions({ title: 'Org settings' }); }, [navigation]);

  function transfer() {
    Alert.alert(
      'Transfer ownership',
      'Who should become the new owner? They get full control; you stay an officer.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...PEOPLE.map(p => ({
          text: p,
          onPress: () => Alert.alert(
            'Confirm transfer',
            `Make ${p} the owner of ${name}? You can ask them to transfer it back later.`,
            [
              { text: 'Cancel', style: 'cancel' as const },
              { text: 'Transfer', onPress: () => setOwner(p) },
            ],
          ),
        })),
      ],
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · settings, nothing saved</Text></View>

      <Text style={s.heading}>Organization settings</Text>

      <Text style={s.label}>ORG NAME</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} />

      <Text style={s.label}>OWNER</Text>
      <View style={s.ownerCard}>
        <Text style={s.ownerName}>{owner}</Text>
        <Pressable style={s.transferBtn} onPress={transfer}><Text style={s.transferText}>Transfer</Text></Pressable>
      </View>
      <Text style={s.hint}>An org always has exactly one owner — you can hand it off but never leave it ownerless.</Text>

      <Text style={[s.label, { marginTop: 22 }]}>CUSTOMIZE YOUR ORG</Text>
      <Pressable style={s.linkRow} onPress={() => router.push('/setup/tree' as any)}>
        <Text style={s.linkText}>Edit leadership structure (Q&A builder)</Text><Text style={s.chev}>›</Text>
      </Pressable>
      <Pressable style={s.linkRow} onPress={() => router.push('/roster' as any)}>
        <Text style={s.linkText}>Manage members</Text><Text style={s.chev}>›</Text>
      </Pressable>
      <Pressable style={s.linkRow} onPress={() => router.push('/report/weekly' as any)}>
        <Text style={s.linkText}>Edit report questions</Text><Text style={s.chev}>›</Text>
      </Pressable>

      <Text style={s.footNote}>Real settings persist per org and are owner-gated (auth/schema phase).</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 18 },

  label: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 22 },

  ownerCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  ownerName:   { flex: 1, fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  transferBtn: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3b82f6' },
  transferText:{ color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  hint:        { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 17 },

  linkRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  chev:     { fontSize: 20, color: '#475569' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
