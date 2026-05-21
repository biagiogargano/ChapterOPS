/**
 * DataBootstrap — non-blocking, org-aware hydration of the shared caches.
 *
 * Phase 2, checkpoint P2c: this is the relocated root hydration. It lives BELOW
 * Auth/Identity/DevRole (so it can read the active org) and wraps the Stack. It
 * renders children immediately — no loading gate — exactly like the old root
 * effect, so startup behavior is unchanged.
 *
 * While ORG_SCOPED_DATA is false, useActiveDataOrgId() returns DEMO_CHAPTER_ID,
 * so this hydrates the same data the root effect did. Only event reads take the
 * orgId param for now; tasks/notices keep their current default signatures
 * (parameterized in later checkpoints).
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

    // Events: org-scoped read (P2b param). Tasks/notices keep default signatures
    // until their reads are parameterized in later checkpoints.
    fetchAllEvents(orgId).then(remote => { if (fresh()) setSupabaseEventCache(remote); });
    fetchAllTasks().then(remote => { if (fresh()) setSupabaseTaskCache(remote); });
    fetchTaskStates().then(states => { if (fresh()) seedTaskStates(states); });
    void hydrateUpdateNotices();
  }, [orgId]);

  return <>{children}</>;
}
