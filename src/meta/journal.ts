import { ACHIEVEMENTS } from '../data/achievements';
import { ARMOURY, ARMOURY_LINES } from '../data/armoury';
import { ALL_LOG_SLOTS } from '../data/collectionLog';
import { STRUCTURES } from '../data/construction';
import { MAX_MASTERY, masteryLevel } from '../data/mastery';
import { QUESTS } from '../data/quests';
import { PERKS } from '../data/skillTree';
import { SKILLS } from '../data/skills';
import type { MetaSave } from '../save/meta';

/** One line of the progress journal: how far through a system you are. */
export interface JournalLine {
  name: string;
  have: number;
  total: number;
}

/** Long-term completion across every progression system (the J window). */
export function journal(m: MetaSave): JournalLine[] {
  const perkRanks = PERKS.reduce((n, p) => n + Math.min(m.perks[p.id] ?? 0, p.costs.length), 0);
  const perkTotal = PERKS.reduce((n, p) => n + p.costs.length, 0);
  const armouryHave = ARMOURY_LINES.reduce((n, l) => n + m.armoury[l], 0);
  const armouryTotal = ARMOURY_LINES.reduce((n, l) => n + ARMOURY[l].tiers.length, 0);
  const structHave = STRUCTURES.reduce((n, s) => n + (m.structures[s.id] ?? 0), 0);
  const structTotal = STRUCTURES.reduce((n, s) => n + s.levels.length, 0);
  const mastery = SKILLS.reduce((n, s) => n + masteryLevel(m.masteryPoints[s] ?? 0), 0);
  const log = ALL_LOG_SLOTS.filter((id) => (m.collection[id] ?? 0) > 0 || m.pets.includes(id)).length;
  return [
    { name: 'Skill tree ranks', have: perkRanks, total: perkTotal },
    { name: 'Armourer tiers', have: armouryHave, total: armouryTotal },
    { name: 'Camp structures', have: structHave, total: structTotal },
    { name: 'Skill mastery', have: mastery, total: SKILLS.length * MAX_MASTERY },
    { name: 'Collection log', have: log, total: ALL_LOG_SLOTS.length },
    { name: 'Achievements', have: m.achievements.length, total: ACHIEVEMENTS.length },
    { name: 'Quests', have: m.questsDone.length, total: QUESTS.length },
  ];
}

/** Overall completion: the average of every system, so each one counts the same. */
export function overallCompletion(lines: JournalLine[]): number {
  return lines.reduce((n, l) => n + Math.min(1, l.have / l.total), 0) / lines.length;
}

/** Tokens spent on perks, the Armourer and the Builder (an estimate of total investment). */
export function journalSpent(m: MetaSave): number {
  let n = 0;
  for (const p of PERKS) n += p.costs.slice(0, m.perks[p.id] ?? 0).reduce((a, b) => a + b, 0);
  for (const l of ARMOURY_LINES) n += ARMOURY[l].tiers.slice(0, m.armoury[l]).reduce((a, t) => a + t.cost, 0);
  for (const s of STRUCTURES) n += s.levels.slice(0, m.structures[s.id] ?? 0).reduce((a, lv) => a + lv.tokens, 0);
  return n;
}
