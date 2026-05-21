/**
 * dataOrgHolder.ts — module-level holder for the active DATA org id.
 *
 * Phase 2: the seam through which non-React write paths scope their queries/
 * payloads (without threading orgId through every call site). DataBootstrap
 * keeps it in sync with the active org via setDataOrgId(); the event/task/notice
 * write paths read getDataOrgId() (P2g-2/3/4).
 *
 * Default is DEMO_CHAPTER_ID, and while ORG_SCOPED_DATA is false DataBootstrap
 * sets it to DEMO_CHAPTER_ID, so writes target the same constant as today —
 * fully inert until the flag flips.
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
