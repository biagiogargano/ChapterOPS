/**
 * Isolated tests for lib/customTemplatesStore.ts — dependency-free harness.
 * Exercises the synchronous in-memory CRUD + merge/resolve (persistence is
 * fire-and-forget to a stubbed AsyncStorage and not asserted here).
 */

import {
  buildTasksForTemplateId,
  deleteCustomTemplate,
  getCustomTemplates,
  getMergedTemplates,
  getTemplateById,
  isBuiltInTemplate,
  newCustomTemplateId,
  resetCustomTemplates,
  saveCustomTemplate,
} from './customTemplatesStore';
import { EVENT_TEMPLATES, NO_TEMPLATE, type EventTaskTemplate, type EventTemplateInput } from './eventTemplates';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const builtInCount = EVENT_TEMPLATES.length;
const ev: EventTemplateInput = { id: 'evt-9', title: 'Big Night', dateString: '2030-09-20', createdByRole: 'social_chair' };

function makeTemplate(id: string): EventTaskTemplate {
  return {
    id,
    label: 'My Custom',
    taskSpecs: [
      { key: 'a', title: 'Do A for {event}', description: 'A for {event}', assignedRole: 'social_chair', dueOffsetDays: -2, requiresApproval: true, reviewerRole: 'pro_consul' },
      { key: 'b', title: 'Do B for {event}', description: 'B for {event}', assignedRole: 'risk_manager', dueOffsetDays: -1 },
    ],
  };
}

resetCustomTemplates();

// Empty start.
check('starts empty', getCustomTemplates().length === 0);
check('merged starts with built-ins only', getMergedTemplates().length === builtInCount);

// Built-in detection.
check('date_party is built-in', isBuiltInTemplate('date_party') === true);

// Create.
const id = newCustomTemplateId();
check('new id has custom_ prefix', id.startsWith('custom_'));
saveCustomTemplate(makeTemplate(id));
check('custom count is 1', getCustomTemplates().length === 1);
check('merged grew by one', getMergedTemplates().length === builtInCount + 1);
check('getTemplateById finds custom', getTemplateById(id)?.id === id);
check('custom is NOT built-in', isBuiltInTemplate(id) === false);

// Build from custom id.
const built = buildTasksForTemplateId(id, ev);
check('custom builds 2 tasks', built.length === 2);
check('custom task ids are tmpl_ + custom id', built.every(t => t.id.startsWith(`tmpl_${id}_`)));
check('custom task A due −2 days', built.find(t => t.id.endsWith('_a'))?.dueAt === '2030-09-18');
check('custom task linked to event', built.every(t => t.linkedEventId === 'evt-9'));

// Update (same id replaces, no duplicate).
const edited = makeTemplate(id);
edited.label = 'Renamed';
saveCustomTemplate(edited);
check('update does not duplicate', getCustomTemplates().length === 1);
check('update applied', getTemplateById(id)?.label === 'Renamed');

// None sentinel + unknown id.
check('none builds nothing', buildTasksForTemplateId(NO_TEMPLATE, ev).length === 0);
check('unknown id builds nothing', buildTasksForTemplateId('nope', ev).length === 0);

// Delete.
deleteCustomTemplate(id);
check('delete removes custom', getCustomTemplates().length === 0);
check('merged back to built-ins', getMergedTemplates().length === builtInCount);

console.log(`\ncustomTemplatesStore.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
