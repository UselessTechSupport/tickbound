import { ITEMS } from './items';
import { NPCS } from './npcs';

/** Boss pets: very rare cosmetic followers. */
export const PET_CHANCE = 1 / 50;

export interface PetDef {
  id: string;
  name: string;
  bossId: string;
}

export const PETS: PetDef[] = [
  { id: 'pet_goblin_warlord', name: 'Goblin Warlord jr.', bossId: 'goblin_warlord' },
  { id: 'pet_tztok_jad', name: 'TzRek-Jad', bossId: 'tztok_jad' },
  { id: 'pet_chaos_elemental', name: 'Pet chaos elemental', bossId: 'chaos_elemental' },
  { id: 'pet_demonic_gorilla', name: 'Demonic gorilla jr.', bossId: 'demonic_gorilla' },
];

export const PET_BY_ID: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const petForBoss = (bossId: string) => PETS.find((p) => p.bossId === bossId);

/** Supplies everyone gets plenty of; the log is for the interesting stuff. */
function isCommon(id: string): boolean {
  const d = ITEMS[id];
  return !d || id === 'coins' || !!d.heal || !!d.buryXp || !!d.restoresPrayer || !!d.boost || !!d.herblore
    || d.id.endsWith('_rune') || d.id.endsWith('_arrow');
}

export interface LogCategory {
  id: string;
  name: string;
  /** Item (or pet) ids that fill this page. */
  slots: string[];
  /** Monster whose kill count is shown on the page. */
  killCountOf?: string;
}

const uniq = (ids: string[]) => [...new Set(ids)];

/** Pages built from the drop tables, so new drops appear automatically. */
export const LOG_CATEGORIES: LogCategory[] = [
  ...Object.values(NPCS).filter((n) => n.boss).sort((a, b) => a.boss!.floor - b.boss!.floor).map((boss) => ({
    id: boss.id,
    name: boss.name,
    slots: uniq([...boss.drops.map((d) => d.item).filter((i) => !isCommon(i)), petForBoss(boss.id)?.id ?? '']).filter(Boolean),
    killCountOf: boss.id,
  })),
  {
    id: 'monsters',
    name: 'Dungeon monsters',
    slots: uniq(Object.values(NPCS).filter((n) => !n.boss).flatMap((n) => n.drops.map((d) => d.item)).filter((i) => !isCommon(i))),
  },
  {
    id: 'chests',
    name: 'Treasure chests',
    slots: ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune'].flatMap((m) => [`${m}_scimitar`, `${m}_kiteshield`, `${m}_platebody`]),
    killCountOf: 'mimic',
  },
  { id: 'pets', name: 'All pets', slots: PETS.map((p) => p.id) },
];

/** Every distinct loggable id, for "x / y" totals. */
export const ALL_LOG_SLOTS = uniq(LOG_CATEGORIES.flatMap((c) => c.slots));
