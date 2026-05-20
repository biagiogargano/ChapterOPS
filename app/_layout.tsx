import { DevRoleProvider } from '@/lib/devRoleStore';
import { fetchAllEvents } from '@/lib/eventService';
import { setSupabaseEventCache } from '@/lib/eventStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

// AUTH BYPASSED FOR DEV — restore AuthProvider + InitGate from git when ready
export default function RootLayout() {
  // One-time, app-wide hydration: load Supabase events into the shared cache
  // before the tabs render so every screen (Calendar / Today / Tasks) uses the
  // same Supabase UUID events. Falls back to MOCK_EVENTS if the fetch is empty.
  useEffect(() => {
    fetchAllEvents().then(setSupabaseEventCache);
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
