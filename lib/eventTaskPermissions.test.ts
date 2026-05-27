/**
 * Isolated tests for lib/eventTaskPermissions.ts — dependency-free harness (no
 * framework). Compile with tsc to a temp dir, run with node; non-zero exit on
 * failure. Mirrors the lib/positions.test.ts pattern.
 *
 * Regression: officers must only manage tasks for events whose kind is in their
 * ROLE_ALLOWED_KINDS — president/pro_consul → all kinds, each chair → its domain,
 * brother → none (see commits 5be2232 / 07ebb76).
 */

import { canManageEventTasks } from './eventTaskPermissions';
import type { EventKind } from './mockEvents';
import type { Role } from './roles';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// All 12 event kinds (matches lib/mockEvents EventKind + live events.kind CHECK).
const ALL_KINDS: EventKind[] = [
  'chapter', 'eboard', 'social', 'academic', 'recruitment', 'philanthropy',
  'risk', 'finance', 'education', 'ritual', 'communications', 'facility',
];

// president / pro_consul manage EVERY kind.
for (const r of ['president', 'pro_consul'] as Role[]) {
  for (const k of ALL_KINDS) {
    check(`${r} can manage ${k}`, canManageEventTasks(r, k) === true);
  }
}

// Each other role manages EXACTLY its allowed kind(s) and nothing else.
const EXPECT: Record<string, EventKind[]> = {
  annotator:          ['chapter', 'eboard'],
  quaestor:           ['finance'],
  magister:           ['education'],
  kustos:             ['ritual'],
  tribune:            ['communications'],
  social_chair:       ['social'],
  risk_manager:       ['risk'],
  recruitment_chair:  ['recruitment'],
  philanthropy_chair: ['philanthropy'],
  scholarship_chair:  ['academic'],
  house_manager:      ['facility'],
};

for (const role of Object.keys(EXPECT)) {
  const allowed = EXPECT[role];
  for (const k of ALL_KINDS) {
    const want = allowed.includes(k);
    check(
      `${role} ${want ? 'can manage' : 'cannot manage'} ${k}`,
      canManageEventTasks(role as Role, k) === want,
    );
  }
}

// brother manages NO event kind.
for (const k of ALL_KINDS) {
  check(`brother cannot manage ${k}`, canManageEventTasks('brother' as Role, k) === false);
}

console.log(`\neventTaskPermissions.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
