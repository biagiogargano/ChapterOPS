/**
 * app/setup/index.tsx — guided org-setup wizard prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md).
 *
 * ⚠️ MOCK / NON-FUNCTIONAL. No real invites sent, nothing persisted, no auth.
 * Roles-first model: name the org → who's in charge → pick WHICH ROLES your org
 * uses (from the org-type template) → invite people into those roles → done.
 * NO org chart and NO "who reports to whom" here — committees and reporting lines
 * are an optional follow-up in Settings → Roles & structure. Every step after the
 * name is skippable. Dev-only; not linked from phase-2, not wired into the alpha.
 */

import { useActiveTemplate } from '@/lib/orgTemplates/activeOrgTemplate';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Invite { name: string; role: string }

export default function SetupWizardScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const template   = useActiveTemplate();
  const [step, setStep] = useState(0);

  const [orgName, setOrgName]   = useState('');
  const [ownerMe, setOwnerMe]   = useState(true);
  // Which of the template's default roles this org actually uses (all on to start).
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => template.roles);
  const [invites, setInvites]   = useState<Invite[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');

  // If the org type changes (via the org-type screen) reset the role selection to
  // that template's defaults so step 3 reflects the chosen org type.
  const tplIdRef = useRef(template.id);
  useEffect(() => {
    if (tplIdRef.current !== template.id) {
      tplIdRef.current = template.id;
      setSelectedRoles(template.roles);
    }
  }, [template.id, template.roles]);

  useEffect(() => { navigation.setOptions({ title: 'Set up your org' }); }, [navigation]);

  const steps = ['Name', 'Who’s in charge', 'Roles', 'Invite', 'Done'];
  const last  = steps.length - 1;
  const canNext = step !== 0 || orgName.trim().length > 0;

  // Default the invite role to a non-leader role the org actually uses.
  const effectiveDraftRole = selectedRoles.includes(draftRole)
    ? draftRole
    : (selectedRoles[1] ?? selectedRoles[0] ?? '');

  function toggleRole(r: string) {
    setSelectedRoles(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));
  }

  function addInvite() {
    const n = draftName.trim();
    if (!n || !effectiveDraftRole) return;
    setInvites(prev => [...prev, { name: n, role: effectiveDraftRole }]);
    setDraftName('');
  }

  function finish() {
    Alert.alert(
      'Setup complete (prototype)',
      `${orgName || 'Your org'} is set up.\nOwner: ${ownerMe ? 'you' : 'to be transferred'}.\nRoles in use: ${selectedRoles.length}.\nInvites drafted: ${invites.length}.\n\n(Mock — nothing was sent or saved.)`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock setup, nothing saved</Text></View>

        {/* Active org-type template — drives the suggested roles below. */}
        <View style={s.templateBanner}>
          <Text style={s.templateText}>{template.emoji}  Using {template.label} defaults — leader: {template.leaderTitle}</Text>
        </View>

        {/* Step dots */}
        <View style={s.dots}>
          {steps.map((label, i) => (
            <View key={label} style={s.dotWrap}>
              <View style={[s.dot, i === step && s.dotActive, i < step && s.dotDone]} />
            </View>
          ))}
        </View>
        <Text style={s.stepLabel}>Step {step + 1} of {steps.length} · {steps[step]}</Text>

        {/* ── Step 0: Name ── */}
        {step === 0 && (
          <View style={s.block}>
            <Text style={s.q}>What’s your organization called?</Text>
            <TextInput style={s.input} placeholder="e.g. Sigma Chi — Beta Chapter" placeholderTextColor="#475569" value={orgName} onChangeText={setOrgName} autoFocus />
            <Text style={s.help}>You can change this later. That’s the only thing you must do — everything after is optional.</Text>
            <Pressable style={s.previewBtn} onPress={() => router.push('/setup/org-type' as any)}>
              <Text style={s.previewText}>Choose your org type for smart defaults ›</Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 1: Owner ── */}
        {step === 1 && (
          <View style={s.block}>
            <Text style={s.q}>Who’s in charge?</Text>
            <Pressable style={[s.choice, ownerMe && s.choiceOn]} onPress={() => setOwnerMe(true)}>
              <Text style={[s.choiceTitle, ownerMe && s.choiceTitleOn]}>I’m the owner</Text>
              <Text style={s.choiceHint}>You get full control and can transfer it later.</Text>
            </Pressable>
            <Pressable style={[s.choice, !ownerMe && s.choiceOn]} onPress={() => setOwnerMe(false)}>
              <Text style={[s.choiceTitle, !ownerMe && s.choiceTitleOn]}>I’m setting this up for someone else</Text>
              <Text style={s.choiceHint}>You’ll invite them as owner and hand off control.</Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 2: Roles (who does what) — pick which template roles you use ── */}
        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Who does what?</Text>
            <Text style={s.help}>
              These are the {template.label} default roles. Keep the ones your org uses and turn
              off the rest. This is just roles — committees, helpers, and reporting lines are
              optional and can be added later in Settings → Roles &amp; structure.
            </Text>
            <View style={s.rolePickWrap}>
              {template.roles.map(r => {
                const on = selectedRoles.includes(r);
                return (
                  <Pressable key={r} style={[s.roleChip, on && s.roleChipOn]} onPress={() => toggleRole(r)}>
                    <View style={[s.roleCheck, on && s.roleCheckOn]}>{on && <Text style={s.roleCheckMark}>✓</Text>}</View>
                    <Text style={[s.roleChipText, on && s.roleChipTextOn]}>{r}</Text>
                    {r === template.leaderTitle && <Text style={s.leaderTag}>leader</Text>}
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.help}>{selectedRoles.length} role{selectedRoles.length === 1 ? '' : 's'} selected. You can add or rename roles anytime — no org chart required.</Text>
          </View>
        )}

        {/* ── Step 3: Invite — place people into the roles you picked ── */}
        {step === 3 && (
          <View style={s.block}>
            <Text style={s.q}>Invite people into roles (optional)</Text>
            <Text style={s.help}>Invite-link first: share a link and people pick themselves up. Or add a few key people here. Either way you can finish without this.</Text>
            <Pressable style={s.previewBtn} onPress={() => router.push('/setup/invite-link' as any)}>
              <Text style={s.previewText}>Share an invite link ›</Text>
            </Pressable>
            <View style={s.inviteRow}>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Name or email" placeholderTextColor="#475569" value={draftName} onChangeText={setDraftName} onSubmitEditing={addInvite} />
              <Pressable style={s.addBtn} onPress={addInvite}><Text style={s.addBtnText}>Add</Text></Pressable>
            </View>
            <View style={s.tierPick}>
              {selectedRoles.map(r => (
                <Pressable key={r} style={[s.tierChip, effectiveDraftRole === r && s.tierChipOn]} onPress={() => setDraftRole(r)}>
                  <Text style={[s.tierChipText, effectiveDraftRole === r && s.tierChipTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            {invites.length === 0 ? (
              <Text style={s.help}>No invites yet — leaders can also invite their own people after setup. You can skip this entirely.</Text>
            ) : (
              invites.map((inv, i) => (
                <View key={i} style={s.inviteItem}>
                  <Text style={s.inviteName}>{inv.name}</Text>
                  <Text style={s.inviteTier}>{inv.role}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <View style={s.block}>
            <Text style={s.q}>You’re ready 🎉</Text>
            <Text style={s.summary}><Text style={s.bold}>{orgName || 'Your org'}</Text></Text>
            <Text style={s.summaryLine}>Owner: {ownerMe ? 'you' : 'will be transferred to your invite'}</Text>
            <Text style={s.summaryLine}>Roles in use: {selectedRoles.length}</Text>
            <Text style={s.summaryLine}>Invites drafted: {invites.length}</Text>
            <Text style={s.help}>Next: leaders can invite their own people, and committees / reporting lines can be set up later in Settings — none of it is required to start.</Text>
            <Pressable style={s.previewBtn} onPress={() => router.push('/invite' as any)}>
              <Text style={s.previewText}>Preview what an invitee sees ›</Text>
            </Pressable>
          </View>
        )}

        {/* Nav buttons */}
        <View style={s.nav}>
          {step > 0 && (
            <Pressable style={s.backBtn} onPress={() => setStep(step - 1)}><Text style={s.backText}>Back</Text></Pressable>
          )}
          {step < last && step > 0 && (
            <Pressable style={s.skipBtn} onPress={() => setStep(step + 1)}><Text style={s.skipText}>Skip</Text></Pressable>
          )}
          {step < last ? (
            <Pressable style={[s.nextBtn, !canNext && s.nextBtnDisabled]} onPress={() => canNext && setStep(step + 1)} disabled={!canNext}>
              <Text style={[s.nextText, !canNext && s.nextTextDisabled]}>{step === 0 ? 'Start' : 'Next'}</Text>
            </Pressable>
          ) : (
            <Pressable style={s.nextBtn} onPress={finish}><Text style={s.nextText}>Finish</Text></Pressable>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  templateBanner: { backgroundColor: '#1e1b4b', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14, borderWidth: 1, borderColor: '#312e81' },
  templateText:   { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },

  dots:      { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dotWrap:   { flex: 1 },
  dot:       { height: 4, borderRadius: 2, backgroundColor: '#1e293b' },
  dotActive: { backgroundColor: '#6366f1' },
  dotDone:   { backgroundColor: '#4338ca' },
  stepLabel: { fontSize: 12, color: '#64748b', marginBottom: 18 },

  block: { gap: 12 },
  q:     { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
  help:  { fontSize: 13, color: '#64748b', lineHeight: 18 },
  bold:  { fontWeight: '700', color: '#f1f5f9' },

  input: { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', color: '#f1f5f9', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },

  choice:        { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 4 },
  choiceOn:      { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  choiceTitle:   { fontSize: 15, fontWeight: '700', color: '#cbd5e1' },
  choiceTitleOn: { color: '#f1f5f9' },
  choiceHint:    { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 2 },

  // Role picker (step 2)
  rolePickWrap: { gap: 8 },
  roleChip:     { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' },
  roleChipOn:   { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  roleCheck:    { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  roleCheckOn:  { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  roleCheckMark:{ fontSize: 12, color: '#a5b4fc', fontWeight: '700', lineHeight: 14 },
  roleChipText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  roleChipTextOn:{ color: '#f1f5f9' },
  leaderTag:    { fontSize: 10, fontWeight: '700', color: '#a5b4fc', backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },

  inviteRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn:      { backgroundColor: '#1e3a5f', borderRadius: 10, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 16 },
  addBtnText:  { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  tierPick:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tierChip:    { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  tierChipOn:  { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  tierChipText:{ fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  tierChipTextOn: { color: '#a5b4fc' },
  inviteItem:  { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 10, padding: 12 },
  inviteName:  { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  inviteTier:  { fontSize: 12, color: '#818cf8', fontWeight: '600' },

  summary:     { fontSize: 18, marginBottom: 4 },
  summaryLine: { fontSize: 14, color: '#94a3b8' },
  previewBtn:  { marginTop: 8, alignSelf: 'flex-start' },
  previewText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },

  nav:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  backBtn:       { paddingVertical: 12, paddingHorizontal: 14 },
  backText:      { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  skipBtn:       { paddingVertical: 12, paddingHorizontal: 8 },
  skipText:      { color: '#64748b', fontWeight: '600', fontSize: 14 },
  nextBtn:       { flex: 1, backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 14, alignItems: 'center' },
  nextBtnDisabled:{ backgroundColor: '#1e293b', borderColor: '#334155' },
  nextText:      { fontSize: 15, fontWeight: '700', color: '#60a5fa' },
  nextTextDisabled:{ color: '#475569' },
});
