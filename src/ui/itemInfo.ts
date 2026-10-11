import { XP_RATE } from '../data/balance';
import { EquipStats, item } from '../data/items';
import { potionRestore } from '../data/prayers';
import { priceOf, sellPriceOf } from '../data/prices';
import { SKILL_LABELS } from '../data/skills';
import type { Player } from '../entities/Player';

const TICK_SECONDS = 0.6;

const STATS: Array<[keyof EquipStats, string]> = [
  ['attackBonus', 'Att'], ['strengthBonus', 'Str'], ['defenceBonus', 'Def'],
  ['rangedBonus', 'Rng'], ['rangedStrength', 'Rng str'], ['magicBonus', 'Mage'],
];

const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`;
const num = (e: EquipStats, k: keyof EquipStats) => (e[k] as number | undefined) ?? 0;

/** "Att +45, Str +44" — only the non-zero bonuses. */
export function bonusLine(e: EquipStats): string {
  return STATS.filter(([k]) => num(e, k)).map(([k, label]) => `${label} ${signed(num(e, k))}`).join(', ');
}

export function speedText(ticks: number): string {
  return `${ticks} ticks (${(ticks * TICK_SECONDS).toFixed(1)}s)`;
}

/** Differences from the item currently worn in the same slot. */
function compareLine(e: EquipStats, worn: EquipStats): string {
  const parts = STATS.map(([k, label]) => [label, num(e, k) - num(worn, k)] as const)
    .filter(([, d]) => d !== 0)
    .map(([label, d]) => `${label} ${signed(d)}`);
  if (e.slot === 'weapon') {
    const ds = (e.attackSpeed ?? 4) - (worn.attackSpeed ?? 4);
    if (ds) parts.push(`${ds < 0 ? 'faster' : 'slower'} by ${Math.abs(ds)} tick${Math.abs(ds) > 1 ? 's' : ''}`);
    const dr = (e.attackRange ?? 1) - (worn.attackRange ?? 1);
    if (dr) parts.push(`range ${signed(dr)}`);
  }
  return parts.join(', ') || 'same bonuses';
}

/** Tooltip lines for an item: what it does, its stats, requirements and value. */
export function itemInfo(id: string, p: Player): string[] {
  const d = item(id);
  const lines = [d.name];
  const e = d.equip;
  if (e) {
    if (e.slot === 'weapon') {
      const style = e.combatStyle ?? 'melee';
      lines.push(`${style[0].toUpperCase()}${style.slice(1)} weapon: speed ${speedText(e.attackSpeed ?? 4)}, range ${e.attackRange ?? 1}`);
      if (e.providesRune) lines.push(`Provides unlimited ${item(e.providesRune).name.toLowerCase()}s`);
    } else {
      lines.push(`${e.slot[0].toUpperCase()}${e.slot.slice(1)} slot`);
    }
    const bonuses = bonusLine(e);
    if (bonuses) lines.push(bonuses);
    if (e.req) {
      const low = p.skills.level(e.req.skill) < e.req.level;
      lines.push(`Requires ${SKILL_LABELS[e.req.skill]} ${e.req.level}${low ? '  (your level is too low)' : ''}`);
    }
    const wornId = p.equipment[e.slot];
    if (wornId && wornId !== id) lines.push(`vs ${item(wornId).name}: ${compareLine(e, item(wornId).equip!)}`);
  }
  if (d.heal) lines.push(`Heals ${d.heal} HP`);
  if (d.restoresPrayer) lines.push(`Restores ${potionRestore(p.maxPrayer)} prayer points`);
  if (d.buryXp) lines.push(`Bury for ${d.buryXp * XP_RATE} Prayer XP`);
  if (d.burnTicks) lines.push(`Light it for a fire lasting ${Math.round(d.burnTicks * TICK_SECONDS)}s`);
  const value = priceOf(id);
  if (value) lines.push(`Value ${value.toLocaleString()} gp (merchants pay ${sellPriceOf(id).toLocaleString()})`);
  return lines;
}
