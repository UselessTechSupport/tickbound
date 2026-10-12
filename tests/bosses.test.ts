import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';

/** A boss floor with the player standing next to the boss. */
function bossFight(depth: number, seed = 1) {
  const g = new GameState(seed);
  g.loadFloor(depth);
  const boss = g.npcs.find((n) => n.isBoss)!;
  g.npcs = [boss];
  g.player.skills.xp.hitpoints = 1e7;
  g.player.hp = g.player.maxHp;
  return { g, boss };
}
const strike = (g: GameState, npc: unknown, dmg: number) =>
  (g as unknown as { strikeFixed(n: unknown, d: number, c: unknown): number }).strikeFixed(npc, dmg, g.combatPreview());

describe('boss mechanics', () => {
  it('the Goblin Warlord calls two goblins at half HP, once', () => {
    const { g, boss } = bossFight(5);
    strike(g, boss, Math.ceil(boss.maxHp * 0.55));
    expect(g.npcs.length).toBe(3);
    strike(g, boss, 1);
    expect(g.npcs.length).toBe(3);
  });

  it('the Lich raises skeletons at 2/3 and 1/3 HP', () => {
    const { g, boss } = bossFight(25);
    strike(g, boss, Math.ceil(boss.maxHp * 0.4));
    expect(g.npcs.filter((n) => n.name === 'Risen skeleton').length).toBe(2);
    strike(g, boss, Math.ceil(boss.maxHp * 0.35));
    expect(g.npcs.filter((n) => n.name === 'Risen skeleton').length).toBe(4);
  });

  it("the Wyrm's dragonfire gets through protection prayers (halved)", () => {
    const { g, boss } = bossFight(30);
    g.player.prayerPoints = 99;
    g.player.activePrayers.add('protect_magic');
    const hp = g.player.hp;
    boss.specialCount = 4; // the next attack is the 5th
    (g as unknown as { npcAttack(n: unknown): void }).npcAttack(boss);
    expect(g.messages.at(-1)).toMatch(/dragonfire|cheat death/);
    expect(g.player.hp).toBeLessThan(hp);
  });
});

describe('the demonic gorilla', () => {
  it('prays against a style you use three times in a row', () => {
    const { g, boss } = bossFight(20);
    for (let i = 0; i < 3; i++) strike(g, boss, 1);
    expect(boss.prayingAgainst).toBe('melee');
    const before = boss.hp;
    strike(g, boss, 20);
    expect(before - boss.hp).toBe(5);
  });
});

describe('new elite affixes', () => {
  it('Regenerating heals over time; Splitting leaves two lesser copies', async () => {
    const { ELITE_AFFIXES, eliteDef } = await import('../src/data/elites');
    const { NPCS } = await import('../src/data/npcs');
    const { Npc } = await import('../src/entities/Npc');
    const g = new GameState(77);
    g.npcs.length = 0;
    const regen = ELITE_AFFIXES.find((a) => a.id === 'regenerating')!;
    const far = { x: g.player.pos.x, y: g.player.pos.y };
    const r = Object.assign(new Npc(eliteDef(NPCS.hill_giant, regen), far), { elite: regen });
    r.hp = 10;
    g.npcs.push(r);
    for (let i = 0; i < 10; i++) g.tick();
    expect(r.hp).toBeGreaterThan(10);
    const split = ELITE_AFFIXES.find((a) => a.id === 'splitting')!;
    const s = Object.assign(new Npc(eliteDef(NPCS.hill_giant, split), far), { elite: split });
    g.npcs = [s];
    (g as unknown as { killNpc(n: unknown): void }).killNpc(s);
    expect(g.npcs.filter((n) => n.name.startsWith('Lesser')).length).toBe(2);
    expect(g.npcs.every((n) => n.def.drops.length === 0)).toBe(true);
  });
});

describe('floor 35 and 40 bosses', () => {
  it('the Hollow King halves your prayer every 4th attack; the Void Titan summons void spawn', () => {
    const hk = bossFight(35);
    hk.g.player.prayerPoints = 40;
    hk.boss.specialCount = 3;
    (hk.g as unknown as { npcAttack(n: unknown): void }).npcAttack(hk.boss);
    expect(hk.g.player.prayerPoints).toBe(20);
    const vt = bossFight(40);
    vt.boss.specialCount = 5;
    (vt.g as unknown as { npcAttack(n: unknown): void }).npcAttack(vt.boss);
    expect(vt.g.npcs.some((n) => n.name === 'Void spawn')).toBe(true);
  });
});
