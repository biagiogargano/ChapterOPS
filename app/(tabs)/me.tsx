import { useAuth } from '@/lib/auth';
import { DEMO_CHAPTER, DEMO_USER } from '@/lib/demoUser';
import { useDevRole } from '@/lib/devRoleStore';
import { useIdentity } from '@/lib/identityStore';
import { ROLES, ROLE_LABELS, ROLE_SWITCHER_OPTIONS, isOfficer, type Role } from '@/lib/roles';
import { AUTH_ENABLED } from '@/lib/flags';
import { generateQuestionnaireTasks } from '@/lib/reportGeneration';
import { getQuestionnaireDefinition } from '@/lib/reportDefinitions';
import { planQuestionnaireGeneration } from '@/lib/questionnaireGenerationPlan';
import { weeklyCycleId, defaultWeeklyDueDate } from '@/lib/questionnaireCycle';
import { runWeeklyGoalUpdateGeneration } from '@/lib/goalUpdateRun';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Roles allowed to manually generate questionnaire tasks in the alpha (President,
// Pro Consul, Annotator). Explicit set — narrower than isLeadershipRole (which is
// President + Pro Consul only) because the Annotator runs reporting in this pack.
const QUESTIONNAIRE_GENERATOR_ROLES: Role[] = [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ROLES.ANNOTATOR];

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

/**
 * Manual questionnaire-task generator (leadership alpha action).
 *
 * Generic by design: it calls the generic generateQuestionnaireTasks helper with a
 * chosen template. For alpha the template is the Weekly Officer Report and the
 * targets are the current officer roles, but nothing here is hardcoded to "reports"
 * — swapping the template id + roles is all it takes to generate any questionnaire.
 *
 *  • Cycle id is deterministic per ISO week + template (idempotent: same week +
 *    same roles + same template never duplicates).
 *  • Due date defaults to 7 days out (documented default — no per-org pref yet).
 *  • No scheduler, no push, no Supabase — one on-demand button press.
 */
function QuestionnaireGeneratorCard({ orgId, orgTemplate }: { orgId: string; orgTemplate?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // What to generate comes from the org's active starter pack (lib/starterPacks)
  // via a pure resolver — behavior-identical for the Sigma Chi alpha (and for any
  // unknown/missing template, which falls back to sigma_chi). The label still comes
  // from the definition itself, so the card never hardcodes "officer report".
  const { definitionId, roles } = planQuestionnaireGeneration(orgTemplate);
  const templateLabel = getQuestionnaireDefinition(definitionId)?.label ?? 'questionnaire';

  // Confirm before creating real tasks for every officer role (it's idempotent, but
  // a first press still creates tasks for real people). Generation runs only after
  // the user taps "Create tasks".
  function handleGenerate() {
    if (busy) return;
    Alert.alert(
      'Create questionnaire tasks?',
      'This will create this cycle’s Weekly Officer Report tasks for officer roles. It is safe to run again; existing tasks will be skipped.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create tasks', style: 'default', onPress: runGenerate },
      ],
    );
  }

  function runGenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const now = new Date();
      const res = generateQuestionnaireTasks({
        orgId,
        definitionId,
        roles,
        cycle:   weeklyCycleId(definitionId, now),
        dueDate: defaultWeeklyDueDate(now),
      });
      setResult({ created: res.created.length, skipped: res.skipped.length });
    } catch {
      setError('Couldn’t create the tasks. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.genCard}>
      <Text style={s.genTitle}>Create questionnaire tasks</Text>
      <Text style={s.genSub}>Creates tasks from a questionnaire template. Safe to press again.</Text>
      <Text style={s.genTemplate}>Template: {templateLabel}</Text>

      <Pressable
        style={[s.genButton, busy && s.genButtonDisabled]}
        onPress={handleGenerate}
        disabled={busy}
      >
        <Text style={s.genButtonText}>{busy ? 'Creating…' : 'Create questionnaire tasks'}</Text>
      </Pressable>

      {result && (
        <Text style={s.genResult}>
          {result.created > 0
            ? `Created ${result.created} task${result.created === 1 ? '' : 's'}`
            : 'No new tasks'}
          {result.skipped > 0 ? ` · ${result.skipped} already existed` : ''}.
        </Text>
      )}
      {error && <Text style={s.genError}>{error}</Text>}
    </View>
  );
}

