/**
 * app/setup/index.tsx — guided org-setup wizard prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md).
 *
 * ⚠️ MOCK / NON-FUNCTIONAL. No real invites sent, nothing persisted, no auth.
 * Just the first-run flow so we can feel whether it's intuitive: name the org →
 * who's in charge → pick a structure → invite a few people → done. Every step
 * after the first is skippable with sensible defaults. Dev-only; not linked from
 * phase-2, not wired into the alpha.
 */

import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Tier = { id: string; label: string; hint: string };
const SUGGESTED_TIERS: Tier[] = [
  { id: 'owner',   label: 'Owner / Main leader', hint: 'CEO · President — full control (just you for now)' },
  { id: 'exec',    label: 'Top executives',       hint: 'e.g. VP / Pro Consul' },
  { id: 'officer', label: 'Officers',             hint: 'Committee chairs' },
  { id: 'member',  label: 'General members',      hint: 'Everyone else' },
];

interface Invite { name: string; tier: string }

export default function SetupWizardScreen() {
  const navigation = useNavigation();
  const router     = useRouter();
  const [step, setStep] = useState(0);

  const [orgName, setOrgName]   = useState('');
  const [ownerMe, setOwnerMe]   = useState(true);
  const [useTiers, setUseTiers] = useState(true);
  const [invites, setInvites]   = useState<Invite[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftTier, setDraftTier] = useState('exec');

  useEffect(() => { navigation.setOptions({ title: 'Set up your org' }); }, [navigation]);

  const steps = ['Name', 'Who’s in charge', 'Structure', 'Invite', 'Done'];
  const last  = steps.length - 1;
  const canNext = step !== 0 || orgName.trim().length > 0;

  function addInvite() {
    const n = draftName.trim();
    if (!n) return;
    setInvites(prev => [...prev, { name: n, tier: draftTier }]);
    setDraftName('');
  }

  function finish() {
    Alert.alert(
      'Setup complete (prototype)',
      `${orgName || 'Your org'} is set up.\nOwner: ${ownerMe ? 'you' : 'to be transferred'}.\nInvites drafted: ${invites.length}.\n\n(Mock — nothing was sent or saved.)`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · mock setup, nothing saved</Text></View>

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

        {/* ── Step 2: Structure ── */}
        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Pick a starting structure</Text>
            <Pressable style={[s.choice, useTiers && s.choiceOn]} onPress={() => setUseTiers(true)}>
              <Text style={[s.choiceTitle, useTiers && s.choiceTitleOn]}>Use the suggested tiers</Text>
              {SUGGESTED_TIERS.map(t => (
                <Text key={t.id} style={s.tierLine}>•  <Text style={s.bold}>{t.label}</Text> — {t.hint}</Text>
              ))}
              <Text style={s.choiceHint}>You can rename or remove any of these later.</Text>
            </Pressable>
            <Pressable style={[s.choice, !useTiers && s.choiceOn]} onPress={() => setUseTiers(false)}>
              <Text style={[s.choiceTitle, !useTiers && s.choiceTitleOn]}>Start minimal</Text>
              <Text style={s.choiceHint}>Just you + members. Add structure whenever you want.</Text>
            </Pressable>
            <Pressable style={s.previewBtn} onPress={() => router.push('/setup/invite-people' as any)}>
              <Text style={s.previewText}>Invite people, then build your tree from them ›</Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 3: Invite ── */}
        {step === 3 && (
          <View style={s.block}>
            <Text style={s.q}>Invite a few key people (optional)</Text>
            <View style={s.inviteRow}>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Name or email" placeholderTextColor="#475569" value={draftName} onChangeText={setDraftName} onSubmitEditing={addInvite} />
              <Pressable style={s.addBtn} onPress={addInvite}><Text style={s.addBtnText}>Add</Text></Pressable>
            </View>
            <View style={s.tierPick}>
              {SUGGESTED_TIERS.filter(t => t.id !== 'owner').map(t => (
                <Pressable key={t.id} style={[s.tierChip, draftTier === t.id && s.tierChipOn]} onPress={() => setDraftTier(t.id)}>
                  <Text style={[s.tierChipText, draftTier === t.id && s.tierChipTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {invites.length === 0 ? (
              <Text style={s.help}>No invites yet — leaders can also invite their own committee members after setup. You can skip this entirely.</Text>
            ) : (
              invites.map((inv, i) => (
                <View key={i} style={s.inviteItem}>
                  <Text style={s.inviteName}>{inv.name}</Text>
                  <Text style={s.inviteTier}>{SUGGESTED_TIERS.find(t => t.id === inv.tier)?.label}</Text>
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
            <Text style={s.summaryLine}>Structure: {useTiers ? 'suggested tiers' : 'minimal'}</Text>
            <Text style={s.summaryLine}>Invites drafted: {invites.length}</Text>
            <Text style={s.help}>After you finish, leaders can invite their own committees, and a quick walkthrough will show the basics.</Text>
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
  tierLine:      { fontSize: 13, color: '#94a3b8', lineHeight: 20, marginTop: 2 },

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
