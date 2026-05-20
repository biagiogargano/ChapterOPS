import { AuthProvider } from '@/lib/auth';
import { DevRoleProvider } from '@/lib/devRoleStore';
import { IdentityProvider } from '@/lib/identityStore';
import { AUTH_ENABLED } from '@/lib/flags';
import { seedTaskStates } from '@/lib/devTaskStore';
import { fetchAllEvents } from '@/lib/eventService';
import { setSupabaseEventCache } from '@/lib/eventStore';
import { setSupabaseTaskCache } from '@/lib/mockTasks';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

// Auth/identity structure is mounted, gated by AUTH_ENABLED. While the flag is
// false, AuthProvider serves a static fallback surface and IdentityProvider is
// forced into its President fallback; the per-group route guards (useRouteTarget
// → decideRoute) all resolve to 'tabs', so the app boots directly into the
// normal tabs, exactly as before. The root always renders the Stack navigator.
export default function RootLayout() {
  // One-time, app-wide hydration: load Supabase events + structured tasks into
  // their shared caches before the tabs render. Both fall back to their mock
  // data when the fetch is empty (unconfigured / table not seeded yet).
  useEffect(() => {
    fetchAllEvents().then(setSupabaseEventCache);
    fetchAllTasks().then(setSupabaseTaskCache);
    // Seed task interaction state (state/proof/rejection) so reviewer feedback
    // and proof content survive reload — not just the task's bucket state.
    fetchTaskStates().then(seedTaskStates);
    // Load persisted update/change notices.
    void hydrateUpdateNotices();
  }, []);

  // Provider order: Auth → Identity → DevRole(shim) → Stack. The Stack (the
  // navigator) is rendered unconditionally; gating happens inside the route
  // groups via Redirect (see (tabs)/_layout & (auth)/_layout). configuredOverride
  // forces IdentityProvider's fallback branch while the flag is off (from C7).
  return (
    <AuthProvider>
      <IdentityProvider configuredOverride={AUTH_ENABLED ? undefined : false}>
        <DevRoleProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0f172a' },
              headerTintColor: '#f8fafc',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: '#0f172a' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="event/[id]" options={{ title: 'Event', presentation: 'card' }} />
            <Stack.Screen name="task/[id]"  options={{ title: 'Task',  presentation: 'card' }} />
          </Stack>
        </DevRoleProvider>
      </IdentityProvider>
    </AuthProvider>
  );
}
