import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState';
import { effectiveLevel, maxHit } from '../src/systems/combat';
import { itemInfo } from '../src/ui/itemInfo';

describe('item tooltips', () => {
  it('shows weapon speed, range, bonuses, requirements and value', () => {
    const g = new GameState(1);
    const lines = itemInfo('rune_scimitar', g.player).join('\n');
    expect(lines).toContain('Melee weapon: speed 4 ticks (2.4s), range 1');
    expect(lines).toContain('Att +45, Str +44');
    expect(lines).toContain('Requires Attack 40  (your level is too low)');
    expect(lines).toMatch(/vs Bronze dagger: Att \+41, Str \+41/);
    expect(lines).toMatch(/Value 3,000 gp/);
  });

  it('describes bows, staffs, armour penalties and consumables', () => {
    const p = new GameState(2).player;
    expect(itemInfo('yew_shortbow', p).join('\n')).toContain('Ranged weapon: speed 4 ticks (2.4s), range 7');
    expect(itemInfo('staff_of_fire', p).join('\n')).toContain('Provides unlimited fire runes');
    expect(itemInfo('rune_platebody', p).join('\n')).toContain('Def +82, Rng -8, Mage -20');
    expect(itemInfo('lobster', p).join('\n')).toContain('Heals 12 HP');
    expect(itemInfo('rune_arrow', p).join('\n')).toContain('Rng str +49');
  });
});

describe('combat preview', () => {
  it('matches the max hit formula and reacts to style and gear', () => {
    const g = new GameState(3);
    const p = g.player;
    p.skills.addXp('strength', 1_000_000); // level 70ish
    const str = p.skills.level('strength');
    g.setStyle('aggressive');
    expect(g.combatPreview().maxHit).toBe(maxHit(effectiveLevel(str, 3), p.bonuses().strength));
    expect(g.combatPreview().speed).toBe(4);
    expect(g.combatPreview().range).toBe(1);
  });

  it('flags missing ammo and runes', () => {
    const g = new GameState(4);
    g.player.equipment.weapon = 'shortbow';
    expect(g.combatPreview().problem).toMatch(/no ammo/);
    g.player.equipment.ammo = 'bronze_arrow';
    g.player.ammo = 10;
    expect(g.combatPreview().problem).toBeUndefined();
    expect(g.combatPreview().range).toBe(7);
    g.player.equipment.weapon = 'staff';
    expect(g.combatPreview().problem).toMatch(/runes/);
  });
});
