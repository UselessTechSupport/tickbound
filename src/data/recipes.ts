import { SkillName } from './skills';

/**
 * 'mix' (Herblore) and 'fletch' (Fletching, needs a knife) recipes are made straight
 * from the inventory, no station needed.
 */
export type Station = 'fire' | 'furnace' | 'anvil' | 'mix' | 'fletch';

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

/** Logs -> shortbow. */
const bow = (logs: string, output: string, level: number, xp: number): Recipe => ({
  id: `fletch_${output}`, station: 'fletch', skill: 'fletching', level, xp, output, inputs: [{ item: logs, qty: 1 }],
});

/** A bar for the arrowheads plus logs for the shafts -> 15 arrows. */
const arrows = (metal: string, logs: string, level: number, xpEach: number): Recipe => ({
  id: `fletch_${metal}_arrow`, station: 'fletch', skill: 'fletching', level, xp: xpEach * 15, output: `${metal}_arrow`, outputQty: 15,
  inputs: [{ item: `${metal}_bar`, qty: 1 }, { item: logs, qty: 1 }],
});

/** [metal, base smithing level, xp per bar] */
const METALS: Array<[string, number, number]> = [
  ['bronze', 1, 12.5], ['iron', 10, 25], ['steel', 20, 37.5], ['mithril', 30, 50], ['adamant', 40, 62.5], ['rune', 50, 75],
];
/** [item suffix, bars, level offset] */
const SMITHABLES: Array<[string, number, number]> = [['scimitar', 2, 0], ['kiteshield', 3, 2], ['platebody', 5, 5]];

export const RECIPES: Recipe[] = [
  cook('raw_shrimps', 'shrimps', 1, 30, 20),
  cook('raw_trout', 'trout', 10, 70, 30),
  cook('raw_lobster', 'lobster', 25, 120, 45),
  cook('raw_swordfish', 'swordfish', 30, 140, 55),

  mix('attack_potion', 1, 25, 'guam_leaf', 'eye_of_newt'),
  mix('strength_potion', 5, 50, 'tarromin', 'limpwurt_root'),
  mix('defence_potion', 10, 75, 'harralander', 'white_berries'),
  mix('prayer_potion', 15, 87.5, 'ranarr_weed', 'snape_grass'),
  mix('super_attack', 20, 100, 'irit_leaf', 'eye_of_newt'),
  mix('super_strength', 25, 125, 'kwuarm', 'limpwurt_root'),
  mix('super_defence', 30, 150, 'cadantine', 'white_berries'),
  mix('ranging_potion', 30, 162.5, 'dwarf_weed', 'wine_of_zamorak'),
  mix('magic_potion', 35, 172.5, 'lantadyme', 'potato_cactus'),

  smelt('bronze', 1, 6.25, 'copper_ore', 0, 'tin_ore'),
  smelt('iron', 10, 12.5, 'iron_ore', 0),
  smelt('steel', 20, 17.5, 'iron_ore', 1),
  smelt('mithril', 30, 30, 'mithril_ore', 2),
  smelt('adamant', 40, 37.5, 'adamantite_ore', 3),
  smelt('rune', 50, 50, 'runite_ore', 4),

  ...METALS.flatMap(([metal, base, xp]) => SMITHABLES.map(([thing, bars, offset]): Recipe => ({
    id: `smith_${metal}_${thing}`, station: 'anvil', skill: 'smithing', level: base + offset, xp: xp * bars,
    inputs: [{ item: `${metal}_bar`, qty: bars }], output: `${metal}_${thing}`,
  }))),

  bow('logs', 'shortbow', 5, 5),
  bow('oak_logs', 'oak_shortbow', 20, 16.5),
  bow('willow_logs', 'willow_shortbow', 35, 33.3),
  bow('maple_logs', 'maple_shortbow', 50, 50),
  bow('yew_logs', 'yew_shortbow', 65, 67.5),
  arrows('bronze', 'logs', 1, 1.3),
  arrows('iron', 'logs', 15, 2.5),
  arrows('steel', 'oak_logs', 30, 5),
  arrows('mithril', 'willow_logs', 45, 7.5),
  arrows('adamant', 'maple_logs', 60, 10),
  arrows('rune', 'yew_logs', 75, 12.5),
];

export function recipesFor(station: Station): Recipe[] {
  return RECIPES.filter((r) => r.station === station);
}
