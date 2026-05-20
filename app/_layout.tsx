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

// AUTH BYPASSED FOR DEV — restore AuthProvider + InitGate from git when ready
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

  // While AUTH_ENABLED is false, force IdentityProvider into its fallback branch
  // (President, dev switch enabled) regardless of real Supabase config, so the
  // app behaves exactly like the previous dev sandbox. When the flag flips on
  // (C11/C12), pass undefined so the provider uses the real configured check.
  return (
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
          <Stack.Screen name="event/[id]" options={{ title: 'Event', presentation: 'card' }} />
          <Stack.Screen name="task/[id]"  options={{ title: 'Task',  presentation: 'card' }} />
        </Stack>
      </DevRoleProvider>
    </IdentityProvider>
  );
}
