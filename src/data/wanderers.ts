/**
 * Wandering adventurers: now and then someone on a floor wants a few supplies and pays well
 * for them. It's a choice: keep the food for yourself, or trade it for something better.
 */

export interface WandererRequest {
  /** Any of these items count (e.g. any cooked fish). */
  items: string[];
  qty: number;
  what: string;
}

export type WandererReward = 'relic' | 'tokens' | 'coins';

export interface WandererDeal {
  request: WandererRequest;
  reward: WandererReward;
}

export const WANDERER_CHANCE = 0.12;
export const WANDERER_MIN_DEPTH = 2;

const FISH = ['shrimps', 'trout', 'lobster', 'swordfish'];
const BARS = ['bronze_bar', 'iron_bar', 'steel_bar', 'mithril_bar', 'adamant_bar', 'rune_bar'];
const LOGS = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs'];
const HERBS = ['guam_leaf', 'tarromin', 'harralander', 'ranarr_weed', 'irit_leaf', 'kwuarm', 'cadantine', 'dwarf_weed', 'lantadyme'];

export const WANDERER_REQUESTS: WandererRequest[] = [
  { items: FISH, qty: 3, what: 'cooked fish' },
  { items: BARS, qty: 2, what: 'metal bars' },
  { items: LOGS, qty: 5, what: 'logs' },
  { items: HERBS, qty: 2, what: 'herbs' },
  { items: ['bones', 'big_bones'], qty: 6, what: 'bones' },
];

export const REWARD_TEXT: Record<WandererReward, string> = {
  relic: 'a relic of your choice',
  tokens: 'a pouch of Dungeoneering tokens',
  coins: 'a heavy purse of coins',
};

export function rollDeal(rand: () => number): WandererDeal {
  const request = WANDERER_REQUESTS[Math.floor(rand() * WANDERER_REQUESTS.length)];
  const r = rand();
  return { request, reward: r < 0.3 ? 'relic' : r < 0.65 ? 'tokens' : 'coins' };
}
