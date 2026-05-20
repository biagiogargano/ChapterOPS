import { DevRoleProvider } from '@/lib/devRoleStore';
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

  return (
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
  );
}
