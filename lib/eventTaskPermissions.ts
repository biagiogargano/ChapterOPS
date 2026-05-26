import { ROLE_ALLOWED_KINDS } from '@/lib/eventStore';
import type { EventKind } from '@/lib/mockEvents';
import type { Role } from '@/lib/roles';

/**
 * Can this role create / manage tasks on an event of the given kind?
 *
 * Reuses the same per-role event-kind matrix that gates event CREATION
 * (ROLE_ALLOWED_KINDS in eventStore) so task management and event creation stay
 * aligned for alpha:
 *   • president / pro_consul → any kind
 *   • each chair / officer   → only their domain kind(s)
 *   • brother                → none
 *
 * Pure, client-side UI permission check — no data, schema, or policy changes.
 */
export function canManageEventTasks(role: Role, kind: EventKind): boolean {
  return (ROLE_ALLOWED_KINDS[role] ?? []).includes(kind);
}
