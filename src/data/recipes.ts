import { SkillName } from './skills';

/**
 * 'mix' (Herblore) and 'fletch' (Fletching, needs a knife) recipes are made straight
 * from the inventory, no station needed.
 */
export type Station = 'fire' | 'furnace' | 'anvil' | 'mix' | 'fletch' | 'craft';

export interface Recipe {
  id: string;
  station: Station;
  skill: SkillName;
  level: number;
  xp: number;
  inputs: { item: string; qty: number }[];
  output: string;
  /** How many you make at once (default 1). */
  outputQty?: number;
  /** Cooking only: level at which you stop burning it. */
  stopBurn?: number;
}

const cook = (raw: string, cooked: string, level: number, xp: number, stopBurn: number): Recipe => ({
  id: `cook_${cooked}`, station: 'fire', skill: 'cooking', level, xp, inputs: [{ item: raw, qty: 1 }], output: cooked, stopBurn,
});

/** Herb + secondary + vial of water -> potion. */
const mix = (output: string, level: number, xp: number, herb: string, secondary: string): Recipe => ({
  id: `mix_${output}`, station: 'mix', skill: 'herblore', level, xp, output,
  inputs: [{ item: herb, qty: 1 }, { item: secondary, qty: 1 }, { item: 'vial_of_water', qty: 1 }],
});

const smelt = (metal: string, level: number, xp: number, ore: string, coal: number, extra?: string): Recipe => ({
  id: `smelt_${metal}`, station: 'furnace', skill: 'smithing', level, xp, output: `${metal}_bar`,
  inputs: [{ item: ore, qty: 1 }, ...(extra ? [{ item: extra, qty: 1 }] : []), ...(coal ? [{ item: 'coal', qty: coal }] : [])],
});

/** Gem -> amulet (needs a chisel). */
const craft = (gem: string, output: string, level: number, xp: number): Recipe => ({
  id: `craft_${output}`, station: 'craft', skill: 'crafting', level, xp, output, inputs: [{ item: gem, qty: 1 }],
});

/** Logs -> shortbow. Logs are scarce down here, so a bow pays about what chopping the log did. */
const bow = (logs: string, output: string, level: number, xp: number): Recipe => ({
  id: `fletch_${output}`, station: 'fletch', skill: 'fletching', level, xp, output, inputs: [{ item: logs, qty: 1 }],
});

/** Two logs -> a wooden buckler (ranged off-hand). */
const buckler = (logs: string, output: string, level: number, xp: number): Recipe => ({
  id: `fletch_${output}`, station: 'fletch', skill: 'fletching', level, xp, output, inputs: [{ item: logs, qty: 2 }],
});

/** 15 smithed arrowtips plus logs for the shafts -> 15 arrows. */
const arrows = (metal: string, logs: string, level: number, xpEach: number): Recipe => ({
  id: `fletch_${metal}_arrow`, station: 'fletch', skill: 'fletching', level, xp: xpEach * 15, output: `${metal}_arrow`, outputQty: 15,
  inputs: [{ item: `${metal}_arrowtips`, qty: 15 }, { item: logs, qty: 1 }],
});

/**
 * [metal, base smithing level, xp per bar]. Ore is scarce in the dungeon, so smelting a bar
 * and smithing it pay about what mining its ore did.
 */
const METALS: Array<[string, number, number]> = [
  ['bronze', 1, 20], ['iron', 10, 35], ['steel', 20, 50], ['mithril', 30, 80], ['adamant', 40, 100], ['rune', 50, 125],
  ['dragon', 70, 160],
];
/** [item suffix, bars, level offset]. No dragon dagger: that one is a rare special weapon. */
const SMITHABLES: Array<[string, number, number]> = [['dagger', 1, 0], ['scimitar', 2, 0], ['kiteshield', 3, 2], ['platebody', 5, 5]];

