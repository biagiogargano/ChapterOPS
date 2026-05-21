/**
 * DataBootstrap — non-blocking, org-aware hydration of the shared caches.
 *
 * Phase 2, checkpoint P2c: this is the relocated root hydration. It lives BELOW
 * Auth/Identity/DevRole (so it can read the active org) and wraps the Stack. It
 * renders children immediately — no loading gate — exactly like the old root
 * effect, so startup behavior is unchanged.
 *
 * While ORG_SCOPED_DATA is false, useActiveDataOrgId() returns DEMO_CHAPTER_ID,
 * so this hydrates the same data the root effect did. Event, task, and notice
 * reads all take the orgId param.
 *
 * A monotonic request id guards against a stale hydration (from a previous
 * orgId) overwriting newer cache data when the active org changes.
 *
 * Phase gating (P2f): while ORG_SCOPED_DATA is on, hydration only runs on a
 * stable identity phase ('resolved' / 'fallback'); during transient phases
 * (initializing / resolving / error / selecting_org) it is skipped to avoid a
 * demo-then-real double load. While the flag is off, `ready` is always true, so
 * hydration runs exactly as before (inert).
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { fetchAllEvents } from '@/lib/eventService';
import { setSupabaseEventCache } from '@/lib/eventStore';
import { setSupabaseTaskCache } from '@/lib/mockTasks';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import { seedTaskStates } from '@/lib/devTaskStore';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';
import { useIdentity } from '@/lib/identityStore';
import { ORG_SCOPED_DATA } from '@/lib/flags';
import { setDataOrgId } from '@/lib/dataOrgHolder';

export default function DataBootstrap({ children }: { children: ReactNode }) {
  // DEMO_CHAPTER_ID while ORG_SCOPED_DATA is false → identical to today.
  const orgId = useActiveDataOrgId();
  const { phase } = useIdentity();
  const reqIdRef = useRef(0);

  // Keep the data-org holder in sync with the active org so write paths target
  // the same org reads use. useLayoutEffect (not useEffect) so the holder is set
  // synchronously at commit — before paint and before any user-triggered write
  // can run — eliminating the post-paint lag that let writes land in a stale
  // org. Inert while flag-off (orgId === DEMO_CHAPTER_ID).
  useLayoutEffect(() => { setDataOrgId(orgId); }, [orgId]);

  // When scoping is on, only hydrate on a stable phase. When off, always ready.
  const ready = !ORG_SCOPED_DATA || phase === 'resolved' || phase === 'fallback';

  useEffect(() => {
    if (!ready) return;   // skip hydration during transient phases (scoped only)

    const reqId = ++reqIdRef.current;
    const fresh = () => reqId === reqIdRef.current;

    // Events, tasks, and notices: org-scoped reads (P2b/P2d/P2e param). The
    // fresh() guard (incl. the notice isCurrent guard, P2f) prevents a stale
    // hydration from overwriting newer cache data.
    fetchAllEvents(orgId).then(remote => { if (fresh()) setSupabaseEventCache(remote); });
    fetchAllTasks(orgId).then(remote => { if (fresh()) setSupabaseTaskCache(remote); });
    fetchTaskStates(orgId).then(states => { if (fresh()) seedTaskStates(states); });
    void hydrateUpdateNotices(orgId, fresh);
  }, [orgId, ready]);

  return <>{children}</>;
}
