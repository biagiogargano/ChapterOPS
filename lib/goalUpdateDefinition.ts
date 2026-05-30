/**
 * goalUpdateDefinition.ts — pure builder for a goal-linked weekly update FORM.
 *
 * The product direction (master roadmap Lane 3): a weekly update task should walk an
 * officer through EACH of their active goals, then a short officer check-in. This
 * builds the `StructuredResponseDefinition` for that — composed from the goals plus
 * fixed check-in questions — so the existing Task Detail form + submission storage
 * render and persist it with NO new UI or storage.
 *
 * ⚠️ PURE FOUNDATION. No React, no stores, no Supabase, no task insertion, no
 *    scheduler, no notifications. Nothing wires this into a generated task yet —
 *    that's gated on (a) the definition being persistable (it is: a definition id +
 *    answers, already supported) and (b) a product decision on when/how the weekly
 *    update task is generated. Text-only questions (v1 supported types). Never throws.
 *
 * Per-goal questions (keys are namespaced `goal_<id>_<field>` so answers map back):
 *   • current      — current value/status this period (allowNoUpdate)
 *   • changed       — what changed (optional)
 *   • help          — needs help? (optional; tagged help_needed → agenda)
 *   • complete      — request marking this goal complete? (optional)
 * Then officer check-in questions (accomplishments/priorities/blockers/announcements),
 * mirroring the Weekly Officer Report.
 */

import type {
  StructuredQuestion, StructuredResponseDefinition,
} from './structuredResponses';
import type { Goal } from './goals';

/** Field suffixes for a goal's per-update questions. Stable; used to map answers back. */
export const GOAL_UPDATE_FIELDS = ['current', 'changed', 'help', 'complete'] as const;
export type GoalUpdateField = (typeof GOAL_UPDATE_FIELDS)[number];

/** The answer key for one goal's field within a goal-update definition. */
export function goalFieldKey(goalId: string, field: GoalUpdateField): string {
  return `goal_${goalId}_${field}`;
}

/** Parse a goal-update answer key back into { goalId, field }, or null if not one. */
export function parseGoalFieldKey(key: string): { goalId: string; field: GoalUpdateField } | null {
  const m = /^goal_(.+)_(current|changed|help|complete)$/.exec(key);
  if (!m) return null;
  return { goalId: m[1], field: m[2] as GoalUpdateField };
}

export interface BuildGoalUpdateDefinitionInput {
  /** Active goals to include (caller filters to active + owned). */
  goals: Pick<Goal, 'id' | 'title'>[];
  /** Definition id (e.g. 'goal_update_<role>_<period>'). */
  id: string;
  /** Human label (e.g. 'Weekly Update'). */
  label?: string;
  /** Include the officer check-in questions after the goals (default true). */
  includeCheckIn?: boolean;
}

/** The fixed officer check-in questions appended after the per-goal questions. */
function checkInQuestions(startOrder: number): StructuredQuestion[] {
  let o = startOrder;
  return [
    { key: 'accomplishments', prompt: 'What did you accomplish this period?', type: 'long_text', order: o++, required: true, placeholder: 'Wins, progress, things you completed…' },
    { key: 'priorities',      prompt: 'Priorities for next period?',          type: 'long_text', order: o++, required: true, placeholder: 'What you plan to focus on next…' },
    { key: 'blockers',        prompt: 'Blockers or help needed?',             type: 'short_text', order: o++, required: false, allowNoUpdate: true, placeholder: 'Anything you’re stuck on', agendaSection: 'help_needed' },
    { key: 'announcements',   prompt: 'Announcements for the chapter?',       type: 'long_text', order: o++, required: false, allowNoUpdate: true, placeholder: 'Anything everyone should know', agendaSection: 'announcement' },
  ];
}

/**
 * Build the per-goal questions for one goal (4 questions, namespaced keys). Pure.
 */
export function goalQuestions(goal: Pick<Goal, 'id' | 'title'>, startOrder: number): StructuredQuestion[] {
  const t = (goal.title ?? '').trim() || 'this goal';
  let o = startOrder;
  return [
    { key: goalFieldKey(goal.id, 'current'),  prompt: `${t} — current value / status?`, type: 'short_text', order: o++, required: true, allowNoUpdate: true, placeholder: 'e.g. 7 of 12, or “Deposit paid”' },
    { key: goalFieldKey(goal.id, 'changed'),  prompt: `${t} — what changed?`,            type: 'short_text', order: o++, required: false, allowNoUpdate: true, placeholder: 'Progress since last update' },
    { key: goalFieldKey(goal.id, 'help'),     prompt: `${t} — need help?`,               type: 'short_text', order: o++, required: false, allowNoUpdate: true, placeholder: 'What you’re blocked on', agendaSection: 'help_needed' },
    { key: goalFieldKey(goal.id, 'complete'), prompt: `${t} — request marking complete?`, type: 'short_text', order: o++, required: false, allowNoUpdate: true, placeholder: 'Leave “No update” unless done' },
  ];
}

/**
 * Build a complete goal-linked weekly-update definition from active goals + the
 * officer check-in. Pure; never throws. With zero goals it still returns a valid
 * definition (just the check-in), so a weekly update is always answerable.
 */
export function buildGoalUpdateDefinition(input: BuildGoalUpdateDefinitionInput): StructuredResponseDefinition {
  const includeCheckIn = input.includeCheckIn !== false;
  const questions: StructuredQuestion[] = [];
  let order = 1;
  for (const g of input.goals ?? []) {
    const qs = goalQuestions(g, order);
    questions.push(...qs);
    order += qs.length;
  }
  if (includeCheckIn) {
    questions.push(...checkInQuestions(order));
  }
  return {
    id:    input.id,
    label: input.label ?? 'Weekly Update',
    questions,
  };
}
