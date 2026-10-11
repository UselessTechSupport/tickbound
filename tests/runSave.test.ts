import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { NO_ARMOURY } from '../src/data/armoury';
import { GameState } from '../src/game/GameState';
import { deserializeRun, encodeGraph, serializeRun } from '../src/save/runSave';
import { botStep, newBotMemory } from '../src/sim/bot';

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
    expect(JSON.stringify(encodeGraph(r))).toBe(JSON.stringify(encodeGraph(g)));
    // Same inputs from here on must give the same game.
    const rng = RNG.getState();
    play(g, 600);
    const after = JSON.stringify(encodeGraph(g));
    RNG.setState(rng);
    play(r, 600);
    expect(JSON.stringify(encodeGraph(r))).toBe(after);
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
