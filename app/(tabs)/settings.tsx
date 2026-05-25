/**
 * app/(tabs)/settings.tsx — core Settings hub.
 * UI-first / mock-backed. One home for org config, people/positions, structure
 * customization, your profile, and notification prefs. Links into the relevant
 * screens (several still mock until the schema phase). Lives on the feature
 * branch; not in phase-2.
 */

import { useAuth } from '@/lib/auth';
import { DEMO_USER } from '@/lib/demoUser';
import { useDevRole } from '@/lib/devRoleStore';
import { useIdentity } from '@/lib/identityStore';
import { AUTH_ENABLED } from '@/lib/flags';
import { ROLE_LABELS, isOfficer } from '@/lib/roles';
import { getMembers, useRosterVersion } from '@/lib/roster/mockRoster';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

function Row({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { role } = useDevRole();
  const { organization, member } = useIdentity();
  useRosterVersion();

  const orgName  = (AUTH_ENABLED ? organization?.name : 'Sigma Chi — Beta Chapter') || 'Your organization';
  const userName = (AUTH_ENABLED ? member?.fullName : DEMO_USER.full_name) || 'Member';
  const memberCount = getMembers().length;

  const [notifTasks, setNotifTasks]   = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifReports, setNotifReports] = useState(true);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.h1}>Settings</Text>

      {/* Org summary */}
      <View style={s.orgCard}>
        <Text style={s.orgName}>{orgName}</Text>
        <Text style={s.orgMeta}>{memberCount} members · you are {ROLE_LABELS[role]}</Text>
      </View>

      <Text style={s.sectionLabel}>ORGANIZATION</Text>
      <Row title="Org details & ownership" sub="Name, transfer ownership" onPress={() => router.push('/org-settings' as any)} />

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>MEMBERS & ROLES</Text>
      <Row title="Members & positions" sub={`${memberCount} people · assign roles`} onPress={() => router.push('/roster' as any)} />
      <Row title="Leadership structure" sub="Edit the tree (Q&A builder)" onPress={() => router.push('/setup/tree' as any)} />

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>TEMPLATES & AUTOMATION</Text>
      {isOfficer(role) && (
        <Row title="Event templates" sub="Build and edit the task workflows applied to events" onPress={() => router.push('/templates' as any)} />
      )}
      <Row title="Event automation" sub="What each event type auto-creates" onPress={() => router.push('/event-defaults' as any)} />

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>REPORTS & STRUCTURED RESPONSES</Text>
      <Row title="Report questions / response forms" sub="Structured responses officers submit each week" onPress={() => router.push('/report/weekly' as any)} />

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>NOTIFICATIONS</Text>
      <View style={s.toggleCard}>
        <View style={s.toggleRow}><Text style={s.toggleText}>Task reminders</Text><Switch value={notifTasks} onValueChange={setNotifTasks} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" /></View>
        <View style={s.divider} />
        <View style={s.toggleRow}><Text style={s.toggleText}>Event updates</Text><Switch value={notifEvents} onValueChange={setNotifEvents} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" /></View>
        <View style={s.divider} />
        <View style={s.toggleRow}><Text style={s.toggleText}>Report nudges</Text><Switch value={notifReports} onValueChange={setNotifReports} trackColor={{ true: '#4f46e5', false: '#334155' }} thumbColor="#f1f5f9" /></View>
      </View>

      {__DEV__ && (
        <>
          <Text style={[s.sectionLabel, { marginTop: 22 }]}>DEVELOPER / PROTOTYPES</Text>
          <Row title="🧪 All prototypes" sub="Every feature preview in one place — mock data" onPress={() => router.push('/prototypes' as any)} />
        </>
      )}

      <Text style={[s.sectionLabel, { marginTop: 22 }]}>ACCOUNT</Text>
      <View style={s.profileCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{userName.split(' ').map(n => n[0]).join('').toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>{userName}</Text>
          <Text style={s.profileRole}>{ROLE_LABELS[role]} · {orgName}</Text>
        </View>
      </View>
      <Text style={s.accountHint}>Sign out from the Me tab.</Text>

      <Text style={s.footNote}>UI preview — several areas are mock until the schema/auth phase.</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },

  h1: { fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 18 },

  orgCard: { backgroundColor: '#1e1b4b', borderRadius: 14, padding: 16, marginBottom: 22 },
  orgName: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  orgMeta: { fontSize: 13, color: '#a5b4fc', marginTop: 3 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  rowSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  chev:     { fontSize: 20, color: '#475569' },

  toggleCard: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  toggleText: { fontSize: 15, color: '#f1f5f9' },
  divider:    { height: 1, backgroundColor: '#0f172a' },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '800', fontSize: 15 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  profileRole: { fontSize: 13, color: '#64748b', marginTop: 2 },
  accountHint: { fontSize: 12, color: '#475569', marginTop: 8, marginLeft: 2 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 18, lineHeight: 18 },
});
