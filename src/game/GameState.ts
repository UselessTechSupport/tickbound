import { RNG } from 'rot-js';
import { EAT_DELAY, FOV_RADIUS, XP_RATE } from '../data/balance';
import { PerkRanks, RunMods, computeMods } from '../data/skillTree';
import { xpForLevel } from '../systems/xp';
import type { SoundName } from '../audio/sfx';
import { generateCamp } from '../world/camp';
import { item } from '../data/items';
import { Recipe } from '../data/recipes';
import { NO_TOOLS, Toolbelt } from '../data/tools';
import { ResourceNode } from '../entities/ResourceNode';
import { gatherBlocker, gatherRoll, gatherStartMessage, processBlocker, processStep, PROCESS_TICKS } from './skilling';
import { placeResources } from '../world/resources';
import { SKILL_LABELS, SkillName } from '../data/skills';
import { AttackType, DRAIN_RESISTANCE, PRAYER_BY_ID, PrayerGroup, potionRestore } from '../data/prayers';
import { SPELLS, SPELL_BY_ID, SpellDef } from '../data/spells';
import { WEAKNESS_PENALTY } from '../data/npcs';
import { RELICS, RELIC_BY_ID, RELIC_CHOICES } from '../data/relics';
import { Drop, MIMIC_CHANCE, mimicFor } from '../data/npcs';
import { chestLoot } from '../data/loot';
import { PET_CHANCE } from '../data/collectionLog';
import { SLAYER_BONUS_PER_LEVEL, SLAYER_BY_ID, SlayerTask } from '../data/slayer';
import { themeForDepth } from '../data/themes';
import type { Counter } from '../data/achievements';
import { sellPriceOf } from '../data/prices';

const ELEMENTAL_RUNES = ['air_rune', 'water_rune', 'earth_rune', 'fire_rune'];
import { Actor } from '../entities/Actor';
import { GroundItem } from '../entities/GroundItem';
import { Npc } from '../entities/Npc';
import { AttackStyle, Player, STYLE_SKILL } from '../entities/Player';
import { effectiveLevel, hitChance, maxHit, roll, rollDamage } from '../systems/combat';
import { generateFloor } from '../world/dungeonGen';
import { computeVisible } from '../world/fov';
import { findPath } from '../world/pathfinding';
import { spawnMonsters } from '../world/spawn';
import { FloorMap, Point, Tile, isWalkable, setTile, tileAt } from '../world/tiles';

export type GameEvent =
  | { type: 'hit'; target: Actor; damage: number }
  | { type: 'xp'; skill: SkillName; amount: number }
  | { type: 'levelup'; skill: SkillName; level: number }
  | { type: 'floor'; depth: number }
  | { type: 'death' }
  | { type: 'enterDungeon' }
  | { type: 'relicChoice'; options: string[] }
  // Progress tracking (achievements, collection log); see ProgressTracker.
  | { type: 'kill'; npcId: string; boss: boolean; style: AttackType; weakness: boolean; flawless: boolean }
  | { type: 'obtain'; item: string; qty: number; source: string }
  | { type: 'stat'; key: Counter; amount: number }
  | { type: 'pet'; bossId: string }
  | { type: 'made'; item: string }
  | { type: 'slayerDone'; tokens: number }
  | { type: 'sound'; name: SoundName }
  | { type: 'campMenu'; kind: 'mentor' | 'toolsmith' | 'merchant' | 'slayer' }
  | { type: 'projectile'; from: Point; to: Point; style: AttackType; ticks: number };

/** What the player's next attack would look like; see GameState.combatPreview. */
export interface CombatPreview {
  mode: AttackType;
  attackRoll: number;
  maxHit: number;
  /** Ticks between attacks. */
  speed: number;
  /** Tiles. */
  range: number;
  spell?: SpellDef;
  /** Why the player can't attack right now (no ammo, no runes...). */
  problem?: string;
}

/** A ranged/magic attack in flight; protection prayers are checked when it lands. */
interface PendingHit {
  npc: Npc;
  style: AttackType;
  damage: number;
  landsAt: number;
}

/** Projectile flight time in ticks: bosses give an extra tick to read and switch prayers. */
const PROJECTILE_TICKS = 1;
const BOSS_PROJECTILE_TICKS = 2;
/** Share of max prayer restored on each descent. */
/** Sight radius in the camp: it's small and fully lit. */
const CAMP_FOV = 40;

/** What a new GameState starts as: the camp hub, or a dungeon run with unlocks applied. */
export interface RunSetup {
  tools?: Toolbelt;
  perks?: PerkRanks;
  camp?: boolean;
  /** Camp only: whether the Slayer master is around. */
  slayerUnlocked?: boolean;
  /** The save's Slayer task; progress is written straight into it. */
  slayerTask?: SlayerTask | null;
}

const MAX_MESSAGES = 50;

const chebyshev = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const cardinalAdjacent = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const samePos = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const rand = () => RNG.getUniform();

/**
 * All game rules for a single run. Pure logic with no rendering, so it can be
 * unit-tested; scenes call commands and render the resulting state.
 */
export class GameState {
  map!: FloorMap;
  player: Player;
  npcs: Npc[] = [];
  groundItems: GroundItem[] = [];
  nodes: ResourceNode[] = [];
  visible = new Set<number>();
  explored!: Uint8Array;
  messages: string[] = [];
  tickCount = 0;
  over = false;
  kills = 0;
  bossKills = 0;
  pendingHits: PendingHit[] = [];
  /** Effects of purchased skill-tree perks. */
  mods: RunMods;
  /** Undying perk: whether the one cheat-death has been used this run. */
  undyingUsed = false;
  slayerTask: SlayerTask | null = null;
  /** Per-run facts some achievements need. */
  runStats = {
    foodEaten: 0,
    killStyles: new Set<AttackType>(),
    damageDealt: 0,
    damageTaken: 0,
    /** XP gained this run, per skill. */
    xp: {} as Partial<Record<SkillName, number>>,
    itemsLooted: 0,
    coinsLooted: 0,
    killedBy: '',
  };
  /** Damage each boss has dealt this run (for "Untouchable"). */
  private bossDamage = new Map<Npc, number>();
  /** The run ended by choice rather than death. */
  forfeited = false;
  /** Relics picked this run. */
  relics: string[] = [];
  /** Relics on offer, waiting for the player to pick one (the scene pauses meanwhile). */
  pendingRelics: string[] | null = null;
  /** Item categories picked up automatically when walked over (from settings). */
  autoPickup = { coins: false, arrows: false, runes: false };
  /** The merchant whose shop window is open. */
  activeMerchant: ResourceNode | null = null;
  /** Vampyric Fang: damage dealt that hasn't been converted to healing yet. */
  private lifestealBank = 0;

