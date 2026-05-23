import { useAuth } from '@/lib/auth';
import { DEMO_CHAPTER, DEMO_USER } from '@/lib/demoUser';
import { useDevRole } from '@/lib/devRoleStore';
import { useIdentity } from '@/lib/identityStore';
import { ROLE_LABELS, ROLE_SWITCHER_OPTIONS, isOfficer, type Role } from '@/lib/roles';
import { AUTH_ENABLED } from '@/lib/flags';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function RoleOption({
  role,
  active,
  onPress,
}: {
  role: Role;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.roleOption, active && s.roleOptionActive]}
      onPress={onPress}
    >
      <View style={[s.roleRadio, active && s.roleRadioActive]}>
        {active && <View style={s.roleRadioDot} />}
      </View>
      <Text style={[s.roleOptionText, active && s.roleOptionTextActive]}>
        {ROLE_LABELS[role]}
      </Text>
    </Pressable>
  );
}

function OrgOption({
  name,
  active,
  onPress,
}: {
  name: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.roleOption, active && s.roleOptionActive]}
      onPress={onPress}
    >
      <View style={[s.roleRadio, active && s.roleRadioActive]}>
        {active && <View style={s.roleRadioDot} />}
      </View>
      <Text style={[s.roleOptionText, active && s.roleOptionTextActive]}>
        {name}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeScreen() {
  const { role, setRole } = useDevRole();
  const { signOut } = useAuth();
  const { memberships, activeOrgId, setActiveOrg, member, organization } = useIdentity();
  const router = useRouter();

  // Real identity when auth is on; demo values in the flag-off sandbox.
  const userName = (AUTH_ENABLED ? member?.fullName : DEMO_USER.full_name) || 'Member';
  const orgName  = (AUTH_ENABLED ? organization?.name : DEMO_CHAPTER.name) || '';

  // Switch the active org, then return to the root tabs so we don't linger on a
  // detail screen that referenced the previous org. No-op when tapping the org
  // that's already active.
  function handleSwitchOrg(orgId: string) {
    if (orgId === activeOrgId) return;
    setActiveOrg(orgId);
    router.replace('/(tabs)' as any);
  }
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Dev badge (dev only, and only while auth is actually bypassed) */}
      {__DEV__ && !AUTH_ENABLED && (
        <View style={s.devBadge}>
          <Text style={s.devText}>DEV MODE · auth bypassed</Text>
        </View>
      )}

      {/* ── User card ── */}
      <View style={s.userCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={s.userName}>{userName}</Text>
          <Text style={s.userChapter}>{orgName}</Text>
          <View style={s.rolePill}>
            <Text style={s.rolePillText}>{ROLE_LABELS[role]}</Text>
          </View>
        </View>
      </View>

      {/* ── Org switcher (only for multi-org members; hidden in the single-org sandbox) ── */}
      {memberships.length > 1 && (
        <View style={s.switcherCard}>
          <SectionLabel text="ORGANIZATIONS" />
          <Text style={s.switcherHint}>Switch between your chapters</Text>
          <View style={s.roleList}>
            {memberships.map(m => (
              <OrgOption
                key={m.organization.id}
                name={m.organization.name}
                active={m.organization.id === activeOrgId}
                onPress={() => handleSwitchOrg(m.organization.id)}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── Role switcher (dev only — prevents role impersonation in real builds) ── */}
      {__DEV__ && (
        <View style={s.switcherCard}>
          <SectionLabel text="ROLE SWITCHER" />
          <Text style={s.switcherHint}>Switch roles to preview role-specific views</Text>
          <View style={s.roleList}>
            {ROLE_SWITCHER_OPTIONS.map(r => (
              <RoleOption
                key={r}
                role={r}
                active={role === r}
                onPress={() => setRole(r)}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── Manage templates (officers) ── */}
      {isOfficer(role) && (
        <Pressable style={s.linkCard} onPress={() => router.push('/templates' as any)}>
          <View style={{ flex: 1 }}>
            <Text style={s.linkTitle}>Manage event templates</Text>
            <Text style={s.linkSub}>Build and edit the task workflows applied to events</Text>
          </View>
          <Text style={s.linkChevron}>›</Text>
        </Pressable>
      )}

      {/* ── Sign out ── */}
      <Pressable style={s.signOutButton} onPress={() => { void signOut(); }}>
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
    gap: 16,
  },

  devBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#422006',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  devText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  userChapter: {
    fontSize: 13,
    color: '#64748b',
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#312e81',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  rolePillText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
  },

  // Role switcher
  switcherCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  switcherHint: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
  },
  roleList: {
    gap: 4,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  roleOptionActive: {
    backgroundColor: '#1e1b4b',
  },
  roleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRadioActive: {
    borderColor: '#6366f1',
  },
  roleRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  roleOptionText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  roleOptionTextActive: {
    color: '#f1f5f9',
    fontWeight: '600',
  },

  // Manage-templates link card
  linkCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  linkTitle:   { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  linkSub:     { fontSize: 12, color: '#64748b', marginTop: 2 },
  linkChevron: { fontSize: 22, color: '#475569' },

  // Sign out
  signOutButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    opacity: 0.4,
  },
  signOutText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 15,
  },
});
