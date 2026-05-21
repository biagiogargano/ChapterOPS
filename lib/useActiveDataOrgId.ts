/**
 * useActiveDataOrgId — the React accessor for "which org id should the data
 * layer use right now." Composes the resolved active org (from IdentityProvider)
 * with the ORG_SCOPED_DATA flag via the pure resolveDataOrgId.
 *
 * While ORG_SCOPED_DATA is false this always returns DEMO_CHAPTER_ID.
 *
 * Fallback-org reconciliation (P2f): the fallback identity reports
 * activeOrgId = 'demo-chapter' (DEMO_CHAPTER.id), but the data lives under
 * DEMO_CHAPTER_ID ('a0a0…'). So in fallback mode (no-env / dev sandbox) the data
 * org is forced to DEMO_CHAPTER_ID — otherwise flipping ORG_SCOPED_DATA on would
 * scope the sandbox to an empty org. This reconciliation lives ONLY here (the
 * org → data-org boundary); identity.activeOrgId is left as-is for identity
 * logic.
 */

import { useIdentity } from './identityStore';
import { ORG_SCOPED_DATA } from './flags';
import { resolveDataOrgId } from './orgScope';
import { DEMO_CHAPTER_ID } from './eventService';

export function useActiveDataOrgId(): string {
  const { activeOrgId, isFallback } = useIdentity();
  // Sandbox (fallback identity) always reads the demo chapter's data.
  if (isFallback) return DEMO_CHAPTER_ID;
  return resolveDataOrgId(activeOrgId, ORG_SCOPED_DATA, DEMO_CHAPTER_ID);
}
