/**
 * app/(tabs)/pinned.tsx — customizable "Pinned" tab (prototype).
 * PROTOTYPE / mock. Quick access to things you use a lot (e.g. your weekly
 * report). Add from a catalog, remove freely. Conceptually role-gated — not
 * everyone needs this tab. In-memory; feature branch only; not in alpha.
 */

import { PINNABLE, getPinned, isPinned, pin, unpin, usePinnedVersion } from '@/lib/pinned/mockPinned';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PinnedScreen() {
  const router = useRouter();
  usePinnedVersion();
  const [adding, setAdding] = useState(false);

  const pinned   = getPinned();
  const available = PINNABLE.filter(p => !isPinned(p.id));

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · customizable, role-gated tab</Text></View>

      <View style={s.headerRow}>
        <Text style={s.h1}>Pinned</Text>
        <Pressable style={s.addBtn} onPress={() => setAdding(a => !a)}>
          <Text style={s.addBtnText}>{adding ? 'Done' : '+ Add'}</Text>
        </Pressable>
      </View>
      <Text style={s.sub}>Quick access to what you use most. Pin your weekly report, the agenda, attendance — whatever fits your role.</Text>

      {/* Add catalog */}
      {adding && (
        <View style={s.addBox}>
          <Text style={s.addLabel}>ADD A SHORTCUT</Text>
          {available.length === 0 ? (
            <Text style={s.empty}>Everything's already pinned.</Text>
          ) : (
            available.map(p => (
              <Pressable key={p.id} style={s.addRow} onPress={() => pin(p.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.addRowTitle}>{p.title}</Text>
                  <Text style={s.addRowSub}>{p.sub}</Text>
                </View>
                <Text style={s.plus}>＋</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Pinned items */}
      {pinned.length === 0 ? (
        <View style={s.emptyBox}><Text style={s.empty}>Nothing pinned yet. Tap “+ Add” to pin a shortcut.</Text></View>
      ) : (
        pinned.map(p => (
          <View key={p.id} style={s.card}>
            <Pressable style={s.cardMain} onPress={() => router.push(p.route as any)}>
              <Text style={s.star}>★</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{p.title}</Text>
                <Text style={s.cardSub}>{p.sub}</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
            {adding && (
              <Pressable style={s.removeBtn} onPress={() => unpin(p.id)} hitSlop={8}><Text style={s.removeText}>✕</Text></Pressable>
            )}
          </View>
        ))
      )}

      <Text style={s.footNote}>
        In the real app, who gets a Pinned tab (and other tabs) would be
        customizable + role-gated — not everyone needs it.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1:    { fontSize: 28, fontWeight: '800', color: '#f8fafc' },
  addBtn:    { backgroundColor: '#1e3a5f', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3b82f6' },
  addBtnText:{ color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  sub:   { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  addBox:   { backgroundColor: '#1e1b4b', borderRadius: 12, padding: 14, marginBottom: 18 },
  addLabel: { fontSize: 11, fontWeight: '700', color: '#818cf8', letterSpacing: 0.8, marginBottom: 8 },
  addRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#312e81' },
  addRowTitle: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  addRowSub:   { fontSize: 12, color: '#a5b4fc', marginTop: 1 },
  plus:     { fontSize: 20, color: '#c7d2fe', fontWeight: '700' },

  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 8 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  star:     { color: '#fbbf24', fontSize: 16 },
  cardTitle:{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardSub:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  chev:     { fontSize: 20, color: '#475569' },
  removeBtn:{ paddingHorizontal: 16, paddingVertical: 14 },
  removeText:{ color: '#f87171', fontSize: 16, fontWeight: '700' },

  emptyBox: { backgroundColor: '#0a1628', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 16 },
  empty:    { fontSize: 13, color: '#64748b' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
