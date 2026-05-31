/**
 * Tests for lib/agendaDocument — the editable meeting-agenda document model.
 * Dependency-free; asserts via console + process.exit (matches the pure runner).
 */

import {
  AGENDA_DOCUMENT_VERSION, AGENDA_SECTION_DEFS,
  assembleAgendaDocument, isAgendaDocumentEmpty,
  setSectionTitle, setItemText, addManualItem, removeItem,
  withAllCanonicalSections, pruneEmptySections,
} from './agendaDocument';
import type { Agenda } from './buildAgenda';
import type { AgendaGoalItem } from './agendaGoals';
import type { GroupedAgendaContributions } from './agendaContributions';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const emptyAgenda: Agenda = { oldBusiness: [], newBusiness: [], unresolved: [], brotherWide: [] };

const fullAgenda: Agenda = {
  oldBusiness: [{ id: 'e1', title: 'Mixer', meta: 'Mon · House', kind: 'event' }],
  newBusiness: [{ id: 'e2', title: 'Formal', meta: 'Sat · Venue', kind: 'event' }],
  unresolved:  [{ id: 't1', title: 'Book DJ', meta: 'Fri', kind: 'task' }],
  brotherWide: [{ id: 't2', title: 'Pay dues', meta: 'Fri', kind: 'task' }],
};

const goalsAttn: AgendaGoalItem[] = [
  { goalId: 'g1', title: 'Recruit 12', reason: 'not_started', ownerRole: 'recruitment_chair' },
  { goalId: 'g2', title: 'Fundraise $3k', reason: 'ready_to_complete' },
];

const contributions: GroupedAgendaContributions = {
  announcements: [{ section: 'announcement', questionKey: 'announcements', text: 'Dues Friday', source: 'Quaestor' }],
  helpNeeded:    [{ section: 'help_needed', questionKey: 'blockers', text: 'Need a venue', source: 'Social Chair' }],
};

// ── canonical structure: all sections present + in order (includeEmpty default) ─
{
  const doc = assembleAgendaDocument({ agenda: emptyAgenda });
  check('version stamped', doc.v === AGENDA_DOCUMENT_VERSION);
  check('all canonical sections present by default', doc.sections.length === AGENDA_SECTION_DEFS.length);
  check('section order matches canonical', doc.sections.map(s => s.key).join(',') === AGENDA_SECTION_DEFS.map(d => d.key).join(','));
  check('empty agenda → empty document', isAgendaDocumentEmpty(doc));
}

// ── full assembly: each slice lands in its section, with nav refs ──────────────
{
  const doc = assembleAgendaDocument({ agenda: fullAgenda, goalsNeedingAttention: goalsAttn, contributions });
  const sec = (k: string) => doc.sections.find(s => s.key === k)!;
  check('old business event', sec('old_business').items[0].text === 'Mixer' && sec('old_business').items[0].kind === 'event' && sec('old_business').items[0].refId === 'e1');
  check('new business event', sec('new_business').items[0].text === 'Formal');
  check('open task carries refId', sec('open_tasks').items[0].kind === 'task' && sec('open_tasks').items[0].refId === 't1');
  check('chapter-wide task', sec('chapter_wide').items[0].text === 'Pay dues');
  check('goals needing attention with reason meta', sec('goals_attention').items[0].text === 'Recruit 12' && sec('goals_attention').items[0].meta === 'Not started' && sec('goals_attention').items[0].refId === 'g1');
  check('ready-to-complete goal label', sec('goals_attention').items[1].meta === 'Ready to complete');
  check('help needed with source meta', sec('help_needed').items[0].text === 'Need a venue' && sec('help_needed').items[0].meta === 'Social Chair' && sec('help_needed').items[0].kind === 'contribution');
  check('announcement with source', sec('announcements').items[0].text === 'Dues Friday' && sec('announcements').items[0].meta === 'Quaestor');
  check('not empty', !isAgendaDocumentEmpty(doc));
}

// ── deterministic item ids ────────────────────────────────────────────────────
{
  const a = assembleAgendaDocument({ agenda: fullAgenda, goalsNeedingAttention: goalsAttn, contributions });
  const b = assembleAgendaDocument({ agenda: fullAgenda, goalsNeedingAttention: goalsAttn, contributions });
  check('same inputs → identical documents', JSON.stringify(a) === JSON.stringify(b));
  check('item ids are sectionKey:index', a.sections.find(s => s.key === 'old_business')!.items[0].id === 'old_business:0');
}

// ── includeEmpty:false drops empty sections ───────────────────────────────────
{
  const doc = assembleAgendaDocument({ agenda: fullAgenda, includeEmpty: false });
  // No goals/contributions provided → those sections empty → omitted.
  check('empty sections omitted when includeEmpty=false', !doc.sections.some(s => s.key === 'goals_attention' || s.key === 'help_needed' || s.key === 'announcements'));
  check('non-empty sections kept', doc.sections.some(s => s.key === 'old_business'));
}

