import { AuthProvider } from '@/lib/auth';
import { DevRoleProvider } from '@/lib/devRoleStore';
import { IdentityProvider } from '@/lib/identityStore';
import { AUTH_ENABLED } from '@/lib/flags';
import { Stack } from 'expo-router';
import DataBootstrap from '../components/DataBootstrap';

// Auth/identity structure is mounted, gated by AUTH_ENABLED. While the flag is
// false, AuthProvider serves a static fallback surface and IdentityProvider is
// forced into its President fallback; the per-group route guards (useRouteTarget
// → decideRoute) all resolve to 'tabs', so the app boots directly into the
// normal tabs, exactly as before. The root always renders the Stack navigator.
//
// Cache hydration now lives in DataBootstrap (below the providers, so it can
// read the active org); it renders children immediately — no loading gate.
export default function RootLayout() {
  // Provider order: Auth → Identity → DevRole(shim) → DataBootstrap → Stack. The
  // Stack (the navigator) is rendered unconditionally; gating happens inside the
  // route groups via Redirect (see (tabs)/_layout & (auth)/_layout).
  // configuredOverride forces IdentityProvider's fallback branch while the flag
  // is off (from C7).
  return (
    <AuthProvider>
      <IdentityProvider configuredOverride={AUTH_ENABLED ? undefined : false}>
        <DevRoleProvider>
          <DataBootstrap>
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
          </DataBootstrap>
        </DevRoleProvider>
      </IdentityProvider>
    </AuthProvider>
  );
}
