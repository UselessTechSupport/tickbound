/** Run-long boons: pick 1 of 3 after each boss and at relic shrines. */
export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  color: number;
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
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export const RELIC_CHOICES = 3;
/** Chance of a relic shrine on a non-boss floor. */
export const SHRINE_CHANCE = 0.2;
