/**
 * ErrorRetry — shown when identity resolution fails. Buttons call prop
 * callbacks only; this stub performs no auth/network actions itself.
 * Not mounted in C10.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ErrorRetryProps {
  message?:   string;
  onRetry:    () => void;
  onSignOut:  () => void;
}

export default function ErrorRetry({ message, onRetry, onSignOut }: ErrorRetryProps) {
  return (
    <View style={s.root}>
      <Text style={s.title}>Couldn’t load your profile</Text>
      <Text style={s.body}>
        {message ?? 'Something went wrong. Check your connection and try again.'}
      </Text>
      <Pressable style={s.primary} onPress={onRetry}>
        <Text style={s.primaryText}>Retry</Text>
      </Pressable>
      <Pressable style={s.secondary} onPress={onSignOut}>
        <Text style={s.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:         { fontSize: 20, fontWeight: '700', color: '#f8fafc', textAlign: 'center' },
  body:          { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  primary:       { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 28, alignItems: 'center' },
  primaryText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary:     { paddingVertical: 10, paddingHorizontal: 20 },
  secondaryText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
});
