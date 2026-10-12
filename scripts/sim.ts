/**
 * Balance simulator: plays many bot runs per progression stage and reports
 * how deep they get. Run with `npm run sim` (optionally `npm run sim -- 50` runs each).
 */
import { playRun, RunResult } from '../src/sim/bot';
import { STAGES, Style, forStyle } from '../src/sim/stages';

const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
const runs = Number(argv[2] ?? 40);
/** `npm run sim -- 40 ranged` plays every stage as an archer (or `magic`); melee by default. */
const style = (argv[3] ?? 'melee') as Style;
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`Tickbound balance sim: ${runs} ${style} bot runs per stage\n`);
for (const [name, setup] of Object.entries(STAGES)) {
  const started = Date.now();
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) results.push(playRun(1000 + i, forStyle(setup, style)));
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
