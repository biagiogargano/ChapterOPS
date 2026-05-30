/**
 * Goals tab — a REAL, persisted Goals MVP backed by the live Goals v1 RPCs through
 * lib/goalService. No local/fake goals: every read/write goes through the service,
 * and a failed/unconfigured RPC shows an error or empty state (never a fake success).
 *
 * MVP scope: list active goals, create, edit (title/current/target/cadence),
 * complete, archive. Leadership/Annotator see all org goals (listGoalsForOrg);
 * others see only goals they own (listMyGoals) — the RPCs are the real gate.
 * OUT of scope here: goal-update tasks, scheduler, notifications, AI, charts.
 */

import { useDevRole } from '@/lib/devRoleStore';
import { useIdentity } from '@/lib/identityStore';
import { ROLES, ROLE_LABELS, OFFICER_ROLES, isOfficer, type Role } from '@/lib/roles';
import {
  listGoalsForOrgResult, listMyGoalsResult, createGoal, updateGoal, completeGoal, archiveGoal,
} from '@/lib/goalService';
import { goalProgress, goalDisplay, canManageGoal, parseGoalPrompts } from '@/lib/goalHelpers';
import { emitGoalAssignedNotice } from '@/lib/updateNoticeStore';
import type { Goal, GoalCadence, GoalValueKind } from '@/lib/goals';
import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

// Roles that see ALL org goals + can create for officer roles (RPCs enforce this;
// the client only decides which list call to make + whether to show the create form).
const GOAL_ADMIN_ROLES: Role[] = [ROLES.PRESIDENT, ROLES.PRO_CONSUL, ROLES.ANNOTATOR];

// "Update check-in" cadence — how often a goal should be REVIEWED later. This does
// NOT create reminders or scheduled tasks (no scheduler yet). Visible MVP options
// are Weekly / Monthly / One-time; 'one-time' maps to the GoalCadence 'custom' value
// ("no recurring check-in"). 'daily' stays in the type but is hidden from the UI.
const CADENCE_OPTIONS: { value: GoalCadence; label: string }[] = [
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom',  label: 'One-time' },
];
const CADENCE_LABEL: Record<GoalCadence, string> = {
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
  custom:  'One-time',
};

