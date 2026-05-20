import { Tabs } from 'expo-router';
import { Calendar, CheckSquare, Home, User } from 'lucide-react-native';

// AUTH GUARD BYPASSED FOR DEV — restore useAuth + Redirect when auth is fixed
export default function TabLayout() {
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
      <Tabs.Screen name="me"       options={{ title: 'Me',       tabBarIcon: ({ color, size }) => <User        color={color} size={size} /> }} />
    </Tabs>
  );
}
