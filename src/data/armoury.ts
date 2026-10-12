/**
 * The Armourer at camp: permanent starting-gear upgrades bought with tokens.
 * Gear above your level starts in your pack until you can wield it.
 */

export type ArmouryLine = 'melee' | 'ranged' | 'magic' | 'body' | 'ranged_body' | 'magic_body' | 'shield';
export type StartStyle = 'melee' | 'ranged' | 'magic';

export interface ArmouryTier {
  /** Short label for the shop, e.g. "Mithril scimitar". */
  label: string;
  cost: number;
  /** Only sold once you've defeated this boss. */
  requiresKill?: string;
  /** What you start each run with. The first item is the wearable piece. */
  items: Array<{ id: string; qty: number }>;
}

const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const metalLine = (thing: string, costs: number[]): ArmouryTier[] => METALS.map((m, i) => ({
  label: `${cap(m)} ${thing}`, cost: costs[i], items: [{ id: `${m}_${thing}`, qty: 1 }],
}));

export const ARMOURY: Record<ArmouryLine, { name: string; tiers: ArmouryTier[] }> = {
  melee: { name: 'Melee weapon', tiers: metalLine('scimitar', [20, 50, 100, 200, 400, 800]) },
  ranged: {
    name: 'Ranged weapon',
    tiers: [
      { label: 'Shortbow + bronze arrows', cost: 20, items: [{ id: 'shortbow', qty: 1 }, { id: 'bronze_arrow', qty: 200 }] },
      { label: 'Oak shortbow + iron arrows', cost: 60, items: [{ id: 'oak_shortbow', qty: 1 }, { id: 'iron_arrow', qty: 200 }] },
      { label: 'Willow shortbow + steel arrows', cost: 150, items: [{ id: 'willow_shortbow', qty: 1 }, { id: 'steel_arrow', qty: 200 }] },
      { label: 'Maple shortbow + mithril arrows', cost: 350, items: [{ id: 'maple_shortbow', qty: 1 }, { id: 'mithril_arrow', qty: 200 }] },
      { label: 'Yew shortbow + adamant arrows', cost: 700, items: [{ id: 'yew_shortbow', qty: 1 }, { id: 'adamant_arrow', qty: 200 }] },
    ],
  },
  magic: {
    name: 'Magic weapon',
    tiers: [
      { label: 'Staff of air + mind runes', cost: 25, items: [{ id: 'staff_of_air', qty: 1 }, { id: 'mind_rune', qty: 200 }] },
      { label: 'Staff of fire + air & mind runes', cost: 80, items: [{ id: 'staff_of_fire', qty: 1 }, { id: 'air_rune', qty: 300 }, { id: 'mind_rune', qty: 200 }] },
      { label: 'Mystic air staff + chaos runes', cost: 300, items: [{ id: 'mystic_air_staff', qty: 1 }, { id: 'chaos_rune', qty: 150 }, { id: 'mind_rune', qty: 150 }] },
      { label: 'Mystic fire staff + death runes', cost: 700, items: [{ id: 'mystic_fire_staff', qty: 1 }, { id: 'air_rune', qty: 400 }, { id: 'death_rune', qty: 100 }, { id: 'chaos_rune', qty: 100 }] },
    ],
  },
  body: { name: 'Melee armour', tiers: metalLine('platebody', [20, 50, 100, 200, 400, 800]) },
  ranged_body: {
    name: 'Ranged armour',
    tiers: [
      { label: 'Leather body', cost: 20, items: [{ id: 'leather_body', qty: 1 }] },
      { label: 'Hardleather body', cost: 50, items: [{ id: 'hardleather_body', qty: 1 }] },
      { label: 'Studded body', cost: 120, items: [{ id: 'studded_body', qty: 1 }] },
      { label: "Green d'hide body", cost: 300, items: [{ id: 'green_dhide_body', qty: 1 }] },
      { label: "Blue d'hide body", cost: 600, items: [{ id: 'blue_dhide_body', qty: 1 }] },
    ],
  },
  magic_body: {
    name: 'Magic armour',
    tiers: [
      { label: 'Wizard robe', cost: 20, items: [{ id: 'wizard_robe', qty: 1 }] },
      { label: 'Splitbark body', cost: 60, items: [{ id: 'splitbark_body', qty: 1 }] },
      { label: 'Mystic robe top', cost: 150, items: [{ id: 'mystic_robe_top', qty: 1 }] },
      { label: 'Infinity top', cost: 350, items: [{ id: 'infinity_top', qty: 1 }] },
      { label: "Ahrim's robetop", cost: 700, items: [{ id: 'ahrims_robetop', qty: 1 }] },
    ],
  },
  shield: { name: 'Shield', tiers: metalLine('kiteshield', [15, 40, 80, 160, 320, 640]) },
};

/** The late-game tier for every line, sold after your first Ancient Wyrm kill. */
const WYRM = 'ancient_wyrm';
const LATE: Record<ArmouryLine, ArmouryTier> = {
  melee: { label: 'Dragon scimitar', cost: 2500, requiresKill: WYRM, items: [{ id: 'dragon_scimitar', qty: 1 }] },
  ranged: { label: 'Dark bow + rune arrows', cost: 2500, requiresKill: WYRM, items: [{ id: 'dark_bow', qty: 1 }, { id: 'rune_arrow', qty: 200 }] },
  magic: { label: 'Staff of light + death runes', cost: 2500, requiresKill: WYRM, items: [{ id: 'staff_of_light', qty: 1 }, { id: 'air_rune', qty: 400 }, { id: 'death_rune', qty: 150 }, { id: 'chaos_rune', qty: 150 }] },
  body: { label: 'Dragon platebody', cost: 3000, requiresKill: WYRM, items: [{ id: 'dragon_platebody', qty: 1 }] },
  ranged_body: { label: "Black d'hide body", cost: 2500, requiresKill: WYRM, items: [{ id: 'black_dhide_body', qty: 1 }] },
  magic_body: { label: 'Ancestral robe top', cost: 3000, requiresKill: WYRM, items: [{ id: 'ancestral_top', qty: 1 }] },
  shield: { label: 'Dragon kiteshield', cost: 2000, requiresKill: WYRM, items: [{ id: 'dragon_kiteshield', qty: 1 }] },
};
for (const line of Object.keys(LATE) as ArmouryLine[]) ARMOURY[line].tiers.push(LATE[line]);

export const ARMOURY_LINES = Object.keys(ARMOURY) as ArmouryLine[];

export type ArmouryRanks = Record<ArmouryLine, number>;

export const NO_ARMOURY: ArmouryRanks = { melee: 0, ranged: 0, magic: 0, body: 0, ranged_body: 0, magic_body: 0, shield: 0 };

/** The armour line that suits each starting style (worn first if you can). */
export const STYLE_ARMOUR: Record<StartStyle, ArmouryLine> = { melee: 'body', ranged: 'ranged_body', magic: 'magic_body' };

/** The next tier to buy in a line, or null when it's maxed. */
export function nextArmouryTier(ranks: ArmouryRanks, line: ArmouryLine): ArmouryTier | null {
  return ARMOURY[line].tiers[ranks[line]] ?? null;
}

/** Everything your Armoury purchases give at the start of a run. */
export function armouryKit(ranks: ArmouryRanks): Array<{ line: ArmouryLine; id: string; qty: number }> {
  return ARMOURY_LINES.flatMap((line) => {
    const tier = ranks[line] > 0 ? ARMOURY[line].tiers[ranks[line] - 1] : null;
    return tier ? tier.items.map((i) => ({ line, ...i })) : [];
  });
}
