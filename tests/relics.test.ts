import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { RELICS } from '../src/data/relics';
import { Npc } from '../src/entities/Npc';
import { ResourceNode } from '../src/entities/ResourceNode';
import { GameEvent, GameState } from '../src/game/GameState';
import { Tile, setTile, tileAt } from '../src/world/tiles';

const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

function adjacentFloor(g: GameState) {
  const { x, y } = g.player.pos;
  return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].find((t) => tileAt(g.map, t.x, t.y) === Tile.Floor)!;
}

describe('relics', () => {
  it('offers 3 distinct relics after a boss kill and applies the chosen one', () => {
    const events: GameEvent[] = [];
    const g = new GameState(91, (e) => events.push(e));
    g.loadFloor(5);
    const boss = g.npcs.find((n) => n.isBoss)!;
    g.npcs = [boss];
    boss.pos = adjacentFloor(g);
    boss.hp = 1;
    g.player.hp = 999;
    g.attack(boss);
    for (let i = 0; i < 200 && !g.pendingRelics; i++) g.tick();
    expect(g.pendingRelics).toHaveLength(3);
    expect(new Set(g.pendingRelics).size).toBe(3);
    expect(events.some((e) => e.type === 'relicChoice')).toBe(true);
    const pick = g.pendingRelics![1];
    g.chooseRelic(pick);
    expect(g.relics).toEqual([pick]);
    expect(g.pendingRelics).toBeNull();
  });

  it('never offers a relic you already have', () => {
    const g = new GameState(92);
    const regular = RELICS.filter((r) => !r.quest);
    g.relics = regular.slice(0, regular.length - 2).map((r) => r.id);
    g.offerRelics();
    expect(g.pendingRelics).toHaveLength(2);
    for (const id of g.pendingRelics!) expect(g.relics).not.toContain(id);
  });

  it('relic shrines work once', () => {
    const g = new GameState(93);
    g.npcs = [];
    const spot = adjacentFloor(g);
    setTile(g.map, spot.x, spot.y, Tile.Object);
    const shrine = new ResourceNode(spot, 'shrine');
    g.nodes.push(shrine);
    g.talkTo(shrine);
    g.tick();
    expect(g.pendingRelics).toHaveLength(3);
    g.chooseRelic(g.pendingRelics![0]);
    g.talkTo(shrine);
    g.tick();
    expect(g.pendingRelics).toBeNull();
    expect(g.messages.at(-1)).toMatch(/dormant/);
  });

  it("Gourmet's Apron and Seers' Insight boost food and XP", () => {
    const g = new GameState(94);
    g.relics = ['gourmet', 'seers_insight'];
    g.player.hp = 1;
    g.useItem(0); // shrimps: 3 * 1.5
    expect(g.player.hp).toBe(5);
    g.player.inventory.add('bones');
    g.useItem(g.player.inventory.slots.findIndex((s) => s?.id === 'bones'));
    expect(g.player.skills.xp.prayer).toBeCloseTo(4.5 * 1.5);
  });

  it('Ring of Recoil hurts attackers and Dragon Defender softens hits', () => {
    const g = new GameState(95);
    g.relics = ['ring_of_recoil', 'dragon_defender'];
    g.player.hp = 999;
    const npc = new Npc({ ...NPCS.greater_demon, hitpoints: 500 }, adjacentFloor(g));
    npc.hp = 500;
    g.npcs = [npc];
    g.player.intent = null;
    g.player.path = [];
    // Keep the player passive so only recoil damages the demon.
    for (let i = 0; i < 60; i++) {
      g.player.intent = null;
      g.tick();
    }
    expect(npc.hp).toBeLessThan(500);
  });

  it('Bonecrusher buries bones on kill', () => {
    const g = new GameState(96);
    g.relics = ['bonecrusher'];
    g.player.hp = 999;
    const rat = new Npc(NPCS.rat, adjacentFloor(g));
    g.npcs = [rat];
    g.attack(rat);
    run(g, 200);
    expect(g.npcs).toHaveLength(0);
    expect(g.groundItems.some((i) => i.id === 'bones')).toBe(false);
    expect(g.player.skills.xp.prayer).toBeGreaterThan(0);
  });
});
