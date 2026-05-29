/**
 * RecoveryLinkHandler — consumes Supabase auth deep links.
 *
 * All Supabase auth emails (signup confirmation, password recovery, magic link)
 * redirect to AUTH_REDIRECT_URL (chapterops://auth/callback). The redirect
 * carries the session either as a URL fragment (#access_token&refresh_token,
 * implicit flow) or a query (?code=, PKCE). This component:
 *   1. reads the initial URL (cold start) + listens for live URLs (warm),
 *   2. establishes a session from whichever token form is present,
 *   3. routes by the link `type`: recovery → /reset-password,
 *      signup/magiclink/everything-else → /auth/callback (success screen).
 *
 * It renders nothing. It is mounted in the root tree but only does work when
 * AUTH_ENABLED is true — flag-off builds never register listeners. Because
 * lib/supabase.ts sets detectSessionInUrl:false, the client does NOT consume
 * these tokens itself, so this handler is the single place that does.
 */

import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { AUTH_ENABLED } from '@/lib/flags';

/** Parse a Supabase auth redirect URL into the bits we need. */
function parseAuthUrl(url: string): {
  accessToken?:  string;
  refreshToken?: string;
  code?:         string;
  type?:         string;
  errorDesc?:    string;
} {
  const out: ReturnType<typeof parseAuthUrl> = {};
  // Tokens may live in the fragment (#a=b&c=d) or the query (?a=b&c=d).
  const hashIndex  = url.indexOf('#');
  const fragment   = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = url.indexOf('?');
  const query      =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';

  const read = (raw: string) => {
    if (!raw) return;
    for (const pair of raw.split('&')) {
      const [k, v] = pair.split('=');
      if (!k) continue;
      const key   = decodeURIComponent(k);
      const value = decodeURIComponent(v ?? '');
      if (key === 'access_token')       out.accessToken  = value;
      else if (key === 'refresh_token') out.refreshToken = value;
      else if (key === 'code')          out.code         = value;
      else if (key === 'type')          out.type         = value;
      else if (key === 'error_description') out.errorDesc = value;
    }
  };
  read(query);
  read(fragment);
  return out;
}

export default function RecoveryLinkHandler() {
  const router  = useRouter();
  const { setSessionFromTokens } = useAuth();
  // Guard against double-handling the same URL (initial + event can overlap).
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let active = true;

    async function handleUrl(url: string | null) {
      if (!active || !url) return;
      if (handledRef.current === url) return;

      const { accessToken, refreshToken, code, type } = parseAuthUrl(url);
      const isAuthLink =
        !!accessToken || !!code || url.includes('auth/callback') || url.includes('reset-password');
      if (!isAuthLink) return;            // unrelated deep link — ignore
      handledRef.current = url;

      // Establish the session from whichever token form arrived.
      if (accessToken && refreshToken) {
        await setSessionFromTokens(accessToken, refreshToken);
      } else if (code) {
        // PKCE flow fallback.
        await supabase.auth.exchangeCodeForSession(code);
      }

      if (!active) return;
      // Recovery → password reset screen; everything else → confirmation screen.
      if (type === 'recovery') router.replace('/reset-password' as any);
      else                     router.replace('/auth/callback' as any);
    }

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', e => { void handleUrl(e.url); });

    // Backstop: if Supabase emits PASSWORD_RECOVERY before we parse the URL,
    // still route to the reset screen.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) {
        router.replace('/reset-password' as any);
      }
    });

    return () => {
      active = false;
      sub.remove();
      authSub.subscription.unsubscribe();
    };
  }, [router, setSessionFromTokens]);

  return null;
}
