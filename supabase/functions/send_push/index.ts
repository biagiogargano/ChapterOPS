// ════════════════════════════════════════════════════════════════════════════
// send_push — Supabase Edge Function (DRAFT SCAFFOLD — NOT DEPLOYED)
//
//   ⚠️  This is a committed DRAFT for Push v1 Checkpoint A. It is NOT deployed
//       and NOTHING in the app calls it yet. Do not deploy until separately
//       greenlit (see docs/PUSH_V1_PLAN.md and the sibling README.md).
//
// Runtime: Supabase Edge Functions (Deno). This file is intentionally written
// against the Deno/ESM imports Edge Functions use; it is NOT part of the Expo
// app bundle and is excluded from the app's TypeScript build (see note below).
//
// PURPOSE: server-side fan-out of one action-linked push. Resolve audience roles
// → active members in the org → their Expo push tokens (read with the
// SERVICE-ROLE key, bypassing RLS), exclude the actor, POST to the Expo Push API.
//
// SECRETS: read from env at runtime (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
// NONE are hardcoded here or committed anywhere.
//
// NOTE FOR REVIEWERS: this scaffold establishes the contract + control flow. The
// member/role → token resolution query is written against the identity tables
// (members/positions) and push_tokens, and MUST be re-verified against the live
// schema when this is actually wired (Checkpoint A wiring step).
// ════════════════════════════════════════════════════════════════════════════

// @ts-nocheck — Deno/Edge runtime; not type-checked by the Expo app's tsconfig.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SendPushRequest {
  org_id:         string;
  entity_type:    'task' | 'event';
  entity_id:      string;
  audience_roles: string[];
  title:          string;
  body:           string;
  actor_role?:    string;   // excluded from recipients
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: SendPushRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  const { org_id, entity_type, entity_id, audience_roles, title, body, actor_role } = payload;
  if (!org_id || !entity_type || !entity_id || !Array.isArray(audience_roles) || audience_roles.length === 0) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
  }

  // Service-role client — bypasses RLS. Server-only; key never reaches a client.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Exclude the actor's role from the audience so people aren't pushed their own
  // action. (Per-user actor exclusion can be refined later via auth_user_id.)
  const recipientRoles = audience_roles.filter(r => r && r !== actor_role);
  if (recipientRoles.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'only_actor' }), { status: 200 });
  }

  // Resolve roles → active members in this org → their push tokens.
  // DRAFT QUERY: re-verify against live schema (members/positions/push_tokens)
  // at wiring time. Kept as two simple steps for clarity over a single join.
  const { data: members, error: mErr } = await admin
    .from('positions')
    .select('member_id, members!inner(id, org_id, status)')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .in('role', recipientRoles);

  if (mErr) {
    return new Response(JSON.stringify({ error: 'member_lookup_failed', detail: mErr.message }), { status: 500 });
  }

  const memberIds = Array.from(
    new Set((members ?? [])
      .filter((m: any) => m.members?.status === 'active')
      .map((m: any) => m.member_id)),
  );
  if (memberIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_members' }), { status: 200 });
  }

  const { data: tokenRows, error: tErr } = await admin
    .from('push_tokens')
    .select('expo_token')
    .eq('org_id', org_id)
    .in('member_id', memberIds);

  if (tErr) {
    return new Response(JSON.stringify({ error: 'token_lookup_failed', detail: tErr.message }), { status: 500 });
  }

  const tokens = Array.from(new Set((tokenRows ?? []).map((r: any) => r.expo_token).filter(Boolean)));
  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_tokens' }), { status: 200 });
  }

  // Build Expo messages. data carries the deep-link target for tap routing.
  const messages = tokens.map(to => ({
    to,
    title,
    body,
    sound: 'default',
    data: { entityType: entity_type, entityId: entity_id },
  }));

  // Expo accepts batches of up to 100 messages per request.
  const batches: any[][] = [];
  for (let i = 0; i < messages.length; i += 100) batches.push(messages.slice(i, i + 100));

  let sent = 0;
  for (const batch of batches) {
    const resp = await fetch(EXPO_PUSH_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(batch),
    });
    if (resp.ok) sent += batch.length;
    // TODO (wiring step): read receipts; prune tokens that return
    // DeviceNotRegistered from push_tokens.
  }

  return new Response(JSON.stringify({ sent }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
});
