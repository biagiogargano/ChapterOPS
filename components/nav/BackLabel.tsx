/**
 * components/nav/BackLabel.tsx — a global header back button that shows the NAME
 * of the screen you're returning to (not "(tabs)"). Wired into the root Stack's
 * screenOptions.headerLeft so every pushed screen gets a contextual back label on
 * both iOS and Android. Screens that set their own headerLeft (e.g. a Cancel
 * button) override this automatically. UI-only; feature branch.
 */

import { useNavigation } from 'expo-router';
import { Pressable, Text, StyleSheet } from 'react-native';

// Friendly labels for the tabs (when returning into the tab navigator).
const TAB_LABELS: Record<string, string> = {
  index: 'Today', calendar: 'Calendar', create: 'Create',
  tasks: 'Tasks', me: 'Me', settings: 'Settings', pinned: 'Pinned',
};

// Friendly labels for specific pushed routes worth naming explicitly.
const ROUTE_LABELS: Record<string, string> = {
  'event/[id]': 'Event', 'event/create': 'New event',
  'task/[id]': 'Task',   'task/create': 'New task',
  'templates/index': 'Templates',
  'roster/index': 'Members', 'prototypes/index': 'Prototypes',
  'setup/index': 'Setup', 'notifications/index': 'Notifications',
};

/** Title-case a raw route segment as a last-resort label. */
function fallbackLabel(name: string): string {
  const seg = name.split('/')[0].replace(/\[|\]/g, '').replace(/[-_]/g, ' ');
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Back';
}

function labelForRoute(route: any): string {
  if (!route) return 'Back';
  if (route.name === '(tabs)') {
    // Drill into the nested tab navigator state to name the active tab.
    const tabState = route.state;
    const tabName  = tabState?.routes?.[tabState.index ?? 0]?.name;
    return TAB_LABELS[tabName] ?? 'Home';
  }
  return ROUTE_LABELS[route.name] ?? fallbackLabel(route.name);
}

export default function BackLabel() {
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;

  const state = navigation.getState() as any;
  const prev  = state?.routes?.[(state.index ?? 0) - 1];
  const label = labelForRoute(prev);

  return (
    <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.row}>
      <Text style={s.chevron}>‹</Text>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingRight: 16, maxWidth: 180 },
  chevron: { color: '#60a5fa', fontSize: 24, lineHeight: 26, marginRight: 1 },
  label:   { color: '#60a5fa', fontSize: 16, fontWeight: '600' },
});