export const RECIPES: Recipe[] = [
  cook('raw_shrimps', 'shrimps', 1, 30, 20),
  cook('raw_trout', 'trout', 10, 70, 30),
  cook('raw_lobster', 'lobster', 25, 120, 45),
  cook('raw_swordfish', 'swordfish', 30, 140, 55),
  cook('raw_shark', 'shark', 50, 210, 75),
  cook('raw_manta_ray', 'manta_ray', 70, 216, 90),

  mix('attack_potion', 1, 25, 'guam_leaf', 'eye_of_newt'),
  mix('strength_potion', 5, 50, 'tarromin', 'limpwurt_root'),
  mix('defence_potion', 10, 75, 'harralander', 'white_berries'),
  mix('prayer_potion', 15, 87.5, 'ranarr_weed', 'snape_grass'),
  mix('super_attack', 20, 100, 'irit_leaf', 'eye_of_newt'),
  mix('super_strength', 25, 125, 'kwuarm', 'limpwurt_root'),
  mix('super_defence', 30, 150, 'cadantine', 'white_berries'),
  mix('ranging_potion', 30, 162.5, 'dwarf_weed', 'wine_of_zamorak'),
  mix('magic_potion', 35, 172.5, 'lantadyme', 'potato_cactus'),
  mix('super_ranging', 50, 200, 'snapdragon', 'wine_of_zamorak'),
  mix('super_magic', 55, 215, 'snapdragon', 'potato_cactus'),
  mix('super_combat', 70, 260, 'torstol', 'super_defence'),

  smelt('bronze', 1, 12.5, 'copper_ore', 0, 'tin_ore'),
  smelt('iron', 10, 25, 'iron_ore', 0),
  smelt('steel', 20, 35, 'iron_ore', 1),
  smelt('mithril', 30, 60, 'mithril_ore', 2),
  smelt('adamant', 40, 80, 'adamantite_ore', 3),
  smelt('rune', 50, 100, 'runite_ore', 4),
  smelt('dragon', 70, 130, 'dragonite_ore', 5),

  ...METALS.flatMap(([metal, base, xp]) => [
    { id: `smith_${metal}_arrowtips`, station: 'anvil', skill: 'smithing', level: base, xp, inputs: [{ item: `${metal}_bar`, qty: 1 }], output: `${metal}_arrowtips`, outputQty: 15 } as Recipe,
    ...SMITHABLES.filter(([thing]) => !(metal === 'dragon' && thing === 'dagger')).map(([thing, bars, offset]): Recipe => ({
      id: `smith_${metal}_${thing}`, station: 'anvil', skill: 'smithing', level: base + offset, xp: xp * bars,
      inputs: [{ item: `${metal}_bar`, qty: bars }], output: `${metal}_${thing}`,
    })),
  ]),

  craft('sapphire', 'amulet_of_magic', 1, 50),
  craft('emerald', 'amulet_of_accuracy', 20, 70),
  craft('ruby', 'amulet_of_strength', 40, 85),
  craft('diamond', 'amulet_of_power', 55, 100),
  craft('dragonstone', 'dragonstone_amulet', 70, 150),
  craft('sapphire', 'sapphire_orb', 1, 50),
  craft('emerald', 'emerald_orb', 20, 70),
  craft('ruby', 'ruby_orb', 40, 85),
  craft('diamond', 'diamond_orb', 55, 100),
  craft('dragonstone', 'dragonstone_orb', 70, 150),
  bow('logs', 'shortbow', 5, 25),
  bow('oak_logs', 'oak_shortbow', 20, 40),
  bow('willow_logs', 'willow_shortbow', 35, 70),
  bow('maple_logs', 'maple_shortbow', 50, 100),
  bow('yew_logs', 'yew_shortbow', 65, 160),
  bow('magic_logs', 'magic_shortbow', 80, 230),
  buckler('logs', 'wooden_buckler', 5, 50),
  buckler('oak_logs', 'oak_buckler', 20, 80),
  buckler('willow_logs', 'willow_buckler', 35, 140),
  buckler('maple_logs', 'maple_buckler', 50, 200),
  buckler('yew_logs', 'yew_buckler', 65, 320),
  buckler('magic_logs', 'magic_buckler', 80, 460),
  arrows('bronze', 'logs', 1, 2.5),
  arrows('iron', 'logs', 15, 4),
  arrows('steel', 'oak_logs', 30, 6),
  arrows('mithril', 'willow_logs', 45, 9),
  arrows('adamant', 'maple_logs', 60, 12),
  arrows('rune', 'yew_logs', 75, 15),
  arrows('dragon', 'magic_logs', 90, 20),
];

export function recipesFor(station: Station): Recipe[] {
  return RECIPES.filter((r) => r.station === station);
}
