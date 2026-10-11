import type { SkillName } from './skills';

/**
 * Camp building: the Builder upgrades camp structures with tokens plus materials.
 * Materials come from the logs, ores and bars you're carrying when a run ends.
 */

export type StructureId = 'bank_chest' | 'herb_garden' | 'trophy_room' | 'workbench' | 'relic_altar' | 'pet_kennel';

export interface Materials {
  timber: number;
  metal: number;
}

export interface StructureLevel {
  tokens: number;
  timber: number;
  metal: number;
  /** What this level does, shown in the Builder's window. */
  effect: string;
}

export interface StructureDef {
  id: StructureId;
  name: string;
  /** Where it stands at camp once built. */
  pos: { x: number; y: number };
  levels: StructureLevel[];
}

const lvl = (tokens: number, timber: number, metal: number, effect: string): StructureLevel => ({ tokens, timber, metal, effect });

export const STRUCTURES: StructureDef[] = [
  {
    id: 'bank_chest', name: 'Bank chest', pos: { x: 16, y: 4 },
    levels: [
      lvl(100, 20, 10, 'When a run ends, your 2 most valuable carried items are kept for the next run.'),
      lvl(250, 40, 30, 'Keeps your 4 most valuable carried items.'),
      lvl(500, 80, 60, 'Keeps your 6 most valuable carried items.'),
    ],
  },
  {
    id: 'herb_garden', name: 'Herb garden', pos: { x: 2, y: 6 },
    levels: [
      lvl(80, 30, 0, 'Start each run with 1 potion from the garden.'),
      lvl(200, 60, 10, 'Start each run with 2 potions.'),
      lvl(400, 100, 20, 'Start each run with 3 potions (super potions once you reach floor 10).'),
    ],
  },
  {
    id: 'trophy_room', name: 'Trophy room', pos: { x: 23, y: 6 },
    levels: [
      lvl(150, 30, 20, 'Mount 1 boss trophy: +3% max hit per different boss you have defeated.'),
      lvl(300, 60, 40, 'Mount 2 boss trophies.'),
      lvl(600, 100, 80, 'Mount 4 boss trophies.'),
    ],
  },
  {
    id: 'workbench', name: 'Workbench', pos: { x: 2, y: 9 },
    levels: [
      lvl(100, 20, 20, '+15% Smithing, Fletching, Cooking and Herblore XP.'),
      lvl(250, 40, 40, '+30% crafting XP.'),
      lvl(500, 80, 80, '+45% crafting XP.'),
    ],
  },
  {
    id: 'relic_altar', name: 'Relic altar', pos: { x: 23, y: 9 },
    levels: [lvl(300, 40, 40, 'Start each run with one relic you have found before.')],
  },
  {
    id: 'pet_kennel', name: 'Pet kennel', pos: { x: 10, y: 14 },
    levels: [
      lvl(120, 40, 10, 'Your following pet gives a bonus that grows as it comes on runs.'),
      lvl(260, 70, 20, 'Pet bonuses x1.5.'),
      lvl(500, 120, 40, 'Pet bonuses x2.'),
    ],
  },
];

export const STRUCTURE_BY_ID = Object.fromEntries(STRUCTURES.map((s) => [s.id, s])) as Record<StructureId, StructureDef>;

export type StructureLevels = Partial<Record<StructureId, number>>;

export const BANK_SLOTS = [0, 2, 4, 6];
export const GARDEN_POTIONS = [0, 1, 2, 3];
export const TROPHY_MOUNTS = [0, 1, 2, 4];
export const TROPHY_BONUS = 0.03;
export const WORKBENCH_XP = [0, 0.15, 0.3, 0.45];
export const WORKBENCH_SKILLS: SkillName[] = ['smithing', 'fletching', 'cooking', 'herblore'];
export const KENNEL_MULT = [0, 1, 1.5, 2];

/** Camp materials each carried item becomes when a run ends. */
export const MATERIAL_VALUE: Record<string, Partial<Materials>> = {
  logs: { timber: 1 }, oak_logs: { timber: 2 }, willow_logs: { timber: 3 }, maple_logs: { timber: 4 }, yew_logs: { timber: 5 },
  copper_ore: { metal: 1 }, tin_ore: { metal: 1 }, iron_ore: { metal: 1 }, coal: { metal: 1 },
  mithril_ore: { metal: 2 }, adamantite_ore: { metal: 3 }, runite_ore: { metal: 4 },
  bronze_bar: { metal: 2 }, iron_bar: { metal: 3 }, steel_bar: { metal: 4 }, mithril_bar: { metal: 6 }, adamant_bar: { metal: 8 }, rune_bar: { metal: 10 },
};

/** Materials from a carried pack. */
export function materialsFrom(items: Array<{ id: string; qty: number }>): Materials {
  const out = { timber: 0, metal: 0 };
  for (const { id, qty } of items) {
    const v = MATERIAL_VALUE[id];
    if (!v) continue;
    out.timber += (v.timber ?? 0) * qty;
    out.metal += (v.metal ?? 0) * qty;
  }
  return out;
}

/** The next level to build, or null when maxed. */
export function nextStructureLevel(levels: StructureLevels, id: StructureId): StructureLevel | null {
  return STRUCTURE_BY_ID[id].levels[levels[id] ?? 0] ?? null;
}

/** Pets: each boss pet boosts one thing; it grows 1% per level, levelling every 10 floors it comes along. */
export const PET_BUFFS: Record<string, { kind: 'melee' | 'ranged' | 'magic' | 'defence'; label: string }> = {
  pet_goblin_warlord: { kind: 'melee', label: 'melee max hit' },
  pet_tztok_jad: { kind: 'ranged', label: 'ranged max hit' },
  pet_chaos_elemental: { kind: 'magic', label: 'magic max hit' },
  pet_demonic_gorilla: { kind: 'defence', label: 'defence' },
};

export const PET_MAX_LEVEL = 10;

export function petLevel(floors: number): number {
  return Math.min(PET_MAX_LEVEL, 1 + Math.floor(floors / 10));
}

/** Bonus fraction a pet gives with the kennel at `kennel` level. */
export function petBonus(floors: number, kennel: number): number {
  return (petLevel(floors) / 100) * KENNEL_MULT[kennel];
}

export const GARDEN_POOL = ['attack_potion', 'strength_potion', 'defence_potion', 'prayer_potion', 'ranging_potion', 'magic_potion'];
export const GARDEN_SUPER_POOL = ['super_attack', 'super_strength', 'super_defence', 'prayer_potion', 'ranging_potion', 'magic_potion'];
