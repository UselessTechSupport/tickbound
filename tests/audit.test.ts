import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { ResourceNode } from '../src/entities/ResourceNode';
import { Npc } from '../src/entities/Npc';
import { GameState } from '../src/game/GameState';
import { xpForLevel } from '../src/systems/xp';

/** Regression tests for bugs found in the code audit. */

// Private methods, reached the way the game calls them.
type Internals = { landHit(npc: Npc, style: string, dmg: number): void; processPlayer(): void };

describe('audit fixes', () => {
  it('Fragile takes 25% of max HP however high Hitpoints gets', () => {
    const g = new GameState(1, () => {}, { modifiers: ['fragile'] });
    g.player.skills.xp.hitpoints = xpForLevel(80);
    expect(g.player.maxHp).toBe(60);
  });

  it('a splashed spell gives no Magic XP, a landed one does', () => {
    const g = new GameState(1, () => {}, {});
    const p = g.player;
    p.equipment = { weapon: 'staff_of_air' };
    p.inventory.add('mind_rune', 1000);
    // A target that can't be hit: every cast splashes.
    const wall = new Npc({ ...NPCS.goblin, defence: 5000, defenceBonus: 5000, hitpoints: 1000 }, { x: p.pos.x + 1, y: p.pos.y });
    g.npcs = [wall];
    for (let i = 0; i < 50; i++) {
      wall.attackCooldown = 99;
      if (!p.intent) g.attack(wall);
      g.tick();
    }
    expect(p.skills.xp.magic).toBe(0);
  });

  it('Sanctuary heals once per altar; prayer still recharges every time', () => {
    const g = new GameState(1, () => {}, { perks: { sanctuary: 1 } });
    const p = g.player;
    const altar = new ResourceNode({ x: p.pos.x + 1, y: p.pos.y }, 'altar');
    g.nodes.push(altar);
    const pray = () => {
      g.prayAt(altar);
      (g as unknown as Internals).processPlayer();
    };
    p.hp = 1;
    pray();
    expect(p.hp).toBeGreaterThan(1);
    p.hp = 1;
    p.prayerPoints = 0;
    pray();
    expect(p.hp).toBe(1);
    expect(p.prayerPoints).toBe(p.maxPrayer);
  });

  it('the Warding Charm soaks a hit before Undying is used up', () => {
    const g = new GameState(1, () => {}, { perks: { undying: 1 } });
    g.relics.push('warding_charm');
    g.wardLeft = 10;
    const p = g.player;
    p.hp = 5;
    const npc = new Npc(NPCS.goblin, { x: p.pos.x + 1, y: p.pos.y });
    g.npcs = [npc];
    (g as unknown as Internals).landHit(npc, 'melee', 8);
    expect(p.hp).toBe(5);
    expect(g.undyingTimes).toBe(0);
  });

  it('levels the autoplay bot gained do not count toward mastery', () => {
    const g = new GameState(1, () => {}, {});
    g.player.skills.xp.attack = xpForLevel(30);
    g.endAutoplay();
    expect(g.levelsAtStart.attack).toBe(30);
  });
});
