/** Coin values for buying from (and selling to) the wandering merchant. */

const METAL_VALUE: Record<string, number> = { bronze: 30, iron: 80, steel: 200, mithril: 500, adamant: 1200, rune: 3000 };
const KIND_FACTOR: Record<string, number> = { dagger: 0.6, sword: 0.8, scimitar: 1, kiteshield: 1.5, platebody: 2.5 };
const ARROW_VALUE: Record<string, number> = { bronze: 1, iron: 2, steel: 4, mithril: 8, adamant: 15, rune: 40 };

const FIXED: Record<string, number> = {
  guam_leaf: 10, tarromin: 15, harralander: 20, ranarr_weed: 60, irit_leaf: 30, kwuarm: 40, cadantine: 50,
  dwarf_weed: 50, lantadyme: 60, eye_of_newt: 5, limpwurt_root: 10, white_berries: 12, snape_grass: 15,
  wine_of_zamorak: 40, potato_cactus: 35, vial_of_water: 3,
  attack_potion: 40, strength_potion: 60, defence_potion: 70, super_attack: 150, super_strength: 200,
  super_defence: 220, ranging_potion: 250, magic_potion: 260,
  shrimps: 5, trout: 15, lobster: 40, swordfish: 70, prayer_potion: 120,
  raw_shrimps: 2, raw_trout: 6, raw_lobster: 18, raw_swordfish: 30,
  bones: 2, big_bones: 8, logs: 3, oak_logs: 6, willow_logs: 12, maple_logs: 25, yew_logs: 60,
  copper_ore: 4, tin_ore: 4, iron_ore: 10, coal: 15, mithril_ore: 40, adamantite_ore: 80, runite_ore: 300,
  bronze_bar: 12, iron_bar: 30, steel_bar: 70, mithril_bar: 180, adamant_bar: 450, rune_bar: 1200,
  air_rune: 2, water_rune: 2, earth_rune: 2, fire_rune: 2, mind_rune: 3, chaos_rune: 10, death_rune: 25,
  shortbow: 50, oak_shortbow: 120, willow_shortbow: 300, maple_shortbow: 700, yew_shortbow: 1800,
  staff: 100, staff_of_air: 400, staff_of_water: 400, staff_of_earth: 400, staff_of_fire: 400,
  mystic_air_staff: 3000, mystic_fire_staff: 3000,
  dragon_dagger: 3000, granite_maul: 4000, magic_shortbow: 4000, ancient_staff: 4000, dragon_warhammer: 7000, dragon_claws: 9000,
  staff_of_the_dead: 15000, wyrmhide_body: 15000, dragon_platebody: 12000, dragon_kiteshield: 9000, dark_bow: 10000,
  staff_of_light: 10000, black_dhide_body: 9000, ancestral_top: 12000,
  dragon_scimitar: 6000, wizard_robe: 60, mystic_robe_top: 2500, leather_body: 40, green_dhide_body: 2000, wooden_shield: 10,
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