  constructor(public seed: number, private emit: (e: GameEvent) => void = () => {}, setup: RunSetup = {}) {
    this.mods = computeMods(setup.perks ?? {});
    this.slayerTask = setup.slayerTask ?? null;
    this.player = new Player({ x: 0, y: 0 });
    this.player.tools = { ...(setup.tools ?? NO_TOOLS) };
    if (setup.camp) {
      this.loadCamp(setup.slayerUnlocked);
      return;
    }
    this.applyStartingKit();
    this.loadFloor(1);
    this.message('Welcome to Tickbound. Find the stairs and go deeper.');
    const t = this.player.tools;
    if (!t.pickaxe && !t.axe && !t.fishing) {
      this.message('You have no tools yet. Earn Dungeoneering tokens and buy them from the Toolsmith at camp.');
    }
  }

  get isCamp(): boolean {
    return this.map.depth === 0;
  }

  /** Starting levels, gear and supplies, including skill-tree perks. */
  private applyStartingKit(): void {
    const p = this.player;
    const m = this.mods;
    for (const [skill, level] of Object.entries(m.startLevels) as Array<[SkillName, number]>) {
      p.skills.xp[skill] = Math.max(p.skills.xp[skill], xpForLevel(level));
    }
    p.equipment = { weapon: m.startWeapon ?? 'bronze_dagger', shield: 'wooden_shield' };
    if (m.startBody) p.equipment.body = m.startBody;
    p.inventory.add('shrimps', 4);
    for (const it of m.startItems) p.inventory.add(it.id, it.qty);
    p.hp = p.maxHp;
    p.prayerPoints = p.maxPrayer;
  }

  private loadCamp(slayerUnlocked = false): void {
    const { map, nodes } = generateCamp(slayerUnlocked);
    this.map = map;
    this.nodes = nodes;
    // The camp is safe and small: show all of it.
    this.explored = new Uint8Array(map.width * map.height).fill(1);
    const p = this.player;
    p.pos = { ...map.spawn };
    p.prev = { ...map.spawn };
    this.updateFov();
    this.message('Welcome to Tickbound! You are at camp. Talk to the Mentor to learn perks, or the Toolsmith for tools.');
    this.message('Climb down the ladder when you are ready to enter the dungeon. Press H for controls.');
    this.emit({ type: 'floor', depth: 0 });
  }

  /** Dungeoneering tokens this run is worth: depth reached, kills, bosses and carried coins. */
  get tokensEarned(): number {
    const base = 15 * (this.depth - 1) + this.kills + this.mods.bossTokens * this.bossKills
      + Math.floor(this.player.inventory.count('coins') / 20);
    return Math.floor(base * this.mods.tokenMult * (this.hasRelic('lucky_charm') ? 1.25 : 1));
  }

  get depth(): number {
    return this.map.depth;
  }

