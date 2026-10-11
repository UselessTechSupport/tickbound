import {
  BANK_SLOTS, GARDEN_POTIONS, MATERIAL_VALUE, Materials, PET_BUFFS, StructureId, TROPHY_BONUS, TROPHY_MOUNTS,
  WORKBENCH_XP, materialsFrom, petBonus,
} from '../data/construction';
import { NPCS } from '../data/npcs';
import { priceOf } from '../data/prices';
import type { CampSetup, GameState } from '../game/GameState';
import type { MetaSave } from '../save/meta';

/** What camp structures and your pet give a new run. Hands over (and empties) the bank chest. */
export function campSetupFor(m: MetaSave): CampSetup {
  const lvl = (id: StructureId) => m.structures[id] ?? 0;
  const bosses = Object.values(NPCS).filter((n) => n.boss && (m.killCounts[n.id] ?? 0) > 0).length;
  const petBuff = m.activePet ? PET_BUFFS[m.activePet] : undefined;
  const carried = m.bank;
  m.bank = [];
  return {
    carried,
    gardenPotions: GARDEN_POTIONS[lvl('herb_garden')],
    superPotions: m.bestDepth >= 10,
    trophy: TROPHY_BONUS * Math.min(bosses, TROPHY_MOUNTS[lvl('trophy_room')]),
    workbench: WORKBENCH_XP[lvl('workbench')],
    startRelic: lvl('relic_altar') ? m.startRelic : null,
    pet: petBuff && lvl('pet_kennel') ? { kind: petBuff.kind, amount: petBonus(m.petFloors[m.activePet!] ?? 0, lvl('pet_kennel')) } : null,
  };
}

/**
 * End of a run: carried logs/ores/bars become camp materials, the bank chest keeps your most
 * valuable other items, found relics are remembered, and your pet gains the floors it came along for.
 * Returns the materials gained.
 */
export function settleRun(m: MetaSave, g: GameState): Materials {
  const pack = g.player.inventory.slots.filter((s): s is { id: string; qty: number } => !!s);
  const mats = materialsFrom(pack);
  m.materials.timber += mats.timber;
  m.materials.metal += mats.metal;
  const keep = BANK_SLOTS[m.structures.bank_chest ?? 0];
  if (keep) {
    m.bank = pack.filter((s) => s.id !== 'coins' && !MATERIAL_VALUE[s.id])
      .sort((a, b) => priceOf(b.id) * b.qty - priceOf(a.id) * a.qty)
      .slice(0, keep)
      .map((s) => ({ ...s }));
  }
  for (const r of g.relics) if (!m.relicsFound.includes(r)) m.relicsFound.push(r);
  if (m.activePet) m.petFloors[m.activePet] = (m.petFloors[m.activePet] ?? 0) + Math.max(0, g.depth - 1);
  return mats;
}
