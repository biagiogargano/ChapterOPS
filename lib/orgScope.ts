/**
 * orgScope.ts — pure resolution of "which org id should the data layer use."
 *
 * Phase 2, checkpoint P2a: the single canonical decision point for data org
 * scoping. Pure (no React, no I/O), so it's unit-testable in isolation and is
 * the one place later checkpoints flip instead of editing DEMO_CHAPTER_ID across
 * many services.
 *
 * While ORG_SCOPED_DATA is false, callers pass scoped=false and this returns the
 * fallback org id (DEMO_CHAPTER_ID) unconditionally — today's behavior.
 */

/**
 * Resolve the org id the data layer should query against.
 *   - scoped=false (or no active org) → fallbackOrgId (the demo chapter).
 *   - scoped=true with an active org   → that active org id.
 */
export function resolveDataOrgId(
  activeOrgId:   string | null,
  scoped:        boolean,
  fallbackOrgId: string,
): string {
  return scoped && activeOrgId ? activeOrgId : fallbackOrgId;
}
