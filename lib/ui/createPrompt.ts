/**
 * ui/createPrompt.ts — unified "+ New" chooser.
 *
 * Reinforces the two core primitives: creating anything starts with "Event or
 * Task?". Used by the per-tab "+ New" buttons and the actionable empty states so
 * there's one consistent way to add things. Pure UI helper.
 */

import { Alert } from 'react-native';

/** Show the Event/Task chooser; `go` routes to the chosen create screen. */
export function promptCreate(go: (route: string) => void): void {
  Alert.alert(
    'Add new',
    'What would you like to create?',
    [
      { text: 'Event', onPress: () => go('/event/create') },
      { text: 'Task',  onPress: () => go('/task/create') },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}
