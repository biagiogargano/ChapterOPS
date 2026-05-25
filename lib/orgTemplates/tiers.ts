/**
 * orgTemplates/tiers.ts — the org STRUCTURE tier model (prototype).
 * Structure is a few coarse tiers, NOT a fine-grained seniority ranking — roles
 * within a tier are peers. Shared by the setup wizard's roles step and the
 * (owner-only) structure/tree screen so they agree on the same tiers. Mock only.
 */

export const TIERS = [
  { id: 'lead',    label: 'Leadership', color: '#818cf8' },  // indigo
  { id: 'exec',    label: 'Executives', color: '#38bdf8' },  // sky
  { id: 'officer', label: 'Officers',   color: '#34d399' },  // emerald
  { id: 'member',  label: 'Members',    color: '#94a3b8' },  // slate
] as const;

export type TierId = typeof TIERS[number]['id'];
export const TIER_ORDER = TIERS.map(t => t.id) as TierId[];

/** Color for a tier (used to color-code the structure visual + role card). */
export function tierColor(id: TierId): string {
  return TIERS.find(t => t.id === id)?.color ?? '#94a3b8';
}

/** Sensible default tier per role based on its position in the template list. */
export function defaultTiers(roleList: string[]): Record<string, TierId> {
  const n = roleList.length;
  const map: Record<string, TierId> = {};
  roleList.forEach((r, i) => {
    map[r] = i === 0 ? 'lead' : i === n - 1 ? 'member' : i <= 2 ? 'exec' : 'officer';
  });
  return map;
}
