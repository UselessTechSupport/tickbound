import { describe, expect, it } from 'vitest';
import { NPCS, bossForDepth } from '../src/data/npcs';
import { Npc } from '../src/entities/Npc';
import { ResourceNode } from '../src/entities/ResourceNode';
import { GameState } from '../src/game/GameState';
import { Tile, setTile, tileAt } from '../src/world/tiles';
import { xpForLevel } from '../src/systems/xp';

const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

/** Quiet game with prayer trained to `level`. */
function game(level = 30, seed = 31): GameState {
  const g = new GameState(seed);
  g.npcs = [];
  g.player.skills.addXp('prayer', xpForLevel(level));
  g.player.prayerPoints = g.player.maxPrayer;
  return g;
}

/** Puts `npcId` on a free floor tile in sight: cardinally adjacent for dist 1, else `dist` tiles away. */
function place(g: GameState, npcId: string, dist = 1): Npc {
  const { x, y } = g.player.pos;
  const spots = dist === 1
    ? [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    : g.map.tiles.reduce<{ x: number; y: number }[]>((acc, _, i) => {
      const t = { x: i % g.map.width, y: Math.floor(i / g.map.width) };
      if (Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) === dist) acc.push(t);
      return acc;
    }, []);
  for (const t of spots) {
    if (tileAt(g.map, t.x, t.y) === Tile.Floor && g.isVisible(t.x, t.y)) {
      const npc = new Npc(NPCS[npcId], t);
      g.npcs.push(npc);
      return npc;
    }
  }
  throw new Error('no spot');
}

describe('prayer', () => {
  it('needs the level and is exclusive within a group', () => {
    const g = game(1);
    g.togglePrayer('protect_melee');
    expect(g.player.activePrayers.size).toBe(0);
    expect(g.messages.at(-1)).toMatch(/Prayer level of 6/);

    const h = game(30);
    h.togglePrayer('thick_skin');
    h.togglePrayer('rock_skin');
    h.togglePrayer('protect_melee');
    expect([...h.player.activePrayers].sort()).toEqual(['protect_melee', 'rock_skin']);
    h.togglePrayer('protect_magic');
    expect([...h.player.activePrayers].sort()).toEqual(['protect_magic', 'rock_skin']);
  });

  it('protection drains one point every 5 ticks and switches off at 0', () => {
    const g = game(30);
    g.player.prayerPoints = 3;
    g.togglePrayer('protect_melee');
    run(g, 5);
    expect(g.player.prayerPoints).toBe(2);
    run(g, 20);
    expect(g.player.prayerPoints).toBe(0);
    expect(g.player.activePrayers.size).toBe(0);
  });

  it('Protect from Melee blocks all melee damage', () => {
    const g = game(30);
    g.player.prayerPoints = 99;
    const npc = place(g, 'greater_demon');
    g.player.hp = 10;
    g.togglePrayer('protect_melee');
    run(g, 40);
    expect(g.player.hp).toBe(10);
    expect(npc.dead).toBe(false);
  });

  it('checks protection when a projectile lands, not when it is fired', () => {
    const g = game(30);
    g.player.prayerPoints = 99;
    g.player.hp = 99;
    const archer = place(g, 'dark_archer', 3);
    archer.target = g.player;
    // Tick until an arrow is in flight, then switch prayer before it lands.
    for (let i = 0; i < 20 && !g.pendingHits.length; i++) g.tick();
    expect(g.pendingHits.length).toBe(1);
    g.pendingHits[0].damage = 50;
    g.togglePrayer('protect_missiles');
    g.tick();
    expect(g.player.hp).toBe(99);
  });

  it('prayer potions, altars and descending restore points', () => {
    const g = game(30);
    g.player.prayerPoints = 0;
    g.player.inventory.add('prayer_potion');
    g.useItem(g.player.inventory.slots.findIndex((s) => s?.id === 'prayer_potion'));
    expect(g.player.prayerPoints).toBe(7 + Math.floor(g.player.maxPrayer / 4));

    const { x, y } = g.player.pos;
    const spot = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const altar = new ResourceNode(spot, 'altar');
    g.nodes.push(altar);
    g.player.prayerPoints = 1;
    g.prayAt(altar);
    g.tick();
    expect(g.player.prayerPoints).toBe(g.player.maxPrayer);

    g.player.prayerPoints = 0;
    g.loadFloor(2);
    expect(g.player.prayerPoints).toBe(Math.ceil(g.player.maxPrayer * 0.25));
  });

  it('stat prayers raise max hit', () => {
    const g = game(30);
    g.player.hp = 1_000_000;
    g.player.skills.addXp('strength', 1_000_000);
    const npc = place(g, 'moss_giant');
    npc.def = { ...npc.def, defence: -9, defenceBonus: -64, hitpoints: 10_000 }; // always hit
    npc.hp = 10_000;
    g.attack(npc);
    let maxPlain = 0;
    let maxBoosted = 0;
    for (let i = 0; i < 400; i++) {
      const before = npc.hp;
      g.tick();
      maxPlain = Math.max(maxPlain, before - npc.hp);
    }
    g.togglePrayer('ultimate_strength');
    g.player.prayerPoints = 999;
    for (let i = 0; i < 400; i++) {
      const before = npc.hp;
      g.player.prayerPoints = 999;
      g.tick();
      maxBoosted = Math.max(maxBoosted, before - npc.hp);
    }
    expect(maxBoosted).toBeGreaterThan(maxPlain);
  });
});

describe('bosses', () => {
  it('guards the stairs on floor 5 and seals them until killed', () => {
    const g = new GameState(41);
    g.loadFloor(5);
    const boss = g.npcs.find((n) => n.isBoss)!;
    expect(boss.name).toBe('Goblin Warlord');
    expect(g.nodes.some((n) => n.kind === 'altar')).toBe(true);

    g.npcs = [];
    g.explored.fill(1);
    g.npcs.push(boss);
    boss.target = null;
    boss.def = { ...boss.def, aggroRadius: 0 };
    g.player.hp = 9999;
    g.walkTo(g.map.stairs);
    run(g, 300);
    expect(g.depth).toBe(5);
    expect(g.messages.some((m) => m.includes('sealed'))).toBe(true);

    boss.hp = 1;
    g.attack(boss);
    run(g, 200);
    expect(g.bossKills).toBe(1);
    g.walkTo(g.map.stairs);
    run(g, 300);
    expect(g.depth).toBe(6);
  });

  it('switches attack styles', () => {
    const g = game(30);
    g.player.hp = 9999;
    const boss = new Npc(bossForDepth(15), g.player.pos);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      seen.add(boss.attackStyle);
      (g as unknown as { advanceBossStyle(n: Npc): void }).advanceBossStyle(boss);
    }
    expect(seen.size).toBe(3);
  });

  it('scales the last boss past floor 20', () => {
    const b20 = bossForDepth(20);
    const b30 = bossForDepth(30);
    expect(b30.name).toBe(b20.name);
    expect(b30.hitpoints).toBeGreaterThan(b20.hitpoints);
  });
});
