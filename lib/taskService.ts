/**
 * taskService.ts — SCAFFOLDING for future Supabase-backed tasks.
 *
 * ⚠️ STATUS: groundwork only. NONE of these functions are wired into any screen
 *    yet. Tasks today come from lib/mockTasks.ts (MOCK_TASKS + _dynamicTasks)
 *    with interaction state in lib/devTaskStore.ts. This module exists so the
 *    eventual persistence layer can drop in following the same thin-adapter
 *    pattern used by eventService.ts / rsvpService.ts:
 *      - never throws; returns safe defaults ([] / undefined / false)
 *      - no-ops when Supabase is unconfigured (preserves mock fallback)
 *      - returns app-native shapes (MockTask) so callers don't see the schema
 *
 * Backing table: see supabase/tasks_schema.sql (also a PROPOSAL, not yet run).
 *
 * IMPORTANT — RSVP STATE DUALITY: for lightweight 'rsvp' / 'name_submission'
 * tasks, completion is owned by the `rsvps` table (rsvpStore), NOT by a task's
 * `state`. A future wiring layer must keep reading those from rsvpStore and treat
 * the task row as definition-only. Do not let this service become the source of
 * truth for RSVP completion.
 *
 * TECH DEBT: isSupabaseConfigured() is duplicated here and in eventService.ts /
 * rsvpService.ts. A shared lib/supabaseConfig.ts would dedup it, but that touches
 * two working files and is out of scope for this groundwork pass.
 */

import { supabase } from './supabase';
import { DEMO_CHAPTER_ID } from './eventService';
import type {
  LightweightKind,
  MockTask,
  ProofType,
  TaskState,
  TaskType,
  TaskUrgency,
} from './mockTasks';
import type { Role } from './roles';

// Re-export the demo chapter id so future task callers have a single import.
export { DEMO_CHAPTER_ID };

// ─── Guard ────────────────────────────────────────────────────────────────────

function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('/rest/v1') &&
    key.length > 10
  );
}

// ─── Row shape (matches supabase/tasks_schema.sql) ────────────────────────────

interface TaskRow {
  id:                     string;
  chapter_id:             string;
  title:                  string;
  type:                   TaskType;
  lightweight_kind:       LightweightKind | null;
  state:                  TaskState;
  urgency:                TaskUrgency;
  due_label:              string;
  due_at:                 string | null;
  assigned_role:          string;          // Role key OR literal 'all'
  assigned_to:            string;
  visible_to_all:         boolean;
  visible_to:             string[];         // role keys
  linked_event:           string | null;
  linked_event_id:        string | null;
  description:            string;
  linked_event_mandatory: boolean;
  requires_covering:      boolean;
  requires_proof:         boolean;
  proof_type:             ProofType | null;
  requires_approval:      boolean;
  reviewer_role:          string | null;
  is_workflow_parent:     boolean;
  parent_task_id:         string | null;
  supervisor_role:        string | null;
  escalation_chain:       string[];
  escalated_to:           string | null;
  proof_content:          string;
  rejection_note:         string;
  created_by_role:        string | null;
  created_at:             string;
  updated_at:             string;
}

/** Interaction-state subset (mirrors devTaskStore.StoredTask) for updateTaskState. */
export interface TaskStatePatch {
  state?:         TaskState;
  proofContent?:  string;
  rejectionNote?: string;
}

// ─── Normalization helpers (row ↔ MockTask) ───────────────────────────────────

/**
 * Convert a Supabase task row → MockTask, normalizing the relational/array
 * columns back into the app's union shapes. This is the single mapping point a
 * future task cache should reuse.
 */
function rowToMockTask(row: TaskRow): MockTask {
  return {
    id:           row.id,
    title:        row.title,
    type:         row.type,
    state:        row.state,
    urgency:      row.urgency,
    dueLabel:     row.due_label,
    assignedRole: row.assigned_role === 'all' ? 'all' : (row.assigned_role as Role),
    assignedTo:   row.assigned_to,
    visibleTo:    row.visible_to_all ? 'all' : (row.visible_to as Role[]),
    description:  row.description,

    linkedEvent:   row.linked_event   ?? undefined,
    linkedEventId: row.linked_event_id ?? undefined,

    lightweightKind:      row.lightweight_kind ?? undefined,
    linkedEventMandatory: row.linked_event_mandatory,
    requiresCovering:     row.requires_covering,

    requiresProof:    row.requires_proof,
    proofType:        row.proof_type ?? undefined,
    requiresApproval: row.requires_approval,
    reviewerRole:     (row.reviewer_role as Role | null) ?? undefined,

    isWorkflowParent: row.is_workflow_parent,
    parentTaskId:     row.parent_task_id ?? undefined,
    supervisorRole:   (row.supervisor_role as Role | null) ?? undefined,

    escalationChain: row.escalation_chain.length ? (row.escalation_chain as Role[]) : undefined,
    escalatedTo:     (row.escalated_to as Role | null) ?? undefined,
  };
}

