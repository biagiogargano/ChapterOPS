/**
 * questionnaire/mockReport.ts — in-memory mock store for the weekly-report
 * prototype. PLANNING/PROTOTYPE ONLY (see QUESTIONNAIRE_REPORTS_PLAN.md).
 *
 * Demonstrates the locked workflow with zero backend:
 *  - one continuously-editable "living" answer set (latest-write-wins),
 *  - a per-cycle snapshot taken at first final-submit,
 *  - notification recipients (Annotator / Pro Consul / Consul) returned on submit.
 *
 * Module-level state + a tiny subscribe/notify so screens re-render reactively,
 * mirroring the existing rsvpStore pattern. Nothing here is persisted or wired
 * into phase-2 / the alpha.
 */

import { useSyncExternalStore } from 'react';
import {
  hasSubstantiveUpdate,
  type Answer,
  type AnswerMap,
  type QuestionnaireDef,
  type ReportSnapshot,
} from './types';

// ─── Sample definition: a weekly officer report ────────────────────────────────

export const WEEKLY_OFFICER_REPORT: QuestionnaireDef = {
  id:        'weekly_officer_report',
  title:     'Weekly Officer Report',
  ownerRole: 'pro_consul',
  questions: [
    { id: 'goal',     type: 'goal',          prompt: 'This week’s goal / focus', allowNoUpdate: true, hint: 'What are you driving toward this week?' },
    { id: 'progress', type: 'current_value', prompt: 'Members recruited',             allowNoUpdate: true, target: 12, unit: 'members' },
    { id: 'help',     type: 'short_text',    prompt: 'Do you need help with anything?', allowNoUpdate: true, hint: 'Short ask, or leave on No update' },
    { id: 'announce', type: 'long_text',     prompt: 'Announcements for the chapter',   allowNoUpdate: true, hint: 'Anything to share at the meeting?' },
    { id: 'other',    type: 'long_text',     prompt: 'What else are you working on?',   allowNoUpdate: true },
  ],
};

/** Roles notified when a report is submitted (per Biagio’s decision). */
export const SUBMIT_RECIPIENTS = ['annotator', 'pro_consul', 'president'];

// ─── In-memory state ────────────────────────────────────────────────────────────

let _living: AnswerMap = {};
const _snapshots: ReportSnapshot[] = [];

const _listeners = new Set<() => void>();
let _version = 0;
function _notify() { _version++; _listeners.forEach(l => l()); }

// ─── Reads ──────────────────────────────────────────────────────────────────────

export function getLivingAnswers(): AnswerMap {
  return _living;
}

export function getAnswer(questionId: string): Answer {
  return _living[questionId] ?? { questionId };
}

export function getSnapshots(): ReportSnapshot[] {
  return [..._snapshots];
}

/** The current cycle id (ISO week), e.g. "2026-W21". */
export function currentCycleId(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Whether this cycle already has a submitted snapshot. */
export function isCycleSubmitted(cycleId: string = currentCycleId()): boolean {
  return _snapshots.some(s => s.cycleId === cycleId);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/** Merge a partial answer for a prompt (latest-write-wins) and notify. */
export function setAnswer(questionId: string, patch: Partial<Answer>): void {
  const prev = _living[questionId] ?? { questionId };
  const next: Answer = { ...prev, questionId, ...patch };
  // Setting content clears a stale noUpdate flag; toggling noUpdate clears content.
  if (patch.noUpdate === true) { next.text = ''; next.value = null; }
  if (patch.text !== undefined || patch.value !== undefined) next.noUpdate = false;
  _living = { ..._living, [questionId]: next };
  _notify();
}

export type SubmitResult =
  | { ok: true;  snapshot: ReportSnapshot }
  | { ok: false; reason: 'already_submitted' | 'nothing_changed' };

/**
 * Final submit for the current cycle: validates the "something must change"
 * rule, snapshots the living answers, records recipients, and notifies. First
 * submit per cycle only (later edits roll into the next cycle).
 */
export function submitReport(
  def: QuestionnaireDef,
  cycleId: string = currentCycleId(),
): SubmitResult {
  if (isCycleSubmitted(cycleId)) return { ok: false, reason: 'already_submitted' };
  if (!hasSubstantiveUpdate(def.questions, _living)) return { ok: false, reason: 'nothing_changed' };

  const snapshot: ReportSnapshot = {
    cycleId,
    answers:     JSON.parse(JSON.stringify(_living)),
    submittedAt: new Date().toISOString(),
    recipients:  [...SUBMIT_RECIPIENTS],
  };
  _snapshots.push(snapshot);
  _notify();
  return { ok: true, snapshot };
}

/** Prototype helper: wipe living answers + snapshots (dev reset). */
export function resetMockReport(): void {
  _living = {};
  _snapshots.length = 0;
  _notify();
}

// ─── Reactive hook ───────────────────────────────────────────────────────────

/** Re-render a component whenever the mock report store changes. */
export function useMockReportVersion(): number {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _version,
    () => _version,
  );
}
