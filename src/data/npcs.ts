export interface Drop {
  item: string;
  chance: number;
  min?: number;
  max?: number;
}

import { AttackType } from './prayers';
import { gearForDepth } from './loot';

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
  /** Player attacks of this style land far more often (see WEAKNESS_PENALTY). */
  weakness?: AttackType;
}

/** Defence bonus lost against the style a monster is weak to. */
export const WEAKNESS_PENALTY = 30;

/**
 * Combat triangle: armoured melee brutes fall to magic, casters to arrows,
 * archers to a sword in the face. Assigned here so the table above stays readable.
 */
const WEAKNESSES: Record<string, AttackType> = {
  zombie: 'magic', skeleton: 'magic', hill_giant: 'magic', moss_giant: 'magic', lesser_demon: 'magic',
  greater_demon: 'magic', goblin_warlord: 'magic',
  dark_wizard: 'ranged', infernal_mage: 'ranged', lich: 'ranged', shadow_reaper: 'ranged', abyssal_fiend: 'magic', soul_eater: 'melee', giant_spider: 'ranged', tztok_jad: 'ranged',
  skeleton_archer: 'melee', dark_archer: 'melee',
  ghoul: 'magic', mummy: 'magic', wight: 'ranged', hellhound: 'ranged', fire_elemental: 'ranged', salamander: 'melee',
  ice_beast: 'magic', frost_giant: 'magic', freezing_wraith: 'ranged',
};

/** Herblore secondaries and vials, appended to the drop tables above. */
const HERBLORE_DROPS: Record<string, Drop[]> = {
  goblin: [{ item: 'limpwurt_root', chance: 0.1 }, { item: 'vial_of_water', chance: 0.15, min: 1, max: 2 }],
  zombie: [{ item: 'white_berries', chance: 0.12 }, { item: 'vial_of_water', chance: 0.12 }],
  dark_wizard: [{ item: 'eye_of_newt', chance: 0.3, min: 1, max: 3 }, { item: 'vial_of_water', chance: 0.2, min: 1, max: 2 }],
  skeleton: [{ item: 'vial_of_water', chance: 0.15, min: 1, max: 2 }],
  giant_spider: [{ item: 'snape_grass', chance: 0.18 }],
  hill_giant: [{ item: 'limpwurt_root', chance: 0.25, min: 1, max: 2 }],
  moss_giant: [{ item: 'white_berries', chance: 0.18 }, { item: 'vial_of_water', chance: 0.15, min: 1, max: 3 }],
  ghoul: [{ item: 'snape_grass', chance: 0.15 }],
  wight: [{ item: 'eye_of_newt', chance: 0.25, min: 1, max: 3 }, { item: 'vial_of_water', chance: 0.15, min: 1, max: 2 }],
  mummy: [{ item: 'wine_of_zamorak', chance: 0.12 }],
  infernal_mage: [{ item: 'eye_of_newt', chance: 0.25, min: 2, max: 4 }],
  fire_elemental: [{ item: 'wine_of_zamorak', chance: 0.12 }],
  salamander: [{ item: 'potato_cactus', chance: 0.15 }],
  dark_archer: [{ item: 'snape_grass', chance: 0.15 }],
  lesser_demon: [{ item: 'wine_of_zamorak', chance: 0.15 }],
  ice_beast: [{ item: 'white_berries', chance: 0.2, min: 1, max: 2 }],
  frost_giant: [{ item: 'limpwurt_root', chance: 0.2, min: 1, max: 3 }],
  freezing_wraith: [{ item: 'potato_cactus', chance: 0.15 }, { item: 'vial_of_water', chance: 0.2, min: 1, max: 3 }],
};

