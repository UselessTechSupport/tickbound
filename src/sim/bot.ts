import { item } from '../data/items';
import { RECIPES } from '../data/recipes';
import { PROTECTION_HOTKEYS, PRAYER_BY_ID } from '../data/prayers';
import { GameState, RunSetup } from '../game/GameState';
import { Npc } from '../entities/Npc';
import { isWalkable, Point } from '../world/tiles';

/**
 * A simple autopilot that plays a run through the real game rules, for balance
 * testing. It plays like a careful beginner: fights what it sees, eats when hurt,
 * loots and equips upgrades, cooks fish when low on food, explores, then descends.
 * On boss floors it prays against whatever is about to hit it.
 */

export interface RunResult {
  depth: number;
  kills: number;
  bossKills: number;
  tokens: number;
  ticks: number;
  combatLevel: number;
  killedBy: string;
}

const MAX_TICKS_PER_FLOOR = 3000;

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const gearScore = (id: string) => {
  const e = item(id).equip!;
  return e.attackBonus + e.strengthBonus + e.defenceBonus;
};

export function playRun(seed: number, setup: RunSetup, maxTicks = 60_000): RunResult {
  let lastAttacker = 'timeout';
  const g = new GameState(seed, (e) => {
    if (e.type === 'hit' && e.target === g?.player && e.damage > 0) {
      const npc = g.npcs.find((n) => n.target === g.player && n.attackCooldown > 0);
      if (npc) lastAttacker = npc.name;
    }
  }, setup);
  const memo: BotMemory = { ignored: new Set<Npc>(), lastTarget: null, seenMessages: 0 };
  let floorTicks = 0;
  let depth = g.depth;

  for (let t = 0; t < maxTicks && !g.over; t++) {
    if (g.depth !== depth) {
      depth = g.depth;
      floorTicks = 0;
      memo.ignored.clear();
    }
    decide(g, memo, floorTicks > MAX_TICKS_PER_FLOOR);
    g.tick();
    floorTicks++;
  }
  return {
    depth: g.depth, kills: g.kills, bossKills: g.bossKills, tokens: g.tokensEarned, ticks: g.tickCount,
    combatLevel: g.player.combatLevel, killedBy: g.over ? lastAttacker : 'survived',
  };
}

interface BotMemory {
  /** Monsters it couldn't path to this floor. */
  ignored: Set<Npc>;
  lastTarget: Npc | null;
  seenMessages: number;
}

function decide(g: GameState, memo: BotMemory, rush: boolean): void {
  const p = g.player;
  if (g.pendingRelics) g.chooseRelic(g.pendingRelics[0]);
  const fresh = g.messages.slice(memo.seenMessages);
  memo.seenMessages = g.messages.length;
  if (memo.lastTarget && fresh.includes("I can't reach that!")) memo.ignored.add(memo.lastTarget);
  const inv = p.inventory;
  const slotOf = (pred: (id: string) => boolean) => inv.slots.findIndex((s) => !!s && pred(s.id));

  managePrayer(g);

  // Eat below half HP.
  if (p.hp < p.maxHp * 0.5) {
    const food = slotOf((id) => !!item(id).heal);
    if (food >= 0) g.useItem(food);
  }
  // Drink prayer potions on boss floors when low.
  if (g.npcs.some((n) => n.isBoss) && p.prayerPoints < p.maxPrayer * 0.25) {
    const pot = slotOf((id) => !!item(id).restoresPrayer);
    if (pot >= 0) g.useItem(pot);
  }
  // Bury bones and equip upgrades right away.
  const bones = slotOf((id) => !!item(id).buryXp);
  if (bones >= 0) g.useItem(bones);
  const upgrade = slotOf((id) => {
    const e = item(id).equip;
    if (!e || (e.req && p.skills.level(e.req.skill) < e.req.level)) return false;
    const current = p.equipment[e.slot];
    return !current || gearScore(id) > gearScore(current);
  });
  if (upgrade >= 0) g.useItem(upgrade);
  // Drop burnt fish.
  const burnt = slotOf((id) => id === 'burnt_fish');
  if (burnt >= 0) g.dropItem(burnt);

  // Train whichever melee stat is lowest, like players rotating attack styles.
  const lowest = (['attack', 'strength', 'defence'] as const).reduce((a, b) => (p.skills.level(a) <= p.skills.level(b) ? a : b));
  g.setStyle(lowest === 'attack' ? 'accurate' : lowest === 'strength' ? 'aggressive' : 'defensive');

  const busy = p.intent?.kind;
  if (busy === 'attack' || busy === 'gather' || busy === 'process' || busy === 'take' || busy === 'altar') return;

  // Before engaging a boss, top up prayer at the altar if we've found it.
  const boss = g.npcs.find((n) => n.isBoss);
  const altar = g.nodes.find((n) => n.kind === 'altar' && g.isExplored(n.pos.x, n.pos.y));
  if (boss && altar && !boss.target && p.prayerPoints < p.maxPrayer) {
    g.prayAt(altar);
    return;
  }

  // Fight anything in sight.
  // Leave the boss until prayer is topped up (it may still aggro on its own).
  const targets = g.npcs.filter((n) => !memo.ignored.has(n) && g.isVisible(n.pos.x, n.pos.y)
    && !(n.isBoss && !n.target && altar && p.prayerPoints < p.maxPrayer));
  if (targets.length) {
    const near = targets.reduce((a, b) => (dist(a.pos, p.pos) <= dist(b.pos, p.pos) ? a : b));
    g.attack(near);
    memo.lastTarget = near;
    return;
  }

  // Loot worth carrying.
  const wanted = g.groundItems.filter((gi) => {
    if (!g.isExplored(gi.pos.x, gi.pos.y) || !inv.canAdd(gi.id)) return false;
    const d = item(gi.id);
    if (d.equip) return !(p.equipment[d.equip.slot] && gearScore(gi.id) <= gearScore(p.equipment[d.equip.slot]!));
    return !!(d.heal || d.restoresPrayer || d.buryXp || gi.id === 'coins' || gi.id.startsWith('raw_'));
  });
  if (wanted.length && !rush) {
    const near = wanted.reduce((a, b) => (dist(a.pos, p.pos) <= dist(b.pos, p.pos) ? a : b));
    g.take(near);
    if (p.path.length || (p.pos.x === near.pos.x && p.pos.y === near.pos.y)) return;
  }

  // Low on food: fish and cook if we have the gear.
  const foodCount = inv.slots.filter((s) => s && item(s.id).heal).length;
  if (!rush && foodCount < 4 && skillForFood(g)) return;

  // Explore, then take the stairs.
  if (!rush) {
    const frontier = nearestFrontier(g);
    if (frontier) {
      g.walkTo(frontier);
      if (p.path.length) return;
    }
  }
  g.explored.fill(1); // nothing left to find (or out of time): head down
  g.walkTo(g.map.stairs);
}

