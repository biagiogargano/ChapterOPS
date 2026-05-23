/**
 * SearchablePicker — a reusable modal list with a filter box.
 *
 * For choosing one option from a list that may grow long (templates, events,
 * later assignees). Pure presentation: the parent owns the data and the
 * selection handler. Dark-themed to match the app.
 */

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export interface PickerOption {
  id:        string;
  label:     string;
  sublabel?: string;
}

export default function SearchablePicker({
  visible,
  title,
  hint,
  options,
  selectedId,
  searchPlaceholder = 'Search…',
  onSelect,
  onClose,
}: {
  visible:            boolean;
  title:              string;
  hint?:              string;
  options:            PickerOption[];
  selectedId?:        string;
  searchPlaceholder?: string;
  onSelect:           (id: string) => void;
  onClose:            () => void;
}) {
  const [query, setQuery] = useState('');
  // Reset the filter each time the picker opens.
  useEffect(() => { if (visible) setQuery(''); }, [visible]);

  const q = query.trim().toLowerCase();
  const filtered = q === '' ? options : options.filter(o => o.label.toLowerCase().includes(q));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* Inner press swallows taps so they don't close the modal. */}
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>
          {hint ? <Text style={s.hint}>{hint}</Text> : null}

          {options.length > 6 && (
            <TextInput
              style={s.search}
              placeholder={searchPlaceholder}
              placeholderTextColor="#475569"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          )}

          <ScrollView style={s.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <Text style={s.empty}>No matches{query.trim() ? ` for "${query.trim()}"` : ''}.</Text>
            ) : (
              filtered.map(o => {
                const isSel = o.id === selectedId;
                return (
                  <Pressable key={o.id} style={[s.row, isSel && s.rowSel]} onPress={() => onSelect(o.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowLabel, isSel && s.rowLabelSel]} numberOfLines={1}>{o.label}</Text>
                      {o.sublabel ? <Text style={s.rowSub} numberOfLines={1}>{o.sublabel}</Text> : null}
                    </View>
                    {isSel && <Text style={s.check}>✓</Text>}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable style={s.cancel} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 28 },
  card:     { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#334155', maxHeight: '70%' },
  title:    { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  hint:     { fontSize: 13, color: '#64748b', marginTop: 4 },
  search:   { backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  list:     { flexGrow: 0, marginTop: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', marginBottom: 8 },
  rowSel:   { borderColor: '#4f46e5', backgroundColor: '#1e1b4b' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#a5b4fc' },
  rowLabelSel: { color: '#c7d2fe' },
  rowSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  check:    { fontSize: 16, color: '#a5b4fc', fontWeight: '800' },
  empty:    { fontSize: 13, color: '#475569', paddingVertical: 12, textAlign: 'center' },
  cancel:     { paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
});