// ── serializable ──────────────────────────────────────────────────────────────
{
  const doc = assembleAgendaDocument({ agenda: fullAgenda, goalsNeedingAttention: goalsAttn, contributions });
  const round = JSON.parse(JSON.stringify(doc));
  check('document JSON round-trips', JSON.stringify(round) === JSON.stringify(doc));
}

// ── editing helpers: immutable, no-throw, deterministic ───────────────────────
{
  const base = assembleAgendaDocument({ agenda: fullAgenda });   // all canonical sections, some populated

  // setSectionTitle
  const t = setSectionTitle(base, 'old_business', 'Carried Over');
  check('setSectionTitle changes the title', t.sections.find(s => s.key === 'old_business')!.title === 'Carried Over');
  check('setSectionTitle is immutable', base.sections.find(s => s.key === 'old_business')!.title === 'Old Business');
  check('setSectionTitle unknown key → no-op', setSectionTitle(base, 'nope', 'x').sections.length === base.sections.length);

  // setItemText
  const firstId = base.sections.find(s => s.key === 'old_business')!.items[0].id;
  const e = setItemText(base, 'old_business', firstId, 'Edited line');
  check('setItemText edits the item', e.sections.find(s => s.key === 'old_business')!.items[0].text === 'Edited line');
  check('setItemText immutable', base.sections.find(s => s.key === 'old_business')!.items[0].text === 'Mixer');
  check('setItemText unknown item → unchanged', setItemText(base, 'old_business', 'zzz', 'x').sections.find(s => s.key === 'old_business')!.items[0].text === 'Mixer');

  // addManualItem — deterministic note ids, survive removal
  let d = addManualItem(base, 'announcements', 'Bring dues');
  let ann = d.sections.find(s => s.key === 'announcements')!;
  check('addManualItem appends a note', ann.items[ann.items.length - 1].text === 'Bring dues' && ann.items[ann.items.length - 1].kind === 'note');
  check('first note id is announcements:note:1', ann.items.some(i => i.id === 'announcements:note:1'));
  d = addManualItem(d, 'announcements', 'Second note');
  ann = d.sections.find(s => s.key === 'announcements')!;
  check('second note id is announcements:note:2', ann.items.some(i => i.id === 'announcements:note:2'));
  // Remove note 1, add again → next id is 3 (max+1), no collision.
  d = removeItem(d, 'announcements', 'announcements:note:1');
  d = addManualItem(d, 'announcements', 'Third note');
  ann = d.sections.find(s => s.key === 'announcements')!;
  check('post-removal note id avoids collision (note:3)', ann.items.some(i => i.id === 'announcements:note:3') && !ann.items.some(i => i.id === 'announcements:note:1'));

  // removeItem
  const r = removeItem(base, 'open_tasks', base.sections.find(s => s.key === 'open_tasks')!.items[0].id);
  check('removeItem drops the item', r.sections.find(s => s.key === 'open_tasks')!.items.length === 0);
}

// ── withAllCanonicalSections / pruneEmptySections ─────────────────────────────
{
  const sparse = assembleAgendaDocument({ agenda: fullAgenda, includeEmpty: false });   // only populated sections
  const full = withAllCanonicalSections(sparse);
  check('withAllCanonicalSections adds every canonical section', full.sections.length === AGENDA_SECTION_DEFS.length);
  check('withAllCanonicalSections preserves existing content', full.sections.find(s => s.key === 'old_business')!.items[0].text === 'Mixer');

  // Prune: empty + default-title sections dropped; renamed-empty kept; blank items removed.
  let doc = withAllCanonicalSections(assembleAgendaDocument({ agenda: emptyAgenda }));   // all empty
  doc = addManualItem(doc, 'announcements', '  Real note  ');
  doc = addManualItem(doc, 'help_needed', '   ');                 // whitespace-only → dropped on prune
  doc = setSectionTitle(doc, 'new_business', 'Kept Empty');        // renamed empty → kept
  const pruned = pruneEmptySections(doc);
  check('prune keeps a section with a real item', pruned.sections.some(s => s.key === 'announcements' && s.items[0].text === 'Real note'));
  check('prune trims item text', pruned.sections.find(s => s.key === 'announcements')!.items[0].text === 'Real note');
  check('prune drops whitespace-only items', !pruned.sections.some(s => s.key === 'help_needed' && s.items.length > 0));
  check('prune drops empty default-title sections', !pruned.sections.some(s => s.key === 'old_business'));
  check('prune keeps renamed empty section', pruned.sections.some(s => s.key === 'new_business' && s.title === 'Kept Empty'));
}

console.log(`\nagendaDocument.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
