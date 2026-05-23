import {
  getTemplateById,
  newCustomTemplateId,
  saveCustomTemplate,
} from '@/lib/customTemplatesStore';
import type { EventTaskSpec, EventTaskTemplate } from '@/lib/eventTemplates';
import { PROOF_LABEL, type ProofType } from '@/lib/mockTasks';
import { OFFICER_ROLES, ROLE_LABELS, type Role } from '@/lib/roles';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const REVIEWER_ROLES: Role[] = ['pro_consul', 'president'];
const SUPERVISOR_ROLES: Role[] = ['pro_consul', 'president'];
const PROOF_TYPES: ProofType[] = ['text', 'link', 'document', 'image', 'screenshot'];

const DUE_PRESETS: { label: string; days: number }[] = [
  { label: '2 wks before', days: -14 },
  { label: '1 wk before',  days: -7 },
  { label: '3 days before', days: -3 },
  { label: '1 day before', days: -1 },
  { label: 'On day',       days: 0 },
  { label: '1 day after',  days: 1 },
];

let _keySeq = 0;
function newSpecKey(): string {
  return `s${Date.now().toString(36)}${(_keySeq++).toString(36)}`;
}

function blankSpec(): EventTaskSpec {
  return {
    key:           newSpecKey(),
    title:         '',
    description:   '',
    assignedRole:  'social_chair',
    dueOffsetDays: -3,
    requiresApproval: true,
    reviewerRole:  'pro_consul',
  };
}

// Days-offset readout: negative = before, 0 = day of, positive = after.
function offsetLabel(n: number): string {
  if (n === 0) return 'On event day';
  const d = Math.abs(n);
  return `${d} day${d === 1 ? '' : 's'} ${n < 0 ? 'before' : 'after'} event`;
}

