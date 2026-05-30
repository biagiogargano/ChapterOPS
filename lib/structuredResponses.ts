/**
 * structuredResponses.ts — generic structured-response primitive (foundation).
 *
 * The storage-agnostic data model + pure validation behind officer reports,
 * questionnaires, structured check-ins, status updates, and (later) polls/scales.
 * A "structured-response task" is a normal task whose completion is a set of
 * ANSWERS to a fixed QUESTION DEFINITION — distinct from free-text/link proof.
 *
 * ⚠️ FOUNDATION ONLY. Pure types + helpers; NO React, NO stores, NO Supabase, NO
 *    I/O. Nothing in the app imports this yet. Real persistence of answers needs
 *    a separate `task_report_submissions` table (see docs/REPORTS_V1_PLAN.md and
 *    docs/STRUCTURED_RESPONSES_FOUNDATION.md) — that's a deliberate later step.
 *
 * GENERIC BY DESIGN: nothing here is fraternity-specific. A definition is plain
 * data, so any org (club, class, team) supplies its own question set over the
 * same primitive. Sigma Chi's weekly-report fields are just one definition.
 *
 * v1 SCOPE: question type 'short_text' / 'long_text' only. The type union and
 * validators are written so 'select' / 'scale' / 'time' / 'multi_select' can be
 * added later without reshaping existing data — unknown/unsupported types fail
 * SAFE (validation reports them rather than throwing).
 */

// ─── Question types ───────────────────────────────────────────────────────────

/**
 * Supported answer input types. v1 implements the two text types; the rest are
 * RESERVED — present in the union so definitions and storage shapes are stable,
 * but flagged "not yet supported" by isSupportedQuestionType / validation until
 * each is implemented.
 */
export type StructuredQuestionType =
  | 'short_text'
  | 'long_text'
  // ── reserved (not implemented in v1) ──
  | 'select'
  | 'multi_select'
  | 'scale'
  | 'time';

/** Question types actually implemented in v1 (text only). */
export const SUPPORTED_QUESTION_TYPES: StructuredQuestionType[] = ['short_text', 'long_text'];

export function isSupportedQuestionType(t: string): t is StructuredQuestionType {
  return (SUPPORTED_QUESTION_TYPES as string[]).includes(t);
}

// ─── Definition ───────────────────────────────────────────────────────────────

/** One question within a structured-response definition. */
export interface StructuredQuestion {
  /** Stable key (unique within a definition) — answers are keyed by this. */
  key:        string;
  /** Human prompt shown to the responder. */
  prompt:     string;
  type:       StructuredQuestionType;
  /** Display order (lower first). Ties broken by array order, then key. */
  order:      number;
  /** Must be answered (unless "No update" is allowed and used). Default false. */
  required?:  boolean;
  /**
   * Allow a per-question "No update" — the responder explicitly marks nothing to
   * report this cycle, which satisfies `required` without free text. Generic and
   * low-friction (e.g. quiet weeks on a weekly report). Default false.
   */
  allowNoUpdate?: boolean;
  /** Optional placeholder/helper text. */
  placeholder?: string;
  /** Max length for text answers (advisory; validator enforces when present). */
  maxLength?:   number;
}

/** A complete, ordered question set — the "form" a report/questionnaire renders. */
export interface StructuredResponseDefinition {
  /** Stable id (e.g. 'weekly_officer_report'). */
  id:        string;
  /** Human label. */
  label:     string;
  questions: StructuredQuestion[];
}

// ─── Answers ──────────────────────────────────────────────────────────────────

/**
 * One answer. For text questions, `value` holds the text. `noUpdate` marks the
 * "No update" choice (mutually exclusive with a non-empty value). Future typed
 * answers (numbers/selections) extend `value` without changing this shape.
 */
export interface StructuredAnswer {
  /** Matches a StructuredQuestion.key. */
  key:       string;
  value?:    string;
  noUpdate?: boolean;
}

/** A submission = the answers for one definition, keyed for lookup. */
export type StructuredAnswerMap = Record<string, StructuredAnswer>;

// ─── Ordering ─────────────────────────────────────────────────────────────────

/**
 * Questions in stable display order: by `order` asc, ties broken by original
 * array index, then by key — fully deterministic regardless of input order.
 * Pure (does not mutate the input).
 */
export function orderedQuestions(def: StructuredResponseDefinition): StructuredQuestion[] {
  return def.questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) =>
      a.q.order - b.q.order ||
      a.i - b.i ||
      a.q.key.localeCompare(b.q.key),
    )
    .map(x => x.q);
}

// ─── Definition validation ────────────────────────────────────────────────────

export interface DefinitionValidation {
  valid:  boolean;
  errors: string[];
}

/**
 * Validate a definition's shape: non-empty id/label, at least one question,
 * unique non-empty keys, non-empty prompts, and supported question types.
 * Unsupported (reserved) types are reported as errors, not thrown — fail safe.
 */
