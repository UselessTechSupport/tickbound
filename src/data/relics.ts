/** Run-long boons: pick 1 of 3 after each boss and at relic shrines. */
export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  color: number;
  /** Only offered once unlocked by a quest. */
  quest?: boolean;
}

export const RELICS: RelicDef[] = [
  { id: 'vampyric_fang', name: 'Vampyric Fang', desc: 'Heal 1 HP for every 4 damage you deal.', color: 0xc02030 },
  { id: 'berserker_necklace', name: 'Berserker Necklace', desc: '+25% max hit while below half HP.', color: 0xd06020 },
  { id: 'amulet_of_glory', name: 'Amulet of Glory', desc: '+10% accuracy and max hit with every style.', color: 0xe0c040 },
  { id: 'ring_of_wealth', name: 'Ring of Wealth', desc: 'Double coin drops; rare drops 25% more likely.', color: 0xf0d050 },
  { id: 'bonecrusher', name: 'Bonecrusher', desc: 'Kills bury their bones for you and restore 1 prayer point.', color: 0xe8e2d0 },
  { id: 'regen_bracelet', name: 'Regen Bracelet', desc: 'Natural HP regeneration is twice as fast.', color: 0x60c060 },
  { id: 'avas_accumulator', name: "Ava's Accumulator", desc: 'Fired arrows return to your quiver 80% of the time.', color: 0x80a040 },
  { id: 'tome_of_fire', name: 'Tome of Fire', desc: 'Spells cost no elemental (air, water, earth, fire) runes.', color: 0xff6030 },
  { id: 'dragon_defender', name: 'Dragon Defender', desc: 'Every hit you take is reduced by 1.', color: 0xb03030 },
  { id: 'ring_of_recoil', name: 'Ring of Recoil', desc: 'Attackers take 10% of the damage they deal to you (at least 1).', color: 0x9070c0 },
  { id: 'holy_wrench', name: 'Holy Wrench', desc: 'Prayer drains 15% slower and potions restore 50% more.', color: 0x60a0e0 },
  { id: 'gourmet', name: "Gourmet's Apron", desc: 'Food heals 50% more.', color: 0xf09070 },
  { id: 'seers_insight', name: "Seers' Insight", desc: '+50% XP in every skill for the rest of the run.', color: 0x70e0ff },
  { id: 'lucky_charm', name: 'Lucky Charm', desc: '+25% Dungeoneering tokens from this run.', color: 0x40e080 },
  { id: 'graceful', name: 'Graceful Outfit', desc: 'Monsters notice you from 2 tiles closer.', color: 0x40c0a0 },
  { id: 'packed_supplies', name: 'Packed Supplies', desc: 'Find a cooked fish in your pack on every new floor.', color: 0xc08a50 },
  { id: 'hunters_eye', name: "Hunter's Eye", desc: '+1 bow range and +10% ranged accuracy.', color: 0x60a040 },
  { id: 'arcane_battery', name: 'Arcane Battery', desc: 'Spells cost no runes 25% of the time.', color: 0x8060e0 },
  { id: 'executioners_axe', name: "Executioner's Axe", desc: '+20% max hit against monsters below half HP.', color: 0x903030 },
  { id: 'scavengers_pouch', name: "Scavenger's Pouch", desc: '+50% coins from drops, and herbs drop twice as often.', color: 0xa08050 },
  { id: 'warding_charm', name: 'Warding Charm', desc: 'A ward absorbs the first 10 damage you take on each floor.', color: 0x80c0e0 },
  { id: 'phoenix_feather', name: 'Phoenix Feather', desc: 'The first time you drop below 20% HP on each floor, heal 30% of your HP.', color: 0xff8030 },
  // Quest rewards: join the pool once their quest is done.
  { id: 'fire_cape', name: 'Fire Cape', desc: '+10% max hit against bosses.', color: 0xff7020, quest: true },
  { id: 'thieves_gloves', name: "Thieves' Gloves", desc: '+15% chance to pick pockets and locks.', color: 0x6a5a8a, quest: true },
  { id: 'boots_of_lightness', name: 'Boots of Lightness', desc: 'Agility shortcuts never fail and give double XP.', color: 0x8ad0a0, quest: true },
  { id: 'fletchers_kit', name: "Fletcher's Kit", desc: 'Fletching makes 50% more arrows.', color: 0xa07040, quest: true },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export const RELIC_CHOICES = 3;
/** Chance of a relic shrine on a non-boss floor. */
export const SHRINE_CHANCE = 0.2;
