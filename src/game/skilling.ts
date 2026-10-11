import { RNG } from 'rot-js';
import { XP_RATE } from '../data/balance';
import { item } from '../data/items';
import { Recipe } from '../data/recipes';
import { ResourceDef } from '../data/resources';
import { SKILL_LABELS } from '../data/skills';
import { FISHING_GEAR, TOOL_TIERS, usableTier } from '../data/tools';
import { Player } from '../entities/Player';
import { ResourceNode } from '../entities/ResourceNode';
import type { GameState } from './GameState';

/** Ticks between crafted items when repeating (cook, smelt). */
export const PROCESS_TICKS = 4;

const lower = (id: string) => item(id).name.toLowerCase();

/** Tool tier usable for a resource (0 for fishing, which has no tiers). */
function toolTier(p: Player, def: ResourceDef): number {
  const level = p.skills.level(def.skill);
  if (def.kind === 'rock') return usableTier(p.tools.pickaxe, level);
  if (def.kind === 'tree') return usableTier(p.tools.axe, level);
  return 0;
}

/** Why the player can't gather from this node, or null if they can. */
export function gatherBlocker(p: Player, node: ResourceNode): string | null {
  const def = node.def!;
  if (def.kind === 'rock' && !p.tools.pickaxe) return 'You need a pickaxe to mine this rock. Unlock one between runs.';
  if (def.kind === 'tree' && !p.tools.axe) return 'You need an axe to chop down this tree. Unlock one between runs.';
  if (def.kind === 'fishing' && p.tools.fishing < def.fishingTier!) {
    return `You need a ${FISHING_GEAR[def.fishingTier! - 1].toLowerCase()} to fish here. Unlock one between runs.`;
  }
  if (p.skills.level(def.skill) < def.level) {
    return `You need a ${SKILL_LABELS[def.skill]} level of ${def.level} to ${def.verb.toLowerCase()} this.`;
  }
  if (!p.inventory.canAdd(def.product)) return `Your inventory is too full to hold any more ${lower(def.product)}.`;
  return null;
}

export function gatherStartMessage(p: Player, def: ResourceDef): string {
  const tier = toolTier(p, def);
  if (def.kind === 'rock') return `You swing your ${TOOL_TIERS[tier - 1].name.toLowerCase()} pickaxe at the rock.`;
  if (def.kind === 'tree') return `You swing your ${TOOL_TIERS[tier - 1].name.toLowerCase()} axe at the tree.`;
  if (def.kind === 'herb') return 'You start picking herbs.';
  return 'You attempt to catch some fish.';
}

/** Chance that one gathering roll succeeds. Grows with level above the requirement and tool tier. */
export function gatherChance(level: number, def: ResourceDef, tier: number, perkBonus = 0): number {
  const toolBonus = tier > 0 ? (tier - 1) * 0.06 : 0;
  return Math.min(0.95, Math.max(0.08, 0.3 + (level - def.level) * 0.02 + toolBonus + perkBonus));
}

/** One gathering roll. Returns false when the player should stop. */
export function gatherRoll(g: GameState, node: ResourceNode): boolean {
  const p = g.player;
  const def = node.def!;
  if (RNG.getUniform() >= gatherChance(p.skills.level(def.skill), def, toolTier(p, def), g.mods.gatherBonus)) return true;

  p.inventory.add(def.product);
  g.sound(def.kind === 'rock' ? 'mine' : def.kind === 'tree' ? 'chop' : 'fish');
  g.stat('gathers');
  g.made(def.product);
  if (RNG.getUniform() < g.mods.doubleResourceChance && p.inventory.canAdd(def.product)) {
    p.inventory.add(def.product);
    g.message('Rich Veins: you gather an extra one!');
  }
  node.remaining--;
  g.message(def.kind === 'fishing' ? `You catch some ${lower(def.product).replace('raw ', '')}.`
    : def.kind === 'herb' ? `You pick some ${lower(def.product)}.` : `You get some ${lower(def.product)}.`);
  if (def.kind === 'herb') g.stat('herbs');
  g.giveXp(def.skill, def.xp * XP_RATE);

  if (node.depleted) {
    if (def.kind === 'tree') g.message('The tree falls.');
    if (def.kind === 'fishing') g.message('The fishing spot runs dry.');
    if (def.kind === 'herb') g.message('The patch is bare.');
    return false;
  }
  const why = gatherBlocker(p, node);
  if (why) g.message(why);
  return !why;
}

