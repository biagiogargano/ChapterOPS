/**
 * Isolated tests for the task-action notice mirroring in lib/updateNoticeStore.ts —
 * dependency-free harness. Covers the pure builder (buildTaskActionNotice) and the
 * emit → read-for-role → acknowledge(dismiss) flow for the four task-responsibility
 * actions. In the runner Supabase is unconfigured, so persistence is a no-op
 * (session-only store) — exactly the fallback path.
 */

import {
  buildTaskActionNotice, emitTaskActionNotice,
  getNoticesForRole, acknowledgeNotice,
  type TaskActionKind,
} from './updateNoticeStore';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── buildTaskActionNotice: copy, severity, audience, actor ────────────────────
{
  const n = buildTaskActionNotice('assigned', { taskId: 't1', taskTitle: 'Book venue', audienceRole: 'social_chair', actorRole: 'president' });
  check('assigned → builds a notice', n !== null);
  check('assigned summary mentions the title', !!n && n.summary.includes('Book venue'));
  check('assigned entityType=task + entityId', !!n && n.entityType === 'task' && n.entityId === 't1');
  check('assigned audience = the one target role', !!n && n.audienceRoles.join(',') === 'social_chair');
  check('assigned changedByRole = actor', !!n && n.changedByRole === 'president');
  check('rejected is critical severity',
    buildTaskActionNotice('rejected', { taskId: 't', taskTitle: 'x', audienceRole: 'social_chair', actorRole: 'president' })?.severity === 'critical');
  check('approved is low severity',
    buildTaskActionNotice('approved', { taskId: 't', taskTitle: 'x', audienceRole: 'social_chair', actorRole: 'president' })?.severity === 'low');
}

// ── Fail safe: no concrete audience → null (never a broad/all notice) ─────────
{
  check('missing audienceRole → null',
    buildTaskActionNotice('assigned', { taskId: 't', taskTitle: 'x', audienceRole: undefined, actorRole: 'president' }) === null);
  check('null audienceRole → null',
    buildTaskActionNotice('submitted', { taskId: 't', taskTitle: 'x', audienceRole: null, actorRole: 'president' }) === null);
  check('"all" audience → null (no chapter-wide notice)',
    buildTaskActionNotice('approved', { taskId: 't', taskTitle: 'x', audienceRole: 'all', actorRole: 'president' }) === null);
  check('missing taskId → null',
    buildTaskActionNotice('assigned', { taskId: '', taskTitle: 'x', audienceRole: 'social_chair', actorRole: 'president' }) === null);
}

// ── emit → the target role sees it; the actor does NOT ────────────────────────
{
  const taskId = 'task_notice_emit_1';
  emitTaskActionNotice('assigned', { taskId, taskTitle: 'Finalize list', audienceRole: 'quaestor', actorRole: 'president' });

  const forTarget = getNoticesForRole('quaestor').filter(n => n.entityId === taskId);
  check('target role sees the emitted notice', forTarget.length === 1);
  check('actor role does NOT see it', getNoticesForRole('president').every(n => n.entityId !== taskId));
  check('an unrelated role does NOT see it', getNoticesForRole('kustos').every(n => n.entityId !== taskId));

  // Dismiss (acknowledge) hides it for that role.
  if (forTarget[0]) acknowledgeNotice(forTarget[0].id, 'quaestor');
  check('after dismiss, target role no longer sees it',
    getNoticesForRole('quaestor').every(n => n.entityId !== taskId));
}

// ── emit no-ops on a non-concrete audience (no notice created) ────────────────
{
  const taskId = 'task_notice_emit_all';
  emitTaskActionNotice('approved', { taskId, taskTitle: 'x', audienceRole: 'all', actorRole: 'president' });
  check('"all" emit creates no notice for anyone',
    getNoticesForRole('social_chair').every(n => n.entityId !== taskId) &&
    getNoticesForRole('brother').every(n => n.entityId !== taskId));
}

// ── all four kinds build a notice with the right shape ────────────────────────
{
  const kinds: TaskActionKind[] = ['assigned', 'submitted', 'approved', 'rejected'];
  check('all four task actions build a notice',
    kinds.every(k => buildTaskActionNotice(k, { taskId: 't', taskTitle: 'y', audienceRole: 'social_chair', actorRole: 'president' }) !== null));
}

console.log(`\nupdateNoticeStore.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
