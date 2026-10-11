import { SkillName } from './skills';

export type EquipSlot = 'weapon' | 'body' | 'shield';

export interface EquipStats {
  slot: EquipSlot;
  attackBonus: number;
  strengthBonus: number;
  defenceBonus: number;
  /** Weapon attack interval in ticks. */
  attackSpeed?: number;
  req?: { skill: SkillName; level: number };
}

export interface ItemDef {
  id: string;
  /** Ticks a fire lit from these logs burns for. */
  burnTicks?: number;
  name: string;
  color: number;
  examine: string;
  stackable?: boolean;
  heal?: number;
  restoresPrayer?: boolean;
  buryXp?: number;
  equip?: EquipStats;
}

const weapon = (attackBonus: number, strengthBonus: number, level: number): EquipStats => ({
  slot: 'weapon', attackBonus, strengthBonus, defenceBonus: 0, attackSpeed: 4,
  req: level > 1 ? { skill: 'attack', level } : undefined,
});
const body = (defenceBonus: number, level: number): EquipStats => ({
  slot: 'body', attackBonus: 0, strengthBonus: 0, defenceBonus,
  req: level > 1 ? { skill: 'defence', level } : undefined,
});

const shield = (defenceBonus: number, level: number): EquipStats => ({
  slot: 'shield', attackBonus: 0, strengthBonus: 0, defenceBonus,
  req: level > 1 ? { skill: 'defence', level } : undefined,
});

const BRONZE = 0x9c6b3c, IRON = 0x7d7d7d, STEEL = 0xa8a8b0, MITHRIL = 0x4a5a9c, ADAMANT = 0x4a7c4a, RUNE = 0x4fb3c4;

