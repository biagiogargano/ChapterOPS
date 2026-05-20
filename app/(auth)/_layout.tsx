import { Stack } from 'expo-router';

// Plain stack wrapper. Post-sign-in navigation is handled by
// the root InitGate effect, which fires after auth state commits.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
