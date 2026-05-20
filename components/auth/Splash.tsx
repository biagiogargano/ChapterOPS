/**
 * Splash — loading view for indeterminate auth/identity states.
 * Presentational only; no logic, no side effects. Not mounted in C10.
 */

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Splash() {
  return (
    <View style={s.root}>
      <Text style={s.wordmark}>ChapterOPS</Text>
      <ActivityIndicator color="#6366f1" />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 20 },
  wordmark: { fontSize: 24, fontWeight: '800', color: '#f8fafc', letterSpacing: 0.5 },
});
