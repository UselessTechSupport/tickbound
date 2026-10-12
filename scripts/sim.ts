/**
 * Balance simulator: plays many bot runs per progression stage and reports
 * how deep they get. Run with `npm run sim` (optionally `npm run sim -- 50` runs each).
 */
import { RunSetup } from '../src/game/GameState';
import { PERKS } from '../src/data/skillTree';
import { NO_ARMOURY } from '../src/data/armoury';
import { playRun, RunResult } from '../src/sim/bot';

/** Roughly what a player has bought at each stage (perks, Armourer, enchants, camp, mastery). */
const ALL = (n: number) => Object.fromEntries(PERKS.map((p) => [p.id, Math.min(n, p.costs.length)]));
const STAGES: Record<string, RunSetup> = {
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

const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
const runs = Number(argv[2] ?? 40);
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`Tickbound balance sim: ${runs} bot runs per stage\n`);
for (const [name, setup] of Object.entries(STAGES)) {
  const started = Date.now();
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) results.push(playRun(1000 + i, setup));
  const depths = results.map((r) => r.depth);
  const killers = new Map<string, number>();
  for (const r of results) killers.set(r.killedBy, (killers.get(r.killedBy) ?? 0) + 1);
  const top = [...killers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n}`).join(', ');
  console.log(`${name}`);
  console.log(`  depth  p25 ${pct(depths, 0.25)}  median ${pct(depths, 0.5)}  p75 ${pct(depths, 0.75)}  max ${Math.max(...depths)}`);
  console.log(`  reach  floor 5: ${Math.round(100 * depths.filter((d) => d >= 5).length / runs)}%   past boss 5: ${Math.round(100 * depths.filter((d) => d >= 6).length / runs)}%   floor 10: ${Math.round(100 * depths.filter((d) => d >= 10).length / runs)}%   floor 20: ${Math.round(100 * depths.filter((d) => d >= 20).length / runs)}%`);
  console.log(`  avg tokens ${avg(results.map((r) => r.tokens)).toFixed(0)}   avg kills ${avg(results.map((r) => r.kills)).toFixed(0)}   avg combat lvl ${avg(results.map((r) => r.combatLevel)).toFixed(0)}`);
  console.log(`  killed by: ${top}   (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
}
