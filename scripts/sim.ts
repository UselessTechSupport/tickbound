/**
 * Balance simulator: plays many bot runs per progression stage and reports
 * how deep they get. Run with `npm run sim` (optionally `npm run sim -- 50` runs each).
 */
import { RunSetup } from '../src/game/GameState';
import { playRun, RunResult } from '../src/sim/bot';

const STAGES: Record<string, RunSetup> = {
  'fresh save': {},
  'early (~150 tokens)': {
    tools: { pickaxe: 0, axe: 1, fishing: 1, hammer: false, tinderbox: true },
    perks: { packed_lunch: 2, basic_training: 1 },
  },
  'mid (~800 tokens)': {
    tools: { pickaxe: 1, axe: 1, fishing: 2, hammer: true, tinderbox: true },
    perks: { basic_training: 3, iron_will: 2, packed_lunch: 3, hearty_meals: 1, blessed: 2, veterans_kit: 1, treasure_hunter: 1 },
  },
  'late (~3000 tokens)': {
    tools: { pickaxe: 3, axe: 3, fishing: 3, hammer: true, tinderbox: true },
    perks: {
      basic_training: 3, iron_will: 3, veterans_kit: 2, killer_instinct: 2, packed_lunch: 3, hearty_meals: 3,
      second_wind: 2, blessed: 3, focus: 2, pilgrim: 2, holy_supplies: 2, treasure_hunter: 3,
    },
  },
};

const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
const runs = Number(argv[2] ?? 40);
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`RogueScape balance sim: ${runs} bot runs per stage\n`);
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
  console.log(`  reach  floor 5: ${Math.round(100 * depths.filter((d) => d >= 5).length / runs)}%   past boss 5: ${Math.round(100 * depths.filter((d) => d >= 6).length / runs)}%   floor 10: ${Math.round(100 * depths.filter((d) => d >= 10).length / runs)}%`);
  console.log(`  avg tokens ${avg(results.map((r) => r.tokens)).toFixed(0)}   avg kills ${avg(results.map((r) => r.kills)).toFixed(0)}   avg combat lvl ${avg(results.map((r) => r.combatLevel)).toFixed(0)}`);
  console.log(`  killed by: ${top}   (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
}
