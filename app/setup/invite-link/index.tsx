/**
 * app/setup/invite-link/index.tsx — invite link + join-form config (owner side).
 * PROTOTYPE / mock. Share one link; configure which questions people answer when
 * they join and which are required. Scales better than adding everyone by hand.
 * In-memory; dev-only; not in phase-2 / the alpha.
 */

import { INVITE_LINK, getJoinFields, toggleEnabled, toggleRequired, useJoinFormVersion } from '@/lib/orgBuild/mockJoinForm';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function InviteLinkScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  useJoinFormVersion();

  useEffect(() => { navigation.setOptions({ title: 'Invite link' }); }, [navigation]);

  const fields = getJoinFields();

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock link, nothing saved</Text></View>

      <Text style={s.heading}>Invite by link</Text>
      <Text style={s.sub}>Share one link — people join themselves and answer the questions you choose. Best for larger groups.</Text>

      <View style={s.linkCard}>
        <Text style={s.linkLabel}>YOUR JOIN LINK</Text>
        <Text style={s.link}>{INVITE_LINK}</Text>
        <View style={s.linkBtns}>
          <Pressable style={s.linkBtn} onPress={() => Alert.alert('Copied', '(Prototype) Link copied to clipboard.')}><Text style={s.linkBtnText}>Copy</Text></Pressable>
          <Pressable style={s.linkBtn} onPress={() => Alert.alert('Share', '(Prototype) Opens the share sheet.')}><Text style={s.linkBtnText}>Share</Text></Pressable>
        </View>
      </View>

      <Text style={s.sectionLabel}>WHAT TO ASK WHEN THEY JOIN</Text>
      <Text style={s.hint}>Toggle which questions to include, and which are required.</Text>

      {fields.map(f => (
        <View key={f.id} style={s.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{f.label}{f.locked ? '  (always)' : ''}</Text>
            {f.enabled && (
              <Pressable onPress={() => toggleRequired(f.id)} disabled={f.locked}>
                <Text style={[s.reqText, f.required && s.reqTextOn]}>{f.required ? '● Required' : '○ Optional'}</Text>
              </Pressable>
            )}
          </View>
          <Switch value={f.enabled} onValueChange={() => toggleEnabled(f.id)} disabled={f.locked} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" />
        </View>
      ))}

      <Pressable style={s.preview} onPress={() => router.push('/join' as any)}>
        <Text style={s.previewText}>Preview the join form ›</Text>
      </Pressable>

      <Text style={s.footNote}>People who join land in your roster, ready to place in the leadership tree. Real links + collected answers come with the auth/schema phase.</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  linkCard:  { backgroundColor: '#1e1b4b', borderRadius: 14, padding: 16, marginBottom: 22 },
  linkLabel: { fontSize: 11, fontWeight: '700', color: '#818cf8', letterSpacing: 0.8 },
  link:      { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginTop: 6 },
  linkBtns:  { flexDirection: 'row', gap: 8, marginTop: 12 },
  linkBtn:   { backgroundColor: '#312e81', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
  linkBtnText:{ color: '#c7d2fe', fontWeight: '700', fontSize: 13 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 6 },
  hint:         { fontSize: 12, color: '#64748b', marginBottom: 12 },

  fieldRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  reqText:    { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '600' },
  reqTextOn:  { color: '#a5b4fc' },

  preview:     { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  previewText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 18 },
});
