import { SkillName } from './skills';

export type EquipSlot = 'weapon' | 'body' | 'shield' | 'ammo' | 'amulet';

export interface EquipStats {
  slot: EquipSlot;
  attackBonus: number;
  strengthBonus: number;
  defenceBonus: number;
  rangedBonus?: number;
  /** Arrows: adds to ranged max hit. */
  rangedStrength?: number;
  magicBonus?: number;
  /** Bows fire arrows; staffs cast spells. Anything else is melee. */
  combatStyle?: 'ranged' | 'magic';
  /** Tiles; ranged and magic weapons only. */
  attackRange?: number;
  /** Elemental staffs supply unlimited runes of this type. */
  providesRune?: string;
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
  /** Drinkable stat boost (OSRS formula: base + pct of your level), fading 1 level per minute. */
  boost?: { skills: SkillName[]; base: number; pct: number };
  /** Herb or herblore ingredient (supplies; not logged in the collection log). */
  herblore?: boolean;
  buryXp?: number;
  equip?: EquipStats;
}

const weapon = (attackBonus: number, strengthBonus: number, level: number): EquipStats => ({
  slot: 'weapon', attackBonus, strengthBonus, defenceBonus: 0, attackSpeed: 4,
  req: level > 1 ? { skill: 'attack', level } : undefined,
});
/** Plate and metal shields hamper spellcasting and archery, as in OSRS. */
const body = (defenceBonus: number, level: number): EquipStats => ({
  slot: 'body', attackBonus: 0, strengthBonus: 0, defenceBonus, magicBonus: -20, rangedBonus: -8,
  req: level > 1 ? { skill: 'defence', level } : undefined,
});

const shield = (defenceBonus: number, level: number): EquipStats => ({
  slot: 'shield', attackBonus: 0, strengthBonus: 0, defenceBonus, magicBonus: -8, rangedBonus: -2,
  req: level > 1 ? { skill: 'defence', level } : undefined,
});

const bow = (rangedBonus: number, level: number): EquipStats => ({
  slot: 'weapon', attackBonus: 0, strengthBonus: 0, defenceBonus: 0, rangedBonus, combatStyle: 'ranged',
  attackSpeed: 4, attackRange: 7, req: level > 1 ? { skill: 'ranged', level } : undefined,
});

const arrows = (rangedStrength: number, level: number): EquipStats => ({
  slot: 'ammo', attackBonus: 0, strengthBonus: 0, defenceBonus: 0, rangedStrength,
  req: level > 1 ? { skill: 'ranged', level } : undefined,
});

const staff = (magicBonus: number, level: number, providesRune?: string): EquipStats => ({
  slot: 'weapon', attackBonus: 2, strengthBonus: 2, defenceBonus: 2, magicBonus, combatStyle: 'magic',
  attackSpeed: 5, attackRange: 8, providesRune, req: level > 1 ? { skill: 'magic', level } : undefined,
});

const robe = (magicBonus: number, rangedBonus: number, defenceBonus: number, skill: SkillName, level: number): EquipStats => ({
  slot: 'body', attackBonus: 0, strengthBonus: 0, defenceBonus, magicBonus, rangedBonus,
  req: level > 1 ? { skill, level } : undefined,
});

/** Ranged and magic off-hands: no penalty to their style, unlike metal shields. */
const offhand = (defenceBonus: number, rangedBonus: number, magicBonus: number, skill: SkillName, level: number): EquipStats => ({
  slot: 'shield', attackBonus: 0, strengthBonus: 0, defenceBonus, rangedBonus, magicBonus,
  req: level > 1 ? { skill, level } : undefined,
});

