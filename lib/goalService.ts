/**
 * goalService.ts — thin client adapter for the live Goals v1 RPCs.
 *
 * Wraps the six SECURITY DEFINER RPCs applied + verified on alpha
 * (supabase/goals_v1_draft.sql):
 *   • create_goal(p_title, p_cadence, p_target_value, p_current_value,
 *                 p_owner_role, p_update_definition_id, p_reviewer_role, p_org_id) → uuid
 *   • list_goals_for_org(p_org_id) → setof goals
 *   • list_my_goals(p_org_id)      → setof goals
 *   • update_goal(p_goal_id, p_title, p_target_value, p_current_value, p_cadence)
 *   • complete_goal(p_goal_id)
 *   • archive_goal(p_goal_id)
 *
 * Mirrors the reportSubmissionService / proof v1A adapter pattern:
 *   • never throws — returns safe defaults ({ ok:false } / []);
 *   • no-ops when Supabase is unconfigured (preserves flag-off / dev behavior);
 *   • thin — no UI behavior, no task creation, no questionnaire/report coupling.
 *
 * SERVICE ONLY: nothing renders this yet (the Goals tab is a later step). DB rows
 * are mapped into the existing Goal type (lib/goals) where practical.
 */

import { supabase } from './supabase';
import { isSupabaseConfigured } from './memberService';
import type { Goal, GoalCadence, GoalStatus } from './goals';

/** Result of a goal mutation — never throws to the UI. */
export interface GoalMutationResult {
  ok:     boolean;
  /** New goal id on a successful create; undefined otherwise. */
  goalId?: string;
  /** Short error reason when ok=false (RPC message or 'unconfigured'). */
  error?:  string;
}

export interface CreateGoalInput {
  orgId:               string;
  title:               string;
  cadence:             GoalCadence;
  targetValue?:        number | null;
  currentValue?:       number | null;
  ownerRole?:          string | null;
  updateDefinitionId?: string | null;
  reviewerRole?:       string | null;
}

export interface UpdateGoalInput {
  title?:        string | null;
  targetValue?:  number | null;
  currentValue?: number | null;
  cadence?:      GoalCadence | null;
}

/** Map a raw goals row (snake_case) into the Goal type. Defensive; never throws. */
function mapGoalRow(row: any): Goal {
  return {
    id:                 String(row?.id ?? ''),
    orgId:              String(row?.org_id ?? ''),
    title:              String(row?.title ?? ''),
    description:        row?.description ?? undefined,
    ownerRole:          row?.owner_role ?? undefined,
    ownerMemberId:      row?.owner_member_id ?? undefined,
    createdBy:          row?.created_by ?? undefined,
    targetValue:        typeof row?.target_value === 'number' ? row.target_value : (row?.target_value != null ? Number(row.target_value) : undefined),
    currentValue:       typeof row?.current_value === 'number' ? row.current_value : (row?.current_value != null ? Number(row.current_value) : undefined),
    unit:               row?.unit ?? undefined,
    cadence:            (row?.cadence ?? 'weekly') as GoalCadence,
    customPeriodDays:   row?.custom_period_days ?? undefined,
    updateDefinitionId: row?.update_definition_id ?? undefined,
    status:             (row?.status ?? 'active') as GoalStatus,
    reviewerRole:       row?.reviewer_role ?? undefined,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** All goals the caller may read in an org (leadership/annotator → all; else own).
 *  Returns [] when unconfigured, on error, or when there is no input. Never throws. */
export async function listGoalsForOrg(orgId: string): Promise<Goal[]> {
  if (!isSupabaseConfigured()) return [];
  if (!orgId) return [];
  try {
    const { data, error } = await supabase.rpc('list_goals_for_org', { p_org_id: orgId });
    if (error) { console.warn('[goalService] list_goals_for_org error:', error.message); return []; }
    return Array.isArray(data) ? data.map(mapGoalRow) : [];
  } catch (err) {
    console.warn('[goalService] list_goals_for_org threw:', err);
    return [];
  }
}

/** Goals the caller OWNS in an org (owner_role). Same fallback-safe contract. */
export async function listMyGoals(orgId: string): Promise<Goal[]> {
  if (!isSupabaseConfigured()) return [];
  if (!orgId) return [];
  try {
    const { data, error } = await supabase.rpc('list_my_goals', { p_org_id: orgId });
    if (error) { console.warn('[goalService] list_my_goals error:', error.message); return []; }
    return Array.isArray(data) ? data.map(mapGoalRow) : [];
  } catch (err) {
    console.warn('[goalService] list_my_goals threw:', err);
    return [];
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a goal via create_goal. Returns { ok, goalId } or a safe failure. */
export async function createGoal(input: CreateGoalInput): Promise<GoalMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'unconfigured' };
  if (!input.orgId || !input.title || !input.cadence) return { ok: false, error: 'missing_input' };
  try {
    const { data, error } = await supabase.rpc('create_goal', {
      p_title:                input.title,
      p_cadence:              input.cadence,
      p_target_value:         input.targetValue ?? null,
      p_current_value:        input.currentValue ?? null,
      p_owner_role:           input.ownerRole ?? null,
      p_update_definition_id: input.updateDefinitionId ?? null,
      p_reviewer_role:        input.reviewerRole ?? null,
      p_org_id:               input.orgId,
    });
    if (error) { console.warn('[goalService] create_goal error:', error.message); return { ok: false, error: error.message }; }
    return { ok: true, goalId: typeof data === 'string' ? data : undefined };
  } catch (err) {
    console.warn('[goalService] create_goal threw:', err);
    return { ok: false, error: 'threw' };
  }
}

/** Update mutable fields of a goal via update_goal. */
export async function updateGoal(goalId: string, input: UpdateGoalInput): Promise<GoalMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'unconfigured' };
  if (!goalId) return { ok: false, error: 'missing_input' };
  try {
    const { error } = await supabase.rpc('update_goal', {
      p_goal_id:       goalId,
      p_title:         input.title ?? null,
      p_target_value:  input.targetValue ?? null,
      p_current_value: input.currentValue ?? null,
      p_cadence:       input.cadence ?? null,
    });
    if (error) { console.warn('[goalService] update_goal error:', error.message); return { ok: false, error: error.message }; }
    return { ok: true, goalId };
  } catch (err) {
    console.warn('[goalService] update_goal threw:', err);
    return { ok: false, error: 'threw' };
  }
}

/** Mark a goal completed via complete_goal. */
export async function completeGoal(goalId: string): Promise<GoalMutationResult> {
  return mutateGoalStatus('complete_goal', goalId);
}

/** Archive a goal via archive_goal. */
export async function archiveGoal(goalId: string): Promise<GoalMutationResult> {
  return mutateGoalStatus('archive_goal', goalId);
}

/** Shared body for the two status RPCs (identical shape: p_goal_id → void). */
async function mutateGoalStatus(
  rpc: 'complete_goal' | 'archive_goal',
  goalId: string,
): Promise<GoalMutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'unconfigured' };
  if (!goalId) return { ok: false, error: 'missing_input' };
  try {
    const { error } = await supabase.rpc(rpc, { p_goal_id: goalId });
    if (error) { console.warn(`[goalService] ${rpc} error:`, error.message); return { ok: false, error: error.message }; }
    return { ok: true, goalId };
  } catch (err) {
    console.warn(`[goalService] ${rpc} threw:`, err);
    return { ok: false, error: 'threw' };
  }
}
