/**
 * lib/ui/entityColors.ts — constant signature colors per create-able entity type.
 * One source so the Create tab, Today, announcements, and groups all agree.
 * Events additionally color by EVENT KIND (see KIND_COLORS in lib/mockEvents).
 * Tasks color by state/urgency on work surfaces; ENTITY_COLORS.task is the
 * neutral "task" signature used where a single color is needed (e.g. Create tab).
 */
export const ENTITY_COLORS = {
  event:        '#6366f1', // indigo (per-kind overrides via KIND_COLORS)
  task:         '#22c55e', // green
  announcement: '#f59e0b', // amber
  group:        '#a855f7', // purple
} as const;

export type EntityType = keyof typeof ENTITY_COLORS;