/** Amulets: small all-round equipment bonuses in their own slot. */
const amulet = (b: Partial<EquipStats>): EquipStats => ({ slot: 'amulet', attackBonus: 0, strengthBonus: 0, defenceBonus: 0, ...b });

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
  // Special attack weapons (see data/specials.ts): rare drops.
  { id: 'dragon_dagger', name: 'Dragon dagger', color: 0xd03020, equip: weapon(40, 40, 30), examine: 'A powerful dagger. Special: Puncture.' },
  { id: 'granite_maul', name: 'Granite maul', color: 0x8a8a8a, equip: { ...weapon(48, 72, 35), attackSpeed: 7 }, examine: 'Simplicity is the best weapon. Special: Quick Smash.' },
  { id: 'dragon_warhammer', name: 'Dragon warhammer', color: 0xd03020, equip: { ...weapon(52, 70, 45), attackSpeed: 6 }, examine: 'A dragon-forged warhammer. Special: Smash.' },
  { id: 'dragon_claws', name: 'Dragon claws', color: 0xd03020, equip: weapon(57, 56, 50), examine: 'A set of fighting claws. Special: Slice and Dice.' },
  { id: 'magic_shortbow', name: 'Magic shortbow', color: 0x4a7ab0, equip: { ...bow(69, 30), attackSpeed: 3 }, examine: 'Short and magical, but still effective. Special: Snapshot.' },
  { id: 'ancient_staff', name: 'Ancient staff', color: 0x3a2a5a, equip: staff(15, 30), examine: 'A staff of ancient power. Special: Soul Blast.' },
  // Boss uniques (floor 25 Lich, floor 30 Ancient Wyrm).
  { id: 'staff_of_the_dead', name: 'Staff of the dead', color: 0x4a6a3a, equip: staff(28, 65), examine: 'A staff that hums with the Lich\'s stolen life.' },
  { id: 'wyrmhide_body', name: 'Wyrmhide body', color: 0x3a3a5a, equip: robe(-12, 32, 65, 'ranged', 65), examine: 'Scales from the oldest thing in the dungeon.' },
  // Off-hands for ranged and magic (Armourer).
  { id: 'leather_buckler', name: 'Leather buckler', color: 0x8a5a2a, equip: offhand(5, 3, 0, 'ranged', 1), examine: 'A small shield that leaves your draw arm free.' },
  { id: 'studded_buckler', name: 'Studded buckler', color: 0x7a6a5a, equip: offhand(10, 6, 0, 'ranged', 20), examine: 'A buckler reinforced with metal studs.' },
  { id: 'dhide_buckler', name: "D'hide buckler", color: 0x3a8a3a, equip: offhand(18, 10, 0, 'ranged', 40), examine: 'Dragonhide stretched over a light frame.' },
  { id: 'black_dhide_buckler', name: "Black d'hide buckler", color: 0x303030, equip: offhand(30, 15, 0, 'ranged', 60), examine: 'Black dragonhide, light and very tough.' },
  { id: 'apprentice_tome', name: "Apprentice's tome", color: 0x5a6ab0, equip: offhand(0, 0, 5, 'magic', 1), examine: 'A battered book of beginner spells.' },
  { id: 'mages_book', name: "Mage's book", color: 0x4a4ad0, equip: offhand(2, 0, 12, 'magic', 30), examine: 'A book of powerful incantations.' },
  { id: 'arcane_tome', name: 'Arcane tome', color: 0x8a40c0, equip: offhand(4, 0, 18, 'magic', 50), examine: 'Its pages turn by themselves.' },
  { id: 'ancestral_tome', name: 'Ancestral tome', color: 0x6040a0, equip: offhand(6, 0, 24, 'magic', 70), examine: 'The collected wisdom of an ancient order.' },
  { id: 'treasure_map', name: 'Treasure map', color: 0xc0a060, examine: 'X marks the spot... somewhere on every floor you carry it to.' },
  // Crafting: gems found while mining, cut into amulets with a chisel.
  { id: 'sapphire', name: 'Sapphire', color: 0x3050e0, examine: 'A blue gem. A chisel could shape it.' },
  { id: 'emerald', name: 'Emerald', color: 0x30c050, examine: 'A green gem. A chisel could shape it.' },
  { id: 'ruby', name: 'Ruby', color: 0xe03040, examine: 'A red gem. A chisel could shape it.' },
  { id: 'diamond', name: 'Diamond', color: 0xe0f0ff, examine: 'A brilliant gem. A chisel could shape it.' },
  { id: 'dragonstone', name: 'Dragonstone', color: 0xa040e0, examine: 'A rare and powerful gem.' },
  { id: 'amulet_of_magic', name: 'Amulet of magic', color: 0x3050e0, equip: amulet({ magicBonus: 10 }), examine: 'A sapphire amulet that aids spellcasting.' },
  { id: 'amulet_of_accuracy', name: 'Amulet of accuracy', color: 0x30c050, equip: amulet({ attackBonus: 8, rangedBonus: 8 }), examine: 'An emerald amulet that steadies your aim.' },
  { id: 'amulet_of_strength', name: 'Amulet of strength', color: 0xe03040, equip: amulet({ strengthBonus: 10 }), examine: 'A ruby amulet that lends you strength.' },
  { id: 'amulet_of_power', name: 'Amulet of power', color: 0xe0f0ff, equip: amulet({ attackBonus: 6, strengthBonus: 6, defenceBonus: 6, rangedBonus: 6, magicBonus: 6 }), examine: 'A diamond amulet humming with power.' },
  { id: 'dragonstone_amulet', name: 'Dragonstone amulet', color: 0xa040e0, equip: amulet({ attackBonus: 10, strengthBonus: 10, defenceBonus: 10, rangedBonus: 10, magicBonus: 10 }), examine: 'A dragonstone amulet. Its power is unmistakable.' },
  // Late-game Armourer tier (after the Ancient Wyrm).
  { id: 'dragon_platebody', name: 'Dragon platebody', color: 0xd03020, equip: body(110, 60), examine: 'Forged from the scales of something enormous.' },
  { id: 'dragon_kiteshield', name: 'Dragon kiteshield', color: 0xd03020, equip: shield(60, 60), examine: 'A shield of dragon metal.' },
  { id: 'dark_bow', name: 'Dark bow', color: 0x303040, equip: bow(88, 60), examine: 'A bow of dark wood that drinks the light.' },
  { id: 'staff_of_light', name: 'Staff of light', color: 0xfff0a0, equip: staff(24, 60), examine: 'A staff that glows faintly in the dark.' },
  { id: 'black_dhide_body', name: "Black d'hide body", color: 0x303030, equip: robe(-15, 28, 55, 'ranged', 60), examine: 'Made from 100% real black dragonhide.' },
  { id: 'ancestral_top', name: 'Ancestral robe top', color: 0x6040a0, equip: robe(34, -6, 52, 'magic', 70), examine: 'Robes worn by an ancient order of mages.' },
  { id: 'dragon_scimitar', name: 'Dragon scimitar', color: 0xd03020, equip: weapon(67, 66, 60), examine: 'A vicious, curved sword of dragon metal.' },
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
  { id: 'wooden_shield', name: 'Wooden shield', color: 0x7a5230, equip: { ...shield(5, 1), magicBonus: 0, rangedBonus: 0 }, examine: 'A solid wooden shield.' },

  // Ranged
  { id: 'shortbow', name: 'Shortbow', color: 0xc89858, equip: bow(8, 1), examine: 'A nice sturdy bow.' },
  { id: 'oak_shortbow', name: 'Oak shortbow', color: 0xd0a060, equip: bow(14, 5), examine: 'A shortbow made out of oak.' },
  { id: 'willow_shortbow', name: 'Willow shortbow', color: 0xc8c070, equip: bow(20, 20), examine: 'A shortbow made out of willow.' },
  { id: 'maple_shortbow', name: 'Maple shortbow', color: 0xe08850, equip: bow(29, 30), examine: 'A shortbow made out of maple.' },
  { id: 'yew_shortbow', name: 'Yew shortbow', color: 0xb07050, equip: bow(47, 40), examine: 'A shortbow made out of yew.' },
  { id: 'bronze_arrow', name: 'Bronze arrow', color: BRONZE, stackable: true, equip: arrows(7, 1), examine: 'Arrows with bronze heads.' },
  { id: 'iron_arrow', name: 'Iron arrow', color: IRON, stackable: true, equip: arrows(10, 1), examine: 'Arrows with iron heads.' },
  { id: 'steel_arrow', name: 'Steel arrow', color: STEEL, stackable: true, equip: arrows(16, 5), examine: 'Arrows with steel heads.' },
  { id: 'mithril_arrow', name: 'Mithril arrow', color: MITHRIL, stackable: true, equip: arrows(22, 20), examine: 'Arrows with mithril heads.' },
  { id: 'adamant_arrow', name: 'Adamant arrow', color: ADAMANT, stackable: true, equip: arrows(31, 30), examine: 'Arrows with adamant heads.' },
  { id: 'rune_arrow', name: 'Rune arrow', color: RUNE, stackable: true, equip: arrows(49, 40), examine: 'Arrows with rune heads.' },
  { id: 'leather_body', name: 'Leather body', color: 0x8a5a2a, equip: robe(0, 2, 8, 'defence', 1), examine: 'Better than no armour!' },
  { id: 'hardleather_body', name: 'Hardleather body', color: 0x6a4a2a, equip: robe(-4, 6, 14, 'ranged', 10), examine: 'Harder than normal leather.' },
  { id: 'studded_body', name: 'Studded body', color: 0x7a6a5a, equip: robe(-6, 10, 20, 'ranged', 20), examine: 'Leather armour reinforced with metal studs.' },
  { id: 'blue_dhide_body', name: "Blue d'hide body", color: 0x3a5ab0, equip: robe(-15, 22, 40, 'ranged', 50), examine: 'Made from 100% real blue dragonhide.' },
  { id: 'green_dhide_body', name: "Green d'hide body", color: 0x3a8a3a, equip: robe(-15, 15, 30, 'ranged', 40), examine: 'Made from 100% real dragonhide.' },

  // Magic
  { id: 'staff', name: 'Staff', color: 0x6a4a2a, equip: staff(6, 1), examine: "It's a slightly magical stick." },
  { id: 'staff_of_air', name: 'Staff of air', color: 0xe0e0f0, equip: staff(10, 1, 'air_rune'), examine: 'A magical staff that provides unlimited air runes.' },
  { id: 'staff_of_water', name: 'Staff of water', color: 0x5080ff, equip: staff(10, 1, 'water_rune'), examine: 'A magical staff that provides unlimited water runes.' },
  { id: 'staff_of_earth', name: 'Staff of earth', color: 0x9a7a4a, equip: staff(10, 1, 'earth_rune'), examine: 'A magical staff that provides unlimited earth runes.' },
  { id: 'staff_of_fire', name: 'Staff of fire', color: 0xff6030, equip: staff(10, 1, 'fire_rune'), examine: 'A magical staff that provides unlimited fire runes.' },
  { id: 'mystic_air_staff', name: 'Mystic air staff', color: 0xe8e8ff, equip: staff(18, 40, 'air_rune'), examine: 'It is a slightly magical stick of air.' },
  { id: 'mystic_fire_staff', name: 'Mystic fire staff', color: 0xff7040, equip: staff(18, 40, 'fire_rune'), examine: 'It is a slightly magical stick of fire.' },
  { id: 'wizard_robe', name: 'Wizard robe', color: 0x3a4aa0, equip: robe(5, 0, 2, 'magic', 1), examine: 'I can do magic better in this.' },
  { id: 'splitbark_body', name: 'Splitbark body', color: 0x7a5a3a, equip: robe(10, -4, 22, 'magic', 15), examine: 'Bark armour that does not hinder spellcasting.' },
  { id: 'infinity_top', name: 'Infinity top', color: 0xd0d8ff, equip: robe(24, 0, 20, 'magic', 45), examine: 'Robes of the Magic Training Arena.' },
  { id: 'ahrims_robetop', name: "Ahrim's robetop", color: 0x3a2a3a, equip: robe(30, -10, 45, 'magic', 60), examine: "Ahrim the Blighted's armoured robes." },
  { id: 'mystic_robe_top', name: 'Mystic robe top', color: 0x5a5ad0, equip: robe(20, 0, 14, 'magic', 30), examine: 'The upper half of a magical robe.' },
  { id: 'air_rune', name: 'Air rune', color: 0xe0e0f0, stackable: true, examine: 'One of the 4 basic elemental runes.' },
  { id: 'water_rune', name: 'Water rune', color: 0x4070ff, stackable: true, examine: 'One of the 4 basic elemental runes.' },
  { id: 'earth_rune', name: 'Earth rune', color: 0x8a6a3a, stackable: true, examine: 'One of the 4 basic elemental runes.' },
  { id: 'fire_rune', name: 'Fire rune', color: 0xff5020, stackable: true, examine: 'One of the 4 basic elemental runes.' },
  { id: 'mind_rune', name: 'Mind rune', color: 0xe08030, stackable: true, examine: 'Used for basic level missile spells.' },
  { id: 'chaos_rune', name: 'Chaos rune', color: 0xe0c030, stackable: true, examine: 'Used for medium level missile spells.' },
  { id: 'death_rune', name: 'Death rune', color: 0xd0d0d0, stackable: true, examine: 'Used for high level missile spells.' },

  { id: 'prayer_potion', name: 'Prayer potion', color: 0x40c0b0, restoresPrayer: true, examine: 'A potion that restores prayer points.' },

  // Herblore: herbs, secondaries, vials and potions
  { id: 'guam_leaf', name: 'Guam leaf', color: 0x6aa040, herblore: true, examine: 'A fresh herb.' },
  { id: 'tarromin', name: 'Tarromin', color: 0x8aa030, herblore: true, examine: 'A fresh herb.' },
  { id: 'harralander', name: 'Harralander', color: 0xa09030, herblore: true, examine: 'A fresh herb.' },
  { id: 'ranarr_weed', name: 'Ranarr weed', color: 0x40a050, herblore: true, examine: 'A valuable herb.' },
  { id: 'irit_leaf', name: 'Irit leaf', color: 0x5a9a5a, herblore: true, examine: 'A fresh herb.' },
  { id: 'kwuarm', name: 'Kwuarm', color: 0x7a9a3a, herblore: true, examine: 'A fresh herb.' },
  { id: 'cadantine', name: 'Cadantine', color: 0x3a8a5a, herblore: true, examine: 'A fresh herb.' },
  { id: 'dwarf_weed', name: 'Dwarf weed', color: 0x6a8a2a, herblore: true, examine: 'A fresh herb.' },
  { id: 'lantadyme', name: 'Lantadyme', color: 0x8ab040, herblore: true, examine: 'A fresh herb.' },
  { id: 'snapdragon', name: 'Snapdragon', color: 0xc0d040, herblore: true, examine: 'A rare herb from the deep.' },
  { id: 'torstol', name: 'Torstol', color: 0x6a9a30, herblore: true, examine: 'The rarest herb of all.' },
  { id: 'eye_of_newt', name: 'Eye of newt', color: 0xe0d0a0, stackable: true, herblore: true, examine: 'It seems to be looking at me.' },
  { id: 'limpwurt_root', name: 'Limpwurt root', color: 0xc08040, stackable: true, herblore: true, examine: 'The root of a limpwurt plant.' },
  { id: 'white_berries', name: 'White berries', color: 0xf0f0f0, stackable: true, herblore: true, examine: 'Poisonous berries.' },
  { id: 'snape_grass', name: 'Snape grass', color: 0x60a060, stackable: true, herblore: true, examine: 'Strange spiky grass.' },
  { id: 'wine_of_zamorak', name: 'Wine of zamorak', color: 0x902040, stackable: true, herblore: true, examine: 'A jug full of Zamorak wine.' },
  { id: 'potato_cactus', name: 'Potato cactus', color: 0x70a050, stackable: true, herblore: true, examine: 'How on earth did a cactus get down here?' },
  { id: 'vial_of_water', name: 'Vial of water', color: 0xa0c0ff, stackable: true, herblore: true, examine: 'A glass vial containing water.' },
  { id: 'attack_potion', name: 'Attack potion', color: 0x4060ff, boost: { skills: ['attack'], base: 3, pct: 0.1 }, examine: 'Boosts your Attack.' },
  { id: 'strength_potion', name: 'Strength potion', color: 0xd04040, boost: { skills: ['strength'], base: 3, pct: 0.1 }, examine: 'Boosts your Strength.' },
  { id: 'defence_potion', name: 'Defence potion', color: 0x40c060, boost: { skills: ['defence'], base: 3, pct: 0.1 }, examine: 'Boosts your Defence.' },
  { id: 'super_attack', name: 'Super attack', color: 0x40e0e0, boost: { skills: ['attack'], base: 5, pct: 0.15 }, examine: 'Greatly boosts your Attack.' },
  { id: 'super_strength', name: 'Super strength', color: 0xe040e0, boost: { skills: ['strength'], base: 5, pct: 0.15 }, examine: 'Greatly boosts your Strength.' },
  { id: 'super_defence', name: 'Super defence', color: 0xe0c040, boost: { skills: ['defence'], base: 5, pct: 0.15 }, examine: 'Greatly boosts your Defence.' },
  { id: 'ranging_potion', name: 'Ranging potion', color: 0x60e0a0, boost: { skills: ['ranged'], base: 4, pct: 0.1 }, examine: 'Boosts your Ranged.' },
  { id: 'super_ranging', name: 'Super ranging', color: 0x40c080, boost: { skills: ['ranged'], base: 6, pct: 0.15 }, examine: 'Greatly boosts your Ranged.' },
  { id: 'super_magic', name: 'Super magic', color: 0xa03070, boost: { skills: ['magic'], base: 6, pct: 0.12 }, examine: 'Greatly boosts your Magic.' },
  { id: 'super_combat', name: 'Super combat', color: 0x40a040, boost: { skills: ['attack', 'strength', 'defence'], base: 5, pct: 0.15 }, examine: 'Boosts Attack, Strength and Defence all at once.' },
  { id: 'magic_potion', name: 'Magic potion', color: 0xc04080, boost: { skills: ['magic'], base: 4, pct: 0 }, examine: 'Boosts your Magic.' },

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
