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
  ];
  // Merge duplicates (two identical gear rolls).
  return stock.filter((s, i) => stock.findIndex((o) => o.id === s.id) === i);
}

/** Coins plus one or two depth-appropriate goodies. */
export function chestLoot(depth: number): Array<{ id: string; qty: number }> {
  const loot = [{ id: 'coins', qty: 20 * depth + RNG.getUniformInt(0, 30 * depth) }];
  const picks = RNG.getUniform() < 0.4 ? 2 : 1;
  for (let i = 0; i < picks; i++) {
    const roll = RNG.getUniform();
    if (roll < 0.3) loot.push({ id: foodForDepth(depth), qty: RNG.getUniformInt(2, 3) });
    else if (roll < 0.5) loot.push({ id: 'prayer_potion', qty: 1 });
    else if (roll < 0.65) loot.push({ id: `${metalForDepth(depth)}_arrow`, qty: RNG.getUniformInt(20, 40) });
    else if (roll < 0.8) loot.push({ id: depth >= 10 ? 'death_rune' : 'chaos_rune', qty: RNG.getUniformInt(8, 20) });
    else loot.push({ id: gearForDepth(depth), qty: 1 });
  }
  return loot;
}
