/**
 * Isolated tests for lib/agendaDocumentService.ts — dependency-free harness.
 *
 * ASYNC suite: exports runAsync() which the runner AWAITS and gates on { failed }.
 * In the pure runner EXPO_PUBLIC_SUPABASE_* is unset → isSupabaseConfigured() is false,
 * so every wrapper takes its FALLBACK-SAFE path: reads → ok:true/null (sandbox),
 * mutations → { ok:false, error:'unconfigured' }, NONE throw.
 */

import {
  getAgendaDocument, upsertAgendaDocument, finalizeAgendaDocument,
} from './agendaDocumentService';
import type { AgendaDocument } from './agendaDocument';

export async function runAsync(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const check = (name: string, cond: boolean): void => {
    if (cond) passed++;
    else { failed++; console.error(`  ✗ FAIL: ${name}`); }
  };

  const doc: AgendaDocument = { v: 1, sections: [{ key: 'old_business', title: 'Old Business', items: [] }] };

  // ── Reads: unconfigured = ok:true, null (legit empty, not an error) ───────────
  {
    const r = await getAgendaDocument('evt-1');
    check('get → ok:true when unconfigured', r.ok === true && r.document === null);
    check('get → no error when unconfigured', r.error === undefined);
    const r2 = await getAgendaDocument('');
    check('get → ok:true on empty eventId', r2.ok === true && r2.document === null);
  }

  // ── Mutations: safe failure when unconfigured / bad input ─────────────────────
  {
    const u = await upsertAgendaDocument({ eventId: 'evt-1', title: 'Agenda', sections: doc });
    check('upsert → ok:false when unconfigured', u.ok === false);
    check('upsert → error unconfigured', u.error === 'unconfigured');
    check('upsert → no id on failure', u.id === undefined);

    check('upsert → ok:false on missing event',
      (await upsertAgendaDocument({ eventId: '', title: 'A', sections: doc })).ok === false);
    check('upsert → ok:false on invalid sections',
      (await upsertAgendaDocument({ eventId: 'e', title: 'A', sections: null as unknown as AgendaDocument })).ok === false);

    const f = await finalizeAgendaDocument('evt-1');
    check('finalize → ok:false when unconfigured', f.ok === false);
    check('finalize → ok:false on empty event', (await finalizeAgendaDocument('')).ok === false);
  }

  // ── Never throws ──────────────────────────────────────────────────────────────
  let threw = false;
  try {
    await getAgendaDocument('e');
    await upsertAgendaDocument({ eventId: 'e', title: 't', sections: doc, generatedFrom: { any: 'thing' } });
    await finalizeAgendaDocument('e');
  } catch { threw = true; }
  check('service never throws', threw === false);

  console.log(`\nagendaDocumentService.test: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