export function hasInputs(p: Player, recipe: Recipe): boolean {
  return recipe.inputs.every((i) => p.inventory.count(i.item) >= i.qty);
}

/** Why the player can't make this recipe, or null if they can. */
export function processBlocker(p: Player, recipe: Recipe): string | null {
  const what = lower(recipe.output);
  if (recipe.station === 'anvil' && !p.tools.hammer) return 'You need a hammer to work the metal with. Unlock one between runs.';
  if (recipe.station === 'fletch' && !p.tools.knife) return 'You need a knife to fletch. Buy one from the Toolsmith between runs.';
  if (p.skills.level(recipe.skill) < recipe.level) {
    const verb = { fire: 'cook', furnace: 'smelt', anvil: 'make', mix: 'mix', fletch: 'fletch' }[recipe.station];
    return `You need a ${SKILL_LABELS[recipe.skill]} level of ${recipe.level} to ${verb} ${recipe.station === 'anvil' ? 'a ' : ''}${what}.`;
  }
  if (!hasInputs(p, recipe)) {
    if (recipe.station === 'anvil') return `You don't have enough bars to make a ${what}.`;
    if (recipe.station === 'fletch') {
      return `You need ${recipe.inputs.map((i) => item(i.item).name.toLowerCase()).join(' and ')} to fletch that.`;
    }
    if (recipe.station === 'mix') {
      const [herb, secondary] = recipe.inputs.map((i) => item(i.item).name.toLowerCase());
      return `You need ${herb}, ${secondary} and a vial of water to mix a ${what}.`;
    }
    return `You don't have the ${recipe.station === 'fire' ? 'food' : 'ore'} for that.`;
  }
  return null;
}

/** Cooking burn chance: 45% at the required level, falling to 0 at the stop-burn level. */
export function burnChance(level: number, recipe: Recipe): number {
  if (!recipe.stopBurn || level >= recipe.stopBurn) return 0;
  return 0.45 * (recipe.stopBurn - level) / (recipe.stopBurn - recipe.level);
}

/** Consumes inputs and produces one output (or burnt food). */
export function processStep(g: GameState, recipe: Recipe): void {
  const p = g.player;
  for (const i of recipe.inputs) p.inventory.remove(i.item, i.qty);
  const what = lower(recipe.output);

  if (recipe.station === 'fire' && RNG.getUniform() < burnChance(p.skills.level('cooking'), recipe) * g.mods.burnMult) {
    p.inventory.add('burnt_fish');
    g.sound('burn');
    g.message(`You accidentally burn the ${what}.`);
    return;
  }
  const qty = recipe.outputQty ?? 1;
  if (!p.inventory.add(recipe.output, qty)) g.dropHere(recipe.output, qty);
  g.sound(recipe.station === 'fire' ? 'cook' : 'smith');
  if (recipe.station === 'fletch') g.stat('fletches');
  g.made(recipe.output);
  if (recipe.station === 'fire') g.stat('cooks');
  if (recipe.station === 'anvil') g.stat('smiths');
  if (recipe.station === 'anvil' && RNG.getUniform() < g.mods.saveBarChance) {
    p.inventory.add(recipe.inputs[0].item);
    g.message('Master Smith: you save a bar!');
  }
  g.message(
    recipe.station === 'fire' ? `You cook the ${what}.`
      : recipe.station === 'furnace' ? `You retrieve a bar of ${what.replace(' bar', '')}.`
        : recipe.station === 'mix' ? `You mix the ingredients into a ${what}.`
          : recipe.station === 'fletch' ? (qty > 1 ? `You fletch ${qty} ${what}s.` : `You carefully cut the wood into a ${what}.`)
          : `You hammer the metal and make a ${what}.`,
  );
  g.giveXp(recipe.skill, recipe.xp * XP_RATE);
}