/** Ranged and magic supplies, appended to the drop tables above. */
const SUPPLY_DROPS: Record<string, Drop[]> = {
  goblin: [{ item: 'bronze_arrow', chance: 0.2, min: 5, max: 15 }, { item: 'shortbow', chance: 0.03 }, { item: 'wooden_buckler', chance: 0.03 }],
  zombie: [{ item: 'air_rune', chance: 0.25, min: 5, max: 15 }, { item: 'mind_rune', chance: 0.25, min: 5, max: 15 }],
  skeleton: [{ item: 'iron_arrow', chance: 0.2, min: 5, max: 15 }],
  dark_wizard: [
    { item: 'air_rune', chance: 0.5, min: 8, max: 20 }, { item: 'mind_rune', chance: 0.5, min: 8, max: 20 },
    { item: 'water_rune', chance: 0.25, min: 5, max: 15 }, { item: 'earth_rune', chance: 0.25, min: 5, max: 15 },
    { item: 'staff', chance: 0.06 }, { item: 'wizard_robe', chance: 0.05 },
    { item: 'sapphire_orb', chance: 0.04 }, { item: 'apprentice_tome', chance: 0.03 },
  ],
  skeleton_archer: [
    { item: 'iron_arrow', chance: 0.5, min: 10, max: 30 }, { item: 'oak_shortbow', chance: 0.05 },
    { item: 'leather_body', chance: 0.05 }, { item: 'oak_buckler', chance: 0.04 }, { item: 'leather_buckler', chance: 0.03 },
  ],
  hill_giant: [{ item: 'steel_arrow', chance: 0.15, min: 5, max: 15 }, { item: 'chaos_rune', chance: 0.12, min: 3, max: 8 }],
  giant_spider: [{ item: 'fire_rune', chance: 0.2, min: 10, max: 25 }],
  moss_giant: [
    { item: 'mithril_arrow', chance: 0.15, min: 5, max: 20 }, { item: 'chaos_rune', chance: 0.2, min: 5, max: 12 },
    { item: 'willow_shortbow', chance: 0.04 },
  ],
  infernal_mage: [
    { item: 'chaos_rune', chance: 0.45, min: 8, max: 20 }, { item: 'fire_rune', chance: 0.45, min: 15, max: 40 },
    { item: 'death_rune', chance: 0.12, min: 2, max: 6 }, { item: 'staff_of_fire', chance: 0.05 },
    { item: 'mystic_robe_top', chance: 0.03 }, { item: 'ruby_orb', chance: 0.03 }, { item: 'mages_book', chance: 0.015 },
  ],
  dark_archer: [
    { item: 'adamant_arrow', chance: 0.45, min: 10, max: 30 }, { item: 'maple_shortbow', chance: 0.05 },
    { item: 'yew_shortbow', chance: 0.02 }, { item: 'green_dhide_body', chance: 0.03 },
    { item: 'maple_buckler', chance: 0.04 }, { item: 'studded_buckler', chance: 0.03 }, { item: 'dhide_buckler', chance: 0.01 },
  ],
  lesser_demon: [{ item: 'death_rune', chance: 0.2, min: 3, max: 8 }, { item: 'rune_arrow', chance: 0.1, min: 5, max: 15 }],
  greater_demon: [{ item: 'death_rune', chance: 0.3, min: 5, max: 12 }, { item: 'mystic_fire_staff', chance: 0.02 }, { item: 'arcane_tome', chance: 0.01 }],
  demonic_gorilla: [{ item: 'dragon_scimitar', chance: 0.1 }],
  goblin_warlord: [{ item: 'willow_shortbow', chance: 0.25 }, { item: 'iron_arrow', chance: 1, min: 40, max: 80 }, { item: 'staff_of_water', chance: 0.25 }],
  tztok_jad: [{ item: 'mystic_air_staff', chance: 0.25 }, { item: 'chaos_rune', chance: 1, min: 30, max: 60 }, { item: 'maple_shortbow', chance: 0.25 }],
  chaos_elemental: [{ item: 'death_rune', chance: 1, min: 20, max: 40 }, { item: 'yew_shortbow', chance: 0.25 }, { item: 'mystic_robe_top', chance: 0.25 }],
};



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

  // ---- Themed floors: Crypt (6-10), Volcanic depths (11-15), Frozen caverns (16-20) ----
  {
    id: 'ghoul', name: 'Ghoul', color: 0x8a9a6a, attack: 20, strength: 22, defence: 16, hitpoints: 26,
    attackBonus: 10, strengthBonus: 8, defenceBonus: 8, attackSpeed: 4, aggroRadius: 5,
    minDepth: 6, maxDepth: 10, weight: 5, examine: 'It reeks of the grave.',
    drops: [
      { item: 'big_bones', chance: 1 }, { item: 'coins', chance: 0.4, min: 20, max: 80 },
      { item: 'trout', chance: 0.25 }, { item: 'mithril_platebody', chance: 0.03 },
    ],
  },
  {
    id: 'wight', name: 'Wight', color: 0x6a7a8a, attack: 24, strength: 22, defence: 20, hitpoints: 28,
    attackBonus: 20, strengthBonus: 16, defenceBonus: 10, attackSpeed: 5, aggroRadius: 5,
    attackStyle: 'magic', attackRange: 6,
    minDepth: 6, maxDepth: 10, weight: 4, examine: 'A barrow-wight, crackling with dark magic.',
    drops: [
      { item: 'bones', chance: 1 }, { item: 'chaos_rune', chance: 0.4, min: 5, max: 15 },
      { item: 'prayer_potion', chance: 0.1 }, { item: 'staff_of_earth', chance: 0.04 },
    ],
  },
  {
    id: 'mummy', name: 'Mummy', color: 0xc8b890, attack: 22, strength: 26, defence: 26, hitpoints: 34,
    attackBonus: 12, strengthBonus: 14, defenceBonus: 20, attackSpeed: 6, aggroRadius: 4,
    minDepth: 7, maxDepth: 10, weight: 4, examine: 'Wrapped up tight, and very cross about it.',
    drops: [
      { item: 'coins', chance: 0.6, min: 40, max: 160 }, { item: 'lobster', chance: 0.25 },
      { item: 'mystic_robe_top', chance: 0.02 }, { item: 'mithril_scimitar', chance: 0.04 },
    ],
  },
  {
    id: 'hellhound', name: 'Hellhound', color: 0xa02a1a, attack: 40, strength: 42, defence: 30, hitpoints: 45,
    attackBonus: 30, strengthBonus: 28, defenceBonus: 20, attackSpeed: 4, aggroRadius: 6,
    minDepth: 11, maxDepth: 15, weight: 5, examine: 'Hello, nice doggy...',
    drops: [
      { item: 'bones', chance: 1 }, { item: 'coins', chance: 0.5, min: 60, max: 200 },
      { item: 'lobster', chance: 0.2 }, { item: 'adamant_platebody', chance: 0.03 }, { item: 'rune_scimitar', chance: 0.01 },
    ],
  },
  {
    id: 'fire_elemental', name: 'Fire elemental', color: 0xff6020, attack: 38, strength: 36, defence: 30, hitpoints: 40,
    attackBonus: 35, strengthBonus: 30, defenceBonus: 15, attackSpeed: 5, aggroRadius: 6,
    attackStyle: 'magic', attackRange: 7,
    minDepth: 11, maxDepth: 15, weight: 4, examine: 'A living blaze.',
    drops: [
      { item: 'fire_rune', chance: 0.7, min: 30, max: 80 }, { item: 'death_rune', chance: 0.15, min: 3, max: 8 },
      { item: 'mystic_fire_staff', chance: 0.015 },
    ],
  },
  {
    id: 'salamander', name: 'Salamander', color: 0xd08020, attack: 42, strength: 40, defence: 36, hitpoints: 48,
    attackBonus: 35, strengthBonus: 30, defenceBonus: 25, attackSpeed: 5, aggroRadius: 6,
    attackStyle: 'ranged', attackRange: 6,
    minDepth: 12, maxDepth: 15, weight: 4, examine: 'It spits molten rock.',
    drops: [
      { item: 'coins', chance: 0.5, min: 60, max: 200 }, { item: 'swordfish', chance: 0.15 },
      { item: 'adamant_arrow', chance: 0.4, min: 10, max: 30 }, { item: 'maple_shortbow', chance: 0.04 },
    ],
  },
  {
    id: 'ice_beast', name: 'Ice beast', color: 0x90d0ff, attack: 60, strength: 60, defence: 55, hitpoints: 64,
    attackBonus: 45, strengthBonus: 45, defenceBonus: 40, attackSpeed: 4, aggroRadius: 6,
    minDepth: 16, maxDepth: 20, weight: 5, examine: 'Its breath freezes the air.',
    drops: [
      { item: 'big_bones', chance: 1 }, { item: 'coins', chance: 0.5, min: 100, max: 300 },
      { item: 'swordfish', chance: 0.2 }, { item: 'rune_platebody', chance: 0.02 },
    ],
  },
  {
    id: 'frost_giant', name: 'Frost giant', color: 0xa0c0e0, attack: 66, strength: 70, defence: 62, hitpoints: 80,
    attackBonus: 50, strengthBonus: 55, defenceBonus: 45, attackSpeed: 6, aggroRadius: 5,
    minDepth: 16, maxDepth: 20, weight: 4, examine: 'An enormous giant of living ice.',
    drops: [
      { item: 'big_bones', chance: 1 }, { item: 'coins', chance: 0.6, min: 150, max: 400 },
      { item: 'rune_kiteshield', chance: 0.03 }, { item: 'dragon_scimitar', chance: 0.008 },
    ],
  },
  {
    id: 'freezing_wraith', name: 'Freezing wraith', color: 0xc0e8ff, attack: 64, strength: 62, defence: 50, hitpoints: 60,
    attackBonus: 55, strengthBonus: 50, defenceBonus: 30, attackSpeed: 5, aggroRadius: 6,
    attackStyle: 'magic', attackRange: 7,
    minDepth: 16, maxDepth: 20, weight: 4, examine: 'A shrieking spirit of frost.',
    drops: [
      { item: 'death_rune', chance: 0.4, min: 5, max: 15 }, { item: 'prayer_potion', chance: 0.15 },
      { item: 'mystic_air_staff', chance: 0.02 },
    ],
  },

  // ---- Bosses (one every 5 floors; never in the random pool) ----
  // ---- The Abyss (floor 21+): stats here are for floor 21; deeper floors scale them up. ----
  {
    id: 'abyssal_fiend', name: 'Abyssal fiend', color: 0x8a2a4a, attack: 74, strength: 80, defence: 66, hitpoints: 95,
    attackBonus: 60, strengthBonus: 65, defenceBonus: 50, attackSpeed: 4, aggroRadius: 6,
    minDepth: 21, maxDepth: 999, weight: 4, examine: 'It came from somewhere below the bottom.',
    drops: [
      { item: 'big_bones', chance: 1 }, { item: 'coins', chance: 0.6, min: 200, max: 500 },
      { item: 'rune_platebody', chance: 0.02 }, { item: 'dragon_scimitar', chance: 0.01 },
    ],
  },
  {
    id: 'shadow_reaper', name: 'Shadow reaper', color: 0x3a3a4a, attack: 72, strength: 70, defence: 56, hitpoints: 78,
    attackBonus: 65, strengthBonus: 55, defenceBonus: 35, attackSpeed: 5, aggroRadius: 6, attackStyle: 'magic', attackRange: 7,
    minDepth: 21, maxDepth: 999, weight: 3, examine: 'Where it passes, the light forgets to come back.',
    drops: [
      { item: 'death_rune', chance: 0.5, min: 10, max: 25 }, { item: 'blood_rune', chance: 0.25, min: 5, max: 15 }, { item: 'prayer_potion', chance: 0.2 },
      { item: 'coins', chance: 0.5, min: 150, max: 400 },
    ],
  },
  {
    id: 'soul_eater', name: 'Soul eater', color: 0x5a6a3a, attack: 70, strength: 68, defence: 58, hitpoints: 82,
    attackBonus: 60, strengthBonus: 55, defenceBonus: 40, attackSpeed: 5, aggroRadius: 7, attackStyle: 'ranged', attackRange: 6,
    minDepth: 21, maxDepth: 999, weight: 3, examine: 'It spits something you would rather not think about.',
    drops: [
      { item: 'rune_arrow', chance: 0.3, min: 10, max: 30 }, { item: 'coins', chance: 0.5, min: 150, max: 400 },
      { item: 'swordfish', chance: 0.2 },
    ],
  },
  {
    id: 'tormentor', name: 'Tormentor', color: 0x7a3a2a, attack: 76, strength: 82, defence: 76, hitpoints: 130,
    attackBonus: 55, strengthBonus: 70, defenceBonus: 65, attackSpeed: 6, aggroRadius: 5,
    minDepth: 21, maxDepth: 999, weight: 2, examine: 'Covered in hooks. It enjoys its work.',
    drops: [
      { item: 'big_bones', chance: 1, min: 2, max: 2 }, { item: 'coins', chance: 0.7, min: 300, max: 700 },
      { item: 'rune_bar', chance: 0.1 },
    ],
  },
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
  {
    id: 'lich', name: 'The Lich', color: 0x6a5a9a, attack: 88, strength: 85, defence: 72, hitpoints: 210,
    attackBonus: 100, strengthBonus: 140, defenceBonus: 80, attackSpeed: 5, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'It traded its life for power. It does not intend to give either back.',
    boss: { styles: ['magic', 'melee'], switchEvery: 2, floor: 25 },
    drops: [
      { item: 'big_bones', chance: 1, min: 3, max: 4 },
      { item: 'coins', chance: 1, min: 1500, max: 3500 },
      { item: 'prayer_potion', chance: 1, min: 4, max: 6 },
      { item: 'swordfish', chance: 1, min: 4, max: 6 },
      { item: 'death_rune', chance: 1, min: 40, max: 80 },
      { item: 'blood_rune', chance: 1, min: 25, max: 50 },
      { item: 'staff_of_the_dead', chance: 0.12 },
    ],
  },
  {
    id: 'ancient_wyrm', name: 'Ancient Wyrm', color: 0x2a2a3a, attack: 100, strength: 100, defence: 86, hitpoints: 260,
    attackBonus: 110, strengthBonus: 160, defenceBonus: 95, attackSpeed: 5, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'The oldest thing in the dungeon. Its scales are older than the stone.',
    boss: { styles: ['melee', 'ranged', 'magic'], switchEvery: 2, floor: 30 },
    drops: [
      { item: 'big_bones', chance: 1, min: 4, max: 5 },
      { item: 'coins', chance: 1, min: 2000, max: 5000 },
      { item: 'prayer_potion', chance: 1, min: 4, max: 6 },
      { item: 'swordfish', chance: 1, min: 5, max: 7 },
      { item: 'rune_bar', chance: 1, min: 2, max: 4 },
      { item: 'dragon_arrow', chance: 0.6, min: 30, max: 60 },
      { item: 'wyrmhide_body', chance: 0.12 },
    ],
  },
  {
    id: 'hollow_king', name: 'The Hollow King', color: 0x5a4a6a, attack: 112, strength: 112, defence: 96, hitpoints: 300,
    attackBonus: 120, strengthBonus: 170, defenceBonus: 105, attackSpeed: 5, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'A crown with nothing beneath it, and it still rules.',
    boss: { styles: ['melee', 'magic'], switchEvery: 3, floor: 35 },
    drops: [
      { item: 'big_bones', chance: 1, min: 4, max: 6 },
      { item: 'coins', chance: 1, min: 3000, max: 6000 },
      { item: 'prayer_potion', chance: 1, min: 5, max: 7 },
      { item: 'shark', chance: 1, min: 4, max: 6 },
      { item: 'blood_rune', chance: 1, min: 30, max: 60 },
      { item: 'hollow_crown', chance: 0.1 },
    ],
  },
  {
    id: 'void_titan', name: 'Void Titan', color: 0x1a1a2a, attack: 125, strength: 125, defence: 108, hitpoints: 360,
    attackBonus: 130, strengthBonus: 185, defenceBonus: 115, attackSpeed: 6, aggroRadius: 9, attackRange: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'Where it stands, the world is thinner.',
    boss: { styles: ['melee', 'ranged', 'magic'], switchEvery: 3, floor: 40 },
    drops: [
      { item: 'big_bones', chance: 1, min: 5, max: 6 },
      { item: 'coins', chance: 1, min: 4000, max: 8000 },
      { item: 'prayer_potion', chance: 1, min: 5, max: 7 },
      { item: 'shark', chance: 1, min: 5, max: 7 },
      { item: 'dragon_bar', chance: 1, min: 1, max: 3 },
      { item: 'void_blade', chance: 0.1 },
    ],
  },
];

