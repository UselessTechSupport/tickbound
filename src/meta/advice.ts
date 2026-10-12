import { ARMOURY_LINES, nextArmouryTier } from '../data/armoury';
import { nextStructureLevel, STRUCTURES } from '../data/construction';
import { PERKS, nextRankCost, perkBlocker } from '../data/skillTree';
import { nextUnlocks } from '../data/tools';
import type { MetaSave } from '../save/meta';

/**
 * The camp advisor: one short, relevant suggestion for what to do next, so new players
 * always have a goal and veterans are reminded of things they can afford.
 */
export function campAdvice(m: MetaSave): string | null {
  const t = m.tools;
  const cheapestTool = nextUnlocks(t).sort((a, b) => a.cost - b.cost)[0];
  if (m.runs === 0) return 'Tip: take the ladder to start your first run. Kill monsters and go deep for Dungeoneering tokens.';
  if (!t.pickaxe && !t.axe && !t.fishing && cheapestTool && m.tokens >= cheapestTool.cost) {
    return `Tip: you can afford a ${cheapestTool.label} from the Toolsmith. Tools let you gather food and materials in runs.`;
  }
  const affordablePerk = PERKS.filter((p) => !perkBlocker(m.perks, m.tokens, p.id))
    .sort((a, b) => (nextRankCost(m.perks, a.id) ?? 0) - (nextRankCost(m.perks, b.id) ?? 0))[0];
  if (affordablePerk && m.runs < 10) return `Tip: the Mentor can teach you ${affordablePerk.name} (${nextRankCost(m.perks, affordablePerk.id)} tokens).`;
  if ((m.perks.veterans_kit ?? 0) > 0) {
    const line = ARMOURY_LINES.find((l) => {
      const tier = nextArmouryTier(m.armoury, l);
      return tier && m.tokens >= tier.cost;
    });
    if (line && m.runs < 30) return `Tip: the Armourer has better starting gear you can afford: ${nextArmouryTier(m.armoury, line)!.label}.`;
  }
  const build = STRUCTURES.find((s) => {
    const next = nextStructureLevel(m.structures, s.id);
    return next && m.tokens >= next.tokens && m.materials.timber >= next.timber && m.materials.metal >= next.metal;
  });
  if (build) return `Tip: the Builder can ${(m.structures[build.id] ?? 0) ? 'upgrade' : 'build'} your ${build.name.toLowerCase()} with what you've saved.`;
  if (!m.slayerUnlocked && m.bestDepth >= 4) return 'Tip: defeat the Goblin Warlord on floor 5 to unlock Slayer.';
  if (!(m.perks.veterans_kit ?? 0) && m.tokens >= 60 && (m.perks.basic_training ?? 0) >= 2) {
    return "Tip: Veteran's Kit (Mentor, Melee branch) unlocks the Armourer and much better starting gear.";
  }
  if (affordablePerk) return `Tip: you can afford ${affordablePerk.name} at the Mentor (${nextRankCost(m.perks, affordablePerk.id)} tokens).`;
  return null;
}
