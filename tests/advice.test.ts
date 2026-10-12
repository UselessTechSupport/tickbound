import { describe, expect, it } from 'vitest';
import { campAdvice } from '../src/meta/advice';
import { freshMeta } from '../src/save/meta';

describe('camp advisor', () => {
  it('points new players at their first run, then their first tool', () => {
    const m = freshMeta();
    expect(campAdvice(m)).toMatch(/first run/);
    m.runs = 1;
    m.tokens = 30;
    expect(campAdvice(m)).toMatch(/Toolsmith/);
  });

  it('suggests an affordable perk, then the Builder when materials allow', () => {
    const m = freshMeta();
    m.runs = 3;
    m.tools = { ...m.tools, axe: 1, fishing: 1, tinderbox: true };
    m.tokens = 20;
    expect(campAdvice(m)).toMatch(/Mentor/);
    m.runs = 50;
    m.tokens = 100;
    m.perks = Object.fromEntries(['basic_training'].map((id) => [id, 5]));
    m.materials = { timber: 100, metal: 100 };
    expect(campAdvice(m)).toMatch(/Builder/);
  });
});
