/**
 * DataBootstrap — non-blocking, org-aware hydration of the shared caches.
 *
 * Phase 2, checkpoint P2c: this is the relocated root hydration. It lives BELOW
 * Auth/Identity/DevRole (so it can read the active org) and wraps the Stack. It
 * renders children immediately — no loading gate — exactly like the old root
 * effect, so startup behavior is unchanged.
 *
 * While ORG_SCOPED_DATA is false, useActiveDataOrgId() returns DEMO_CHAPTER_ID,
 * so this hydrates the same data the root effect did. Event and task reads take
 * the orgId param; notices keep their current default signature (parameterized
 * in a later checkpoint).
 *
 * A monotonic request id guards against a stale hydration (from a previous
 * orgId) overwriting newer cache data when the active org changes.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { fetchAllEvents } from '@/lib/eventService';
import { setSupabaseEventCache } from '@/lib/eventStore';
import { setSupabaseTaskCache } from '@/lib/mockTasks';
import { fetchAllTasks, fetchTaskStates } from '@/lib/taskService';
import { hydrateUpdateNotices } from '@/lib/updateNoticeStore';
import { seedTaskStates } from '@/lib/devTaskStore';
import { useActiveDataOrgId } from '@/lib/useActiveDataOrgId';

export default function DataBootstrap({ children }: { children: ReactNode }) {
  // DEMO_CHAPTER_ID while ORG_SCOPED_DATA is false → identical to today.
  const orgId = useActiveDataOrgId();
  const reqIdRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    const fresh = () => reqId === reqIdRef.current;

    // Events + tasks: org-scoped reads (P2b/P2d param). Notices keep the default
    // signature until parameterized in a later checkpoint.
    fetchAllEvents(orgId).then(remote => { if (fresh()) setSupabaseEventCache(remote); });
    fetchAllTasks(orgId).then(remote => { if (fresh()) setSupabaseTaskCache(remote); });
    fetchTaskStates(orgId).then(states => { if (fresh()) seedTaskStates(states); });
    void hydrateUpdateNotices();
  }, [orgId]);

  return <>{children}</>;
}
