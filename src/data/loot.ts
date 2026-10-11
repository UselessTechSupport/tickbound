import { RNG } from 'rot-js';
import { priceOf } from './prices';

/** What a floor's merchant sells: per-unit price, limited quantity. */
export interface StockEntry {
  id: string;
  qty: number;
  price: number;
}

const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune'];
const BOWS = ['shortbow', 'oak_shortbow', 'willow_shortbow', 'maple_shortbow', 'yew_shortbow'];

/** Metal tier that fits a depth: bronze on floor 1-2 up to rune from floor 15. */
export function metalForDepth(depth: number): string {
  return METALS[[3, 5, 8, 11, 15].filter((d) => depth >= d).length];
}

function bowForDepth(depth: number): string {
  return BOWS[[3, 6, 9, 13].filter((d) => depth >= d).length];
}

function foodForDepth(depth: number): string {
  return depth >= 9 ? 'swordfish' : depth >= 4 ? 'lobster' : 'trout';
}

/** A gear piece around the depth's tier, occasionally one tier better. */
export function gearForDepth(depth: number): string {
  const kind = RNG.getItem(['scimitar', 'platebody', 'kiteshield'])!;
  const tier = Math.min(METALS.length - 1, METALS.indexOf(metalForDepth(depth)) + (RNG.getUniform() < 0.3 ? 1 : 0));
  return `${METALS[tier]}_${kind}`;
}

export function generateStock(depth: number): StockEntry[] {
  const entry = (id: string, qty: number): StockEntry => ({ id, qty, price: priceOf(id) });
  const metal = metalForDepth(depth);
  const stock = [
    entry(foodForDepth(depth), 6),
    entry('prayer_potion', depth >= 8 ? 3 : 2),
    entry(`${metal}_arrow`, 150),
    entry('air_rune', 150),
    entry('fire_rune', 150),
    entry(depth >= 10 ? 'death_rune' : depth >= 5 ? 'chaos_rune' : 'mind_rune', depth >= 10 ? 40 : 100),
    entry(gearForDepth(depth), 1),
    entry(gearForDepth(depth), 1),
    entry(RNG.getUniform() < 0.5 ? bowForDepth(depth) : depth >= 8 ? 'staff_of_fire' : 'staff_of_air', 1),
    entry('vial_of_water', 25),
    entry(RNG.getItem(['eye_of_newt', 'limpwurt_root', 'white_berries', 'snape_grass'])!, 10),
  ];
  // Merge duplicates (two identical gear rolls).
  return stock.filter((s, i) => stock.findIndex((o) => o.id === s.id) === i);
}

/** Chance a chest gives a second bonus item. */
export const CHEST_SECOND_PICK = 0.4;

/** Coins in a chest on `depth`: [min, max]. */
export function chestCoins(depth: number): [number, number] {
  return [20 * depth, 50 * depth];
}

export interface ChestEntry {
  label: string;
  chance: number;
  qty: [number, number];
  /** The item this entry gives at a depth (gear rolls its kind and tier when looted). */
  item: (depth: number) => string;
}

/** Each bonus pick rolls once on this table; chances add up to 1. */
export const CHEST_TABLE: ChestEntry[] = [
  { label: 'Food', chance: 0.3, qty: [2, 3], item: foodForDepth },
  { label: 'Prayer potion', chance: 0.2, qty: [1, 1], item: () => 'prayer_potion' },
  { label: 'Arrows', chance: 0.15, qty: [20, 40], item: (d) => `${metalForDepth(d)}_arrow` },
  { label: 'Runes', chance: 0.15, qty: [8, 20], item: (d) => (d >= 10 ? 'death_rune' : 'chaos_rune') },
  { label: 'Armour or weapon', chance: 0.2, qty: [1, 1], item: gearForDepth },
];

/** Coins plus one or two depth-appropriate goodies, rolled from CHEST_TABLE. */
export function chestLoot(depth: number): Array<{ id: string; qty: number }> {
  const [lo, hi] = chestCoins(depth);
  const loot = [{ id: 'coins', qty: RNG.getUniformInt(lo, hi) }];
  const picks = RNG.getUniform() < CHEST_SECOND_PICK ? 2 : 1;
  for (let i = 0; i < picks; i++) {
    let roll = RNG.getUniform();
    const entry = CHEST_TABLE.find((e) => (roll -= e.chance) < 0) ?? CHEST_TABLE[CHEST_TABLE.length - 1];
    loot.push({ id: entry.item(depth), qty: RNG.getUniformInt(entry.qty[0], entry.qty[1]) });
  }
  return loot;
}
