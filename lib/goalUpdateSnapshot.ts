/**
 * goalUpdateSnapshot.ts — pure, durable snapshot of a goal-update FORM as submitted.
 *
 * THE PROBLEM (history drift): a goal-update task's definition is reconstructed at
 * render time from the role's CURRENT active goals (lib/goalUpdateGeneration.
 * reconstructGoalUpdateDefinition). That is fine for the live week, but it means an
 * OLD submitted update re-renders against today's goals — if a goal was archived,
 * renamed, or retargeted after the officer submitted, the historical answers no longer
 * line up with the questions they were actually answering. The stored `answers`
 * (task_report_submissions.answers) are keyed by `goal_<id>_<field>`, so the VALUES
 * survive — but the QUESTIONS/labels/goal context do not.
 *
 * THE FIX (this module): capture a self-contained snapshot of the definition (the exact
 * questions + labels as rendered) plus the goal id→title context, at submit time. Stored
 * durably, a snapshot lets any later reader render the update EXACTLY as it was, with no
 * goal lookup. Pure + serializable + versioned + never throws.
 *
 * ⚠️ STORAGE-AGNOSTIC FOUNDATION. This module only builds/validates/reads the snapshot
 *    VALUE. It does not persist anything. The durable store is a DRAFT, UNAPPLIED schema
 *    change — a `definition_snapshot jsonb` column on task_report_submissions (see
 *    supabase/task_report_submission_snapshot_patch_draft.sql). Until that is applied and
 *    the submit/read path is wired, nothing calls this in the app — building it now keeps
 *    the helper ready and tested without faking persistence.
 */

import type { StructuredQuestion, StructuredResponseDefinition } from './structuredResponses';
import type { Goal } from './goals';

/** Current snapshot schema version. Bump only on a breaking shape change. */
export const GOAL_UPDATE_SNAPSHOT_VERSION = 1 as const;

/** One goal's identity at submit time (so titles render historically, not live). */
export interface GoalSnapshotEntry {
  id:    string;
  title: string;
}

/**
 * A self-contained record of a goal-update form as it was submitted: the exact
 * definition (questions + labels) plus the goal context. Everything needed to render
 * the historical update with NO live goal lookup. JSON-serializable.
 */
export interface GoalUpdateSnapshot {
  v:          typeof GOAL_UPDATE_SNAPSHOT_VERSION;
  definition: StructuredResponseDefinition;
  goals:      GoalSnapshotEntry[];
}

/** Deep-ish copy one question into a plain, serializable object (no aliasing). */
function cloneQuestion(q: StructuredQuestion): StructuredQuestion {
  const out: StructuredQuestion = { key: q.key, prompt: q.prompt, type: q.type, order: q.order };
  if (q.required !== undefined)      out.required = q.required;
  if (q.allowNoUpdate !== undefined) out.allowNoUpdate = q.allowNoUpdate;
  if (q.placeholder !== undefined)   out.placeholder = q.placeholder;
  if (q.maxLength !== undefined)     out.maxLength = q.maxLength;
  if (q.agendaSection !== undefined) out.agendaSection = q.agendaSection;
  return out;
}

/**
 * Build a durable snapshot from the definition that was rendered + the goals it was
 * built from. Pure; never throws. The result is a plain object safe to JSON-serialize
 * into storage (a jsonb column). `goals` may be the full Goal objects — only id+title
 * are captured.
 */
export function buildGoalUpdateSnapshot(
  definition: StructuredResponseDefinition,
  goals: Pick<Goal, 'id' | 'title'>[],
): GoalUpdateSnapshot {
  return {
    v: GOAL_UPDATE_SNAPSHOT_VERSION,
    definition: {
      id:        definition.id,
      label:     definition.label,
      questions: (definition.questions ?? []).map(cloneQuestion),
    },
    goals: (goals ?? []).map(g => ({ id: g.id, title: (g.title ?? '').trim() })),
  };
}

/** Type guard: is `x` a structurally-valid goal-update snapshot? Defensive; no throw. */
export function isGoalUpdateSnapshot(x: unknown): x is GoalUpdateSnapshot {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  if (s.v !== GOAL_UPDATE_SNAPSHOT_VERSION) return false;
  const def = s.definition as Record<string, unknown> | undefined;
  if (!def || typeof def !== 'object') return false;
  if (typeof def.id !== 'string' || typeof def.label !== 'string') return false;
  if (!Array.isArray(def.questions)) return false;
  if (!Array.isArray(s.goals)) return false;
  return true;
}

/**
 * Recover the historical definition from a snapshot for rendering, or null if the value
 * is not a valid snapshot (caller then falls back to live reconstruction). Pure.
 */
export function definitionFromSnapshot(x: unknown): StructuredResponseDefinition | null {
  if (!isGoalUpdateSnapshot(x)) return null;
  return x.definition;
}

/** Look up a goal's title as it was at submit time, or undefined. Pure. */
export function goalTitleFromSnapshot(snapshot: GoalUpdateSnapshot, goalId: string): string | undefined {
  return snapshot.goals.find(g => g.id === goalId)?.title;
}
