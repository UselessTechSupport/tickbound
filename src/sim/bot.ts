import { item } from '../data/items';
import { SPELLS } from '../data/spells';
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

type Style = 'melee' | 'ranged' | 'magic';

/**
 * How good a piece of gear is for a combat style: weapons only count for their own style;
 * armour is defence plus that style's offence (plate's spell and archery penalties count).
 */
const gearScore = (id: string, style: Style) => {
  const e = item(id).equip!;
  const offence = style === 'melee' ? e.attackBonus + e.strengthBonus
    : style === 'ranged' ? (e.rangedBonus ?? 0) + (e.rangedStrength ?? 0) : (e.magicBonus ?? 0);
  if (e.slot === 'weapon') return (e.combatStyle ?? 'melee') === style ? offence : -Infinity;
  if (e.slot === 'ammo') return style === 'ranged' ? offence : -Infinity;
  return e.defenceBonus + offence;
};

const usable = (g: GameState, id: string) => {
  const req = item(id).equip?.req;
  return !req || g.player.skills.level(req.skill) >= req.level;
};

/** Casts of `spell` the bot's runes (and staff) allow. */
const castsOf = (g: GameState, spell: (typeof SPELLS)[number]) => Math.min(...Object.entries(spell.runes).map(([r, n]) => Math.floor(g.runesFor(r) / n)));

/** The strongest spell the bot has the Magic level for (runes aside). */
const bestSpell = (g: GameState) => [...SPELLS].reverse().find((s) => g.player.skills.level('magic') >= s.level);

/** Arrows in the quiver plus usable arrows carried; casts of the strongest castable spell. */
function supplies(g: GameState, style: Style): number {
  const p = g.player;
  if (style === 'ranged') {
    return p.ammo + p.inventory.slots.reduce((n, s) => n + (s && item(s.id).equip?.slot === 'ammo' && usable(g, s.id) ? s.qty : 0), 0);
  }
  if (style === 'magic') return Math.max(0, ...SPELLS.filter((s) => !g.canCast(s)).map((s) => castsOf(g, s)));
  return Infinity;
}

export function playRun(seed: number, setup: RunSetup, maxTicks = 60_000): RunResult {
  let lastAttacker = 'timeout';
  const g = new GameState(seed, (e) => {
    if (e.type === 'hit' && e.target === g?.player && e.damage > 0) {
      const npc = g.npcs.find((n) => n.target === g.player && n.attackCooldown > 0);
      if (npc) lastAttacker = npc.name;
    }
  }, setup);
  const memo = newBotMemory();
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

/** Fresh memory for driving a run with botStep (also used by in-game autoplay). */
export function newBotMemory(): BotMemory {
  return { ignored: new Set<Npc>(), lastTarget: null, seenMessages: 0, shopped: new Set() };
}

/** One decision for the current tick; call before GameState.tick(). `rush` = head for the stairs. */
export function botStep(g: GameState, memo: BotMemory, rush: boolean): void {
  decide(g, memo, rush);
}

export interface BotMemory {
  /** Monsters it couldn't path to this floor. */
  ignored: Set<Npc>;
  lastTarget: Npc | null;
  seenMessages: number;
  /** The combat style it plays: the weapon it started with. Falls back to melee when out of arrows or runes. */
  style?: Style;
  /** Merchants it has already restocked from. */
  shopped: Set<unknown>;
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
  memo.style ??= g.startStyle;
  memo.shopped ??= new Set();
  // Out of arrows or runes: fight in melee until it finds more.
  const style: Style = supplies(g, memo.style) > 0 ? memo.style : 'melee';

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
    if (!e || !usable(g, id) || gearScore(id, style) === -Infinity) return false;
    const current = p.equipment[e.slot];
    // More of the arrows already in the quiver go straight in.
    if (e.slot === 'ammo' && id === current) return true;
    return !current || gearScore(id, style) > gearScore(current, style);
  });
  if (upgrade >= 0) g.useItem(upgrade);
  // Out of arrows or runes with no melee weapon: put the bow or staff away and fight unarmed.
  else if (style === 'melee' && p.weaponType !== 'melee' && inv.freeSlots() > 0) g.unequip('weapon');
  // Drop burnt fish.
  const burnt = slotOf((id) => id === 'burnt_fish');
  if (burnt >= 0) g.dropItem(burnt);

  if (p.weaponType === 'melee') {
    // Train whichever melee stat is lowest, like players rotating attack styles.
    const lowest = (['attack', 'strength', 'defence'] as const).reduce((a, b) => (p.skills.level(a) <= p.skills.level(b) ? a : b));
    g.setStyle(lowest === 'attack' ? 'accurate' : lowest === 'strength' ? 'aggressive' : 'defensive');
  } else {
    // Ranged: rapid fire; magic: accurate. Switch to defensive (shared Defence XP) when Defence lags behind.
    const main = p.skills.level(p.weaponType);
    g.setStyle(p.skills.level('defence') < main - 10 ? 'defensive' : p.weaponType === 'ranged' ? 'aggressive' : 'accurate');
  }

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

  // Restock arrows or runes at a merchant when running low.
  if (!rush && memo.style !== 'melee' && restock(g, memo)) return;

  // Loot worth carrying.
  const wanted = g.groundItems.filter((gi) => {
    if (!g.isExplored(gi.pos.x, gi.pos.y) || !inv.canAdd(gi.id)) return false;
    const d = item(gi.id);
    // Arrows for an archer, runes for a mage.
    if (memo.style === 'ranged' && d.equip?.slot === 'ammo') return true;
    if (memo.style === 'magic' && gi.id.endsWith('_rune')) return true;
    if (d.equip) {
      // Gear for its own style (and melee weapons to fall back on).
      const s = d.equip.slot === 'weapon' && (d.equip.combatStyle ?? 'melee') === 'melee' ? 'melee' : memo.style!;
      const current = p.equipment[d.equip.slot];
      const score = gearScore(gi.id, s);
      return score > -Infinity && !(current && score <= gearScore(current, s));
    }
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

/**
 * Ranged and magic: when supplies run low, walk to a merchant on the floor and buy the best
 * arrows it has, or the runes for the strongest spell, with the coins it's carrying.
 */
function restock(g: GameState, memo: BotMemory): boolean {
  const style = memo.style!;
  const low = style === 'ranged' ? 60 : 40;
  if (supplies(g, style) >= low) return false;
  const merchant = g.nodes.find((n) => n.kind === 'merchant' && !memo.shopped.has(n) && g.isExplored(n.pos.x, n.pos.y));
  if (!merchant) return false;
  if (g.activeMerchant !== merchant) {
    g.talkTo(merchant);
    if (g.player.intent) return true;
    memo.shopped.add(merchant); // couldn't reach it
    return false;
  }
  const stock = merchant.stock ?? [];
  const wanted = (id: string) => {
    if (style === 'ranged') return item(id).equip?.slot === 'ammo' && usable(g, id);
    const spell = bestSpell(g);
    return !!spell && id in spell.runes && g.runesFor(id) !== Infinity;
  };
  for (let guard = 0; guard < 40 && supplies(g, style) < low * 3; guard++) {
    const i = stock.findIndex((e) => e.qty > 0 && wanted(e.id));
    if (i < 0 || !g.buy(i)) break;
  }
  g.closeShop();
  memo.shopped.add(merchant);
  return false;
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
