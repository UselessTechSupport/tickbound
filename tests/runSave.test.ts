import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { NO_ARMOURY } from '../src/data/armoury';
import { GameState } from '../src/game/GameState';
import { deserializeRun, serializeRun } from '../src/save/runSave';
import { botStep, newBotMemory } from '../src/sim/bot';

/** The observable state of a run, for checking a restored run plays out the same. */
const snapshot = (g: GameState) => JSON.stringify({
  tick: g.tickCount, depth: g.depth, kills: g.kills, over: g.over, tokens: g.tokensEarned,
  pos: g.player.pos, hp: g.player.hp, prayer: g.player.prayerPoints, xp: g.player.skills.xp,
  inv: g.player.inventory.slots, eq: g.player.equipment,
  npcs: g.npcs.map((n) => [n.def.id, n.pos.x, n.pos.y, n.hp]),
  items: g.groundItems.map((i) => [i.id, i.qty, i.pos.x, i.pos.y]),
  traps: g.traps, messages: g.messages.slice(-20),
});

const play = (g: GameState, ticks: number, memo = newBotMemory()) => {
  for (let i = 0; i < ticks && !g.over; i++) {
    botStep(g, memo, false);
    g.player.hp = Math.max(g.player.hp, 30); // keep the test character alive
    g.tick();
  }
};

describe('resume after refresh', () => {
  it('a restored run continues exactly like the original', () => {
    const g = new GameState(4242, () => {}, {
      armoury: { ...NO_ARMOURY, melee: 2, body: 1 }, enchants: { melee: { id: 'leeching', rank: 2 } },
    });
    play(g, 2500);
    expect(g.over).toBe(false);
    expect(g.depth).toBeGreaterThan(2);
    const saved = serializeRun(g);
    const events: string[] = [];
    const r = deserializeRun(saved, (e) => events.push(e.type))!;
    expect(r).toBeInstanceOf(GameState);
    expect(snapshot(r)).toBe(snapshot(g));
    // Same inputs from here on must give the same game.
    const rng = RNG.getState();
    play(g, 600);
    const after = snapshot(g);
    RNG.setState(rng);
    play(r, 600);
    expect(snapshot(r)).toBe(after);
    expect(events.length).toBeGreaterThan(0); // the new event sink is connected
  });

  it('keeps shared references (attack targets are the same monster objects)', () => {
    const g = new GameState(77);
    const npc = g.npcs[0];
    g.attack(npc);
    const r = deserializeRun(serializeRun(g), () => {})!;
    const intent = r.player.intent as { kind: string; npc?: unknown };
    expect(intent.kind).toBe('attack');
    expect(r.npcs).toContain(intent.npc);
  });

  it('rejects garbage', () => {
    expect(deserializeRun('{"v":1,"rng":[1,2,3,4],"game":{"$d":"nope"}}', () => {})).toBeNull();
    expect(deserializeRun('not json', () => {})).toBeNull();
  });
});