/**
 * Convert a MockTask → row payload for insert/upsert. Splits the union fields
 * (assignedRole/visibleTo) into their column representations. `id` is included
 * so callers may use client-generated UUIDs (as the events flow does).
 */
function mockTaskToRow(task: MockTask): Record<string, unknown> {
  const visibleToAll = task.visibleTo === 'all';
  return {
    id:                     task.id,
    chapter_id:             DEMO_CHAPTER_ID,
    title:                  task.title,
    type:                   task.type,
    lightweight_kind:       task.lightweightKind ?? null,
    state:                  task.state,
    urgency:                task.urgency,
    due_label:              task.dueLabel,
    assigned_role:          task.assignedRole,
    assigned_to:            task.assignedTo,
    visible_to_all:         visibleToAll,
    visible_to:             visibleToAll ? [] : (task.visibleTo as Role[]),
    linked_event:           task.linkedEvent ?? null,
    linked_event_id:        task.linkedEventId ?? null,
    description:            task.description,
    linked_event_mandatory: task.linkedEventMandatory ?? false,
    requires_covering:      task.requiresCovering ?? false,
    requires_proof:         task.requiresProof ?? false,
    proof_type:             task.proofType ?? null,
    requires_approval:      task.requiresApproval ?? false,
    reviewer_role:          task.reviewerRole ?? null,
    is_workflow_parent:     task.isWorkflowParent ?? false,
    parent_task_id:         task.parentTaskId ?? null,
    supervisor_role:        task.supervisorRole ?? null,
    escalation_chain:       task.escalationChain ?? [],
    escalated_to:           task.escalatedTo ?? null,
  };
}

// ─── Public API (scaffolding — not yet called by any screen) ──────────────────

/** Fetch all tasks for the demo chapter. Returns [] when unconfigured/failed. */
export async function fetchAllTasks(): Promise<MockTask[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('chapter_id', DEMO_CHAPTER_ID);

    if (error) {
      console.warn('[taskService] fetchAllTasks error:', error.message);
      return [];
    }
    return (data as TaskRow[]).map(rowToMockTask);
  } catch (err) {
    console.warn('[taskService] fetchAllTasks threw:', err);
    return [];
  }
}

/** Fetch one task by id. Returns undefined when not found/unconfigured/failed. */
export async function fetchTaskById(id: string): Promise<MockTask | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('chapter_id', DEMO_CHAPTER_ID)
      .maybeSingle();

    if (error) {
      console.warn('[taskService] fetchTaskById error:', error.message);
      return undefined;
    }
    return data ? rowToMockTask(data as TaskRow) : undefined;
  } catch (err) {
    console.warn('[taskService] fetchTaskById threw:', err);
    return undefined;
  }
}

/** Insert a task row (uses the task's id so it can be client-generated). */
export async function insertTask(task: MockTask): Promise<MockTask | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(mockTaskToRow(task))
      .select()
      .single();

    if (error) {
      console.warn('[taskService] insertTask error:', error.message);
      return undefined;
    }
    return rowToMockTask(data as TaskRow);
  } catch (err) {
    console.warn('[taskService] insertTask threw:', err);
    return undefined;
  }
}

/**
 * Update a task's interaction state (state / proof / rejection note).
 * The future replacement for devTaskStore.saveTaskState — but NOT for RSVP
 * tasks, whose state stays owned by the rsvps table.
 * Returns true on success.
 */
export async function updateTaskState(id: string, patch: TaskStatePatch): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.state         !== undefined) payload.state          = patch.state;
    if (patch.proofContent  !== undefined) payload.proof_content  = patch.proofContent;
    if (patch.rejectionNote !== undefined) payload.rejection_note = patch.rejectionNote;

    const { error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .eq('chapter_id', DEMO_CHAPTER_ID);

    if (error) {
      console.warn('[taskService] updateTaskState error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[taskService] updateTaskState threw:', err);
    return false;
  }
}

/** Delete a task by id (cascades to workflow children + event-linked tasks). */
export async function removeTask(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('chapter_id', DEMO_CHAPTER_ID);

    if (error) {
      console.warn('[taskService] removeTask error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[taskService] removeTask threw:', err);
    return false;
  }
}

// Exported for the future cache/wiring layer.
export { rowToMockTask, mockTaskToRow };
export type { TaskRow };
