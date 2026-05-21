/**
 * useActiveDataOrgId — the React accessor for "which org id should the data
 * layer use right now." Composes the resolved active org (from IdentityProvider)
 * with the ORG_SCOPED_DATA flag via the pure resolveDataOrgId.
 *
 * Phase 2, checkpoint P2a: defined but imported by no service/screen yet —
 * inert. While ORG_SCOPED_DATA is false this always returns DEMO_CHAPTER_ID, so
 * wiring it into a service later is a no-op until the flag flips.
 */

import { useIdentity } from './identityStore';
import { ORG_SCOPED_DATA } from './flags';
import { resolveDataOrgId } from './orgScope';
import { DEMO_CHAPTER_ID } from './eventService';

export function useActiveDataOrgId(): string {
  const { activeOrgId } = useIdentity();
  return resolveDataOrgId(activeOrgId, ORG_SCOPED_DATA, DEMO_CHAPTER_ID);
}