/**
 * Manual weekly goal-update generator (leadership alpha action).
 *
 * One on-demand button: creates this week's goal-update task for every officer ROLE
 * that has ≥1 active goal. Each task walks that officer through their active goals +
 * a weekly check-in, opens near the end of the week (availableAt), and is due shortly
 * after. NOT a scheduler — no timer, no push, no AI, no background job. Idempotent:
 * safe to run again; existing tasks are skipped. The form is reconstructed at render
 * from the role's live goals (Task Detail), so it survives reload with no new storage.
 */
function GoalUpdateGeneratorCard({ orgId }: { orgId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; rolesWithGoals: number; error?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    if (busy) return;
    Alert.alert(
      'Create weekly goal update tasks?',
      'This creates this week’s update task for each officer role that has active goals. Each officer is asked to update their active goals and answer a short weekly check-in. It opens near the end of the week. Safe to run again — existing tasks are skipped.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create tasks', style: 'default', onPress: () => { void runGenerate(); } },
      ],
    );
  }

  async function runGenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await runWeeklyGoalUpdateGeneration({ orgId, now: new Date() });
      if (res.error) { setError('Couldn’t read the chapter’s goals. Please try again.'); }
      else { setResult(res); }
    } catch {
      setError('Couldn’t create the tasks. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.genCard}>
      <Text style={s.genTitle}>Create weekly goal update tasks</Text>
      <Text style={s.genSub}>
        One update task per officer role with active goals. Opens near the end of the week. Safe to press again.
      </Text>

      <Pressable
        style={[s.genButton, busy && s.genButtonDisabled]}
        onPress={handleGenerate}
        disabled={busy}
      >
        <Text style={s.genButtonText}>{busy ? 'Creating…' : 'Create weekly goal update tasks'}</Text>
      </Pressable>

      {result && (
        <Text style={s.genResult}>
          {result.rolesWithGoals === 0
            ? 'No active goals yet — nothing to create.'
            : (result.created > 0
                ? `Created ${result.created} task${result.created === 1 ? '' : 's'}`
                : 'No new tasks')
              + (result.skipped > 0 ? ` · ${result.skipped} already existed` : '')
              + '.'}
        </Text>
      )}
      {error && <Text style={s.genError}>{error}</Text>}
    </View>
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
      <SectionLabel text="ACCOUNT" />
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

      {/* Expectation-setting note for real testers: roster + role assignments are
          managed by the chapter admin in the back office, not in-app. Only shown
          when auth is live (the sandbox exposes the role switcher instead). */}
      {AUTH_ENABLED && (
        <Text style={s.adminNote}>
          Your role and chapter are set by your chapter admin. Contact them to update your membership.
        </Text>
      )}

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

      {/* ── Role switcher (sandbox only — hidden when auth is on so real testers
          get their role from their authenticated position, not a manual switch) ── */}
      {__DEV__ && !AUTH_ENABLED && (
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

      {/* ── Create questionnaire tasks (President / Pro Consul / Annotator) ── */}
      {QUESTIONNAIRE_GENERATOR_ROLES.includes(role) && !!activeOrgId && (
        <QuestionnaireGeneratorCard orgId={activeOrgId} orgTemplate={organization?.template} />
      )}

      {/* ── Create weekly goal update tasks (President / Pro Consul / Annotator) ── */}
      {QUESTIONNAIRE_GENERATOR_ROLES.includes(role) && !!activeOrgId && (
        <GoalUpdateGeneratorCard orgId={activeOrgId} />
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

  adminNote: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: -4,
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

  // Questionnaire generator card
  genCard:     { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, gap: 6 },
  genTitle:    { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  genSub:      { fontSize: 12, color: '#64748b' },
  genTemplate: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  genButton:   { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  genButtonDisabled: { backgroundColor: '#312e81', opacity: 0.6 },
  genButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  genResult:   { fontSize: 13, color: '#4ade80', fontWeight: '600', marginTop: 8 },
  genError:    { fontSize: 13, color: '#f87171', fontWeight: '600', marginTop: 8 },

  // Sign out
  signOutButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  signOutText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 15,
  },
});
