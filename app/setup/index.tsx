/**
 * app/setup/index.tsx — guided org-setup wizard prototype.
 * PROTOTYPE ONLY (see SPEC_ONBOARDING_ORG_SETUP.md).
 *
 * ⚠️ MOCK / NON-FUNCTIONAL. No real invites sent, nothing persisted, no auth.
 * Strictly LINEAR, roles-first: Name → Org type → Who's in charge → which ROLES
 * your org uses → invite people into roles → done. Each decision is its own step
 * (no critical choices hidden as a small link below a step). NO org chart and NO
 * "who reports to whom" here — committees/reporting lines are an optional
 * follow-up in Settings → Roles & structure. Dev-only; not in phase-2 / alpha.
 */

import { ORG_TEMPLATES, getOrgTemplate } from '@/lib/orgTemplates/mockOrgTemplates';
import { getActiveTemplateId, setActiveTemplate, useActiveTemplate } from '@/lib/orgTemplates/activeOrgTemplate';
import { TIERS, TIER_ORDER, defaultTiers, tierColor, type TierId } from '@/lib/orgTemplates/tiers';
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
  const [orgTypeId, setOrgTypeId] = useState(getActiveTemplateId());
  const [ownerMe, setOwnerMe]   = useState(true);
  // Role list + which are included + each role's TIER. Starts as the template's
  // defaults, all included. Owner can toggle, add custom, and move roles between
  // tiers (not rank them one-by-one).
  const [roles, setRoles]       = useState<string[]>(() => template.roles);
  const [included, setIncluded] = useState<Set<string>>(() => new Set(template.roles));
  const [tierOf, setTierOf]     = useState<Record<string, TierId>>(() => defaultTiers(template.roles));
  const [customRole, setCustomRole] = useState('');
  const [invites, setInvites]   = useState<Invite[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');

  // When the org type changes, reset the role list to that template's defaults.
  const tplIdRef = useRef(template.id);
  useEffect(() => {
    if (tplIdRef.current !== template.id) {
      tplIdRef.current = template.id;
      setRoles(template.roles);
      setIncluded(new Set(template.roles));
      setTierOf(defaultTiers(template.roles));
    }
  }, [template.id, template.roles]);

  useEffect(() => { navigation.setOptions({ title: 'Set up your org' }); }, [navigation]);

  const steps = ['Name', 'Org type', 'Who’s in charge', 'Roles', 'Invite', 'Done'];
  const last  = steps.length - 1;
  const canNext = step !== 0 || orgName.trim().length > 0;

  // Included roles, grouped by tier (top tier first) — used by invite + summary.
  const selectedRoles = TIER_ORDER.flatMap(t => roles.filter(r => included.has(r) && (tierOf[r] ?? 'officer') === t));
  const effectiveDraftRole = selectedRoles.includes(draftRole)
    ? draftRole
    : (selectedRoles[1] ?? selectedRoles[0] ?? '');

  function pickOrgType(id: string) {
    setOrgTypeId(id);
    setActiveTemplate(id);   // drives the suggested roles in the next step
  }
  function toggleRole(r: string) {
    setIncluded(prev => { const n = new Set(prev); if (n.has(r)) n.delete(r); else n.add(r); return n; });
  }
  function addCustomRole() {
    const r = customRole.trim();
    if (!r || roles.includes(r)) { setCustomRole(''); return; }
    setRoles(prev => [...prev, r]);
    setIncluded(prev => new Set(prev).add(r));
    setTierOf(prev => ({ ...prev, [r]: 'officer' }));
    setCustomRole('');
  }
  // Promote (-1) / demote (+1) a role between tiers — no intra-tier ranking.
  function moveTier(role: string, dir: -1 | 1) {
    setTierOf(prev => {
      const cur  = TIER_ORDER.indexOf(prev[role] ?? 'officer');
      const next = Math.min(TIER_ORDER.length - 1, Math.max(0, cur + dir));
      if (next === cur) return prev;
      return { ...prev, [role]: TIER_ORDER[next] };
    });
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
      `${orgName || 'Your org'} is set up.\nType: ${template.label}.\nOwner: ${ownerMe ? 'you' : 'to be transferred'}.\nRoles in use: ${selectedRoles.length}.\nInvites drafted: ${invites.length}.\n\n(Mock — nothing was sent or saved.)`,
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
            <Text style={s.help}>You can change this later. It’s the only required step — everything after is optional.</Text>
          </View>
        )}

        {/* ── Step 1: Org type (its own step, not a hidden link) ── */}
        {step === 1 && (
          <View style={s.block}>
            <Text style={s.q}>What kind of organization?</Text>
            <Text style={s.help}>This sets your starting defaults — roles, event types, and reports. Change anything later.</Text>
            <View style={s.typeGrid}>
              {ORG_TEMPLATES.map(tpl => {
                const on = tpl.id === orgTypeId;
                return (
                  <Pressable key={tpl.id} style={[s.typeCard, on && s.typeCardOn]} onPress={() => pickOrgType(tpl.id)}>
                    <Text style={s.typeEmoji}>{tpl.emoji}</Text>
                    <Text style={[s.typeLabel, on && s.typeLabelOn]}>{tpl.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={s.typePreview}>
              <Text style={s.typePreviewLabel}>LEADER</Text>
              <Text style={s.typePreviewValue}>{getOrgTemplate(orgTypeId)?.leaderTitle}</Text>
              <Text style={[s.typePreviewLabel, { marginTop: 8 }]}>SUGGESTED ROLES</Text>
              <Text style={s.typePreviewValue}>{getOrgTemplate(orgTypeId)?.roles.join(' · ')}</Text>
            </View>
          </View>
        )}

        {/* ── Step 2: Owner ── */}
        {step === 2 && (
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

        {/* ── Step 3: Roles grouped into TIERS (peers within a tier) ── */}
        {step === 3 && (
          <View style={s.block}>
            <Text style={s.q}>Roles &amp; tiers</Text>
            <Text style={s.help}>
              Setup just defines your roles and how they’re grouped into tiers (the
              seniority/order) — nothing more. Keep the {template.label} roles you use, add
              your own, and use ▲▼ to move a role between tiers. Roles in the same tier are
              equals — no need to rank minor differences.
            </Text>
            {TIERS.map(tier => {
              const tierRoles = roles.filter(r => (tierOf[r] ?? 'officer') === tier.id);
              if (tierRoles.length === 0) return null;
              return (
                <View key={tier.id} style={s.tierGroup}>
                  <Text style={[s.tierHeader, { color: tierColor(tier.id) }]}>{tier.label.toUpperCase()}</Text>
                  {tierRoles.map(r => {
                    const on = included.has(r);
                    const ti = TIER_ORDER.indexOf(tierOf[r] ?? 'officer');
                    return (
                      <View key={r} style={[s.roleChip, on && s.roleChipOn]}>
                        <Pressable style={s.roleCheckHit} onPress={() => toggleRole(r)}>
                          <View style={[s.roleCheck, on && s.roleCheckOn]}>{on && <Text style={s.roleCheckMark}>✓</Text>}</View>
                        </Pressable>
                        <Text style={[s.roleChipText, on && s.roleChipTextOn]} numberOfLines={1}>{r}</Text>
                        {r === template.leaderTitle && <Text style={s.leaderTag}>leader</Text>}
                        <Pressable style={s.moveBtn} onPress={() => moveTier(r, -1)} disabled={ti === 0}>
                          <Text style={[s.moveText, ti === 0 && s.moveDisabled]}>▲</Text>
                        </Pressable>
                        <Pressable style={s.moveBtn} onPress={() => moveTier(r, 1)} disabled={ti === TIER_ORDER.length - 1}>
                          <Text style={[s.moveText, ti === TIER_ORDER.length - 1 && s.moveDisabled]}>▼</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            <View style={s.inviteRow}>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Add a custom role…" placeholderTextColor="#475569" value={customRole} onChangeText={setCustomRole} onSubmitEditing={addCustomRole} returnKeyType="done" />
              <Pressable style={s.addBtn} onPress={addCustomRole}><Text style={s.addBtnText}>Add</Text></Pressable>
            </View>
            <Text style={s.help}>{selectedRoles.length} role{selectedRoles.length === 1 ? '' : 's'} included across {TIERS.filter(t => roles.some(r => included.has(r) && (tierOf[r] ?? 'officer') === t.id)).length} tier(s).</Text>
            <Text style={s.help}>
              You’ll assign actual people to these roles later in Settings → Members &amp;
              positions. Detailed committees and reporting lines are optional, also later in
              Settings → Roles &amp; structure. You don’t build a full org chart here.
            </Text>
          </View>
        )}

        {/* ── Step 4: Invite — two clear options, not a hidden link ── */}
        {step === 4 && (
          <View style={s.block}>
            <Text style={s.q}>Add people (optional)</Text>
            <Text style={s.help}>Invite-link first: share a link and people pick themselves up. Or add a few key people by hand. Either way you can finish without this.</Text>

            <Pressable style={s.optionBtn} onPress={() => router.push('/setup/invite-link' as any)}>
              <Text style={s.optionBtnText}>🔗  Share an invite link</Text>
              <Text style={s.optionBtnSub}>Recommended — people join themselves into a role</Text>
            </Pressable>

            <Text style={[s.help, { marginTop: 4 }]}>Or add someone manually:</Text>
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
            {invites.length > 0 && invites.map((inv, i) => (
              <View key={i} style={s.inviteItem}>
                <Text style={s.inviteName}>{inv.name}</Text>
                <Text style={s.inviteTier}>{inv.role}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Step 5: Done ── */}
        {step === 5 && (
          <View style={s.block}>
            <Text style={s.q}>You’re ready 🎉</Text>
            <Text style={s.summary}><Text style={s.bold}>{orgName || 'Your org'}</Text></Text>
            <Text style={s.summaryLine}>Type: {template.label}</Text>
            <Text style={s.summaryLine}>Owner: {ownerMe ? 'you' : 'will be transferred to your invite'}</Text>
            <Text style={s.summaryLine}>Roles in use: {selectedRoles.length}</Text>
            <Text style={s.summaryLine}>Invites drafted: {invites.length}</Text>
            <Text style={s.help}>Next, anytime: assign people to roles in Settings → Members &amp; positions, and set up optional committees / reporting lines in Settings → Roles &amp; structure. None of it is required to start.</Text>
            <Pressable style={s.optionBtn} onPress={() => router.push('/invite' as any)}>
              <Text style={s.optionBtnText}>👀  Preview the invitee view</Text>
              <Text style={s.optionBtnSub}>See what someone sees when they accept</Text>
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

  // Org-type step
  typeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard:  { width: '47%', backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155', gap: 6 },
  typeCardOn:{ borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  typeEmoji: { fontSize: 22 },
  typeLabel: { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  typeLabelOn:{ color: '#f1f5f9', fontWeight: '700' },
  typePreview:      { backgroundColor: '#0a1628', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 14, marginTop: 6 },
  typePreviewLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 },
  typePreviewValue: { fontSize: 14, color: '#cbd5e1', marginTop: 2, lineHeight: 19 },

  choice:        { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155', gap: 4 },
  choiceOn:      { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  choiceTitle:   { fontSize: 15, fontWeight: '700', color: '#cbd5e1' },
  choiceTitleOn: { color: '#f1f5f9' },
  choiceHint:    { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 2 },

  // Role picker (step 3) — grouped into tiers
  rolePickWrap: { gap: 8 },
  tierGroup:    { gap: 8, marginTop: 6 },
  tierHeader:   { fontSize: 11, fontWeight: '700', color: '#818cf8', letterSpacing: 0.8, marginTop: 6 },
  roleChip:     { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' },
  roleChipOn:   { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  roleCheckHit: { padding: 2 },
  roleCheck:    { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  roleCheckOn:  { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  roleCheckMark:{ fontSize: 12, color: '#a5b4fc', fontWeight: '700', lineHeight: 14 },
  roleChipText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  roleChipTextOn:{ color: '#f1f5f9' },
  leaderTag:    { fontSize: 10, fontWeight: '700', color: '#a5b4fc', backgroundColor: '#312e81', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  moveBtn:      { paddingHorizontal: 6, paddingVertical: 4 },
  moveText:     { fontSize: 13, color: '#818cf8', lineHeight: 15 },
  moveDisabled: { color: '#334155' },

  // Invite step
  optionBtn:    { backgroundColor: '#1e3a5f', borderRadius: 11, borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 13, paddingHorizontal: 14, gap: 2 },
  optionBtnText:{ color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  optionBtnSub: { color: '#64748b', fontSize: 12 },
  inviteRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn:      { backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingVertical: 12, paddingHorizontal: 16 },
  addBtnText:  { color: '#94a3b8', fontWeight: '700', fontSize: 14 },
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