export function validateDefinition(def: StructuredResponseDefinition): DefinitionValidation {
  const errors: string[] = [];
  if (!def.id || def.id.trim() === '')       errors.push('definition id is required');
  if (!def.label || def.label.trim() === '') errors.push('definition label is required');
  if (!Array.isArray(def.questions) || def.questions.length === 0) {
    errors.push('definition must have at least one question');
    return { valid: false, errors };
  }

  const seen = new Set<string>();
  for (const q of def.questions) {
    if (!q.key || q.key.trim() === '') errors.push('question key is required');
    else if (seen.has(q.key))          errors.push(`duplicate question key: ${q.key}`);
    else                               seen.add(q.key);

    if (!q.prompt || q.prompt.trim() === '') errors.push(`question "${q.key}" needs a prompt`);
    if (!isSupportedQuestionType(q.type))    errors.push(`question "${q.key}" uses unsupported type: ${q.type}`);
    if (q.maxLength !== undefined && (!Number.isInteger(q.maxLength) || q.maxLength <= 0)) {
      errors.push(`question "${q.key}" has an invalid maxLength`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ─── Answer validation ────────────────────────────────────────────────────────

/** True if an answer counts as "provided" — a non-empty value OR an explicit
 *  No-update (only when that question allows it). */
export function isAnswered(q: StructuredQuestion, a: StructuredAnswer | undefined): boolean {
  if (!a) return false;
  if (a.noUpdate) return q.allowNoUpdate === true;   // No-update only counts if permitted
  return typeof a.value === 'string' && a.value.trim().length > 0;
}

export interface AnswerValidation {
  valid:           boolean;
  errors:          string[];
  missingRequired: string[];   // keys of unanswered required questions
}

/**
 * Validate answers against a definition:
 *  • required questions must be answered (value or permitted No-update);
 *  • a No-update answer is invalid if the question doesn't allow it;
 *  • value + noUpdate are mutually exclusive;
 *  • text answers must respect maxLength when set;
 *  • answers for unknown keys are reported (kept out of a clean submission).
 * Pure; never throws.
 */
export function validateAnswers(
  def: StructuredResponseDefinition,
  answers: StructuredAnswerMap,
): AnswerValidation {
  const errors: string[] = [];
  const missingRequired: string[] = [];
  const known = new Set(def.questions.map(q => q.key));

  for (const q of def.questions) {
    const a = answers[q.key];
    if (a) {
      if (a.noUpdate && !q.allowNoUpdate) {
        errors.push(`question "${q.key}" does not allow "No update"`);
      }
      if (a.noUpdate && typeof a.value === 'string' && a.value.trim() !== '') {
        errors.push(`question "${q.key}" has both a value and "No update"`);
      }
      if (q.maxLength !== undefined && typeof a.value === 'string' && a.value.length > q.maxLength) {
        errors.push(`question "${q.key}" exceeds max length ${q.maxLength}`);
      }
    }
    if (q.required && !isAnswered(q, a)) missingRequired.push(q.key);
  }

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) errors.push(`answer for unknown question: ${key}`);
  }

  const valid = errors.length === 0 && missingRequired.length === 0;
  return { valid, errors, missingRequired };
}

// ─── Answer editing (pure; the form's state transforms) ───────────────────────

/**
 * Return a new answer map with `key`'s text value set. Setting a non-empty value
 * clears any "No update" on that key (they're mutually exclusive). Pure — does
 * not mutate the input.
 */
export function withAnswerValue(
  map: StructuredAnswerMap,
  key: string,
  value: string,
): StructuredAnswerMap {
  return { ...map, [key]: { key, value, noUpdate: false } };
}

/**
 * Return a new answer map with `key`'s "No update" toggled to `noUpdate`. Turning
 * No-update ON clears the text value (mutually exclusive); turning it OFF leaves
 * an empty value. Pure — does not mutate the input.
 */
export function withAnswerNoUpdate(
  map: StructuredAnswerMap,
  key: string,
  noUpdate: boolean,
): StructuredAnswerMap {
  const prev = map[key];
  return {
    ...map,
    [key]: noUpdate
      ? { key, noUpdate: true }
      : { key, value: prev?.value ?? '', noUpdate: false },
  };
}

// ─── Completeness ─────────────────────────────────────────────────────────────

export interface ResponseProgress {
  answered: number;   // questions with a provided answer
  total:    number;   // all questions
  required: number;   // required questions
  requiredAnswered: number;
  /** True when every REQUIRED question is answered (the submit gate). */
  complete: boolean;
}

/**
 * Completeness of a set of answers for a definition. "complete" means every
 * required question is answered — the gate for allowing submission. Optional
 * questions count toward `answered`/`total` but not toward the gate. Pure.
 */
export function responseProgress(
  def: StructuredResponseDefinition,
  answers: StructuredAnswerMap,
): ResponseProgress {
  let answered = 0;
  let required = 0;
  let requiredAnswered = 0;
  for (const q of def.questions) {
    const ok = isAnswered(q, answers[q.key]);
    if (ok) answered++;
    if (q.required) {
      required++;
      if (ok) requiredAnswered++;
    }
  }
  return {
    answered,
    total: def.questions.length,
    required,
    requiredAnswered,
    complete: requiredAnswered === required,
  };
}
