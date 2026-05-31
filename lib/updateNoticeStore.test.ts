/**
 * Isolated tests for the task-action notice mirroring in lib/updateNoticeStore.ts —
 * dependency-free harness. Covers the pure builder (buildTaskActionNotice) and the
 * emit → read-for-role → acknowledge(dismiss) flow for the four task-responsibility
 * actions. In the runner Supabase is unconfigured, so persistence is a no-op
 * (session-only store) — exactly the fallback path.
 */

import {
  buildTaskActionNotice, emitTaskActionNotice, buildGoalAssignedNotice, emitGoalAssignedNotice,
  buildAgendaFinalizedNotice, emitAgendaFinalizedNotice, emitUpdateNotice,
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

// ── buildGoalAssignedNotice (in-app only; entity_type 'goal') ─────────────────
{
  const n = buildGoalAssignedNotice({ goalId: 'g1', goalTitle: 'Recruit 12', ownerRole: 'recruitment_chair', actorRole: 'president' });
  check('goal-assigned → builds a notice', n !== null);
  check('goal notice entityType=goal', !!n && n.entityType === 'goal');
  check('goal notice entityId', !!n && n.entityId === 'g1');
  check('goal notice audience = owner role', !!n && n.audienceRoles.join(',') === 'recruitment_chair');
  check('goal notice summary mentions title', !!n && n.summary.includes('Recruit 12'));
  check('goal notice changedBy = actor', !!n && n.changedByRole === 'president');
}
check('goal-assigned → null when actor IS the owner role (self-create)',
  buildGoalAssignedNotice({ goalId: 'g', goalTitle: 'x', ownerRole: 'president', actorRole: 'president' }) === null);
check('goal-assigned → null with no owner role',
  buildGoalAssignedNotice({ goalId: 'g', goalTitle: 'x', ownerRole: null, actorRole: 'president' }) === null);
check('goal-assigned → null for "all"',
  buildGoalAssignedNotice({ goalId: 'g', goalTitle: 'x', ownerRole: 'all', actorRole: 'president' }) === null);
check('goal-assigned → null with no goalId',
  buildGoalAssignedNotice({ goalId: '', goalTitle: 'x', ownerRole: 'social_chair', actorRole: 'president' }) === null);

// ── emitGoalAssignedNotice → owner role sees it; actor/self/all do NOT ────────
{
  const goalId = 'goal_assign_emit_1';
  emitGoalAssignedNotice({ goalId, goalTitle: 'Book venue', ownerRole: 'social_chair', actorRole: 'president' });
  check('owner role sees the goal notice',
    getNoticesForRole('social_chair').filter(n => n.entityId === goalId).length === 1);
  check('actor (president) does NOT see it',
    getNoticesForRole('president').every(n => n.entityId !== goalId));
  check('unrelated role does NOT see it',
    getNoticesForRole('kustos').every(n => n.entityId !== goalId));
  const mine = getNoticesForRole('social_chair').find(n => n.entityId === goalId);
  if (mine) acknowledgeNotice(mine.id, 'social_chair');
  check('after dismiss, owner no longer sees it',
    getNoticesForRole('social_chair').every(n => n.entityId !== goalId));
}
{
  // Self-create (owner === actor) emits NOTHING.
  const goalId = 'goal_assign_self';
  emitGoalAssignedNotice({ goalId, goalTitle: 'x', ownerRole: 'quaestor', actorRole: 'quaestor' });
  check('self-create emits no goal notice',
    getNoticesForRole('quaestor').every(n => n.entityId !== goalId));
}
{
  // 'all' owner emits nothing (no broad notice).
  const goalId = 'goal_assign_all';
  emitGoalAssignedNotice({ goalId, goalTitle: 'x', ownerRole: 'all', actorRole: 'president' });
  check('"all" owner emits no broad notice',
    getNoticesForRole('social_chair').every(n => n.entityId !== goalId) &&
    getNoticesForRole('brother').every(n => n.entityId !== goalId));
}

// ── buildAgendaFinalizedNotice (in-app only; entity_type 'event') ─────────────
{
  const n = buildAgendaFinalizedNotice({ eventId: 'e1', eventTitle: 'Chapter Meeting', audienceRoles: ['president', 'social_chair'], actorRole: 'annotator' });
  check('agenda-finalized → builds a notice', n !== null);
  check('agenda notice entityType=event', !!n && n.entityType === 'event');
  check('agenda notice entityId', !!n && n.entityId === 'e1');
  check('agenda notice summary mentions the meeting', !!n && n.summary.includes('Chapter Meeting'));
  check('agenda notice keeps the multi-role audience', !!n && n.audienceRoles.includes('president') && n.audienceRoles.includes('social_chair'));
  check('agenda notice is low severity', !!n && n.severity === 'low');
  check('agenda notice changedBy = actor', !!n && n.changedByRole === 'annotator');
}
check('agenda-finalized → null with no eventId',
  buildAgendaFinalizedNotice({ eventId: '', eventTitle: 'x', audienceRoles: ['president'], actorRole: 'annotator' }) === null);
check('agenda-finalized → null with empty audience',
  buildAgendaFinalizedNotice({ eventId: 'e', eventTitle: 'x', audienceRoles: [], actorRole: 'annotator' }) === null);
check('agenda-finalized → null when only "all" in audience (no broad notice)',
  buildAgendaFinalizedNotice({ eventId: 'e', eventTitle: 'x', audienceRoles: ['all'], actorRole: 'annotator' }) === null);
check('agenda-finalized → default title when blank',
  (buildAgendaFinalizedNotice({ eventId: 'e', eventTitle: '   ', audienceRoles: ['president'], actorRole: 'annotator' })?.summary ?? '').includes('the meeting'));

// ── emitAgendaFinalizedNotice → officers see it; actor does NOT ────────────────
{
  const eventId = 'agenda_final_emit_1';
  emitAgendaFinalizedNotice({ eventId, eventTitle: 'E-Board', audienceRoles: ['president', 'pro_consul', 'social_chair'], actorRole: 'president' });
  check('an officer audience role sees the agenda-finalized notice',
    getNoticesForRole('social_chair').filter(n => n.entityId === eventId).length === 1);
  check('the actor (president) does NOT see it',
    getNoticesForRole('president').every(n => n.entityId !== eventId));
  check('a non-audience role does NOT see it',
    getNoticesForRole('brother').every(n => n.entityId !== eventId));
}

// ── coalescing: a 2nd notice for the same entity REPLACES (not stacks) + maxes severity ──
{
  const entityId = 'coalesce_entity_1';
  emitUpdateNotice({ entityType: 'task', entityId, summary: 'first', severity: 'low', audienceRoles: ['kustos'], changedByRole: 'president' });
  emitUpdateNotice({ entityType: 'task', entityId, summary: 'second', severity: 'critical', audienceRoles: ['kustos'], changedByRole: 'president' });
  const forRole = getNoticesForRole('kustos').filter(n => n.entityId === entityId);
  check('only ONE live notice per entity (coalesced)', forRole.length === 1);
  check('coalesced notice shows the latest summary', forRole[0]?.summary === 'second');
  check('coalesced severity is the max (critical)', forRole[0]?.severity === 'critical');
}

// ── expiry: a 0-day notice is filtered out of getNoticesForRole ───────────────
{
  const entityId = 'expiry_entity_1';
  emitUpdateNotice({ entityType: 'task', entityId, summary: 'expired', severity: 'low', audienceRoles: ['tribune'], changedByRole: 'president', expiresInDays: 0 });
  check('an already-expired notice is not returned',
    getNoticesForRole('tribune').every(n => n.entityId !== entityId));
  // A live (positive-expiry) notice IS returned, confirming the filter is about expiry.
  const live = 'expiry_entity_live';
  emitUpdateNotice({ entityType: 'task', entityId: live, summary: 'live', severity: 'low', audienceRoles: ['tribune'], changedByRole: 'president', expiresInDays: 7 });
  check('a live notice IS returned', getNoticesForRole('tribune').some(n => n.entityId === live));
}

console.log(`\nupdateNoticeStore.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
