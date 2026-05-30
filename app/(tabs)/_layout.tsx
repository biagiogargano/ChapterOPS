import { Redirect, Tabs } from 'expo-router';
import { Calendar, CheckSquare, Home, Target, User } from 'lucide-react-native';
import { useRouteTarget } from '@/lib/useRouteTarget';
import { hrefForTarget } from '@/lib/routeTarget';
import Splash from '../../components/auth/Splash';

// Route guard: only render the tabs when the resolved target is 'tabs'. While
// AUTH_ENABLED is false this is always 'tabs', so behavior is unchanged.
export default function TabLayout() {
  const target = useRouteTarget();
  if (target === 'splash') return <Splash />;                       // loading — never redirect
  if (target !== 'tabs') return <Redirect href={hrefForTarget(target) as any} />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Today',    tabBarIcon: ({ color, size }) => <Home        color={color} size={size} /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Calendar    color={color} size={size} /> }} />
      <Tabs.Screen name="tasks"    options={{ title: 'Tasks',    tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} /> }} />
      <Tabs.Screen name="goals"    options={{ title: 'Goals',    tabBarIcon: ({ color, size }) => <Target      color={color} size={size} /> }} />
      <Tabs.Screen name="me"       options={{ title: 'Me',       tabBarIcon: ({ color, size }) => <User        color={color} size={size} /> }} />
    </Tabs>
  );
}
