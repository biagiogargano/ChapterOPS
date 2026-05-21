/**
 * dataOrgHolder.ts — module-level holder for the active DATA org id.
 *
 * Phase 2, checkpoint P2g-1: the seam through which non-React write paths will
 * eventually scope their queries/payloads (without threading orgId through every
 * call site). DataBootstrap keeps it in sync with the active org via
 * setDataOrgId(); write paths will read getDataOrgId() in later P2g checkpoints.
 *
 * Default is DEMO_CHAPTER_ID, and while ORG_SCOPED_DATA is false DataBootstrap
 * sets it to DEMO_CHAPTER_ID, so reads here are the same constant writes use
 * today — fully inert until both the writes are wired AND the flag flips.
 *
 * NOTE: getDataOrgId() is intentionally consumed by NOTHING yet (P2g-1).
 */

import { DEMO_CHAPTER_ID } from './orgConstants';

let _dataOrgId: string = DEMO_CHAPTER_ID;

/** The org id write paths should target. Defaults to the demo chapter. */
export function getDataOrgId(): string {
  return _dataOrgId;
}

/** Set by DataBootstrap whenever the active data org changes. */
export function setDataOrgId(orgId: string): void {
  _dataOrgId = orgId;
}
