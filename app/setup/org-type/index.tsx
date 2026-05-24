/**
 * app/setup/org-type/index.tsx — pick your org type (prototype).
 * PROTOTYPE / mock. The first onboarding step that makes the org-agnostic vision
 * concrete: choose an org type and preview the DEFAULTS it seeds (leader title,
 * roles, event types, default report). Same engine, different smart defaults.
 * Nothing saved; dev-only; not in phase-2 / the alpha.
 */

import { ORG_TEMPLATES, getOrgTemplate } from '@/lib/orgTemplates/mockOrgTemplates';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function OrgTypeScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [selected, setSelected] = useState('fraternity');

  useEffect(() => { navigation.setOptions({ title: 'Org type' }); }, [navigation]);

  const t = getOrgTemplate(selected)!;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · template defaults, nothing saved</Text></View>

      <Text style={s.heading}>What kind of organization?</Text>
      <Text style={s.sub}>This sets your starting defaults — roles, labels, event types, and reports. You can change anything later. Same app underneath; just tailored to you.</Text>

      <View style={s.grid}>
        {ORG_TEMPLATES.map(tpl => {
          const on = tpl.id === selected;
          return (
            <Pressable key={tpl.id} style={[s.card, on && s.cardOn]} onPress={() => setSelected(tpl.id)}>
              <Text style={s.emoji}>{tpl.emoji}</Text>
              <Text style={[s.cardLabel, on && s.cardLabelOn]}>{tpl.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.preview}>
        <Text style={s.previewTitle}>{t.emoji}  {t.label}</Text>
        <Text style={s.previewBlurb}>{t.blurb}</Text>

        <Text style={s.pLabel}>LEADER IS CALLED</Text>
        <Text style={s.pValue}>{t.leaderTitle}</Text>

        <Text style={s.pLabel}>DEFAULT ROLES</Text>
        <View style={s.chips}>{t.roles.map(r => <View key={r} style={s.chip}><Text style={s.chipText}>{r}</Text></View>)}</View>

        <Text style={s.pLabel}>DEFAULT EVENT TYPES</Text>
        <View style={s.chips}>{t.eventKinds.map(k => <View key={k} style={[s.chip, s.chipAlt]}><Text style={s.chipTextAlt}>{k}</Text></View>)}</View>

        <Text style={s.pLabel}>RECURRING REPORT</Text>
        <Text style={s.pValue}>{t.defaultReport ? `Yes — ${t.reportName}` : 'None by default'}</Text>
      </View>

      <Pressable style={s.primary} onPress={() => router.push('/setup/invite-link' as any)}>
        <Text style={s.primaryText}>Use {t.label} defaults ›</Text>
      </Pressable>
      <Text style={s.footNote}>
        Fraternity is the first strong default; the same primitives (events, tasks,
        structured responses, roles) power every org type. Real templates would seed
        org config at creation.
      </Text>
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

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card:      { width: '47%', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155', gap: 6 },
  cardOn:    { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  emoji:     { fontSize: 24 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  cardLabelOn:{ color: '#f1f5f9', fontWeight: '700' },

  preview:      { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 6 },
  previewTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  previewBlurb: { fontSize: 13, color: '#94a3b8', marginBottom: 8, lineHeight: 18 },
  pLabel:  { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginTop: 10 },
  pValue:  { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip:    { backgroundColor: '#0f172a', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#312e81' },
  chipText:{ fontSize: 12, color: '#a5b4fc', fontWeight: '600' },
  chipAlt: { borderColor: '#334155' },
  chipTextAlt:{ fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  primary:     { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  footNote:    { fontSize: 12, color: '#475569', marginTop: 14, lineHeight: 18 },
});
