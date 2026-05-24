/**
 * app/permissions/index.tsx — org-owner permission matrix prototype.
 * PROTOTYPE ONLY (see SPEC_PERMISSIONS_CUSTOMIZATION.md).
 *
 * ⚠️ PREVIEW, NOT ENFORCED. Lets the owner tune who can view/edit/manage each
 * surface, Google-Docs-style, to validate the model. Tapping a cell cycles
 * None → View → Edit → Manage. Real enforcement needs auth + RLS (deferred).
 * Dev-only screen; not linked from phase-2, not wired into the alpha.
 */

import { ROLE_LABELS } from '@/lib/roles';
import {
  ACCESS_LABEL,
  OWNER_ROLE,
  RESOURCES,
  SUBJECT_ROLES,
  cycleAccess,
  getAccess,
  resetPermissions,
  usePermissionsVersion,
  type AccessLevel,
} from '@/lib/permissions/mockPermissions';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const CELL_STYLE: Record<AccessLevel, { bg: string; fg: string; short: string }> = {
  none:   { bg: '#1a0505', fg: '#f87171', short: '—' },
  view:   { bg: '#0f172a', fg: '#94a3b8', short: 'View' },
  edit:   { bg: '#052e16', fg: '#4ade80', short: 'Edit' },
  manage: { bg: '#1e1b4b', fg: '#a5b4fc', short: 'Manage' },
};

export default function PermissionsScreen() {
  const navigation = useNavigation();
  usePermissionsVersion();

  useEffect(() => { navigation.setOptions({ title: 'Permissions' }); }, [navigation]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · preview, NOT enforced yet</Text></View>

      <Text style={s.heading}>Who can do what</Text>
      <Text style={s.sub}>
        Owner ({ROLE_LABELS[OWNER_ROLE]}) controls access per role, like sharing a
        Doc. Tap a cell to cycle No access → View → Edit → Manage.
      </Text>

      {/* Horizontal scroll for the role columns */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tableScroll}>
        <View>
          {/* Header row: role names */}
          <View style={s.row}>
            <View style={s.resourceHead}><Text style={s.resourceHeadText}>RESOURCE</Text></View>
            {SUBJECT_ROLES.map(role => (
              <View key={role} style={s.colHead}><Text style={s.colHeadText}>{ROLE_LABELS[role]}</Text></View>
            ))}
          </View>

          {/* One row per resource */}
          {RESOURCES.map(res => (
            <View key={res.id} style={s.row}>
              <View style={s.resourceCell}><Text style={s.resourceText}>{res.label}</Text></View>
              {SUBJECT_ROLES.map(role => {
                const lvl = getAccess(res.id, role);
                const cfg = CELL_STYLE[lvl];
                return (
                  <Pressable
                    key={role}
                    style={[s.cell, { backgroundColor: cfg.bg }]}
                    onPress={() => cycleAccess(res.id, role)}
                  >
                    <Text style={[s.cellText, { color: cfg.fg }]}>{cfg.short}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.legend}>
        {(Object.keys(ACCESS_LABEL) as AccessLevel[]).map(l => (
          <View key={l} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: CELL_STYLE[l].bg, borderColor: CELL_STYLE[l].fg }]} />
            <Text style={s.legendText}>{ACCESS_LABEL[l]}</Text>
          </View>
        ))}
      </View>

      <Pressable style={s.resetBtn} onPress={resetPermissions}>
        <Text style={s.resetText}>Reset to defaults</Text>
      </Pressable>

      <Text style={s.footNote}>
        {ROLE_LABELS[OWNER_ROLE]} always has Manage everywhere and can’t be locked
        out. This is a preview of the model — it does not enforce access yet; real
        enforcement needs auth + per-org RLS.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const COL_W = 76;

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18, lineHeight: 18 },

  tableScroll: { marginBottom: 6 },
  row:         { flexDirection: 'row', alignItems: 'stretch' },

  resourceHead:     { width: 120, paddingVertical: 8, justifyContent: 'flex-end' },
  resourceHeadText: { fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.6 },
  colHead:          { width: COL_W, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'flex-end' },
  colHeadText:      { fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },

  resourceCell: { width: 120, paddingVertical: 12, paddingRight: 8, justifyContent: 'center' },
  resourceText: { fontSize: 13, fontWeight: '600', color: '#cbd5e1' },
  cell:         { width: COL_W, marginLeft: 4, marginBottom: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  cellText:     { fontSize: 12, fontWeight: '700' },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendText: { fontSize: 12, color: '#94a3b8' },

  resetBtn:  { marginTop: 18, alignSelf: 'flex-start', backgroundColor: '#1e293b', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155' },
  resetText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
