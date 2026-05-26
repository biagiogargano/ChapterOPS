/**
 * app/first-run/index.tsx — consolidated into the single intro experience.
 * There is now ONE onboarding prototype: the annotated tour (/tutorial) that
 * flows into the setup wizard (/setup). This route just redirects there so we
 * don't keep multiple competing first-run screens. Dev-only; not in phase-2.
 */

import { Redirect } from 'expo-router';

export default function FirstRunScreen() {
  return <Redirect href={'/tutorial' as any} />;
}
