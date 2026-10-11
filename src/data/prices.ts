/** Coin values for buying from (and selling to) the wandering merchant. */

const METAL_VALUE: Record<string, number> = { bronze: 30, iron: 80, steel: 200, mithril: 500, adamant: 1200, rune: 3000 };
const KIND_FACTOR: Record<string, number> = { dagger: 0.6, sword: 0.8, scimitar: 1, kiteshield: 1.5, platebody: 2.5 };
const ARROW_VALUE: Record<string, number> = { bronze: 1, iron: 2, steel: 4, mithril: 8, adamant: 15, rune: 40 };

const FIXED: Record<string, number> = {
  shrimps: 5, trout: 15, lobster: 40, swordfish: 70, prayer_potion: 120,
  raw_shrimps: 2, raw_trout: 6, raw_lobster: 18, raw_swordfish: 30,
  bones: 2, big_bones: 8, logs: 3, oak_logs: 6, willow_logs: 12, maple_logs: 25, yew_logs: 60,
  copper_ore: 4, tin_ore: 4, iron_ore: 10, coal: 15, mithril_ore: 40, adamantite_ore: 80, runite_ore: 300,
  bronze_bar: 12, iron_bar: 30, steel_bar: 70, mithril_bar: 180, adamant_bar: 450, rune_bar: 1200,
  air_rune: 2, water_rune: 2, earth_rune: 2, fire_rune: 2, mind_rune: 3, chaos_rune: 10, death_rune: 25,
  shortbow: 50, oak_shortbow: 120, willow_shortbow: 300, maple_shortbow: 700, yew_shortbow: 1800,
  staff: 100, staff_of_air: 400, staff_of_water: 400, staff_of_earth: 400, staff_of_fire: 400,
  mystic_air_staff: 3000, mystic_fire_staff: 3000,
  wizard_robe: 60, mystic_robe_top: 2500, leather_body: 40, green_dhide_body: 2000, wooden_shield: 10,
};

/** Full (buy) price of one item; 0 = worthless. */
export function priceOf(id: string): number {
  if (id in FIXED) return FIXED[id];
  const [metal, ...rest] = id.split('_');
  const kind = rest.join('_');
  if (kind === 'arrow') return ARROW_VALUE[metal] ?? 0;
  if (METAL_VALUE[metal] && KIND_FACTOR[kind]) return Math.round(METAL_VALUE[metal] * KIND_FACTOR[kind]);
  return 0;
}

/** Merchants buy at 40% of value, OSRS general-store style. */
export function sellPriceOf(id: string): number {
  return Math.floor(priceOf(id) * 0.4);
}