  loadFloor(depth: number): void {
    this.map = generateFloor(this.seed * 1000 + depth, depth);
    this.explored = new Uint8Array(this.map.width * this.map.height);
    // Resources first so monsters only spawn on tiles left free.
    this.nodes = placeResources(this.map);
    this.npcs = spawnMonsters(this.map);
    this.groundItems = [];
    this.pendingHits = [];
    const p = this.player;
    if (depth > 1) p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + Math.ceil(p.maxPrayer * this.mods.descentPrayerRestore));
    p.pos = { ...this.map.spawn };
    p.prev = { ...this.map.spawn };
    p.via = undefined;
    p.path = [];
    p.intent = null;
    this.updateFov();
    if (depth > 1) this.message(`You descend to floor ${depth}.`);
    const theme = themeForDepth(depth);
    if (depth > 1 && theme !== themeForDepth(depth - 1)) this.message(`You enter ${theme.name}. The air changes...`);
    if (depth > 1 && this.hasRelic('packed_supplies')) {
      const fish = depth >= 12 ? 'swordfish' : depth >= 8 ? 'lobster' : 'trout';
      if (p.inventory.add(fish)) this.message(`Packed Supplies: you find a ${item(fish).name.toLowerCase()} in your pack.`);
    }
    const boss = this.npcs.find((n) => n.isBoss);
    if (boss) this.message(`You sense a powerful presence guarding the stairs: ${boss.name}.`);
    this.emit({ type: 'floor', depth });
  }

  /** Slayer XP equals the monster's hitpoints (OSRS); finishing pays tokens. */
  private slayerKill(npc: Npc): void {
    const task = this.slayerTask!;
    const cat = SLAYER_BY_ID[task.category];
    task.remaining--;
    this.giveXp('slayer', npc.def.hitpoints * XP_RATE);
    if (task.remaining === 0) {
      const tokens = cat.tokensPerKill * task.total;
      this.message(`You have completed your Slayer task! (+${tokens} Dungeoneering tokens) See the Slayer master at camp for another.`);
      this.stat('tasks');
      this.emit({ type: 'slayerDone', tokens });
    } else if (task.remaining <= 3 || task.remaining % 5 === 0) {
      this.message(`Slayer task: ${task.remaining} more ${cat.name.toLowerCase()} to go.`);
    }
  }

  /** Something gathered or crafted (achievements track what you've made). */
  made(id: string): void {
    this.emit({ type: 'made', item: id });
  }

  /** Counts toward a lifetime statistic (achievements). */
  stat(key: Counter, amount = 1): void {
    this.emit({ type: 'stat', key, amount });
  }

  /** Asks the renderer to play a sound effect (the rules stay audio-free). */
  sound(name: SoundName): void {
    this.emit({ type: 'sound', name });
  }

  message(text: string): void {
    this.messages.push(text);
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
  }

  isVisible(x: number, y: number): boolean {
    return this.visible.has(y * this.map.width + x);
  }

  isExplored(x: number, y: number): boolean {
    return this.explored[y * this.map.width + x] === 1;
  }

  npcAt(x: number, y: number): Npc | undefined {
    return this.npcs.find((n) => n.pos.x === x && n.pos.y === y);
  }

  nodeAt(x: number, y: number): ResourceNode | undefined {
    return this.nodes.find((n) => n.pos.x === x && n.pos.y === y);
  }

  itemsAt(x: number, y: number): GroundItem[] {
    return this.groundItems.filter((g) => g.pos.x === x && g.pos.y === y);
  }

  // ---- Player commands (from input) ----

  walkTo(target: Point): void {
    if (this.over || !this.isExplored(target.x, target.y)) return;
    const p = this.player;
    p.path = findPath(this.map, p.pos, target);
    const stairs = tileAt(this.map, target.x, target.y) === Tile.StairsDown;
    p.intent = stairs ? { kind: 'descend' } : { kind: 'walk' };
  }

  attack(npc: Npc): void {
    if (this.over) return;
    this.player.intent = { kind: 'attack', npc };
    this.player.path = [];
  }

  /** Walk to an item and pick it up; `all` takes the whole pile on that tile. */
  take(g: GroundItem, all = false): void {
    if (this.over) return;
    const p = this.player;
    p.intent = { kind: 'take', item: g, all };
    p.path = findPath(this.map, p.pos, g.pos);
  }

  gather(node: ResourceNode): void {
    if (this.over) return;
    this.player.intent = { kind: 'gather', node, started: false };
    this.player.path = [];
  }

  /** Cook / smelt / smith `recipe` at a station; `repeat` keeps going until inputs run out. */
  process(node: ResourceNode, recipe: Recipe, repeat = true): void {
    if (this.over) return;
    this.player.intent = { kind: 'process', node, recipe, repeat, started: false };
    this.player.path = [];
  }

  /** Buys one of a stock line from the open merchant. */
  buy(index: number): boolean {
    const m = this.activeMerchant;
    const entry = m?.stock?.[index];
    if (!entry || entry.qty <= 0) return false;
    const inv = this.player.inventory;
    // Ammo and runes come in bundles so buying isn't a hundred clicks.
    const bundle = item(entry.id).stackable ? Math.min(entry.qty, 25) : 1;
    const cost = entry.price * bundle;
    if (inv.count('coins') < cost) {
      this.message("You don't have enough coins.");
      return false;
    }
    if (!inv.canAdd(entry.id)) {
      this.message("You don't have enough inventory space.");
      return false;
    }
    inv.remove('coins', cost);
    inv.add(entry.id, bundle);
    this.stat('purchases');
    entry.qty -= bundle;
    this.sound('buy');
    return true;
  }

  /** Sells a whole inventory slot to the open merchant at 40% of value. */
  sell(slot: number): boolean {
    const stack = this.player.inventory.slots[slot];
    if (!this.activeMerchant || !stack || stack.id === 'coins') return false;
    const each = sellPriceOf(stack.id);
    if (each <= 0) {
      this.message("The merchant isn't interested in that.");
      return false;
    }
    const qty = stack.qty; // take() empties the slot object, so read this first
    this.player.inventory.take(slot);
    this.player.inventory.add('coins', each * qty);
    this.sound('pickup');
    return true;
  }

  closeShop(): void {
    this.activeMerchant = null;
  }

  private openChest(node: ResourceNode): void {
    if (node.used) {
      this.message('The chest is empty.');
      return;
    }
    node.used = true;
    if (this.depth >= 3 && rand() < MIMIC_CHANCE) {
      // The "chest" was a monster all along: it leaves its spot and attacks.
      this.nodes.splice(this.nodes.indexOf(node), 1);
      setTile(this.map, node.pos.x, node.pos.y, Tile.Floor);
      const mimic = new Npc(mimicFor(this.depth), node.pos);
      mimic.target = this.player;
      this.npcs.push(mimic);
      this.message('The chest springs to life! It\'s a Mimic!');
      this.sound('hurt');
      return;
    }
    const got: string[] = [];
    this.stat('chests');
    for (const { id, qty } of chestLoot(this.depth)) {
      this.emit({ type: 'obtain', item: id, qty, source: 'chest' });
      if (this.player.inventory.add(id, qty)) this.countLoot(id, qty);
      else this.dropOnTile(id, qty, this.player.pos);
      got.push(`${qty > 1 ? `${qty} x ` : ''}${item(id).name}`);
    }
    this.message(`You open the chest and find: ${got.join(', ')}.`);
    this.sound('buy');
  }

  /** Ends the run now; tokens are banked exactly as if you had died. */
  forfeit(): void {
    if (this.over || this.isCamp) return;
    this.over = true;
    this.forfeited = true;
    this.pendingRelics = null;
    this.message('You forfeit the run and retreat to camp.');
    this.emit({ type: 'death' });
  }

  /** A drop's chance with your perks and relics (rare drops under 10% get boosted). */
  dropChance(d: Drop): number {
    if (d.chance >= 0.1) return d.chance;
    const wealth = this.hasRelic('ring_of_wealth') ? 1.25 : 1;
    return Math.min(1, d.chance * this.mods.rareDropMult * wealth);
  }

  /** A drop's quantity range with your coin bonuses applied. */
  dropQuantity(d: Drop): [number, number] {
    const lo = d.min ?? 1;
    const hi = d.max ?? lo;
    if (d.item !== 'coins') return [lo, hi];
    const mult = this.mods.coinMult * (this.hasRelic('ring_of_wealth') ? 2 : 1);
    return [Math.floor(lo * mult), Math.floor(hi * mult)];
  }

  hasRelic(id: string): boolean {
    return this.relics.includes(id);
  }

  /** Offers RELIC_CHOICES random relics the player doesn't have yet. */
  offerRelics(): void {
    const pool = RELICS.filter((r) => !this.hasRelic(r.id)).map((r) => r.id);
    if (!pool.length) return;
    this.pendingRelics = RNG.shuffle(pool).slice(0, RELIC_CHOICES);
    this.emit({ type: 'relicChoice', options: this.pendingRelics });
  }

  chooseRelic(id: string): void {
    if (!this.pendingRelics?.includes(id)) return;
    this.relics.push(id);
    this.stat('relics');
    this.pendingRelics = null;
    this.message(`You gain the ${RELIC_BY_ID[id].name}: ${RELIC_BY_ID[id].desc}`);
    this.sound('levelup');
  }

  /** Walk to a camp NPC and open its menu. */
  talkTo(node: ResourceNode): void {
    this.player.intent = { kind: 'talk', node };
    this.player.path = [];
  }

  prayAt(node: ResourceNode): void {
    if (this.over) return;
    this.player.intent = { kind: 'altar', node };
    this.player.path = [];
  }

  togglePrayer(id: string): void {
    if (this.over) return;
    const p = this.player;
    const def = PRAYER_BY_ID[id];
    if (p.activePrayers.delete(id)) {
      this.sound('prayerOff');
      return;
    }
    if (p.skills.level('prayer') < def.level) {
      this.message(`You need a Prayer level of ${def.level} to use ${def.name}.`);
      return;
    }
    if (p.prayerPoints <= 0) {
      this.message('You need to recharge your Prayer at an altar.');
      return;
    }
    for (const other of [...p.activePrayers]) {
      if (PRAYER_BY_ID[other].group === def.group) p.activePrayers.delete(other);
    }
    p.activePrayers.add(id);
    this.sound('prayerOn');
  }

  /**
   * Quick-prayers: if any of `ids` is on, switch them all off; otherwise switch on
   * every one you have the level for.
   */
  toggleQuickPrayers(ids: string[]): void {
    if (this.over || !ids.length) return;
    const p = this.player;
    if (ids.some((id) => p.activePrayers.has(id))) {
      for (const id of ids) if (p.activePrayers.has(id)) this.togglePrayer(id);
      return;
    }
    const usable = ids.filter((id) => p.skills.level('prayer') >= PRAYER_BY_ID[id].level);
    if (!usable.length) {
      this.message("You don't have the Prayer level for any of your quick-prayers yet.");
      return;
    }
    for (const id of usable) this.togglePrayer(id);
  }

  setStyle(style: AttackStyle): void {
    this.player.style = style;
  }

  /** Left-click action on an inventory slot: eat, bury, or wield. */
  useItem(slot: number): void {
    if (this.over) return;
    const p = this.player;
    const stack = p.inventory.slots[slot];
    if (!stack) return;
    const def = item(stack.id);

    if (def.burnTicks) {
      this.lightFire(slot);
    } else if (def.restoresPrayer) {
      if (p.eatCooldown > 0) return;
      p.inventory.take(slot, 1);
      const restore = potionRestore(p.maxPrayer) * (this.hasRelic('holy_wrench') ? 1.5 : 1);
      p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + Math.floor(restore));
      p.eatCooldown = EAT_DELAY;
      this.message('You drink the prayer potion.');
      this.sound('eat');
    } else if (def.heal) {
      if (p.eatCooldown > 0) return;
      p.inventory.take(slot, 1);
      const heal = (def.heal + this.mods.foodHealBonus) * (this.hasRelic('gourmet') ? 1.5 : 1);
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(heal));
      p.eatCooldown = EAT_DELAY;
      p.attackCooldown += EAT_DELAY;
      this.message(`You eat the ${def.name.toLowerCase()}. It heals some health.`);
      this.runStats.foodEaten++;
      this.sound('eat');
    } else if (def.buryXp) {
      p.inventory.take(slot, 1);
      this.message('You bury the bones.');
      this.sound('bury');
      this.stat('bones');
      this.giveXp('prayer', def.buryXp);
    } else if (def.equip) {
      const req = def.equip.req;
      if (req && p.skills.level(req.skill) < req.level) {
        this.message(`You need a ${SKILL_LABELS[req.skill]} level of ${req.level} to wield this.`);
        return;
      }
      if (def.equip.slot === 'ammo') {
        this.equipAmmo(slot);
        return;
      }
      p.inventory.take(slot);
      const old = p.equipment[def.equip.slot];
      p.equipment[def.equip.slot] = def.id;
      if (old) p.inventory.slots[slot] = { id: old, qty: 1 };
    }
  }

  /** Moves a whole arrow stack into the quiver, swapping out different arrows. */
  private equipAmmo(slot: number): void {
    const p = this.player;
    const stack = p.inventory.take(slot)!;
    if (p.equipment.ammo === stack.id) {
      p.ammo += stack.qty;
      return;
    }
    const old = p.equipment.ammo;
    const oldQty = p.ammo;
    p.equipment.ammo = stack.id;
    p.ammo = stack.qty;
    if (old) p.inventory.add(old, oldQty);
  }

  private lightFire(slot: number): void {
    const p = this.player;
    if (!p.tools.tinderbox) {
      this.message('You need a tinderbox to light a fire. Unlock one between runs.');
      return;
    }
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: p.pos.x + dx, y: p.pos.y + dy }))
      .find((t) => tileAt(this.map, t.x, t.y) === Tile.Floor && !this.npcAt(t.x, t.y) && !this.itemsAt(t.x, t.y).length);
    if (!spot) {
      this.message("You can't light a fire here.");
      return;
    }
    const logs = p.inventory.take(slot, 1)!;
    const fire = new ResourceNode(spot, 'fire');
    fire.expiresAt = this.tickCount + item(logs.id).burnTicks!;
    this.nodes.push(fire);
    setTile(this.map, spot.x, spot.y, Tile.Object);
    this.message('The fire catches and the logs begin to burn.');
    this.stat('fires');
  }

  /** Unequips an item back into the inventory. */
  unequip(slot: keyof Player['equipment']): void {
    const p = this.player;
    const id = p.equipment[slot];
    if (!id) return;
    if (!p.inventory.add(id, slot === 'ammo' ? p.ammo : 1)) {
      this.message("You don't have enough inventory space to do that.");
      return;
    }
    delete p.equipment[slot];
    if (slot === 'ammo') p.ammo = 0;
  }

  dropItem(slot: number): void {
    if (this.over) return;
    const stack = this.player.inventory.take(slot);
    if (stack) this.groundItems.push(new GroundItem(stack.id, stack.qty, { ...this.player.pos }));
  }

  // ---- Tick processing ----

  tick(): void {
    if (this.over) return;
    this.tickCount++;
    this.player.prev = { ...this.player.pos };
    this.player.via = undefined;
    for (const n of this.npcs) n.prev = { ...n.pos };

    this.processPlayer();
    this.autoPickUp();
    if (this.over) return;
    for (const n of [...this.npcs]) this.processNpc(n);
    this.landPendingHits();
    if (this.over) return;
    this.expireFires();
    this.drainPrayer();

    const p = this.player;
    const regen = Math.round(this.mods.hpRegenTicks / (this.hasRelic('regen_bracelet') ? 2 : 1));
    if (this.tickCount % regen === 0 && p.hp < p.maxHp) p.hp++;
    this.updateFov();
  }

  private updateFov(): void {
    const { x, y } = this.player.pos;
    this.visible = computeVisible(this.map, x, y, this.isCamp ? CAMP_FOV : FOV_RADIUS);
    for (const i of this.visible) this.explored[i] = 1;
  }

  private drainPrayer(): void {
    const p = this.player;
    if (!p.activePrayers.size) return;
    for (const id of p.activePrayers) p.prayerDrain += PRAYER_BY_ID[id].drain;
    const resistance = DRAIN_RESISTANCE * this.mods.drainResistMult * (this.hasRelic('holy_wrench') ? 1.15 : 1);
    while (p.prayerDrain >= resistance) {
      p.prayerDrain -= resistance;
      p.prayerPoints = Math.max(0, p.prayerPoints - 1);
    }
    if (p.prayerPoints === 0) {
      p.activePrayers.clear();
      p.prayerDrain = 0;
      this.message('You have run out of prayer points, you can recharge at an altar.');
      this.sound('prayerOff');
    }
  }

  private landPendingHits(): void {
    const due = this.pendingHits.filter((h) => h.landsAt <= this.tickCount);
    this.pendingHits = this.pendingHits.filter((h) => h.landsAt > this.tickCount);
    for (const h of due) {
      this.landHit(h.npc, h.style, h.damage);
      if (this.over) return;
    }
  }

  private expireFires(): void {
    for (const n of [...this.nodes]) {
      if (n.expiresAt === undefined || this.tickCount < n.expiresAt) continue;
      this.nodes.splice(this.nodes.indexOf(n), 1);
      setTile(this.map, n.pos.x, n.pos.y, Tile.Floor);
      if (this.isVisible(n.pos.x, n.pos.y)) this.message('The fire burns out.');
    }
  }

  /** Steps along the path, re-pathing if something (e.g. a new fire) now blocks it. */
  private stepPlayer(): void {
    const p = this.player;
    this.stepAlongPath();
    if (p.running && p.path.length) {
      p.via = { ...p.pos };
      this.stepAlongPath();
    }
  }

  private stepAlongPath(): void {
    const p = this.player;
    const next = p.path[0];
    if (next && !isWalkable(this.map, next.x, next.y)) {
      p.path = findPath(this.map, p.pos, p.path[p.path.length - 1]);
    }
    p.step();
  }

  setRunning(on: boolean): void {
    this.player.running = on;
  }

  /**
   * Moves the player toward a tile cardinally adjacent to `target`.
   * `stopWhen` lets ranged attackers halt mid-run once they're in range.
   */
  private approach(target: Point, stopWhen?: () => boolean): 'adjacent' | 'moving' | 'unreachable' {
    const p = this.player;
    if (cardinalAdjacent(p.pos, target)) return 'adjacent';
    p.path = this.pathToAdjacent(target);
    if (!p.path.length) return 'unreachable';
    p.step();
    if (stopWhen) this.updateFov();
    if (p.running && p.path.length && !cardinalAdjacent(p.pos, target) && !stopWhen?.()) {
      p.via = { ...p.pos };
      p.step();
    }
    return cardinalAdjacent(p.pos, target) ? 'adjacent' : 'moving';
  }

  /** In range of the player's weapon and in line of sight. */
  private inAttackRange(npc: Npc): boolean {
    const p = this.player;
    return chebyshev(p.pos, npc.pos) <= p.attackRange && this.isVisible(npc.pos.x, npc.pos.y);
  }

  private processPlayer(): void {
    const p = this.player;
    if (p.attackCooldown > 0) p.attackCooldown--;
    if (p.eatCooldown > 0) p.eatCooldown--;
    const intent = p.intent;

    switch (intent?.kind) {
      case 'attack': {
        const npc = intent.npc;
        if (npc.dead || !this.npcs.includes(npc)) {
          p.intent = null;
          return;
        }
        if (p.attackRange > 1) {
          // Bows and staffs: close in only until the target is in range and in sight.
          if (!this.inAttackRange(npc)) {
            const a = this.approach(npc.pos, () => this.inAttackRange(npc));
            if (a === 'unreachable') {
              this.message("I can't reach that!");
              p.intent = null;
              return;
            }
          }
          if (this.inAttackRange(npc) && p.attackCooldown === 0) this.playerAttack(npc);
          return;
        }
        const a = this.approach(npc.pos);
        if (a === 'unreachable') {
          this.message("I can't reach that!");
          p.intent = null;
        } else if (a === 'adjacent' && p.attackCooldown === 0) {
          this.playerAttack(npc);
        }
        return;
      }
      case 'gather': {
        const node = intent.node;
        if (!this.nodes.includes(node) || node.depleted) {
          p.intent = null;
          return;
        }
        const a = this.approach(node.pos);
        if (a !== 'adjacent') {
          if (a === 'unreachable') {
            this.message("I can't reach that!");
            p.intent = null;
          }
          return;
        }
        if (!intent.started) {
          const why = gatherBlocker(p, node);
          if (why) {
            this.message(why);
            p.intent = null;
            return;
          }
          intent.started = true;
          p.actionTimer = node.def!.rollTicks;
          this.message(gatherStartMessage(p, node.def!));
          return;
        }
        if (--p.actionTimer > 0) return;
        p.actionTimer = node.def!.rollTicks;
        if (!gatherRoll(this, node)) p.intent = null;
        return;
      }
      case 'process': {
        const { node, recipe } = intent;
        if (!this.nodes.includes(node)) {
          p.intent = null;
          return;
        }
        const a = this.approach(node.pos);
        if (a !== 'adjacent') {
          if (a === 'unreachable') {
            this.message("I can't reach that!");
            p.intent = null;
          }
          return;
        }
        if (!intent.started) {
          const why = processBlocker(p, recipe);
          if (why) {
            this.message(why);
            p.intent = null;
            return;
          }
          intent.started = true;
          p.actionTimer = 1;
        }
        if (--p.actionTimer > 0) return;
        processStep(this, recipe);
        if (!intent.repeat || processBlocker(p, recipe)) p.intent = null;
        else p.actionTimer = PROCESS_TICKS;
        return;
      }
      case 'take': {
        this.stepPlayer();
        const g = intent.item;
        if (!this.groundItems.includes(g)) {
          p.intent = null;
        } else if (samePos(p.pos, g.pos)) {
          if (intent.all) for (const other of this.itemsAt(g.pos.x, g.pos.y)) this.pickUp(other);
          else this.pickUp(g);
          p.intent = null;
        } else if (!p.path.length) {
          p.intent = null;
        }
        return;
      }
      case 'descend':
        this.stepPlayer();
        if (!p.path.length) {
          p.intent = null;
          if (tileAt(this.map, p.pos.x, p.pos.y) !== Tile.StairsDown) return;
          const boss = this.npcs.find((n) => n.isBoss);
          if (boss) this.message(`The way down is sealed while ${boss.name} lives.`);
          else if (this.isCamp) this.emit({ type: 'enterDungeon' });
          else this.loadFloor(this.depth + 1);
        }
        return;
      case 'talk': {
        const a = this.approach(intent.node.pos);
        if (a === 'moving') return;
        p.intent = null;
        if (a !== 'adjacent') return;
        const node = intent.node;
        if (node.kind === 'merchant') {
          this.activeMerchant = node;
          this.emit({ type: 'campMenu', kind: 'merchant' });
        } else if (node.kind === 'chest') {
          this.openChest(node);
        } else if (node.kind === 'shrine') {
          if (node.used) {
            this.message('The shrine is dormant.');
          } else {
            node.used = true;
            this.offerRelics();
          }
        } else {
          this.emit({ type: 'campMenu', kind: node.kind === 'slayer_master' ? 'slayer' : node.kind as 'mentor' | 'toolsmith' });
        }
        return;
      }
      case 'altar': {
        const a = this.approach(intent.node.pos);
        if (a === 'moving') return;
        p.intent = null;
        if (a === 'unreachable') {
          this.message("I can't reach that!");
          return;
        }
        p.prayerPoints = p.maxPrayer;
        this.message('You recharge your Prayer points.');
        return;
      }
      default:
        this.stepPlayer();
        if (!p.path.length) p.intent = null;
    }
  }

  /** Shortest path to any free tile cardinally adjacent to `target` (melee and objects need a straight side). */
  private pathToAdjacent(target: Point): Point[] {
    let best: Point[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = { x: target.x + dx, y: target.y + dy };
      if (!isWalkable(this.map, t.x, t.y)) continue;
      const path = findPath(this.map, this.player.pos, t);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  }

  private pickUp(g: GroundItem): void {
    if (!this.player.inventory.add(g.id, g.qty)) {
      this.message("You don't have enough inventory space to hold that item.");
      return;
    }
    this.groundItems.splice(this.groundItems.indexOf(g), 1);
    this.countLoot(g.id, g.qty);
    this.sound('pickup');
  }

  /** Picks up enabled categories (coins, arrows, runes) from tiles you walked over this tick. */
  private autoPickUp(): void {
    const a = this.autoPickup;
    if (this.over || !(a.coins || a.arrows || a.runes)) return;
    const wanted = (id: string) => (a.coins && id === 'coins') || (a.arrows && id.endsWith('_arrow')) || (a.runes && id.endsWith('_rune'));
    const p = this.player;
    if (samePos(p.prev, p.pos)) return; // only tiles you moved onto, so a full pack doesn't nag every tick
    for (const pos of [p.via, p.pos]) {
      if (!pos) continue;
      for (const gi of this.itemsAt(pos.x, pos.y)) if (wanted(gi.id)) this.pickUp(gi);
    }
  }

  /** Swap two inventory slots. */
  swapSlots(a: number, b: number): void {
    this.player.inventory.swap(a, b);
  }

  private countLoot(id: string, qty: number): void {
    if (id === 'coins') this.runStats.coinsLooted += qty;
    else this.runStats.itemsLooted += qty;
  }

  /**
   * The player's current offence with their gear, style, prayers, perks and relics.
   * Pure: used both to resolve attacks and to show stats in the Gear tab.
   */
  /** Is this monster part of the current Slayer task? */
  isOnTask(npc: Npc): boolean {
    const t = this.slayerTask;
    return !!t && t.remaining > 0 && SLAYER_BY_ID[t.category]?.npcIds.includes(npc.def.id);
  }

  /** With a target on your Slayer task, Slayer levels boost accuracy and max hit (slayer helm style). */
  combatPreview(target?: Npc): CombatPreview {
    const p = this.player;
    const b = p.bonuses();
    const s = p.skills;
    const boosted = (skill: SkillName, group: PrayerGroup) =>
      Math.floor(s.level(skill) * (1 + p.prayerBoost(group)));
    const mode = p.weaponType;
    let attackRoll: number;
    let max: number;
    let speed = b.speed;
    let spell: SpellDef | undefined;
    let problem: string | undefined;

    if (mode === 'ranged') {
      if (!p.equipment.ammo || p.ammo <= 0) problem = 'There is no ammo left in your quiver.';
      const eff = effectiveLevel(boosted('ranged', 'ranged'), p.style === 'accurate' ? 3 : 0);
      attackRoll = roll(eff, b.ranged);
      max = maxHit(eff, b.rangedStrength);
      if (p.style === 'aggressive') speed -= 1; // Rapid
    } else if (mode === 'magic') {
      const pick = this.pickSpell();
      if (typeof pick === 'string') problem = pick;
      else spell = pick;
      attackRoll = roll(effectiveLevel(boosted('magic', 'magic'), 1), b.magic);
      max = spell?.maxHit ?? 0;
    } else {
      attackRoll = roll(effectiveLevel(boosted('attack', 'attack'), p.style === 'accurate' ? 3 : 0), b.attack);
      max = maxHit(effectiveLevel(boosted('strength', 'strength'), p.style === 'aggressive' ? 3 : 0), b.strength);
    }
    const glory = this.hasRelic('amulet_of_glory') ? 1.1 : 1;
    const berserk = this.hasRelic('berserker_necklace') && p.hp < p.maxHp / 2 ? 1.25 : 1;
    const slayer = target && this.isOnTask(target) ? 1 + SLAYER_BONUS_PER_LEVEL * s.level('slayer') : 1;
    return {
      mode,
      attackRoll: Math.floor(this.mods.combatMult * glory * slayer * attackRoll),
      maxHit: Math.floor(this.mods.combatMult * glory * berserk * slayer * max),
      speed,
      range: p.attackRange,
      spell,
      problem,
    };
  }

  /** Chance the player's next attack hits `npc` (weakness included). */
  hitChanceAgainst(npc: Npc, preview = this.combatPreview(npc)): number {
    const weakness = npc.def.weakness === preview.mode ? WEAKNESS_PENALTY : 0;
    const defRoll = roll(npc.def.defence + 9, Math.max(-63, npc.def.defenceBonus - weakness));
    return hitChance(preview.attackRoll, defRoll);
  }

  private playerAttack(npc: Npc): void {
    const p = this.player;
    const c = this.combatPreview(npc);
    if (c.problem) {
      this.message(c.problem);
      p.intent = null;
      return;
    }
    const { mode, spell, speed } = c;
    const max = c.maxHit;
    const chance = this.hitChanceAgainst(npc, c);
    const dmg = Math.min(npc.hp, rollDamage(chance, max, rand));
    if (dmg > 0 && this.hasRelic('vampyric_fang')) {
      this.lifestealBank += dmg;
      const heal = Math.floor(this.lifestealBank / 4);
      this.lifestealBank %= 4;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }

    p.attackCooldown = speed;
    if (mode === 'ranged') this.fireArrow(npc);
    if (spell) this.castSpell(spell);
    if (mode !== 'melee') this.emit({ type: 'projectile', from: { ...p.pos }, to: { ...npc.pos }, style: mode, ticks: 1 });
    this.applyHit(npc, dmg);
    npc.target = p;
    this.giveCombatXp(mode, dmg, spell);
    if (npc.dead) this.killNpc(npc);
  }

  private giveCombatXp(mode: 'melee' | 'ranged' | 'magic', dmg: number, spell?: SpellDef): void {
    const p = this.player;
    const defensive = p.style === 'defensive';
    if (mode === 'melee') {
      if (dmg > 0) this.giveXp(STYLE_SKILL[p.style], 4 * dmg * XP_RATE);
    } else if (mode === 'ranged') {
      if (dmg > 0) this.giveXp('ranged', (defensive ? 2 : 4) * dmg * XP_RATE);
      if (dmg > 0 && defensive) this.giveXp('defence', 2 * dmg * XP_RATE);
    } else {
      // Spells give XP for the cast even on a splash, as in OSRS.
      this.giveXp('magic', (spell!.baseXp + (defensive ? 1.33 : 2) * dmg) * XP_RATE);
      if (dmg > 0 && defensive) this.giveXp('defence', dmg * XP_RATE);
    }
    if (dmg > 0) this.giveXp('hitpoints', (4 / 3) * dmg * XP_RATE);
  }

  /** Uses one arrow; it may land under the target to be picked up again. */
  private fireArrow(npc: Npc): void {
    const p = this.player;
    const id = p.equipment.ammo!;
    if (this.hasRelic('avas_accumulator') && rand() < 0.8) return; // straight back to the quiver
    p.ammo--;
    if (p.ammo <= 0) {
      delete p.equipment.ammo;
      this.message('You have run out of arrows.');
    }
    if (rand() < this.mods.arrowRecovery) this.dropOnTile(id, 1, npc.pos);
  }

  /** Adds to an existing stack on the tile when possible, so recovered arrows don't clutter. */
  private dropOnTile(id: string, qty: number, pos: Point): void {
    const existing = item(id).stackable && this.itemsAt(pos.x, pos.y).find((g) => g.id === id);
    if (existing) existing.qty += qty;
    else this.groundItems.push(new GroundItem(id, qty, { ...pos }));
  }

  /** Runes available for a spell: inventory plus unlimited from an elemental staff. */
  runesFor(rune: string): number {
    const w = this.player.equipment.weapon;
    if (w && item(w).equip?.providesRune === rune) return Infinity;
    return this.player.inventory.count(rune);
  }

  canCast(spell: SpellDef): string | null {
    if (this.player.skills.level('magic') < spell.level) return `You need a Magic level of ${spell.level} to cast ${spell.name}.`;
    if (Object.entries(spell.runes).some(([r, n]) => this.runesFor(r) < n)) return 'You do not have enough runes to cast this spell.';
    return null;
  }

  /** The autocast spell, or the strongest castable one; a message string if none can be cast. */
  private pickSpell(): SpellDef | string {
    const p = this.player;
    if (p.autocast) {
      const chosen = SPELL_BY_ID[p.autocast];
      return this.canCast(chosen) ?? chosen;
    }
    const best = [...SPELLS].reverse().find((s) => !this.canCast(s));
    return best ?? 'You do not have enough runes to cast any combat spell.';
  }

  private castSpell(spell: SpellDef): void {
    if (rand() < this.mods.runeSaveChance) return; // Arcane Thrift
    const tome = this.hasRelic('tome_of_fire');
    for (const [rune, n] of Object.entries(spell.runes)) {
      if (tome && ELEMENTAL_RUNES.includes(rune)) continue;
      if (this.runesFor(rune) !== Infinity) this.player.inventory.remove(rune, n);
    }
  }

  /** Choose the spell a staff autocasts; null = always the strongest available. */
  setAutocast(spellId: string | null): void {
    this.player.autocast = spellId;
  }

  private applyHit(target: Actor, dmg: number): void {
    if (target === this.player) this.runStats.damageTaken += dmg;
    else this.runStats.damageDealt += dmg;
    target.hp -= dmg;
    target.lastHitTick = this.tickCount;
    this.emit({ type: 'hit', target, damage: dmg });
  }

  private killNpc(npc: Npc): void {
    this.npcs.splice(this.npcs.indexOf(npc), 1);
    this.kills++;
    const style = this.player.weaponType;
    this.runStats.killStyles.add(style);
    this.emit({
      type: 'kill', npcId: npc.def.id, boss: npc.isBoss, style, weakness: npc.def.weakness === style,
      flawless: npc.isBoss && (this.bossDamage.get(npc) ?? 0) === 0,
    });
    if (this.isOnTask(npc)) this.slayerKill(npc);
    if (npc.isBoss && rand() < PET_CHANCE) {
      this.message('You have a funny feeling like you\'re being followed.');
      this.emit({ type: 'pet', bossId: npc.def.id });
    }
    if (npc.isBoss) {
      this.bossKills++;
      this.message(`Congratulations, you have defeated ${npc.name}! The way down is open.`);
      this.offerRelics();
    }
    this.player.intent = null;
    for (const d of npc.def.drops) {
      if (rand() >= this.dropChance(d)) continue;
      const [lo, hi] = this.dropQuantity(d);
      const qty = lo + Math.floor(rand() * (hi - lo + 1));
      const buryXp = item(d.item).buryXp;
      if (buryXp && this.hasRelic('bonecrusher')) {
        this.giveXp('prayer', buryXp * qty);
        const p = this.player;
        p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + 1);
        continue;
      }
      if (item(d.item).stackable) {
        this.groundItems.push(new GroundItem(d.item, qty, { ...npc.pos }));
        this.emit({ type: 'obtain', item: d.item, qty, source: npc.def.id });
      } else {
        for (let i = 0; i < qty; i++) this.groundItems.push(new GroundItem(d.item, 1, { ...npc.pos }));
        this.emit({ type: 'obtain', item: d.item, qty, source: npc.def.id });
      }
    }
  }

  giveXp(skill: SkillName, amount: number): void {
    const p = this.player;
    const hpBefore = p.maxHp;
    const prayerBefore = p.maxPrayer;
    if (this.hasRelic('seers_insight')) amount *= 1.5;
    this.runStats.xp[skill] = (this.runStats.xp[skill] ?? 0) + amount;
    const gained = p.skills.addXp(skill, amount);
    this.emit({ type: 'xp', skill, amount });
    if (gained > 0) {
      const level = p.skills.level(skill);
      if (skill === 'hitpoints') p.hp += p.maxHp - hpBefore;
      if (skill === 'prayer') p.prayerPoints += p.maxPrayer - prayerBefore;
      const label = SKILL_LABELS[skill];
      this.message(`Congratulations, you just advanced ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label} level. You are now level ${level}.`);
      this.emit({ type: 'levelup', skill, level });
    }
  }

  private processNpc(npc: Npc): void {
    const p = this.player;
    if (npc.attackCooldown > 0) npc.attackCooldown--;

    if (!npc.target) {
      const d = chebyshev(npc.pos, p.pos);
      const aggro = npc.def.aggroRadius - (this.hasRelic('graceful') && !npc.isBoss ? 2 : 0);
      if (aggro > 0 && d <= aggro && this.isVisible(npc.pos.x, npc.pos.y)) {
        npc.target = p;
      } else {
        this.wander(npc);
        return;
      }
    }

    if (chebyshev(npc.pos, p.pos) > 16) {
      npc.target = null;
      return;
    }
    // Melee needs a cardinal neighbour; ranged/magic need range and line of sight.
    const inReach = npc.attackStyle === 'melee'
      ? cardinalAdjacent(npc.pos, p.pos)
      : chebyshev(npc.pos, p.pos) <= npc.attackRange && this.isVisible(npc.pos.x, npc.pos.y);
    if (inReach) {
      if (npc.attackCooldown === 0) this.npcAttack(npc);
    } else {
      this.stepToward(npc, p.pos);
    }
  }

  private npcAttack(npc: Npc): void {
    const p = this.player;
    const d = npc.def;
    const style = npc.attackStyle;
    const def = Math.floor(p.skills.level('defence') * (1 + p.prayerBoost('defence')));
    const attRoll = roll(d.attack + 9, d.attackBonus);
    const defRoll = roll(effectiveLevel(def, p.style === 'defensive' ? 3 : 0), p.bonuses().defence);
    const max = maxHit(d.strength + 9, d.strengthBonus);
    const dmg = rollDamage(hitChance(attRoll, defRoll), max, rand);
    npc.attackCooldown = d.attackSpeed;

    if (style === 'melee') {
      this.landHit(npc, style, dmg);
    } else {
      const ticks = npc.isBoss ? BOSS_PROJECTILE_TICKS : PROJECTILE_TICKS;
      this.pendingHits.push({ npc, style, damage: dmg, landsAt: this.tickCount + ticks });
      this.emit({ type: 'projectile', from: { ...npc.pos }, to: { ...p.pos }, style, ticks });
    }
    if (npc.def.boss) this.advanceBossStyle(npc);
  }

  /** Applies an NPC hit to the player, blocked entirely by the matching protection prayer. */
  private landHit(npc: Npc, style: AttackType, damage: number): void {
    const p = this.player;
    const blocked = p.isProtectedFrom(style) && damage > 0;
    if (blocked) this.stat('blocks');
    let dmg = blocked ? 0 : damage;
    if (dmg > 0 && this.hasRelic('dragon_defender')) dmg -= 1;
    dmg = Math.min(p.hp, dmg);
    if (dmg > 0 && this.hasRelic('ring_of_recoil') && !npc.dead && this.npcs.includes(npc)) {
      const recoil = Math.min(npc.hp, Math.max(1, Math.round(dmg * 0.1)));
      this.applyHit(npc, recoil);
      if (npc.dead) this.killNpc(npc);
    }
    if (dmg >= p.hp && this.mods.undying && !this.undyingUsed) {
      this.undyingUsed = true;
      dmg = p.hp - 1;
      this.message('You narrowly cheat death! (Undying)');
    }
    if (npc.isBoss && dmg > 0) this.bossDamage.set(npc, (this.bossDamage.get(npc) ?? 0) + dmg);
    this.applyHit(p, dmg);
    // Auto-retaliate when idle or skilling.
    const busy = p.intent?.kind;
    const canRetaliate = !npc.dead && this.npcs.includes(npc);
    if (canRetaliate && ((!busy && !p.path.length) || busy === 'gather' || busy === 'process')) {
      p.intent = { kind: 'attack', npc };
    }
    if (p.dead) {
      this.over = true;
      this.runStats.killedBy = npc.name;
      this.message('Oh dear, you are dead!');
      this.emit({ type: 'death' });
    }
  }

  /** Bosses switch style after `switchEvery` attacks (or randomly every attack when 1). */
  private advanceBossStyle(npc: Npc): void {
    const { styles, switchEvery } = npc.def.boss!;
    if (switchEvery === 1) {
      npc.styleIndex = Math.floor(rand() * styles.length);
      return;
    }
    if (++npc.attacksSinceSwitch < switchEvery) return;
    npc.attacksSinceSwitch = 0;
    const others = styles.map((_, i) => i).filter((i) => i !== npc.styleIndex);
    npc.styleIndex = others[Math.floor(rand() * others.length)];
  }

  /** Can an NPC move from `from` to the adjacent tile `to`? */
  private canNpcStep(from: Point, to: Point): boolean {
    if (!isWalkable(this.map, to.x, to.y)) return false;
    if (samePos(to, this.player.pos) || this.npcAt(to.x, to.y)) return false;
    if (to.x !== from.x && to.y !== from.y) {
      if (!isWalkable(this.map, to.x, from.y) || !isWalkable(this.map, from.x, to.y)) return false;
    }
    return true;
  }

  /**
   * OSRS-style "dumb" chase: step straight toward the target with no pathfinding,
   * so NPCs can get stuck behind obstacles (safespotting works).
   */
  private stepToward(npc: Npc, target: Point): void {
    const dx = Math.sign(target.x - npc.pos.x);
    const dy = Math.sign(target.y - npc.pos.y);
    const options: Point[] = [];
    // Diagonally adjacent: line up on one axis instead of moving diagonally.
    if (!(chebyshev(npc.pos, target) === 1 && dx && dy) && dx && dy) {
      options.push({ x: npc.pos.x + dx, y: npc.pos.y + dy });
    }
    if (dx) options.push({ x: npc.pos.x + dx, y: npc.pos.y });
    if (dy) options.push({ x: npc.pos.x, y: npc.pos.y + dy });
    for (const o of options) {
      if (this.canNpcStep(npc.pos, o)) {
        npc.pos = o;
        return;
      }
    }
  }

  private wander(npc: Npc): void {
    if (rand() > 0.12) return;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = dirs[Math.floor(rand() * 4)];
    const to = { x: npc.pos.x + dx, y: npc.pos.y + dy };
    if (chebyshev(to, npc.spawn) <= 4 && this.canNpcStep(npc.pos, to)) npc.pos = to;
  }
}
