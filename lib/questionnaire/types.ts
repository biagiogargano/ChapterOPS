/**
 * questionnaire/types.ts — UI-only scaffolding types for Questionnaire / Report
 * Tasks (see QUESTIONNAIRE_REPORTS_PLAN.md). PLANNING/PROTOTYPE ONLY.
 *
 * These shapes back an in-memory mock so we can build and feel the weekly-report
 * flow before any schema/RLS/RPC exists. They are NOT a database schema and are
 * intentionally decoupled from the real task/event types. Nothing here is wired
 * into phase-2 / the alpha.
 */

/**
 * Prompt types. Tier-1 (MVP, confirmed by Biagio) = goal / current_value /
 * short_text / long_text. Tier-2 (prototype-only, here to explore the builder) =
 * single_select / multi_select / percentage.
 */
export type QuestionType =
  | 'goal'           // free-text status / goal statement
  | 'current_value'  // numeric progress (optional target)
  | 'short_text'     // one-line open answer
  | 'long_text'      // multi-line open answer
  | 'single_select'  // pick exactly one option (Tier-2)
  | 'multi_select'   // pick any number of options (Tier-2)
  | 'percentage';    // 0–100 numeric (Tier-2)

/** An option for a select-style prompt. */
export interface QuestionOption {
  id:    string;
  label: string;
}

/** A single prompt on a questionnaire. */
export interface QuestionDef {
  id:       string;
  type:     QuestionType;
  prompt:   string;
  /** Whether this prompt offers a per-prompt "No update" toggle. */
  allowNoUpdate?: boolean;
  /** current_value only: optional target + unit for display. */
  target?:  number;
  unit?:    string;
  /** single_select / multi_select only: the choices. */
  options?: QuestionOption[];
  /** Placeholder/help shown in the input. */
  hint?:    string;
}

/** An ordered set of prompts = one report definition (per officer/committee). */
export interface QuestionnaireDef {
  id:        string;
  title:     string;
  /** The role this report belongs to (authoring is per officer/committee). */
  ownerRole: string;
  questions: QuestionDef[];
}

/**
 * A responder's answer to one prompt. `noUpdate` marks "nothing changed" for
 * that prompt; otherwise text (goal/short/long) or value (current_value) holds
 * the content. Empty/absent = unanswered.
 */
export interface Answer {
  questionId: string;
  noUpdate?:  boolean;
  text?:      string;          // goal / short_text / long_text
  value?:     number | null;   // current_value / percentage
  selected?:  string[];        // single_select (len 1) / multi_select option ids
}

/** Living answers, keyed by questionId — one continuously-editable set. */
export type AnswerMap = Record<string, Answer>;

/**
 * A frozen per-cycle submission. Taken at first final-submit; never mutated
 * after (later edits live on the living set and roll into the next cycle).
 */
export interface ReportSnapshot {
  cycleId:     string;          // e.g. "2026-W21"
  answers:     AnswerMap;       // deep copy of the living set at submit time
  submittedAt: string;          // ISO timestamp
  recipients:  string[];        // roles notified on submit
}

/**
 * Pure helper: does this answer set contain at least one *substantive* update?
 * A "No update" toggle or empty field does NOT count. Used by the
 * "something must change" rule on final submit. Dependency-free on purpose so
 * it stays trivially testable.
 */
export function hasSubstantiveUpdate(
  questions: QuestionDef[],
  answers:   AnswerMap,
): boolean {
  return questions.some(q => {
    const a = answers[q.id];
    if (!a || a.noUpdate) return false;
    if (q.type === 'current_value' || q.type === 'percentage') {
      return typeof a.value === 'number';
    }
    if (q.type === 'single_select' || q.type === 'multi_select') {
      return (a.selected?.length ?? 0) > 0;
    }
    return !!a.text && a.text.trim().length > 0;
  });
}
