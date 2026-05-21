/**
 * orgConstants.ts — neutral home for org-related constants.
 *
 * DEMO_CHAPTER_ID lived in eventService.ts; it was extracted here (P2g-1) so the
 * data-org holder and the service write paths can import it without creating an
 * import cycle (eventService imports the holder for writes; the holder imports
 * the constant from here, which imports nothing). eventService re-exports it for
 * backward compatibility, so existing `from './eventService'` imports still work.
 */

/** Chapter UUID used for all demo data. Must match events_seed.sql. */
export const DEMO_CHAPTER_ID = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