for (const n of list) {
  n.weakness = WEAKNESSES[n.id];
  n.drops.push(...(SUPPLY_DROPS[n.id] ?? []), ...(HERBLORE_DROPS[n.id] ?? []));
}

/** Chests on floor 3+ are sometimes Mimics. */
export const MIMIC_CHANCE = 0.1;

/** A Mimic scaled to the floor it ambushes you on. */
export function mimicFor(depth: number): NpcDef {
  return {
    id: 'mimic', name: 'Mimic', color: 0xb04040,
    attack: 4 + depth * 4, strength: 4 + depth * 4, defence: 2 + depth * 3, hitpoints: 10 + depth * 4,
    attackBonus: depth * 2, strengthBonus: depth * 2, defenceBonus: depth * 2, attackSpeed: 4, aggroRadius: 8,
    minDepth: 0, maxDepth: -1, weight: 0, examine: 'That was no chest!', weakness: 'magic',
    drops: [
      { item: 'coins', chance: 1, min: 50 * depth, max: 100 * depth },
      { item: 'prayer_potion', chance: 1 },
      { item: gearForDepth(depth), chance: 0.6 },
    ],
  };
}

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

/** Floor where the regular monster roster ends; deeper floors reuse its last band, scaled up. */
export const DEEP_FLOOR = 20;
/** Regular monsters past DEEP_FLOOR get 4% stronger per floor (bosses scale on their own). */
export const DEEP_SCALE_PER_FLOOR = 0.04;

export function npcsForDepth(depth: number): NpcDef[] {
  const pool = list.filter((n) => !n.boss && n.weight > 0 && depth >= n.minDepth && depth <= n.maxDepth);
  if (depth <= DEEP_FLOOR) return pool;
  // The endless deep: the Abyss roster, ever stronger.
  const scale = 1 + DEEP_SCALE_PER_FLOOR * (depth - DEEP_FLOOR);
  const s = (v: number) => Math.round(v * scale);
  return pool.map((n) => ({ ...n, attack: s(n.attack), strength: s(n.strength), defence: s(n.defence), hitpoints: s(n.hitpoints) }));
}
