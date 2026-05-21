/**
 * orgScopeReset.ts — clears all org-scoped module stores/caches in one call,
 * for use on an org transition (Issue B). Importing the stores here (which don't
 * import this module) keeps the dependency one-directional — no cycles.
 *
 * Phase 2, checkpoint B-1: defined but wired into NOTHING yet. DataBootstrap
 * will call resetOrgScopedData() on an actual org change in B-2. Inert until
 * then, and inert flag-off (no org transitions occur while ORG_SCOPED_DATA is
 * false — there is only the demo org).
 *
 * Each underlying reset clears data only and notifies its store's subscribers
 * where applicable; reactive listener sets are left intact.
 */

import { resetOrgScopedEvents } from './eventStore';
import { resetOrgScopedTasks } from './mockTasks';
import { resetNotices } from './updateNoticeStore';
import { resetRsvps } from './rsvpStore';
import { resetTaskStates } from './devTaskStore';

/** Clear events, tasks, notices, RSVPs, and task interaction state at once. */
export function resetOrgScopedData(): void {
  resetOrgScopedEvents();
  resetOrgScopedTasks();
  resetNotices();
  resetRsvps();
  resetTaskStates();
}
