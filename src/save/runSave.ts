import { RNG } from '../core/rng';
import * as elites from '../data/elites';
import * as items from '../data/items';
import * as loot from '../data/loot';
import * as npcs from '../data/npcs';
import * as prayers from '../data/prayers';
import * as recipes from '../data/recipes';
import * as relics from '../data/relics';
import * as resources from '../data/resources';
import * as slayer from '../data/slayer';
import * as spells from '../data/spells';
import { GroundItem } from '../entities/GroundItem';
import { Inventory } from '../entities/Inventory';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import { ResourceNode } from '../entities/ResourceNode';
import { GameEvent, GameState } from '../game/GameState';
import { Skills } from '../systems/skills';
import { SKILLS } from '../data/skills';

/**
 * Saves the run in progress so a refresh or closed tab doesn't lose it.
 *
 * The whole GameState object graph is encoded generically: class instances keep their
 * class, shared references stay shared, and objects from the static data tables (monster
 * defs, recipes, elite affixes...) are stored by name. New fields are saved automatically.
 */

const KEY = 'tickbound.run';
const VERSION = 1;

const CLASSES: Record<string, { prototype: object }> = { GameState, Player, Npc, GroundItem, ResourceNode, Inventory, Skills };
const CLASS_NAME = new Map<object, string>(Object.entries(CLASSES).map(([name, c]) => [c.prototype, name]));

/** Every object in an exported data table, keyed by where it lives (e.g. "npcs:NPCS:goblin"). */
let dataKeys: Map<object, string> | null = null;
let dataByKey: Map<string, object> | null = null;
function dataTables(): { keys: Map<object, string>; byKey: Map<string, object> } {
  if (!dataKeys || !dataByKey) {
    dataKeys = new Map();
    dataByKey = new Map();
    const modules = { elites, items, loot, npcs, prayers, recipes, relics, resources, slayer, spells };
    for (const [mod, exports] of Object.entries(modules)) {
      for (const [name, table] of Object.entries(exports as Record<string, unknown>)) {
        if (!table || typeof table !== 'object') continue;
        for (const [k, v] of Object.entries(table)) {
          if (!v || typeof v !== 'object' || dataKeys.has(v)) continue;
          const key = `${mod}:${name}:${k}`;
          dataKeys.set(v, key);
          dataByKey.set(key, v);
        }
      }
    }
  }
  return { keys: dataKeys, byKey: dataByKey };
}

type Encoded = unknown;
const SKIP = Symbol('skip');

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeGraph(root: unknown): Encoded {
  const { keys } = dataTables();
  const ids = new Map<object, number>();
  const enc = (v: unknown): Encoded | typeof SKIP => {
    if (v === undefined) return { $u: 1 };
    if (typeof v === 'function' || typeof v === 'symbol') return SKIP;
    if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: String(v) };
    if (v === null || typeof v !== 'object') return v;
    const dataKey = keys.get(v);
    if (dataKey) return { $d: dataKey };
    const seen = ids.get(v);
    if (seen !== undefined) return { $r: seen };
    const $i = ids.size;
    ids.set(v, $i);
    if (v instanceof Uint8Array) return { $i, $u8: toBase64(v) };
    if (v instanceof Set) return { $i, $set: [...v].map(enc) };
    if (v instanceof Map) return { $i, $map: [...v].map(([k, x]) => [enc(k), enc(x)]) };
    if (Array.isArray(v)) return { $i, $a: v.map((x) => { const e = enc(x); return e === SKIP ? { $u: 1 } : e; }) };
    const proto = Object.getPrototypeOf(v);
    const $c = proto === Object.prototype || proto === null ? undefined : CLASS_NAME.get(proto);
    if (proto !== Object.prototype && proto !== null && !$c) throw new Error(`runSave: can't save a ${proto?.constructor?.name}`);
    const f: Record<string, Encoded> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined) continue;
      const e = enc(x);
      if (e !== SKIP) f[k] = e;
    }
    return { $i, $c, f };
  };
  return enc(root);
}

export function decodeGraph(data: Encoded): unknown {
  const { byKey } = dataTables();
  const objs = new Map<number, unknown>();
  const dec = (v: Encoded): unknown => {
    if (v === null || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    if ('$u' in o) return undefined;
    if ('$n' in o) return Number(o.$n);
    if ('$d' in o) {
      const d = byKey.get(o.$d as string);
      if (!d) throw new Error(`runSave: unknown data ${o.$d}`);
      return d;
    }
    if ('$r' in o) {
      if (!objs.has(o.$r as number)) throw new Error('runSave: bad reference');
      return objs.get(o.$r as number);
    }
    const id = o.$i as number;
    if ('$u8' in o) {
      const a = fromBase64(o.$u8 as string);
      objs.set(id, a);
      return a;
    }
    if ('$set' in o) {
      const s = new Set();
      objs.set(id, s);
      for (const x of o.$set as Encoded[]) s.add(dec(x));
      return s;
    }
    if ('$map' in o) {
      const m = new Map();
      objs.set(id, m);
      for (const [k, x] of o.$map as Array<[Encoded, Encoded]>) m.set(dec(k), dec(x));
      return m;
    }
    if ('$a' in o) {
      const a: unknown[] = [];
      objs.set(id, a);
      for (const x of o.$a as Encoded[]) a.push(dec(x));
      return a;
    }
    const cls = o.$c ? CLASSES[o.$c as string] : undefined;
    if (o.$c && !cls) throw new Error(`runSave: unknown class ${o.$c}`);
    const out = Object.create(cls ? cls.prototype : Object.prototype) as Record<string, unknown>;
    objs.set(id, out);
    for (const [k, x] of Object.entries(o.f as Record<string, Encoded>)) out[k] = dec(x);
    return out;
  };
  return dec(data);
}

/** Copy over any field `target` doesn't have from a freshly constructed `defaults`. */
function fillMissing(target: object, defaults: object): void {
  const t = target as Record<string, unknown>;
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in t) && typeof v !== 'function') t[k] = v;
  }
}

/** Snapshot of a run, including the shared random number generator's state. */
export function serializeRun(g: GameState): string {
  return JSON.stringify({ v: VERSION, rng: RNG.getState(), game: encodeGraph(g) });
}

/** Rebuild a run from serializeRun's output; null if it's from an incompatible version. */
export function deserializeRun(json: string, emit: (e: GameEvent) => void): GameState | null {
  try {
    const data = JSON.parse(json) as { v: number; rng: number[]; game: Encoded };
    if (data.v !== VERSION) return null;
    const g = decodeGraph(data.game) as GameState;
    if (!(g instanceof GameState)) return null;
    // Fields added by a game update since the run was saved get their fresh defaults
    // (e.g. a list the game expects to exist), so an old save doesn't break the new code.
    const fresh = new GameState(0, () => {}, { camp: true });
    fillMissing(g, fresh);
    fillMissing(g.player, fresh.player);
    fillMissing(g.player.skills, fresh.player.skills);
    // Skills added since the run was saved start at 0 XP.
    for (const skill of SKILLS) g.player.skills.xp[skill] ??= 0;
    g.attachEmitter(emit);
    RNG.setState(data.rng);
    return g;
  } catch (err) {
    console.warn('Could not restore the saved run:', err);
    return null;
  }
}

export function saveRun(g: GameState): void {
  try {
    localStorage.setItem(KEY, serializeRun(g));
  } catch {
    // Storage full or unavailable: the run just won't survive a refresh.
  }
}

export function loadRun(emit: (e: GameEvent) => void): GameState | null {
  try {
    const json = localStorage.getItem(KEY);
    return json ? deserializeRun(json, emit) : null;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