/** Pray against the next incoming hit on boss floors and for projectiles in flight. */
function managePrayer(g: GameState): void {
  const p = g.player;
  const boss = g.npcs.find((n) => n.isBoss && n.target === p);
  const incoming = g.pendingHits.length ? g.pendingHits.reduce((a, b) => (a.landsAt <= b.landsAt ? a : b)).style : undefined;
  const style = incoming ?? (boss ? boss.attackStyle : undefined);
  const want = style ? PROTECTION_HOTKEYS.find((id) => PRAYER_BY_ID[id].protects === style) : undefined;
  for (const id of PROTECTION_HOTKEYS) {
    if (p.activePrayers.has(id) && id !== want) g.togglePrayer(id);
  }
  if (want && !p.activePrayers.has(want) && p.prayerPoints > 0 && p.skills.level('prayer') >= PRAYER_BY_ID[want].level) {
    g.togglePrayer(want);
  }
}

function skillForFood(g: GameState): boolean {
  const p = g.player;
  const inv = p.inventory;
  const cookable = RECIPES.filter((r) => r.station === 'fire' && inv.count(r.inputs[0].item) > 0
    && p.skills.level('cooking') >= r.level);
  const fire = g.nodes.find((n) => n.kind === 'fire' && g.isExplored(n.pos.x, n.pos.y));
  if (cookable.length && fire) {
    g.process(fire, cookable[0]);
    return true;
  }
  if (cookable.length && p.tools.tinderbox) {
    const logs = inv.slots.findIndex((s) => !!s && !!item(s.id).burnTicks);
    if (logs >= 0) {
      g.useItem(logs);
      return true;
    }
  }
  const rawCount = inv.slots.filter((s) => s?.id.startsWith('raw_')).length;
  if (rawCount < 3 && inv.freeSlots() > 2) {
    const spot = g.nodes.find((n) => n.kind === 'resource' && !n.depleted && n.def!.kind === 'fishing'
      && g.isExplored(n.pos.x, n.pos.y) && p.tools.fishing >= n.def!.fishingTier! && p.skills.level('fishing') >= n.def!.level);
    if (spot) {
      g.gather(spot);
      return true;
    }
  }
  // Need fuel for a fire.
  if (cookable.length && !fire && p.tools.axe && p.tools.tinderbox) {
    const tree = g.nodes.find((n) => n.kind === 'resource' && !n.depleted && n.def!.kind === 'tree'
      && g.isExplored(n.pos.x, n.pos.y) && p.skills.level('woodcutting') >= n.def!.level);
    if (tree) {
      g.gather(tree);
      return true;
    }
  }
  return false;
}

/** BFS to the closest explored walkable tile that borders unexplored space. */
function nearestFrontier(g: GameState): Point | null {
  const map = g.map;
  const start = g.player.pos;
  const seen = new Uint8Array(map.width * map.height);
  const queue: Point[] = [start];
  seen[start.y * map.width + start.x] = 1;
  while (queue.length) {
    const c = queue.shift()!;
    if (DIRS8.some(([dx, dy]) => {
      const x = c.x + dx;
      const y = c.y + dy;
      return x >= 0 && y >= 0 && x < map.width && y < map.height && !g.isExplored(x, y);
    }) && (c.x !== start.x || c.y !== start.y)) {
      return c;
    }
    for (const [dx, dy] of DIRS8.slice(0, 4)) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = n.y * map.width + n.x;
      if (!isWalkable(map, n.x, n.y) || seen[k]) continue;
      seen[k] = 1;
      queue.push(n);
    }
  }
  return null;
}

const dist = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