export default function TemplateEditScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const params     = useLocalSearchParams<{ templateId?: string; duplicateFrom?: string }>();

  // Load source: edit an existing custom template, or duplicate any template.
  const source = useMemo(() => {
    const id = params.templateId ?? params.duplicateFrom;
    return id ? getTemplateById(id) : undefined;
  }, [params.templateId, params.duplicateFrom]);

  const editing = !!params.templateId;

  const [name,  setName ] = useState(() =>
    source ? (editing ? source.label : `${source.label} (copy)`) : '',
  );
  const [specs, setSpecs] = useState<EventTaskSpec[]>(() =>
    source ? source.taskSpecs.map(s => ({ ...s, key: newSpecKey() })) : [blankSpec()],
  );
  // Per-task "Options" disclosure (approval/proof). Collapsed by default; the
  // underlying values still apply whether or not the section is expanded.
  const [openOptions, setOpenOptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit Template' : 'New Template' });
  }, [navigation, editing]);

  function patchSpec(i: number, patch: Partial<EventTaskSpec>) {
    setSpecs(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeSpec(i: number) {
    setSpecs(prev => prev.filter((_, idx) => idx !== i));
  }
  function addSpec() {
    setSpecs(prev => [...prev, blankSpec()]);
  }
  function moveSpec(i: number, dir: -1 | 1) {
    setSpecs(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function toggleOptions(key: string) {
    setOpenOptions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const validSpecs = specs.filter(s => s.title.trim().length > 0);
  const canSave    = name.trim().length > 0 && validSpecs.length > 0;

  function handleSave() {
    if (!canSave) return;
    const template: EventTaskTemplate = {
      id:    params.templateId ?? newCustomTemplateId(),
      label: name.trim(),
      taskSpecs: validSpecs.map(s => ({
        ...s,
        title:       s.title.trim(),
        description: s.description?.trim() || s.title.trim(),
        reviewerRole: s.requiresApproval ? (s.reviewerRole ?? 'pro_consul') : undefined,
        proofType:    s.requiresProof ? (s.proofType ?? 'text') : undefined,
      })),
    };
    saveCustomTemplate(template);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Template name */}
        <Text style={s.fieldLabel}>TEMPLATE NAME</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Philanthropy Event"
          placeholderTextColor="#475569"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Task specs */}
        {specs.map((spec, i) => (
          <View key={spec.key} style={s.specCard}>
            <View style={s.specHeader}>
              <Text style={s.specHeaderText}>TASK {i + 1}</Text>
              <View style={s.specHeaderActions}>
                <Pressable onPress={() => moveSpec(i, -1)} disabled={i === 0} hitSlop={6}>
                  <Text style={[s.moveText, i === 0 && s.moveTextOff]}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveSpec(i, 1)} disabled={i === specs.length - 1} hitSlop={6}>
                  <Text style={[s.moveText, i === specs.length - 1 && s.moveTextOff]}>↓</Text>
                </Pressable>
                {specs.length > 1 && (
                  <Pressable onPress={() => removeSpec(i)} hitSlop={6}>
                    <Text style={s.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <TextInput
              style={s.input}
              placeholder='Task title — use {event} for the event name'
              placeholderTextColor="#475569"
              value={spec.title}
              onChangeText={v => patchSpec(i, { title: v })}
              autoCapitalize="sentences"
            />
            <TextInput
              style={[s.input, s.inputMultiline]}
              placeholder="Description (optional)"
              placeholderTextColor="#475569"
              value={spec.description}
              onChangeText={v => patchSpec(i, { description: v })}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />

            {/* Assignee */}
            <Text style={s.subLabel}>Assign to</Text>
            <View style={s.chipWrap}>
              {OFFICER_ROLES.map(r => (
                <Pressable key={r} style={[s.chip, spec.assignedRole === r && s.chipOn]} onPress={() => patchSpec(i, { assignedRole: r })}>
                  <Text style={[s.chipText, spec.assignedRole === r && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              ))}
            </View>

            {/* Due offset — quick presets + fine-tune */}
            <Text style={s.subLabel}>Due</Text>
            <View style={s.chipWrap}>
              {DUE_PRESETS.map(p => (
                <Pressable key={p.label} style={[s.chip, spec.dueOffsetDays === p.days && s.chipOn]} onPress={() => patchSpec(i, { dueOffsetDays: p.days })}>
                  <Text style={[s.chipText, spec.dueOffsetDays === p.days && s.chipTextOn]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[s.stepperRow, { marginTop: 8 }]}>
              <Pressable style={s.stepBtn} onPress={() => patchSpec(i, { dueOffsetDays: spec.dueOffsetDays - 1 })}>
                <Text style={s.stepBtnText}>−</Text>
              </Pressable>
              <Text style={s.stepValue}>{offsetLabel(spec.dueOffsetDays)}</Text>
              <Pressable style={s.stepBtn} onPress={() => patchSpec(i, { dueOffsetDays: spec.dueOffsetDays + 1 })}>
                <Text style={s.stepBtnText}>+</Text>
              </Pressable>
            </View>

            {/* Options (approval / proof) — collapsed by default to keep rows compact */}
            <Pressable style={s.optionsToggle} onPress={() => toggleOptions(spec.key)}>
              <Text style={s.optionsToggleText}>Options (approval, proof)</Text>
              <Text style={s.optionsChevron}>{openOptions.has(spec.key) ? '▴' : '▾'}</Text>
            </Pressable>
            {openOptions.has(spec.key) && (
              <View>
                {/* Approval */}
                <Pressable style={s.toggleRow} onPress={() => patchSpec(i, { requiresApproval: !spec.requiresApproval })}>
                  <View style={[s.box, spec.requiresApproval && s.boxOn]}>{spec.requiresApproval && <Text style={s.boxCheck}>✓</Text>}</View>
                  <Text style={s.toggleLabel}>Requires approval</Text>
                </Pressable>
                {spec.requiresApproval && (
                  <>
                    <Text style={s.subLabel}>Reviewed by</Text>
                    <View style={s.chipWrap}>
                      {REVIEWER_ROLES.map(r => (
                        <Pressable key={r} style={[s.chip, (spec.reviewerRole ?? 'pro_consul') === r && s.chipOn]} onPress={() => patchSpec(i, { reviewerRole: r })}>
                          <Text style={[s.chipText, (spec.reviewerRole ?? 'pro_consul') === r && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={s.subLabel}>Also oversee (optional)</Text>
                    <View style={s.chipWrap}>
                      <Pressable style={[s.chip, !spec.supervisorRole && s.chipOn]} onPress={() => patchSpec(i, { supervisorRole: undefined })}>
                        <Text style={[s.chipText, !spec.supervisorRole && s.chipTextOn]}>None</Text>
                      </Pressable>
                      {SUPERVISOR_ROLES.map(r => (
                        <Pressable key={r} style={[s.chip, spec.supervisorRole === r && s.chipOn]} onPress={() => patchSpec(i, { supervisorRole: r })}>
                          <Text style={[s.chipText, spec.supervisorRole === r && s.chipTextOn]}>{ROLE_LABELS[r]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {/* Proof */}
                <Pressable style={s.toggleRow} onPress={() => patchSpec(i, { requiresProof: !spec.requiresProof })}>
                  <View style={[s.box, spec.requiresProof && s.boxOn]}>{spec.requiresProof && <Text style={s.boxCheck}>✓</Text>}</View>
                  <Text style={s.toggleLabel}>Requires proof</Text>
                </Pressable>
                {spec.requiresProof && (
                  <View style={s.chipWrap}>
                    {PROOF_TYPES.map(p => (
                      <Pressable key={p} style={[s.chip, (spec.proofType ?? 'text') === p && s.chipOn]} onPress={() => patchSpec(i, { proofType: p })}>
                        <Text style={[s.chipText, (spec.proofType ?? 'text') === p && s.chipTextOn]}>{PROOF_LABEL[p]}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        <Pressable style={s.addBtn} onPress={addSpec}>
          <Text style={s.addBtnText}>+ Add task</Text>
        </Pressable>

        {!canSave && (
          <Text style={s.hint}>Add a template name and at least one task with a title to save.</Text>
        )}
        <Pressable style={[s.saveBtn, !canSave && s.saveBtnOff]} onPress={handleSave} disabled={!canSave}>
          <Text style={[s.saveBtnText, !canSave && s.saveBtnTextOff]}>{editing ? 'Save Changes' : 'Create Template'}</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 8 },
  subLabel:   { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },
  inputMultiline: { minHeight: 56, marginTop: 8, fontSize: 14 },

  specCard: { backgroundColor: '#162032', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 14, marginTop: 16 },
  specHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  specHeaderText: { fontSize: 11, fontWeight: '700', color: '#818cf8', letterSpacing: 0.6 },
  specHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  moveText:    { fontSize: 17, fontWeight: '700', color: '#818cf8', lineHeight: 20 },
  moveTextOff: { color: '#334155' },
  removeText: { fontSize: 12, fontWeight: '600', color: '#f87171' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn:   { backgroundColor: '#1e1b4b', borderColor: '#4f46e5' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextOn: { color: '#a5b4fc' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:    { width: 40, height: 40, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  stepBtnText:{ fontSize: 20, color: '#a5b4fc', lineHeight: 24 },
  stepValue:  { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#cbd5e1' },

  optionsToggle:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 6 },
  optionsToggleText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  optionsChevron:    { fontSize: 13, color: '#64748b' },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  box:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  boxOn:      { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  boxCheck:   { fontSize: 13, color: '#a5b4fc', fontWeight: '700', lineHeight: 16 },
  toggleLabel:{ fontSize: 14, fontWeight: '600', color: '#cbd5e1' },

  addBtn:     { marginTop: 16, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#4f46e5', backgroundColor: '#1e1b4b', alignItems: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#a5b4fc' },

  hint:    { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveBtnOff: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  saveBtnTextOff: { color: '#475569' },
});
