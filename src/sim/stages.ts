/**
 * Progression stages for the balance sim (scripts/sim.ts): roughly what a player owns at
 * each point, and the same stage for a ranged or magic player.
 */
import { RunSetup } from '../game/GameState';
import { PERKS } from '../data/skillTree';
import { ARMOURY, ArmouryLine, NO_ARMOURY } from '../data/armoury';

/** Roughly what a player has bought at each stage (perks, Armourer, enchants, camp, mastery). */
const ALL = (n: number) => Object.fromEntries(PERKS.map((p) => [p.id, Math.min(n, p.costs.length)]));
export const STAGES: Record<string, RunSetup> = {
  'fresh save': {},
  'early (~150 tokens)': {
    tools: { pickaxe: 0, axe: 1, fishing: 1, hammer: false, tinderbox: true, knife: true },
    perks: { packed_lunch: 2, basic_training: 1 },
  },
  'mid (~800 tokens)': {
    tools: { pickaxe: 1, axe: 1, fishing: 2, hammer: true, tinderbox: true, knife: true },
    perks: { basic_training: 3, guard_drills: 2, iron_will: 2, packed_lunch: 3, hearty_meals: 1, blessed: 2, veterans_kit: 1, treasure_hunter: 1 },
    armoury: { ...NO_ARMOURY, melee: 2, body: 2, shield: 1 },
  },
  'late (~3000 tokens)': {
    tools: { pickaxe: 3, axe: 3, fishing: 3, hammer: true, tinderbox: true, knife: true },
    perks: {
      basic_training: 5, guard_drills: 4, iron_will: 4, veterans_kit: 1, precision: 2, brute_force: 2, toughness: 2,
      killer_instinct: 2, packed_lunch: 3, hearty_meals: 2, second_wind: 2, blessed: 3, focus: 2, pilgrim: 1,
      holy_supplies: 2, treasure_hunter: 3,
    },
    armoury: { ...NO_ARMOURY, melee: 4, body: 4, shield: 3 },
  },
  'veteran (~25k tokens)': {
    tools: { pickaxe: 5, axe: 5, fishing: 4, hammer: true, tinderbox: true, knife: true },
    perks: { ...ALL(3), basic_training: 5, guard_drills: 5, iron_will: 5, precision: 4, brute_force: 4, toughness: 4, constitution: 3, killer_instinct: 4,
      warlords_might: 0, deadeye: 0, chain_lightning: 0, grandmaster: 0, juggernaut: 0, phoenix: 0, saint: 0, master_gatherer: 0,
      grandmaster_crafter: 0, shadowstep: 0, midas: 0, crushing_blow: 1, volley: 0, momentum: 1, bulwark: 1, undying: 1 },
    armoury: { ...NO_ARMOURY, melee: 5, body: 5, shield: 5 },
    enchants: { melee: { id: 'brutal', rank: 2 }, body: { id: 'fortified', rank: 2 } },
    campSetup: { trophy: 0.06, gardenPotions: 2 },
    mastery: { attack: 4, strength: 4, defence: 4, hitpoints: 4, prayer: 3 },
  },
  'endgame (~150k tokens)': {
    tools: { pickaxe: 6, axe: 6, fishing: 4, hammer: true, tinderbox: true, knife: true },
    perks: ALL(9),
    armoury: { ...NO_ARMOURY, melee: 6, body: 6, shield: 6 },
    enchants: { melee: { id: 'brutal', rank: 3 }, body: { id: 'fortified', rank: 3 }, shield: { id: 'fortified', rank: 3 } },
    campSetup: { trophy: 0.12, gardenPotions: 3, superPotions: true },
    mastery: { attack: 9, strength: 9, defence: 9, hitpoints: 9, prayer: 8, cooking: 6 },
  },
};

export type Style = 'melee' | 'ranged' | 'magic';

/** The same stage for a ranged or magic player: their weapon, armour and off-hand lines, perks, enchants and mastery. */
const PERK_SWAP: Record<Exclude<Style, 'melee'>, Record<string, string>> = {
  ranged: {
    basic_training: 'rangers_kit', precision: 'eagle_eye', brute_force: 'heavy_draw', bloodlust: 'quiver', executioner: 'sharpshooter',
    rage: 'kiting', crushing_blow: 'volley', warlords_might: 'deadeye',
  },
  magic: {
    basic_training: 'apprentice_kit', precision: 'arcane_focus', brute_force: 'spell_power', bloodlust: 'soul_siphon', executioner: 'attunement',
    rage: 'overcharge', crushing_blow: 'battle_mage', warlords_might: 'chain_lightning',
  },
};
export function forStyle(setup: RunSetup, style: Style): RunSetup {
  if (style === 'melee') return { ...setup, startStyle: 'melee' };
  const swap = PERK_SWAP[style];
  const perks = Object.fromEntries(Object.entries(setup.perks ?? {}).map(([id, r]) => [swap[id] ?? id, r]));
  // Perks that the swap moved in keep the higher rank.
  for (const [from, to] of Object.entries(swap)) if (setup.perks?.[to] !== undefined) perks[to] = Math.max(perks[to] ?? 0, setup.perks[from] ?? 0);
  const a = setup.armoury;
  const cap = (line: ArmouryLine, rank: number) => Math.min(rank, ARMOURY[line].tiers.length);
  const armoury = a && {
    ...NO_ARMOURY,
    melee: a.melee, // a melee weapon to fall back on when out of arrows or runes
    [style]: cap(style, a.melee),
    [`${style}_body`]: cap(`${style}_body` as ArmouryLine, a.body),
    [`${style}_shield`]: cap(`${style}_shield` as ArmouryLine, a.shield),
  };
  const enchants = setup.enchants && Object.fromEntries(Object.entries(setup.enchants).map(([line, e]) => [line === 'melee' ? style : line === 'body' || line === 'shield' ? `${style}_${line}` : line, e]));
  const m = setup.mastery;
  const mastery = m && { ...m, [style]: Math.max(m.attack ?? 0, m.strength ?? 0), attack: 0, strength: 0 };
  return { ...setup, startStyle: style, perks, armoury, enchants, mastery };
}
