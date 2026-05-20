/**
 * OnboardingHub — shown when a signed-in user has zero memberships. Offers the
 * Join vs Create choice. Buttons call prop callbacks only; no navigation, no
 * writes. Not mounted in C10 (join/create logic arrives in C13).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface OnboardingHubProps {
  onJoin:   () => void;
  onCreate: () => void;
}

export default function OnboardingHub({ onJoin, onCreate }: OnboardingHubProps) {
  return (
    <View style={s.root}>
      <Text style={s.title}>Welcome to ChapterOPS</Text>
      <Text style={s.body}>You’re signed in. Join your organization or create a new one.</Text>

      <Pressable style={s.primary} onPress={onJoin}>
        <Text style={s.primaryText}>Join an organization</Text>
      </Pressable>
      <Pressable style={s.secondary} onPress={onCreate}>
        <Text style={s.secondaryText}>Create a new organization</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:         { fontSize: 24, fontWeight: '800', color: '#f8fafc', textAlign: 'center' },
  body:          { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  primary:       { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', alignSelf: 'stretch' },
  primaryText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary:     { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', alignSelf: 'stretch' },
  secondaryText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
});
