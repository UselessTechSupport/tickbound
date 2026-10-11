import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, AchievementDef, Counter, tierOf } from '../data/achievements';
import { ALL_LOG_SLOTS, petForBoss } from '../data/collectionLog';
import { item } from '../data/items';
import type { GameEvent, GameState } from '../game/GameState';
import type { MetaSave } from '../save/meta';

/** Something worth telling the player about. */
export type Notice =
  | { kind: 'achievement'; id: string; name: string; reward: number }
  | { kind: 'collection'; id: string; name: string }
  | { kind: 'pet'; id: string; name: string };

/** Events that can move achievement progress; everything else is skipped cheaply. */
const TRACKED = new Set<GameEvent['type']>(['kill', 'obtain', 'stat', 'pet', 'floor', 'levelup', 'death']);

/**
 * Turns game events into lifetime progress: kill counts, the collection log,
 * pets, counters and achievements. Mutates the save; the caller persists it.
 */
export class ProgressTracker {
  /** True when the save changed since the last `takeDirty()`. */
  private dirty = false;

  constructor(private meta: MetaSave) {}

  takeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  progress(a: AchievementDef): [number, number] | null {
    if (!a.counter) return null;
    const [key, target] = a.counter;
    return [Math.min(target, this.meta.lifetime[key] ?? 0), target];
  }

  handle(e: GameEvent, game: GameState): Notice[] {
    if (!TRACKED.has(e.type)) return [];
    const m = this.meta;
    const notices: Notice[] = [];
    const bump = (key: Counter, n = 1) => {
      m.lifetime[key] = (m.lifetime[key] ?? 0) + n;
      this.dirty = true;
    };
    const log = (id: string, qty: number, name: string) => {
      if (!ALL_LOG_SLOTS.includes(id)) return;
      if (!m.collection[id]) notices.push({ kind: 'collection', id, name });
      m.collection[id] = (m.collection[id] ?? 0) + qty;
      this.dirty = true;
    };

    switch (e.type) {
      case 'kill':
        m.killCounts[e.npcId] = (m.killCounts[e.npcId] ?? 0) + 1;
        bump('kills');
        if (e.weakness) bump('weaknessKills');
        if (e.npcId === 'mimic') bump('mimicKills');
        if (e.style === 'ranged') bump('rangedKills');
        if (e.style === 'magic') bump('magicKills');
        if (e.flawless) this.complete(ACHIEVEMENT_BY_ID.untouchable, notices);
        break;
      case 'obtain':
        log(e.item, e.qty, item(e.item).name);
        break;
      case 'stat':
        bump(e.key, e.amount);
        break;
      case 'pet': {
        const pet = petForBoss(e.bossId);
        if (pet && !m.pets.includes(pet.id)) {
          m.pets.push(pet.id);
          m.activePet ??= pet.id;
          notices.push({ kind: 'pet', id: pet.id, name: pet.name });
          log(pet.id, 1, pet.name);
        }
        break;
      }
    }

    const ctx = { meta: m, game };
    for (const a of ACHIEVEMENTS) {
      if (m.achievements.includes(a.id)) continue;
      const done = a.counter ? (m.lifetime[a.counter[0]] ?? 0) >= a.counter[1] : a.check?.(ctx) ?? false;
      if (done) this.complete(a, notices);
    }
    return notices;
  }

  private complete(a: AchievementDef, notices: Notice[]): void {
    const m = this.meta;
    if (m.achievements.includes(a.id)) return;
    m.achievements.push(a.id);
    const reward = tierOf(a).reward;
    m.tokens += reward;
    this.dirty = true;
    notices.push({ kind: 'achievement', id: a.id, name: a.name, reward });
  }
}

