import {
  deleteCustomTemplate,
  getCustomTemplates,
  useCustomTemplatesVersion,
} from '@/lib/customTemplatesStore';
import { EVENT_TEMPLATES, type EventTaskTemplate } from '@/lib/eventTemplates';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function TemplateRow({
  template,
  builtIn,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template:    EventTaskTemplate;
  builtIn:     boolean;
  onEdit?:     () => void;
  onDuplicate: () => void;
  onDelete?:   () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{template.label}</Text>
        <Text style={s.cardSub}>
          {template.taskSpecs.length} task{template.taskSpecs.length === 1 ? '' : 's'}
          {builtIn ? '  ·  Built-in' : ''}
        </Text>
      </View>
      <View style={s.cardActions}>
        {builtIn ? (
          <Pressable style={s.actionBtn} onPress={onDuplicate}>
            <Text style={s.actionText}>Duplicate</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={s.actionBtn} onPress={onEdit}>
              <Text style={s.actionText}>Edit</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, s.actionBtnDanger]} onPress={onDelete}>
              <Text style={[s.actionText, s.actionTextDanger]}>Delete</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function TemplatesScreen() {
  const router     = useRouter();
  const navigation = useNavigation();

  useCustomTemplatesVersion();              // re-render on create/edit/delete
  const custom = getCustomTemplates();

  useEffect(() => {
    navigation.setOptions({
      title: 'Templates',
      headerRight: () => (
        <Pressable style={s.newBtn} onPress={() => router.push('/templates/edit' as any)}>
          <Text style={s.newText}>+ New</Text>
        </Pressable>
      ),
    });
  }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  function confirmDelete(t: EventTaskTemplate) {
    Alert.alert('Delete Template', `Delete "${t.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCustomTemplate(t.id) },
    ]);
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.intro}>
        Apply a template when creating an event to auto-generate its prep tasks. Duplicate a built-in to customize it, or build your own.
      </Text>

      <Text style={s.sectionLabel}>YOUR TEMPLATES</Text>
      {custom.length === 0 ? (
        <Text style={s.empty}>No custom templates yet. Tap “+ New” or duplicate a built-in below.</Text>
      ) : (
        custom.map(t => (
          <TemplateRow
            key={t.id}
            template={t}
            builtIn={false}
            onEdit={() => router.push(`/templates/edit?templateId=${t.id}` as any)}
            onDuplicate={() => router.push(`/templates/edit?duplicateFrom=${t.id}` as any)}
            onDelete={() => confirmDelete(t)}
          />
        ))
      )}

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>BUILT-IN</Text>
      {EVENT_TEMPLATES.map(t => (
        <TemplateRow
          key={t.id}
          template={t}
          builtIn
          onDuplicate={() => router.push(`/templates/edit?duplicateFrom=${t.id}` as any)}
        />
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  intro:        { fontSize: 13, color: '#94a3b8', lineHeight: 19, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },
  empty:        { fontSize: 13, color: '#475569', marginBottom: 4 },

  newBtn:  { paddingHorizontal: 12, paddingVertical: 4 },
  newText: { color: '#818cf8', fontSize: 15, fontWeight: '600' },

  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  cardBody:   { flex: 1, gap: 3 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  cardSub:    { fontSize: 12, color: '#64748b' },
  cardActions:{ flexDirection: 'row', gap: 8, flexShrink: 0 },
  actionBtn:  { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  actionText: { fontSize: 12, fontWeight: '600', color: '#818cf8' },
  actionBtnDanger:  { backgroundColor: '#1a0505', borderColor: '#7f1d1d' },
  actionTextDanger: { color: '#f87171' },
});
