/**
 * pushTokens.ts — client push-token registration adapter (Push v1, Stage 3).
 *
 * Registers this device's Expo push token against the signed-in user via the
 * upsert_push_token RPC (applied + verified on alpha). Registration ONLY (no
 * sends): the send_push Edge Function is the fan-out path, wired in a later stage.
 *
 * SAFETY / FALLBACK:
 *   • No-ops (returns 'skipped') when AUTH_ENABLED is false, Supabase is
 *     unconfigured, or not running on a physical device. So flag-off / sandbox /
 *     Expo Go behavior is unchanged and build-12 users are unaffected.
 *   • Denied permission is handled QUIETLY — a persistent flag prevents any
 *     automatic re-prompt. No alerts, no UI.
 *   • Never throws; every failure returns a controlled result string.
 *
 * Requires a native build with the expo-notifications plugin + APNs key in EAS
 * to actually obtain/deliver a token; in Expo Go / the current build it no-ops.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { AUTH_ENABLED } from './flags';

export type PushRegisterResult = 'ok' | 'denied' | 'skipped' | 'error';

// Persistent flag: once the user denies, never auto-prompt again.
const DENIED_KEY = 'push.permission.denied.v1';
// Session guard: at most one registration attempt per app run.
let _attemptedThisSession = false;

function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.startsWith('https://') && !url.includes('/rest/v1') && key.length > 10;
}

/** The EAS projectId getExpoPushTokenAsync needs (from app.json extra.eas). */
function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId
  );
}

/**
 * Attempt to register this device's push token for the given org.
 *
 * Returns:
 *   'skipped' — gated off (flag off / unconfigured / simulator / already tried /
 *               previously denied). The common, expected outcome today.
 *   'denied'  — user just declined the OS prompt (flag stored; won't re-prompt).
 *   'ok'      — token obtained and upserted.
 *   'error'   — an unexpected failure (swallowed; logged).
 *
 * Idempotent + quiet: safe to call from multiple "first meaningful action"
 * sites; only the first call per session does work.
 */
export async function registerPushToken(orgId: string): Promise<PushRegisterResult> {
  if (!AUTH_ENABLED)            return 'skipped';
  if (!isSupabaseConfigured())  return 'skipped';
  if (!orgId)                   return 'skipped';
  if (_attemptedThisSession)    return 'skipped';
  _attemptedThisSession = true;

  try {
    // Physical device required — simulators can't receive push. Constants
    // reports the device type without an extra dependency (expo-device).
    if (Constants.isDevice === false) return 'skipped';

    // Never auto-re-prompt after a prior denial.
    const denied = await AsyncStorage.getItem(DENIED_KEY);
    if (denied === '1') return 'skipped';

    // Check current permission; only request if undetermined.
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status === 'undetermined') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      await AsyncStorage.setItem(DENIED_KEY, '1');   // quiet; no re-prompt, no alert
      return 'denied';
    }

    const projectId = getProjectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoToken = tokenResp?.data;
    if (!expoToken) return 'error';

    const { error } = await supabase.rpc('upsert_push_token', {
      p_expo_token: expoToken,
      p_platform:   Platform.OS,
      p_org:        orgId,
    });
    if (error) {
      console.warn('[pushTokens] upsert_push_token error:', error.message);
      return 'error';
    }
    return 'ok';
  } catch (err) {
    console.warn('[pushTokens] registerPushToken threw:', err);
    return 'error';
  }
}
