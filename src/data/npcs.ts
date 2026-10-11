export interface Drop {
  item: string;
  chance: number;
  min?: number;
  max?: number;
}

import { AttackType } from './prayers';

export interface BossDef {
  /** Attack styles it cycles between. */
  styles: AttackType[];
  /** Attacks before switching style; 1 = picks a random style every attack (Jad-style). */
  switchEvery: number;
  /** Boss floor this boss guards (5, 10, ...). */
  floor: number;
}

export interface NpcDef {
  id: string;
  name: string;
  color: number;
  attack: number;
  strength: number;
  defence: number;
  hitpoints: number;
  attackBonus: number;
  strengthBonus: number;
  defenceBonus: number;
  attackSpeed: number;
  /** Chebyshev tile radius at which it notices the player; 0 = passive. */
  aggroRadius: number;
  minDepth: number;
  maxDepth: number;
  /** Relative spawn weight among NPCs eligible at a depth. */
  weight: number;
  examine: string;
  drops: Drop[];
  /** Default 'melee'. Ranged and magic attackers fire projectiles from range. */
  attackStyle?: AttackType;
  /** Tiles; melee is always 1 (cardinal only). */
  attackRange?: number;
  boss?: BossDef;
}

const list: NpcDef[] = [
  {
    id: 'rat', name: 'Rat', color: 0x8a7a6a, attack: 1, strength: 1, defence: 1, hitpoints: 2,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, attackSpeed: 4, aggroRadius: 4,
    minDepth: 1, maxDepth: 2, weight: 3, examine: 'A popular dwarven delicacy.',
    drops: [{ item: 'bones', chance: 1 }],
  },
  {
    id: 'goblin', name: 'Goblin', color: 0x5f8f3a, attack: 1, strength: 1, defence: 1, hitpoints: 5,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, attackSpeed: 4, aggroRadius: 3,
    minDepth: 1, maxDepth: 3, weight: 4, examine: 'An ugly green creature.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.5, min: 1, max: 15 },
      { item: 'shrimps', chance: 0.3 },
      { item: 'bronze_sword', chance: 0.06 },
      { item: 'bronze_platebody', chance: 0.04 },
    ],
  },
  {
    id: 'giant_rat', name: 'Giant rat', color: 0x7a6a5a, attack: 3, strength: 3, defence: 2, hitpoints: 6,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, attackSpeed: 4, aggroRadius: 4,
    minDepth: 1, maxDepth: 4, weight: 3, examine: 'Overgrown vermin.',
    drops: [{ item: 'bones', chance: 1 }, { item: 'shrimps', chance: 0.2 }],
  },
  {
    id: 'zombie', name: 'Zombie', color: 0x5a7a4a, attack: 6, strength: 6, defence: 5, hitpoints: 12,
    attackBonus: 2, strengthBonus: 2, defenceBonus: 2, attackSpeed: 5, aggroRadius: 4,
    minDepth: 3, maxDepth: 6, weight: 4, examine: 'The walking dead.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.4, min: 3, max: 25 },
      { item: 'trout', chance: 0.2 },
      { item: 'iron_scimitar', chance: 0.03 },
    ],
  },
  {
    id: 'skeleton', name: 'Skeleton', color: 0xd8d4c4, attack: 10, strength: 10, defence: 10, hitpoints: 14,
    attackBonus: 4, strengthBonus: 4, defenceBonus: 4, attackSpeed: 4, aggroRadius: 5,
    minDepth: 4, maxDepth: 7, weight: 4, examine: 'Could do with gaining a few pounds.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.4, min: 5, max: 40 },
      { item: 'trout', chance: 0.25 },
      { item: 'iron_scimitar', chance: 0.05 },
      { item: 'iron_platebody', chance: 0.04 },
    ],
  },
  {
    id: 'giant_spider', name: 'Giant spider', color: 0x4a3a5a, attack: 18, strength: 18, defence: 14, hitpoints: 22,
    attackBonus: 10, strengthBonus: 4, defenceBonus: 10, attackSpeed: 4, aggroRadius: 6,
    minDepth: 5, maxDepth: 8, weight: 3, examine: 'I think this spider has been genetically modified.',
    drops: [
      { item: 'coins', chance: 0.4, min: 10, max: 60 },
      { item: 'trout', chance: 0.15 },
      { item: 'steel_scimitar', chance: 0.05 },
    ],
  },
  {
    id: 'hill_giant', name: 'Hill Giant', color: 0x9a7a5a, attack: 16, strength: 20, defence: 18, hitpoints: 26,
    attackBonus: 12, strengthBonus: 10, defenceBonus: 10, attackSpeed: 6, aggroRadius: 4,
    minDepth: 5, maxDepth: 9, weight: 3, examine: 'A very large foe.',
    drops: [
      { item: 'big_bones', chance: 1 },
      { item: 'coins', chance: 0.4, min: 10, max: 80 },
      { item: 'trout', chance: 0.12 },
      { item: 'steel_platebody', chance: 0.05 },
    ],
  },
  {
    id: 'moss_giant', name: 'Moss giant', color: 0x4a7a3a, attack: 26, strength: 26, defence: 24, hitpoints: 40,
    attackBonus: 33, strengthBonus: 31, defenceBonus: 20, attackSpeed: 6, aggroRadius: 4,
    minDepth: 8, maxDepth: 12, weight: 3, examine: 'His beard seems to have a life of its own.',
    drops: [
      { item: 'big_bones', chance: 1 },
      { item: 'coins', chance: 0.5, min: 20, max: 150 },
      { item: 'lobster', chance: 0.1 },
      { item: 'mithril_scimitar', chance: 0.05 },
      { item: 'mithril_platebody', chance: 0.04 },
    ],
  },
  {
    id: 'lesser_demon', name: 'Lesser demon', color: 0xa02020, attack: 50, strength: 52, defence: 50, hitpoints: 58,
    attackBonus: 40, strengthBonus: 40, defenceBonus: 30, attackSpeed: 4, aggroRadius: 6,
    minDepth: 11, maxDepth: 99, weight: 3, examine: 'Lesser, but still pretty big.',
    drops: [
      { item: 'coins', chance: 0.6, min: 50, max: 300 },
      { item: 'lobster', chance: 0.1 },
      { item: 'swordfish', chance: 0.05 },
      { item: 'adamant_scimitar', chance: 0.04 },
      { item: 'adamant_platebody', chance: 0.03 },
      { item: 'rune_scimitar', chance: 0.01 },
    ],
  },
  {
    id: 'greater_demon', name: 'Greater demon', color: 0xd03010, attack: 62, strength: 64, defence: 62, hitpoints: 70,
    attackBonus: 50, strengthBonus: 50, defenceBonus: 40, attackSpeed: 4, aggroRadius: 7,
    minDepth: 14, maxDepth: 99, weight: 2, examine: 'Big, red, and incredibly evil.',
    drops: [
      { item: 'coins', chance: 0.6, min: 100, max: 500 },
      { item: 'swordfish', chance: 0.1 },
      { item: 'rune_scimitar', chance: 0.03 },
      { item: 'rune_platebody', chance: 0.02 },
    ],
  },

  // ---- Ranged & magic attackers ----
  {
    id: 'dark_wizard', name: 'Dark wizard', color: 0x5a2a8a, attack: 10, strength: 10, defence: 6, hitpoints: 12,
    attackBonus: 15, strengthBonus: 10, defenceBonus: 0, attackSpeed: 5, aggroRadius: 4,
    attackStyle: 'magic', attackRange: 6,
    minDepth: 3, maxDepth: 7, weight: 2, examine: 'He works evil magic.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.5, min: 5, max: 30 },
      { item: 'shrimps', chance: 0.25 },
      { item: 'prayer_potion', chance: 0.06 },
    ],
  },
  {
    id: 'skeleton_archer', name: 'Skeleton archer', color: 0xc8c0a0, attack: 14, strength: 12, defence: 12, hitpoints: 16,
    attackBonus: 15, strengthBonus: 10, defenceBonus: 5, attackSpeed: 5, aggroRadius: 5,
    attackStyle: 'ranged', attackRange: 7,
    minDepth: 4, maxDepth: 9, weight: 3, examine: 'It rattles as it draws its bow.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.4, min: 10, max: 50 },
      { item: 'trout', chance: 0.2 },
      { item: 'prayer_potion', chance: 0.06 },
    ],
  },
  {
    id: 'infernal_mage', name: 'Infernal mage', color: 0xc04a1a, attack: 32, strength: 32, defence: 24, hitpoints: 36,
    attackBonus: 30, strengthBonus: 25, defenceBonus: 15, attackSpeed: 5, aggroRadius: 5,
    attackStyle: 'magic', attackRange: 7,
    minDepth: 9, maxDepth: 15, weight: 2, examine: 'An evil magic user.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.5, min: 30, max: 150 },
      { item: 'prayer_potion', chance: 0.1 },
    ],
  },
  {
    id: 'dark_archer', name: 'Dark archer', color: 0x2a4a2a, attack: 45, strength: 45, defence: 40, hitpoints: 50,
    attackBonus: 40, strengthBonus: 35, defenceBonus: 25, attackSpeed: 5, aggroRadius: 6,
    attackStyle: 'ranged', attackRange: 8,
    minDepth: 12, maxDepth: 99, weight: 2, examine: 'Never far from the shadows.',
    drops: [
      { item: 'bones', chance: 1 },
      { item: 'coins', chance: 0.6, min: 50, max: 250 },
      { item: 'prayer_potion', chance: 0.1 },
    ],
  },

  // ---- Bosses (one every 5 floors; never in the random pool) ----
  {
    id: 'goblin_warlord', name: 'Goblin Warlord', color: 0x3f7a1a, attack: 22, strength: 22, defence: 18, hitpoints: 40,
    attackBonus: 20, strengthBonus: 15, defenceBonus: 15, attackSpeed: 5, aggroRadius: 7, attackRange: 7,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'The biggest, meanest goblin around. Watch his weapon.',
    boss: { styles: ['melee', 'ranged'], switchEvery: 3, floor: 5 },
    drops: [
      { item: 'big_bones', chance: 1 },
      { item: 'coins', chance: 1, min: 100, max: 300 },
      { item: 'prayer_potion', chance: 1, min: 2, max: 3 },
      { item: 'trout', chance: 1, min: 3, max: 4 },
      { item: 'mithril_scimitar', chance: 0.5 },
      { item: 'steel_platebody', chance: 0.5 },
    ],
  },
  {
    id: 'tztok_jad', name: 'TzTok-Jad', color: 0xd06020, attack: 42, strength: 40, defence: 34, hitpoints: 100,
    attackBonus: 60, strengthBonus: 120, defenceBonus: 30, attackSpeed: 6, aggroRadius: 9, attackRange: 9,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'This is going to hurt...',
    boss: { styles: ['ranged', 'magic'], switchEvery: 1, floor: 10 },
    drops: [
      { item: 'big_bones', chance: 1, min: 2, max: 2 },
      { item: 'coins', chance: 1, min: 300, max: 800 },
      { item: 'prayer_potion', chance: 1, min: 3, max: 4 },
      { item: 'lobster', chance: 1, min: 3, max: 4 },
      { item: 'adamant_scimitar', chance: 0.5 },
      { item: 'adamant_platebody', chance: 0.5 },
    ],
  },
  {
    id: 'chaos_elemental', name: 'Chaos Elemental', color: 0x8a3ab0, attack: 58, strength: 58, defence: 50, hitpoints: 130,
    attackBonus: 70, strengthBonus: 110, defenceBonus: 50, attackSpeed: 5, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'A shimmering mass of energy.',
    boss: { styles: ['melee', 'ranged', 'magic'], switchEvery: 2, floor: 15 },
    drops: [
      { item: 'big_bones', chance: 1, min: 2, max: 3 },
      { item: 'coins', chance: 1, min: 600, max: 1500 },
      { item: 'prayer_potion', chance: 1, min: 3, max: 5 },
      { item: 'swordfish', chance: 1, min: 3, max: 5 },
      { item: 'rune_scimitar', chance: 0.5 },
      { item: 'rune_kiteshield', chance: 0.5 },
    ],
  },
  {
    id: 'demonic_gorilla', name: 'Demonic gorilla', color: 0x4a1a1a, attack: 75, strength: 75, defence: 66, hitpoints: 170,
    attackBonus: 90, strengthBonus: 130, defenceBonus: 70, attackSpeed: 5, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'A demonic gorilla. It adapts to how you fight.',
    boss: { styles: ['melee', 'ranged', 'magic'], switchEvery: 3, floor: 20 },
    drops: [
      { item: 'big_bones', chance: 1, min: 3, max: 3 },
      { item: 'coins', chance: 1, min: 1000, max: 3000 },
      { item: 'prayer_potion', chance: 1, min: 4, max: 5 },
      { item: 'swordfish', chance: 1, min: 4, max: 6 },
      { item: 'rune_platebody', chance: 0.6 },
    ],
  },
];

export const BOSS_EVERY = 5;

export function isBossFloor(depth: number): boolean {
  return depth % BOSS_EVERY === 0;
}

/**
 * The boss for a boss floor. Past the last boss, the final one repeats with
 * stats scaled up 15% per extra boss floor.
 */
export function bossForDepth(depth: number): NpcDef {
  const bosses = list.filter((n) => n.boss).sort((a, b) => a.boss!.floor - b.boss!.floor);
  const exact = bosses.find((b) => b.boss!.floor === depth);
  if (exact) return exact;
  const last = bosses[bosses.length - 1];
  const scale = 1 + 0.15 * ((depth - last.boss!.floor) / BOSS_EVERY);
  const s = (v: number) => Math.round(v * scale);
  return {
    ...last, attack: s(last.attack), strength: s(last.strength), defence: s(last.defence), hitpoints: s(last.hitpoints),
    boss: { ...last.boss!, floor: depth },
  };
}

export const NPCS: Record<string, NpcDef> = Object.fromEntries(list.map((n) => [n.id, n]));

export function npcsForDepth(depth: number): NpcDef[] {
  return list.filter((n) => depth >= n.minDepth && depth <= n.maxDepth);
}
