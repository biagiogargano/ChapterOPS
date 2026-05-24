/**
 * questionnaire/types.ts — UI-only scaffolding types for generic structured
 * response forms (see WEEKLY_REPORT_V1_PLAN.md). PLANNING/PROTOTYPE ONLY.
 *
 * Aligned to v1 scope: a tiny GENERIC input-type enum (short_text | long_text |
 * number), with variants like progress/current-vs-target expressed via `config`
 * — NOT new types. "No update" is a per-field option, not a type. These shapes
 * back an in-memory mock; not a DB schema, not wired into phase-2 / the alpha.
 */

/** v1 input types — kept to 3; variants come from `config`, not new types. */
export type QuestionType = 'short_text' | 'long_text' | 'number';

/** number-only config. `mode:'progress'` renders current-vs-target. */
export interface NumberConfig {
  mode?:   'plain' | 'progress';
  target?: number;
  unit?:   string;
}

/** A single prompt on a form. */
export interface QuestionDef {
  id:       string;
  type:     QuestionType;
  prompt:   string;
  /** Whether this prompt offers a per-prompt "No update" toggle. */
  allowNoUpdate?: boolean;
  /** number only: progress/target/unit config. */
  config?:  NumberConfig;
  /** Placeholder/help shown in the input. */
  hint?:    string;
}

/** An ordered set of prompts = one response form (the first is the Weekly Report). */
export interface QuestionnaireDef {
  id:        string;
  title:     string;
  /** The role this form's responders hold (generic; from org template defaults). */
  ownerRole: string;
  questions: QuestionDef[];
}

/**
 * A responder's answer to one prompt. `noUpdate` marks "nothing changed";
 * otherwise `text` (short/long) or `value` (number) holds the content.
 */
export interface Answer {
  questionId: string;
  noUpdate?:  boolean;
  text?:      string;          // short_text / long_text
  value?:     number | null;   // number (incl. progress mode)
}

/** Living answers, keyed by questionId — one continuously-editable set. */
export type AnswerMap = Record<string, Answer>;

/**
 * A per-cycle submission snapshot. In v1 the form LOCKS on submit (no rolling
 * edits), so this is the final response for that cycle.
 */
export interface ReportSnapshot {
  cycleId:     string;          // e.g. "2026-W21"
  answers:     AnswerMap;       // deep copy of the answers at submit time
  submittedAt: string;          // ISO timestamp
  recipients:  string[];        // roles notified on submit
}

/**
 * Pure helper: does this answer set contain at least one *substantive* update?
 * A "No update" toggle or empty field does NOT count. Drives the
 * "something must change" warning (warn, not block). Dependency-free.
 */
export function hasSubstantiveUpdate(
  questions: QuestionDef[],
  answers:   AnswerMap,
): boolean {
  return questions.some(q => {
    const a = answers[q.id];
    if (!a || a.noUpdate) return false;
    if (q.type === 'number') return typeof a.value === 'number';
    return !!a.text && a.text.trim().length > 0;
  });
}
