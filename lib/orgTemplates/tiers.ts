/**
 * orgTemplates/tiers.ts — the org STRUCTURE tier model (prototype).
 * Structure is a few coarse tiers, NOT a fine-grained seniority ranking — roles
 * within a tier are peers. Shared by the setup wizard's roles step and the
 * (owner-only) structure/tree screen so they agree on the same tiers. Mock only.
 */

export const TIERS = [
  { id: 'lead',    label: 'Leadership' },
  { id: 'exec',    label: 'Executives' },
  { id: 'officer', label: 'Officers'   },
  { id: 'member',  label: 'Members'    },
] as const;

export type TierId = typeof TIERS[number]['id'];
export const TIER_ORDER = TIERS.map(t => t.id) as TierId[];

/** Sensible default tier per role based on its position in the template list. */
export function defaultTiers(roleList: string[]): Record<string, TierId> {
  const n = roleList.length;
  const map: Record<string, TierId> = {};
  roleList.forEach((r, i) => {
    map[r] = i === 0 ? 'lead' : i === n - 1 ? 'member' : i <= 2 ? 'exec' : 'officer';
  });
  return map;
}
