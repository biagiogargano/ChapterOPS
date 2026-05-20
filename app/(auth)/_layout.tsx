import { Redirect, Stack } from 'expo-router';
import { useRouteTarget } from '@/lib/useRouteTarget';

// Route guard: if the user is already resolved into the app, bounce out of the
// auth group to the tabs. While AUTH_ENABLED is false the target is always
// 'tabs', so any attempt to reach an auth screen (even a direct link) redirects
// to the tabs — no login/onboarding exposure.
export default function AuthLayout() {
  const target = useRouteTarget();
  if (target === 'tabs') return <Redirect href={'/(tabs)' as any} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