function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function GoalsScreen() {
  const { role } = useDevRole();
  const { activeOrgId, member } = useIdentity();
  const navigation = useNavigation();

  const [goals, setGoals]     = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);   // leadership-only

  const isAdmin = GOAL_ADMIN_ROLES.includes(role);
  // Any officer may create goals — for their OWN role (the form defaults owner to the
  // current role). Leadership create for any officer role via the role switcher.
  // Brother / non-officer roles get no create form. RPCs remain the real gate.
  const canCreate = isOfficer(role);
  const currentMemberId = member?.id ?? null;

  const load = useCallback(async () => {
    if (!activeOrgId) { setGoals([]); setLoading(false); setError('No active organization.'); return; }
    setLoading(true);
    setError(null);
    const res = isAdmin ? await listGoalsForOrgResult(activeOrgId) : await listMyGoalsResult(activeOrgId);
    if (res.ok) {
      setGoals(res.goals);
    } else {
      // A failed read must NOT masquerade as "No goals yet." — show a real error so
      // the user can retry (the empty state otherwise looks identical to truly-empty).
      setGoals([]);
      setError('Couldn’t load goals. Check your connection and try again.');
    }
    setLoading(false);
  }, [activeOrgId, isAdmin]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: 'Goals' });
  }, [navigation]));

  // Owner roles present in the loaded active goals, for the leadership filter chips.
  const ownerRolesInList = Array.from(
    new Set(goals.filter(g => g.status === 'active' && g.ownerRole).map(g => g.ownerRole as string)),
  );

  // The filter "self-heals": if the selected owner role is no longer present (its
  // goals were archived/completed, or the list reloaded without them), treat it as
  // no filter so the user can never get stuck on an empty filtered view.
  const effectiveFilter = ownerFilter && ownerRolesInList.includes(ownerFilter) ? ownerFilter : null;

  // Only show active goals (completed/archived are filtered out). Leadership may
  // additionally filter by owner role (client-only; RPCs remain the permission gate).
  const activeGoals = goals
    .filter(g => g.status === 'active')
    .filter(g => !isAdmin || effectiveFilter === null || g.ownerRole === effectiveFilter);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Track goals that progress over time. {isAdmin ? 'You see all org goals.' : 'You see goals for your role.'}
        </Text>

        {/* Create — any officer (for their own role); leadership picks the owner
            role in the form. Non-officers get no create form. RPC also enforces. */}
        {canCreate && (
          showCreate
            ? <CreateGoalForm
                orgId={activeOrgId ?? ''}
                defaultOwnerRole={role}
                actorRole={role}
                canChooseOwner={isAdmin}
                onCancel={() => setShowCreate(false)}
                onCreated={() => { setShowCreate(false); void load(); }}
              />
            : <Pressable style={s.newBtn} onPress={() => setShowCreate(true)}>
                <Text style={s.newBtnText}>+ New goal</Text>
              </Pressable>
        )}

        {/* Owner-role filter (leadership only; client-side view filter) */}
        {isAdmin && ownerRolesInList.length > 1 && (
          <View style={s.filterRow}>
            <Pressable style={[s.chip, effectiveFilter === null && s.chipOn]} onPress={() => setOwnerFilter(null)}>
              <Text style={[s.chipText, effectiveFilter === null && s.chipTextOn]}>All</Text>
            </Pressable>
            {ownerRolesInList.map(r => (
              <Pressable key={r} style={[s.chip, effectiveFilter === r && s.chipOn]} onPress={() => setOwnerFilter(r)}>
                <Text style={[s.chipText, effectiveFilter === r && s.chipTextOn]}>{ROLE_LABELS[r as Role] ?? r}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {loading ? (
          <View style={s.center}><ActivityIndicator color="#6366f1" /></View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => void load()}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : activeGoals.length === 0 ? (
          <Text style={s.empty}>
            {canCreate ? 'No goals yet. Tap "+ New goal" to add one.' : 'No goals for your role yet.'}
          </Text>
        ) : (
          activeGoals.map(g => (
            <GoalCard key={g.id} goal={g} canManage={canManageGoal(g, role, currentMemberId)} onChanged={() => void load()} />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, canManage, onChanged }: { goal: Goal; canManage: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const progress = goalProgress(goal);

  async function doComplete() {
    setBusy(true);
    const r = await completeGoal(goal.id);
    setBusy(false);
    if (r.ok) onChanged();
    else Alert.alert('Couldn’t complete goal', r.error ?? 'Please try again.');
  }
  function confirmArchive() {
    Alert.alert('Archive goal?', `Archive "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => {
          setBusy(true);
          const r = await archiveGoal(goal.id);
          setBusy(false);
          if (r.ok) onChanged();
          else Alert.alert('Couldn’t archive goal', r.error ?? 'Please try again.');
        } },
    ]);
  }

  if (editing) {
    return <EditGoalForm goal={goal} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />;
  }

  // Unified display: numeric goals show "cur/tgt · NN%" + bar; text goals show a
  // "current → target" status line and no bar.
  const display = goalDisplay(goal);
  const showBar = display.kind === 'numeric' && progress.percent !== null;
  const fillPct = progress.percent ?? 0;   // narrowed for the style width
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{goal.title}</Text>
      <View style={s.metaRow}>
        {display.valueLine !== '' && <Text style={s.metaStrong}>{display.valueLine}</Text>}
        <Text style={s.metaDim}>{CADENCE_LABEL[goal.cadence] ?? goal.cadence}</Text>
        {goal.ownerRole && <Text style={s.metaDim}>{ROLE_LABELS[goal.ownerRole as Role] ?? goal.ownerRole}</Text>}
      </View>
      {showBar && (
        <View style={s.barTrack}><View style={[s.barFill, { width: `${fillPct}%` }]} /></View>
      )}

      {canManage ? (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} disabled={busy} onPress={() => setEditing(true)}>
            <Text style={s.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={s.actionBtn} disabled={busy} onPress={() => void doComplete()}>
            <Text style={s.actionText}>Complete</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, s.actionDanger]} disabled={busy} onPress={confirmArchive}>
            <Text style={[s.actionText, s.actionDangerText]}>Archive</Text>
          </Pressable>
        </View>
      ) : (
        // Read-only: an officer viewing a goal they didn't personally create (e.g.
        // one leadership assigned to their role). Make the absence of actions honest.
        <Text style={s.viewOnly}>View only — you didn’t create this goal</Text>
      )}
    </View>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateGoalForm({
  orgId, defaultOwnerRole, actorRole, canChooseOwner, onCancel, onCreated,
}: {
  orgId: string;
  defaultOwnerRole: Role;
  actorRole: Role;           // the creator's current role (for goal-assigned notices)
  canChooseOwner: boolean;   // leadership/annotator may pick the owner role
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle]     = useState('');
  const [valueKind, setValueKind] = useState<GoalValueKind>('numeric');
  const [target, setTarget]   = useState('');   // numeric: target #;  text: target outcome
  const [current, setCurrent] = useState('');   // numeric: current #; text: current status
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [ownerRole, setOwnerRole] = useState<Role>(defaultOwnerRole);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const isText = valueKind === 'text';

  // Bulk: one goal per line or per ';'. Value fields apply to all created goals.
  const titles = parseGoalPrompts(title);

  async function submit() {
    if (busy) return;
    if (titles.length === 0) { setErr('Enter at least one goal title.'); return; }
    if (!orgId) { setErr('No active organization.'); return; }
    setBusy(true);
    setErr(null);

    // Numeric goals → target/currentValue; text goals → valueKind + target/currentText.
    const common = isText
      ? { valueKind: 'text' as const, targetText: target.trim() || null, currentText: current.trim() || null }
      : { targetValue: parseNum(target), currentValue: parseNum(current) };
    let created = 0;
    let firstError: string | null = null;
    for (const t of titles) {
      const r = await createGoal({ orgId, title: t, cadence, ownerRole, ...common });
      if (r.ok) {
        created++;
        // In-app notice for the owner role when it's an ASSIGNMENT (builder no-ops
        // when ownerRole === actorRole / 'all'). No push. Never blocks create.
        if (r.goalId) emitGoalAssignedNotice({ goalId: r.goalId, goalTitle: t, ownerRole, actorRole });
      } else if (!firstError) firstError = r.error ?? 'unknown';
    }
    setBusy(false);

    if (created === titles.length) { onCreated(); return; }   // all succeeded
    if (created === 0) {
      setErr(firstError === 'unconfigured'
        ? 'Goals storage isn’t available here. Try on a device build.'
        : `Couldn’t create the goal${titles.length > 1 ? 's' : ''}.`);
      return;
    }
    // Partial: some created, some failed — refresh the list AND report honestly.
    setErr(`Created ${created} of ${titles.length}. ${titles.length - created} failed — try those again.`);
    onCreated();
  }

  return (
    <View style={s.form}>
      <Text style={s.formLabel}>NEW GOAL</Text>
      <TextInput
        style={[s.input, { minHeight: 44 }]}
        placeholder="What's the goal? e.g. Recruit 12 new members"
        placeholderTextColor="#475569"
        value={title}
        onChangeText={t => { setTitle(t); setErr(null); }}
        multiline
      />
      <Text style={s.helperText}>Add multiple goals at once by separating them with a new line or a semicolon (;).</Text>
      {titles.length > 1 && <Text style={s.ownerNote}>{titles.length} goals will be created.</Text>}

      <Text style={s.ownerLabel}>GOAL TYPE</Text>
      <View style={s.cadenceRow}>
        <Pressable style={[s.chip, !isText && s.chipOn]} onPress={() => setValueKind('numeric')}>
          <Text style={[s.chipText, !isText && s.chipTextOn]}>Measurable number</Text>
        </Pressable>
        <Pressable style={[s.chip, isText && s.chipOn]} onPress={() => setValueKind('text')}>
          <Text style={[s.chipText, isText && s.chipTextOn]}>Status / outcome</Text>
        </Pressable>
      </View>

      {isText ? (
        <>
          <Text style={s.ownerLabel}>PROGRESS (OPTIONAL)</Text>
          <TextInput style={s.input} placeholder="Current status — e.g. Deposit paid" placeholderTextColor="#475569" value={current} onChangeText={setCurrent} />
          <TextInput style={s.input} placeholder="Target outcome — e.g. Venue booked" placeholderTextColor="#475569" value={target} onChangeText={setTarget} />
        </>
      ) : (
        <>
          <Text style={s.ownerLabel}>PROGRESS (OPTIONAL)</Text>
          <View style={s.row2}>
            <TextInput style={[s.input, s.flex1]} placeholder="Current #" placeholderTextColor="#475569" keyboardType="numeric" value={current} onChangeText={setCurrent} />
            <TextInput style={[s.input, s.flex1]} placeholder="Target #" placeholderTextColor="#475569" keyboardType="numeric" value={target} onChangeText={setTarget} />
          </View>
        </>
      )}

      <Text style={s.ownerLabel}>UPDATE CHECK-IN</Text>
      <View style={s.cadenceRow}>
        {CADENCE_OPTIONS.map(opt => (
          <Pressable key={opt.value} style={[s.chip, cadence === opt.value && s.chipOn]} onPress={() => setCadence(opt.value)}>
            <Text style={[s.chipText, cadence === opt.value && s.chipTextOn]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.helperText}>How often should this goal be reviewed? This does not create reminders yet.</Text>

      {/* Owner role: leadership/annotator picks; officers are locked to their own. */}
      {canChooseOwner ? (
        <>
          <Text style={s.ownerLabel}>WHO IS THIS GOAL FOR?</Text>
          <View style={s.cadenceRow}>
            {OFFICER_ROLES.map(r => (
              <Pressable key={r} style={[s.chip, ownerRole === r && s.chipOn]} onPress={() => setOwnerRole(r)}>
                <Text style={[s.chipText, ownerRole === r && s.chipTextOn]}>{ROLE_LABELS[r] ?? r}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={s.ownerNote}>For your role: {ROLE_LABELS[ownerRole] ?? ownerRole}</Text>
      )}

      {err && <Text style={s.errorText}>{err}</Text>}
      <View style={s.formActions}>
        <Pressable style={s.secondaryBtn} onPress={onCancel} disabled={busy}><Text style={s.secondaryText}>Cancel</Text></Pressable>
        <Pressable style={[s.primaryBtn, busy && s.btnDisabled]} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{titles.length > 1 ? `Create ${titles.length}` : 'Create'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

function EditGoalForm({ goal, onCancel, onSaved }: { goal: Goal; onCancel: () => void; onSaved: () => void }) {
  // A goal's kind is fixed once created (changing numeric↔text mid-life would orphan
  // values); edit respects the existing kind.
  const isText = goal.valueKind === 'text';
  const [title, setTitle]     = useState(goal.title);
  const [target, setTarget]   = useState(isText ? (goal.targetText ?? '') : (goal.targetValue != null ? String(goal.targetValue) : ''));
  const [current, setCurrent] = useState(isText ? (goal.currentText ?? '') : (goal.currentValue != null ? String(goal.currentValue) : ''));
  const [cadence, setCadence] = useState<GoalCadence>(goal.cadence);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  async function save() {
    if (busy) return;
    if (title.trim() === '') { setErr('Enter a goal title.'); return; }
    setBusy(true);
    setErr(null);
    const valueFields = isText
      ? { targetText: target.trim() || null, currentText: current.trim() || null }
      : { targetValue: parseNum(target), currentValue: parseNum(current) };
    const r = await updateGoal(goal.id, { title: title.trim(), cadence, ...valueFields });
    setBusy(false);
    if (r.ok) onSaved();
    else setErr(r.error === 'unconfigured' ? 'Goals storage isn’t available here.' : (r.error ?? 'Couldn’t save changes.'));
  }

  return (
    <View style={s.form}>
      <Text style={s.formLabel}>EDIT GOAL{isText ? ' (status)' : ''}</Text>
      <TextInput style={s.input} placeholder="Goal title" placeholderTextColor="#475569" value={title} onChangeText={t => { setTitle(t); setErr(null); }} />
      {isText ? (
        <>
          <TextInput style={s.input} placeholder="Current status" placeholderTextColor="#475569" value={current} onChangeText={setCurrent} />
          <TextInput style={s.input} placeholder="Target outcome" placeholderTextColor="#475569" value={target} onChangeText={setTarget} />
        </>
      ) : (
      <View style={s.row2}>
        <TextInput style={[s.input, s.flex1]} placeholder="Current" placeholderTextColor="#475569" keyboardType="numeric" value={current} onChangeText={setCurrent} />
        <TextInput style={[s.input, s.flex1]} placeholder="Target" placeholderTextColor="#475569" keyboardType="numeric" value={target} onChangeText={setTarget} />
      </View>
      )}
      <Text style={s.ownerLabel}>UPDATE CHECK-IN</Text>
      <View style={s.cadenceRow}>
        {CADENCE_OPTIONS.map(opt => (
          <Pressable key={opt.value} style={[s.chip, cadence === opt.value && s.chipOn]} onPress={() => setCadence(opt.value)}>
            <Text style={[s.chipText, cadence === opt.value && s.chipTextOn]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      {err && <Text style={s.errorText}>{err}</Text>}
      <View style={s.formActions}>
        <Pressable style={s.secondaryBtn} onPress={onCancel} disabled={busy}><Text style={s.secondaryText}>Cancel</Text></Pressable>
        <Pressable style={[s.primaryBtn, busy && s.btnDisabled]} onPress={() => void save()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  intro:   { fontSize: 13, color: '#94a3b8', lineHeight: 19, marginBottom: 16 },

  center:    { alignItems: 'center', paddingTop: 48, gap: 12 },
  empty:     { fontSize: 14, color: '#64748b', textAlign: 'center', paddingTop: 40 },
  errorText: { fontSize: 13, color: '#f87171', textAlign: 'center' },
  retryBtn:  { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: '#818cf8', fontWeight: '600', fontSize: 13 },

  newBtn:     { backgroundColor: '#1e1b4b', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#312e81' },
  newBtnText: { color: '#a5b4fc', fontWeight: '700', fontSize: 14 },
  filterRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },

  card:      { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 10, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  metaRow:   { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  metaStrong:{ fontSize: 13, color: '#cbd5e1', fontWeight: '600' },
  metaDim:   { fontSize: 12, color: '#64748b' },
  barTrack:  { height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 6, backgroundColor: '#6366f1', borderRadius: 3 },

  actions:        { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn:      { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#334155' },
  actionText:     { fontSize: 12, fontWeight: '600', color: '#818cf8' },
  actionDanger:   { backgroundColor: '#1a0505', borderColor: '#7f1d1d' },
  actionDangerText:{ color: '#f87171' },

  form:       { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16, gap: 10 },
  formLabel:  { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  input:      { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  row2:       { flexDirection: 'row', gap: 10 },
  flex1:      { flex: 1 },
  cadenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { backgroundColor: '#0f172a', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  chipOn:     { backgroundColor: '#1e1b4b', borderColor: '#6366f1' },
  chipText:   { fontSize: 12, color: '#64748b', fontWeight: '500' },
  chipTextOn: { color: '#a5b4fc', fontWeight: '700' },
  ownerNote:  { fontSize: 12, color: '#64748b' },
  ownerLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8, marginTop: 2 },
  helperText: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  viewOnly:   { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 2 },
  formActions:{ flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryBtn:{ flex: 1, backgroundColor: '#0f172a', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryText:{ color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  primaryBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled:{ opacity: 0.6 },
});