const list: ItemDef[] = [
  { id: 'coins', name: 'Coins', color: 0xe8c547, stackable: true, examine: 'Lovely money!' },
  { id: 'bones', name: 'Bones', color: 0xe8e2d0, buryXp: 4.5, examine: 'Bones are for burying!' },
  { id: 'big_bones', name: 'Big bones', color: 0xd8d0b0, buryXp: 15, examine: 'Ew, it\'s a pile of bones.' },
  { id: 'shrimps', name: 'Shrimps', color: 0xf08a6a, heal: 3, examine: 'Some nicely cooked shrimps.' },
  { id: 'trout', name: 'Trout', color: 0xc07a5a, heal: 7, examine: 'Some nicely cooked trout.' },
  { id: 'lobster', name: 'Lobster', color: 0xd04a2a, heal: 12, examine: 'This looks tricky to eat.' },
  { id: 'swordfish', name: 'Swordfish', color: 0x8090c0, heal: 14, examine: 'I\'d better be careful eating this!' },

  { id: 'bronze_dagger', name: 'Bronze dagger', color: BRONZE, equip: weapon(4, 3, 1), examine: 'Short but pointy.' },
  { id: 'bronze_sword', name: 'Bronze sword', color: BRONZE, equip: weapon(7, 6, 1), examine: 'A razor sharp sword.' },
  { id: 'bronze_scimitar', name: 'Bronze scimitar', color: BRONZE, equip: weapon(7, 6, 1), examine: 'A vicious, curved sword.' },
  { id: 'iron_scimitar', name: 'Iron scimitar', color: IRON, equip: weapon(10, 9, 1), examine: 'A vicious, curved sword.' },
  { id: 'steel_scimitar', name: 'Steel scimitar', color: STEEL, equip: weapon(15, 14, 5), examine: 'A vicious, curved sword.' },
  { id: 'mithril_scimitar', name: 'Mithril scimitar', color: MITHRIL, equip: weapon(21, 20, 20), examine: 'A vicious, curved sword.' },
  { id: 'adamant_scimitar', name: 'Adamant scimitar', color: ADAMANT, equip: weapon(29, 28, 30), examine: 'A vicious, curved sword.' },
  { id: 'rune_scimitar', name: 'Rune scimitar', color: RUNE, equip: weapon(45, 44, 40), examine: 'A vicious, curved sword.' },

  { id: 'bronze_platebody', name: 'Bronze platebody', color: BRONZE, equip: body(15, 1), examine: 'Provides excellent protection.' },
  { id: 'iron_platebody', name: 'Iron platebody', color: IRON, equip: body(21, 1), examine: 'Provides excellent protection.' },
  { id: 'steel_platebody', name: 'Steel platebody', color: STEEL, equip: body(32, 5), examine: 'Provides excellent protection.' },
  { id: 'mithril_platebody', name: 'Mithril platebody', color: MITHRIL, equip: body(46, 20), examine: 'Provides excellent protection.' },
  { id: 'adamant_platebody', name: 'Adamant platebody', color: ADAMANT, equip: body(65, 30), examine: 'Provides excellent protection.' },
  { id: 'rune_platebody', name: 'Rune platebody', color: RUNE, equip: body(82, 40), examine: 'Provides excellent protection.' },

  { id: 'bronze_kiteshield', name: 'Bronze kiteshield', color: BRONZE, equip: shield(8, 1), examine: 'A large metal shield.' },
  { id: 'iron_kiteshield', name: 'Iron kiteshield', color: IRON, equip: shield(11, 1), examine: 'A large metal shield.' },
  { id: 'steel_kiteshield', name: 'Steel kiteshield', color: STEEL, equip: shield(16, 5), examine: 'A large metal shield.' },
  { id: 'mithril_kiteshield', name: 'Mithril kiteshield', color: MITHRIL, equip: shield(22, 20), examine: 'A large metal shield.' },
  { id: 'adamant_kiteshield', name: 'Adamant kiteshield', color: ADAMANT, equip: shield(31, 30), examine: 'A large metal shield.' },
  { id: 'rune_kiteshield', name: 'Rune kiteshield', color: RUNE, equip: shield(44, 40), examine: 'A large metal shield.' },
  { id: 'wooden_shield', name: 'Wooden shield', color: 0x7a5230, equip: shield(5, 1), examine: 'A solid wooden shield.' },

  { id: 'prayer_potion', name: 'Prayer potion', color: 0x40c0b0, restoresPrayer: true, examine: 'A potion that restores prayer points.' },

  // Skilling resources
  { id: 'copper_ore', name: 'Copper ore', color: 0xb87333, examine: 'This needs refining.' },
  { id: 'tin_ore', name: 'Tin ore', color: 0xb0b0a8, examine: 'This needs refining.' },
  { id: 'iron_ore', name: 'Iron ore', color: 0x6e4b3a, examine: 'This needs refining.' },
  { id: 'coal', name: 'Coal', color: 0x222222, examine: 'Hmm, a non-renewable energy source!' },
  { id: 'mithril_ore', name: 'Mithril ore', color: 0x3a4a7c, examine: 'This needs refining.' },
  { id: 'adamantite_ore', name: 'Adamantite ore', color: 0x3a6a3a, examine: 'This needs refining.' },
  { id: 'runite_ore', name: 'Runite ore', color: 0x3fa9b8, examine: 'This needs refining.' },
  { id: 'bronze_bar', name: 'Bronze bar', color: BRONZE, examine: "It's a bar of bronze." },
  { id: 'iron_bar', name: 'Iron bar', color: IRON, examine: "It's a bar of iron." },
  { id: 'steel_bar', name: 'Steel bar', color: STEEL, examine: "It's a bar of steel." },
  { id: 'mithril_bar', name: 'Mithril bar', color: MITHRIL, examine: "It's a bar of mithril." },
  { id: 'adamant_bar', name: 'Adamant bar', color: ADAMANT, examine: "It's a bar of adamant." },
  { id: 'rune_bar', name: 'Rune bar', color: RUNE, examine: "It's a bar of rune." },
  { id: 'logs', burnTicks: 100, name: 'Logs', color: 0x8b5a2b, examine: 'A number of wooden logs.' },
  { id: 'oak_logs', burnTicks: 150, name: 'Oak logs', color: 0x9c6b30, examine: 'Logs cut from an oak tree.' },
  { id: 'willow_logs', burnTicks: 200, name: 'Willow logs', color: 0x7a6a3a, examine: 'Logs cut from a willow tree.' },
  { id: 'maple_logs', burnTicks: 250, name: 'Maple logs', color: 0xa0522d, examine: 'Logs cut from a maple tree.' },
  { id: 'yew_logs', burnTicks: 300, name: 'Yew logs', color: 0x6b4423, examine: 'Logs cut from a yew tree.' },
  { id: 'raw_shrimps', name: 'Raw shrimps', color: 0xc0a0a0, examine: 'I should try cooking this.' },
  { id: 'raw_trout', name: 'Raw trout', color: 0x909aa0, examine: 'I should try cooking this.' },
  { id: 'raw_lobster', name: 'Raw lobster', color: 0x5a3a7a, examine: 'I should try cooking this.' },
  { id: 'raw_swordfish', name: 'Raw swordfish', color: 0x6a7aa0, examine: 'I should try cooking this.' },
  { id: 'burnt_fish', name: 'Burnt fish', color: 0x2a2a2a, examine: 'Oops!' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}
