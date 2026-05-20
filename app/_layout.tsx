import { AuthProvider } from '@/lib/auth';
import { DevRoleProvider } from '@/lib/devRoleStore';
import { IdentityProvider } from '@/lib/identityStore';
import { AUTH_ENABLED } from '@/lib/flags';
import InitGate from '../components/InitGate';
import { seedTaskStates } from '@/lib/devTaskStore';
import { fetchAllEvents } from '@/lib/eventService';
import { setSupabaseEventCache } from '@/lib/eventStore';
import { setSupabaseTaskCache } from '@/lib/mockTasks';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

// Auth/identity/init structure is mounted, but gated by AUTH_ENABLED. While the
// flag is false, AuthProvider serves a static fallback surface, IdentityProvider
// is forced into its President fallback, and InitGate's decideRoute short-circuits
// to 'tabs' — so the app boots directly into the normal tabs, exactly as before.
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

  // Provider order: Auth → Identity → DevRole(shim) → InitGate → Stack.
  // configuredOverride forces IdentityProvider's fallback branch while the flag
  // is off (preserved exactly from C7). InitGate wraps the navigator; with the
  // flag off it short-circuits to 'tabs' and renders the Stack unchanged.
  return (
    <AuthProvider>
      <IdentityProvider configuredOverride={AUTH_ENABLED ? undefined : false}>
        <DevRoleProvider>
          <InitGate>
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
          </InitGate>
        </DevRoleProvider>
      </IdentityProvider>
    </AuthProvider>
  );
}
