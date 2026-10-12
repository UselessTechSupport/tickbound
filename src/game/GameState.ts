import { RNG } from 'rot-js';
import { EAT_DELAY, FOV_RADIUS, XP_RATE } from '../data/balance';
import { PerkRanks, RunMods, computeMods } from '../data/skillTree';
import { xpForLevel } from '../systems/xp';
import type { SoundName } from '../audio/sfx';
import { campNpc, campStructure, generateCamp } from '../world/camp';
import { item } from '../data/items';
import { Recipe } from '../data/recipes';
import { NO_TOOLS, Toolbelt } from '../data/tools';
import { ResourceNode } from '../entities/ResourceNode';
import { gatherBlocker, gatherRoll, gatherStartMessage, processBlocker, processStep, PROCESS_TICKS } from './skilling';
import { placeResources } from '../world/resources';
import { SKILLS, SKILL_LABELS, SkillName } from '../data/skills';
import { AttackType, DRAIN_RESISTANCE, PRAYER_BY_ID, PrayerGroup, potionRestore } from '../data/prayers';
import { SPELLS, SPELL_BY_ID, SpellDef } from '../data/spells';
import { isBossFloor, WEAKNESS_PENALTY } from '../data/npcs';
import { RELICS, RELIC_BY_ID, RELIC_CHOICES } from '../data/relics';
import { Drop, MIMIC_CHANCE, mimicFor } from '../data/npcs';
import { chestLoot } from '../data/loot';
import { PET_CHANCE } from '../data/collectionLog';
import { ELITE_TOKENS } from '../data/elites';
import { herbForDepth } from '../data/resources';

/** Chance a regular monster drops a random herb for its depth. */
export const HERB_DROP_CHANCE = 0.12;
import { SLAYER_BONUS_PER_LEVEL, SLAYER_BY_ID, SlayerTask } from '../data/slayer';
import { themeForDepth } from '../data/themes';
import { ArmouryRanks, NO_ARMOURY, STYLE_ARMOUR, StartStyle, armouryKit } from '../data/armoury';
import { catchUpFor } from '../data/catchup';
import { CURSES } from '../data/curses';
import { modifierBonus } from '../data/modifiers';
import { REWARD_TEXT } from '../data/wanderers';
import { DARKNESS_FOV, FLOOR_EVENT_BY_ID, FloorEventId, GOBLIN_ESCAPE_TICKS, rollFloorEvent, treasureGoblin } from '../data/floorEvents';
import { MasteryLevels, masteryValue } from '../data/mastery';
import { GARDEN_POOL, GARDEN_SUPER_POOL, STRUCTURE_BY_ID, StructureId, WORKBENCH_SKILLS } from '../data/construction';
import { SPEC_BY_WEAPON, SPEC_DROP_CHANCE, SPEC_REGEN, SPEC_REGEN_TICKS, SpecDef, specWeaponsFor } from '../data/specials';
import { PICKPOCKET, POCKET_LIMIT, STUN_TICKS, lockXpFor, thievingChance } from '../data/thieving';
import { SHORTCUT_KINDS, shortcutChance, shortcutXp } from '../data/agility';
import { Enchantment, Enchantments, enchantValue, enchantedItems } from '../data/enchants';
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
  | { type: 'campMenu'; kind: 'mentor' | 'toolsmith' | 'merchant' | 'slayer' | 'armoury' | 'enchanter' | 'builder' | 'quests' }
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
/** Run-wide bonuses from camp structures and your pet. */
export interface CampBonuses {
  /** Trophy room: max hit bonus (fraction). */
  trophy: number;
  /** Workbench: crafting XP bonus (fraction). */
  workbench: number;
  pet: { kind: 'melee' | 'ranged' | 'magic' | 'defence'; amount: number } | null;
}

/** What camp gives a new run. */
export interface CampSetup extends Partial<CampBonuses> {
  carried?: Array<{ id: string; qty: number }>;
  gardenPotions?: number;
  superPotions?: boolean;
  startRelic?: string | null;
}

export interface RunSetup {
  tools?: Toolbelt;
  perks?: PerkRanks;
  camp?: boolean;
  /** Camp only: whether the Slayer master and Armourer are around, and what's been built. */
  slayerUnlocked?: boolean;
  armourerUnlocked?: boolean;
  built?: StructureId[];
  /** Armourer starting gear and which weapon style to equip. */
  armoury?: ArmouryRanks;
  startStyle?: StartStyle;
  /** Enchanter: enchantments on Armourer gear lines. */
  enchants?: Enchantments;
  enchanterUnlocked?: boolean;
  /** Relics unlocked by quests. */
  questRelics?: string[];
  /** Run modifiers chosen at the ladder (see data/modifiers.ts). */
  modifiers?: string[];
  /** Skill mastery levels (see data/mastery.ts). */
  mastery?: MasteryLevels;
  /** Monsters you've killed 100+ times (Monster Lore), and collection log slots filled (Collector). */
  veteranOf?: string[];
  logSlots?: number;
  /** Camp structures and pets (see data/construction.ts). */
  campSetup?: CampSetup;
  /** Skip ahead: start on this floor with catch-up levels and supplies (half rewards). */
  startDepth?: number;
  /** The save's Slayer task; progress is written straight into it. */
  slayerTask?: SlayerTask | null;
}

const MAX_MESSAGES = 50;

const chebyshev = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const cardinalAdjacent = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const samePos = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const rand = () => RNG.getUniform();
const GATHER_SKILLS: SkillName[] = ['mining', 'woodcutting', 'fishing'];

/**
 * Tokens for coins carried home: 20 coins per token up to 2,000 coins (100 tokens), then a
 * tapering rate (square root), so hoarding huge piles of gold can't flood the economy.
 */
export function coinTokens(coins: number): number {
  if (coins <= 2000) return Math.floor(coins / 20);
  return Math.floor(100 * Math.sqrt(coins / 2000));
}
const COMBAT_SKILLS: SkillName[] = ['attack', 'strength', 'defence', 'ranged', 'magic', 'hitpoints'];

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
  eliteKills = 0;
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
  /** Autoplay died before handing over: the run pays nothing. */
  noRewards = false;
  /** This run used skip-ahead or autoplay (in-run challenge achievements don't count). */
  assisted = false;
  /** Raw tokens earned before handing control to the player; these count half. */
  private tokenBaseline = 0;
  /** Relics picked this run. */
  relics: string[] = [];
  /** Relics on offer, waiting for the player to pick one (the scene pauses meanwhile). */
  pendingRelics: string[] | null = null;
  /** Item categories picked up automatically when walked over (from settings). */
  autoPickup = { coins: false, arrows: false, runes: false };
  /** The merchant whose shop window is open. */
  activeMerchant: ResourceNode | null = null;
  /** Quest relics unlocked so far (they join the relic pool). */
  questRelics: string[] = [];
  /** Run modifiers in effect. */
  modifiers: string[] = [];
  /** Curses taken at dark shrines this run. */
  curses: string[] = [];
  /** This floor's event, if any; bonus tokens earned from events this run. */
  floorEvent: FloorEventId | null = null;
  bonusTokens = 0;
  /** Skill mastery levels, and levels at the start of the run (mastery counts levels gained). */
  mastery: MasteryLevels = {};
  levelsAtStart: Partial<Record<SkillName, number>> = {};
  /** Perk support: monsters killed 100+ times, collection log slots, kills on this floor, per-floor flags. */
  veteranOf: string[] = [];
  logSlots = 0;
  floorKills = 0;
  hitThisFloor = false;
  saintUsedFloor = false;
  undyingTimes = 0;
  /** Bonuses from camp structures and your pet for this run. */
  campBonus: CampBonuses = { trophy: 0, workbench: 0, pet: null };
  /** Enchanted Armourer gear by item id. */
  private enchanted = new Map<string, Enchantment>();
  /** Leeching: fractional healing carried between hits. */
  private leechBank = 0;
  /** Vampyric Fang: damage dealt that hasn't been converted to healing yet. */
  private lifestealBank = 0;

  constructor(public seed: number, private emit: (e: GameEvent) => void = () => {}, setup: RunSetup = {}) {
    this.mods = computeMods(setup.perks ?? {});
    this.slayerTask = setup.slayerTask ?? null;
    this.player = new Player({ x: 0, y: 0 });
    this.player.tools = { ...(setup.tools ?? NO_TOOLS) };
    if (setup.camp) {
      this.loadCamp(setup.slayerUnlocked, setup.armourerUnlocked, setup.enchanterUnlocked, setup.built);
      return;
    }
    this.enchanted = enchantedItems(setup.armoury ?? NO_ARMOURY, setup.enchants ?? {});
    this.campBonus = { trophy: 0, workbench: 0, pet: null, ...setup.campSetup };
    this.questRelics = [...(setup.questRelics ?? [])];
    this.veteranOf = [...(setup.veteranOf ?? [])];
    this.logSlots = setup.logSlots ?? 0;
    const startDepth = Math.max(1, setup.startDepth ?? 1);
    this.mastery = { ...setup.mastery };
    this.modifiers = [...(setup.modifiers ?? [])];
    this.applyStartingKit(setup, startDepth);
    this.levelsAtStart = Object.fromEntries(SKILLS.map((s) => [s, this.player.skills.level(s)]));
    this.loadFloor(startDepth);
    const startRelic = setup.campSetup?.startRelic;
    if (startRelic && RELIC_BY_ID[startRelic]) {
      this.relics.push(startRelic);
      this.message(`The relic altar grants you the ${RELIC_BY_ID[startRelic].name}.`);
    }
    if (startDepth > 1) {
      this.assisted = true;
      this.tokenBaseline = this.rawTokens();
      this.message(`You skip ahead to floor ${startDepth}. Floors you skip pay half tokens.`);
    }
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
  /**
   * Starting levels, gear and supplies: skill-tree perks, Armourer gear (worn if you
   * can wield it, otherwise carried) and, when skipping ahead, catch-up levels.
   */
  private applyStartingKit(setup: RunSetup, startDepth: number): void {
    const p = this.player;
    const m = this.mods;
    const style = setup.startStyle ?? 'melee';
    const levels: Partial<Record<SkillName, number>> = { ...m.startLevels };
    const catchUp = startDepth > 1 ? catchUpFor(startDepth, style) : null;
    for (const [skill, level] of Object.entries(catchUp?.levels ?? {}) as Array<[SkillName, number]>) {
      levels[skill] = Math.max(levels[skill] ?? 1, level);
    }
    for (const [skill, level] of Object.entries(levels) as Array<[SkillName, number]>) {
      p.skills.xp[skill] = Math.max(p.skills.xp[skill], xpForLevel(level));
    }
    p.equipment = { weapon: 'bronze_dagger', shield: 'wooden_shield' };
    p.hpBonus = this.perkRank('constitution') + Math.floor(this.masteryOf('hitpoints'));
    p.bowRangeBonus = this.perkRank('long_range');
    p.inventory.add('shrimps', 4);
    for (const it of [...m.startItems, ...(catchUp?.items ?? [])]) p.inventory.add(it.id, it.qty);

    const canWield = (id: string) => {
      const req = item(id).equip?.req;
      return !req || p.skills.level(req.skill) >= req.level;
    };
    // Compare gear by what matters for your starting style (a mage doesn't care about strength).
    const score = (id?: string) => {
      const e = id ? item(id).equip : undefined;
      if (!e) return -Infinity;
      const offence = style === 'melee' ? e.attackBonus + e.strengthBonus
        : style === 'ranged' ? (e.rangedBonus ?? 0) + (e.rangedStrength ?? 0) : (e.magicBonus ?? 0);
      return e.defenceBonus + offence;
    };
    const kit = armouryKit({ ...NO_ARMOURY, ...setup.armoury });
    // Your style's armour goes on first if you can wear it; other bodies only if they're better.
    const styleBody = kit.find((k) => k.line === STYLE_ARMOUR[style] && canWield(k.id))?.id;
    for (const { line, id, qty } of kit) {
      const e = item(id).equip;
      const isWeapon = e?.slot === 'weapon';
      const wear = e && canWield(id) && (isWeapon ? line === style
        : e.slot === 'ammo' ? style === 'ranged' && !p.equipment.ammo
          : e.slot === 'body' && styleBody ? id === styleBody
            : score(id) > score(p.equipment[e.slot]));
      if (wear && e.slot === 'ammo') {
        p.equipment.ammo = id;
        p.ammo = qty;
      } else if (wear) {
        const old = p.equipment[e.slot];
        p.equipment[e.slot] = id;
        if (old && old !== 'bronze_dagger' && old !== 'wooden_shield') p.inventory.add(old);
      } else {
        p.inventory.add(id, qty);
      }
    }
    // Camp: items kept by the bank chest, and potions from the herb garden.
    for (const it of setup.campSetup?.carried ?? []) p.inventory.add(it.id, it.qty);
    const garden = setup.campSetup?.gardenPotions ?? 0;
    const pool = setup.campSetup?.superPotions ? GARDEN_SUPER_POOL : GARDEN_POOL;
    for (let i = 0; i < garden; i++) p.inventory.add(pool[Math.floor(rand() * pool.length)]);
    if (this.hasModifier('famished')) {
      p.inventory.slots.forEach((s, i) => s && item(s.id).heal && p.inventory.take(i));
    }
    if (this.hasModifier('fragile')) p.hpBonus -= Math.round(p.maxHp * 0.25);
    p.hp = p.maxHp;
    p.prayerPoints = p.maxPrayer;
  }

  /** Camp: a newly unlocked NPC sets up shop without restarting the camp. */
  addCampNpc(kind: 'armourer' | 'enchanter' | StructureId): void {
    if (!this.isCamp || this.nodes.some((n) => n.kind === kind)) return;
    const node = kind === 'armourer' || kind === 'enchanter' ? campNpc(kind) : campStructure(kind);
    setTile(this.map, node.pos.x, node.pos.y, Tile.Object);
    this.nodes.push(node);
  }

  /**
   * Strength of an enchantment from the gear you're wearing (weapon, body, shield).
   * Stacks if two worn pieces share it; Renewal (an interval) takes the best one instead.
   */
  enchantPower(id: string): number {
    const p = this.player;
    const values = [p.equipment.weapon, p.equipment.body, p.equipment.shield]
      .map((item) => (item ? this.enchanted.get(item) : undefined))
      .filter((e): e is Enchantment => e?.id === id)
      .map(enchantValue);
    if (!values.length) return 0;
    return id === 'renewal' ? Math.min(...values) : values.reduce((a, b) => a + b, 0);
  }

  /** Enchantment on an item, if it's one of your enchanted Armourer pieces. */
  enchantOn(itemId: string): Enchantment | undefined {
    return this.enchanted.get(itemId);
  }

  /** Roll and set up this floor's event (see data/floorEvents.ts). */
  private startFloorEvent(depth: number): void {
    this.floorEvent = isBossFloor(depth) ? null : rollFloorEvent(depth, rand);
    const free = () => {
      const taken = (p: Point) => this.npcs.some((n) => samePos(n.pos, p));
      return spawnMonsters(this.map).map((n) => n.pos).filter((p) => !taken(p));
    };
    if (this.floorEvent === 'gilded') {
      this.npcs = this.npcs.map((n) => {
        if (n.isBoss) return n;
        const tougher = Object.assign(new Npc({ ...n.def, hitpoints: Math.round(n.def.hitpoints * 1.15) }, n.pos), { elite: n.elite });
        return tougher;
      });
    } else if (this.floorEvent === 'infested') {
      const extra = spawnMonsters(this.map).filter((n) => !n.isBoss && !this.npcs.some((o) => samePos(o.pos, n.pos)));
      this.npcs.push(...extra.slice(0, Math.ceil(this.npcs.length / 2)));
    } else if (this.floorEvent === 'treasure_goblin') {
      const spot = free()[0];
      if (spot) this.npcs.push(new Npc(treasureGoblin(depth), spot));
      else this.floorEvent = null;
    }
  }

  /** Hand over what a wandering adventurer asked for, if you have it, and collect the reward. */
  private tradeWithWanderer(node: ResourceNode): void {
    const deal = node.deal;
    if (!deal || node.used) {
      this.message('"Thanks again, friend. Good luck down there."');
      return;
    }
    const inv = this.player.inventory;
    const have = deal.request.items.reduce((n, id) => n + inv.count(id), 0);
    if (have < deal.request.qty) {
      this.message(`"Bring me ${deal.request.qty} ${deal.request.what} and I'll give you ${REWARD_TEXT[deal.reward]}." (You have ${have}.)`);
      return;
    }
    let left = deal.request.qty;
    for (const id of deal.request.items) {
      const take = Math.min(left, inv.count(id));
      if (take) inv.remove(id, take);
      left -= take;
      if (!left) break;
    }
    node.used = true;
    this.stat('trades');
    this.sound('buy');
    if (deal.reward === 'relic') {
      this.message('"A fair trade! Take this, I found it down here."');
      this.offerRelics();
    } else if (deal.reward === 'tokens') {
      const tokens = 10 + 5 * this.depth;
      this.bonusTokens += tokens;
      this.message(`"A fair trade!" You receive ${tokens} Dungeoneering tokens.`);
    } else {
      const coins = 60 * this.depth;
      if (!inv.add('coins', coins)) this.dropHere('coins', coins);
      this.message(`"A fair trade!" You receive ${coins} coins.`);
    }
  }

  hasModifier(id: string): boolean {
    return this.modifiers.includes(id);
  }

  hasCurse(id: string): boolean {
    return this.curses.includes(id);
  }

  /** Frailty: lose a tenth of your max HP for the run. */
  private applyFrailty(): void {
    const p = this.player;
    p.hpBonus -= Math.max(1, Math.round(p.maxHp * 0.1));
    p.hp = Math.min(p.hp, p.maxHp);
  }

  /** Rank of a Mentor perk this run (0 if not bought). */
  perkRank(id: string): number {
    return this.mods.perkRanks?.[id] ?? 0;
  }

  /** Perk multipliers on accuracy and max hit for an attack with `mode` against `target`. */
  private perkMults(mode: AttackType, target?: Npc): { acc: number; dmg: number } {
    const r = (id: string) => this.perkRank(id);
    const p = this.player;
    let acc = 1 + 0.03 * r({ melee: 'precision', ranged: 'eagle_eye', magic: 'arcane_focus' }[mode]);
    let dmg = 1 + 0.03 * r({ melee: 'brute_force', ranged: 'heavy_draw', magic: 'spell_power' }[mode]);
    // Mastery: Attack/Strength for melee, Ranged and Magic for theirs.
    acc *= 1 + this.masteryOf(mode === 'melee' ? 'attack' : mode);
    dmg *= 1 + this.masteryOf(mode === 'melee' ? 'strength' : mode);
    const both = (f: number) => {
      acc *= f;
      dmg *= f;
    };
    if (mode === 'melee' && p.hp < p.maxHp / 2) both(1 + 0.05 * r('rage'));
    if (mode === 'magic' && p.hp > p.maxHp * 0.75) both(1 + 0.05 * r('overcharge'));
    if (target) {
      if (mode === 'melee' && target.hp < target.maxHp / 4) dmg *= 1 + 0.1 * r('executioner');
      if (mode === 'magic' && target.def.weakness === 'magic') dmg *= 1 + 0.1 * r('attunement');
      if (this.veteranOf.includes(target.def.id)) both(1 + 0.03 * r('monster_lore'));
      if (target.isBoss || target.elite) both(1 + 0.05 * r('giant_slayer'));
      if (!target.target) both(1 + 0.1 * r('ambusher'));
    }
    dmg *= 1 + Math.min(0.01 * this.floorKills, 0.03 * r('momentum'));
    return { acc, dmg };
  }

  /** Mastery bonus for a skill this run (e.g. 0.05 = +5%). */
  masteryOf(skill: SkillName): number {
    return masteryValue(skill, this.mastery[skill] ?? 0);
  }

  /** Preservation: a potion sometimes isn't used up. */
  private preserved(): boolean {
    if (rand() >= 0.1 * this.perkRank('preservation')) return false;
    this.message('Preservation: the potion is not used up.');
    return true;
  }

  /** Undying (and Phoenix) charges left this run. */
  private undyingLeft(): number {
    return (this.mods.undying ? 1 + this.perkRank('phoenix') : 0) - this.undyingTimes;
  }

  /** Special attack cost after Weapon Mastery. */
  specCost(spec: SpecDef): number {
    return spec.cost - 5 * this.perkRank('weapon_mastery');
  }

  /** Merchant prices after Haggler. */
  buyPrice(price: number): number {
    return Math.max(1, Math.round(price * (1 - 0.1 * this.perkRank('haggler'))));
  }

  sellPrice(id: string): number {
    return Math.floor(sellPriceOf(id) * (1 + 0.1 * this.perkRank('haggler')));
  }

  /** Trophy room and pet bonuses to max hit. */
  private campMaxHitMult(mode: AttackType): number {
    const pet = this.campBonus.pet;
    return (1 + this.campBonus.trophy) * (pet && pet.kind === mode ? 1 + pet.amount : 1);
  }

  /** Restored runs (see save/runSave.ts) need their event sink reconnected. */
  attachEmitter(emit: (e: GameEvent) => void): void {
    this.emit = emit;
  }

  /** Autoplay handover: everything earned so far counts half from here on. */
  endAutoplay(): void {
    this.assisted = true;
    this.tokenBaseline = this.rawTokens();
    this.message(`Autoplay hands over on floor ${this.depth}. Autoplayed floors pay half tokens. Good luck!`);
  }

  private loadCamp(slayerUnlocked = false, armourerUnlocked = false, enchanterUnlocked = false, built: StructureId[] = []): void {
    const { map, nodes } = generateCamp(slayerUnlocked, armourerUnlocked, enchanterUnlocked, built);
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
    if (this.noRewards) return 0;
    // Tokens from skipped or autoplayed floors (the baseline) only count half.
    const base = this.rawTokens() - this.tokenBaseline / 2;
    const collector = (1 + 0.002 * this.perkRank('collector') * this.logSlots) * (1 + modifierBonus(this.modifiers));
    return Math.floor(base * this.mods.tokenMult * collector * (this.hasRelic('lucky_charm') ? 1.25 : 1));
  }

  /** Token value before multipliers and the half-rate for skipped floors. */
  private rawTokens(): number {
    return 15 * (this.depth - 1) + this.kills + this.bonusTokens + this.mods.bossTokens * this.bossKills
      + (ELITE_TOKENS + 10 * this.perkRank('elite_hunter')) * this.eliteKills
      + coinTokens(this.player.inventory.count('coins')) * (this.perkRank('midas') ? 2 : 1);
  }

  get depth(): number {
    return this.map.depth;
  }

  loadFloor(depth: number): void {
    this.map = generateFloor(this.seed * 1000 + depth, depth);
    this.explored = new Uint8Array(this.map.width * this.map.height);
    // Resources first so monsters only spawn on tiles left free.
    this.nodes = placeResources(this.map);
    // Bountiful: resources last longer.
    for (const n of this.nodes) if (n.kind === 'resource') n.remaining += this.perkRank('bountiful');
    this.npcs = spawnMonsters(this.map);
    this.startFloorEvent(depth);
    if (this.hasModifier('hardened')) {
      this.npcs = this.npcs.map((n) => Object.assign(new Npc({ ...n.def, hitpoints: Math.round(n.def.hitpoints * 1.25) }, n.pos), { elite: n.elite }));
    }
    if (this.hasModifier('ironman')) {
      for (const n of this.nodes.filter((x) => x.kind === 'merchant' || x.kind === 'wanderer')) setTile(this.map, n.pos.x, n.pos.y, Tile.Floor);
      this.nodes = this.nodes.filter((x) => x.kind !== 'merchant' && x.kind !== 'wanderer');
    }
    this.floorKills = 0;
    this.hitThisFloor = false;
    this.saintUsedFloor = false;
    this.groundItems = [];
    this.pendingHits = [];
    const p = this.player;
    if (depth > 1) p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + Math.ceil(p.maxPrayer * this.mods.descentPrayerRestore));
    if (depth > 1 && this.perkRank('fresh_air')) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.1 * this.perkRank('fresh_air')));
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
    if (this.floorEvent) {
      this.stat('floorEvents');
      const ev = FLOOR_EVENT_BY_ID[this.floorEvent];
      this.message(`${ev.name}! ${ev.desc}`);
    }
    this.emit({ type: 'floor', depth });
  }

  /** Slayer XP equals the monster's hitpoints (OSRS); finishing pays tokens. */
  private slayerKill(npc: Npc): void {
    const task = this.slayerTask!;
    const cat = SLAYER_BY_ID[task.category];
    task.remaining--;
    this.giveXp('slayer', npc.def.hitpoints * XP_RATE);
    if (task.remaining === 0) {
      const tokens = Math.round(cat.tokensPerKill * task.total * (1 + 0.15 * this.perkRank('slayer_studies') + this.masteryOf('slayer')));
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

  /** Thieving: walk up to a humanoid monster and try to pick its pocket. */
  pickpocket(npc: Npc): void {
    if (this.over) return;
    this.player.intent = { kind: 'pickpocket', npc };
    this.player.path = [];
  }

  /** Agility: walk to a wall shortcut and cross it. */
  useShortcut(node: ResourceNode): void {
    if (this.over) return;
    this.player.intent = { kind: 'shortcut', node };
    this.player.path = [];
  }

  /** Damage from traps and getting caught (not from a monster's attack). */
  hurtPlayer(dmg: number, cause: string): void {
    const p = this.player;
    // Trap Sense.
    dmg = Math.max(dmg > 0 ? 1 : 0, Math.round(dmg * (1 - 0.25 * this.perkRank('trap_sense'))));
    if (dmg >= p.hp && this.undyingLeft() > 0) {
      this.undyingUsed = true;
      this.undyingTimes++;
      dmg = p.hp - 1;
      this.message('You narrowly cheat death! (Undying)');
    }
    this.applyHit(p, dmg);
    if (p.dead) {
      this.over = true;
      this.runStats.killedBy = cause;
      this.message('Oh dear, you are dead!');
      this.emit({ type: 'death' });
    }
  }

  /** Put an item in the pack, or on the floor under you if it's full. */
  dropHere(id: string, qty: number): void {
    this.dropOnTile(id, qty, this.player.pos);
  }

  private tryPickpocket(npc: Npc): void {
    const p = this.player;
    const def = PICKPOCKET[npc.def.id];
    if (!def) return;
    const level = p.skills.level('thieving');
    if (level < def.level) {
      this.message(`You need a Thieving level of ${def.level} to pick the ${npc.name.toLowerCase()}'s pocket.`);
      return;
    }
    if (npc.picked >= POCKET_LIMIT + this.perkRank('rummage')) {
      this.message(`The ${npc.name.toLowerCase()}'s pockets are empty.`);
      return;
    }
    this.message(`You attempt to pick the ${npc.name.toLowerCase()}'s pocket.`);
    if (!this.perkRank('shadowstep') && rand() >= thievingChance(level, def.level) + this.thievingBonus()) {
      this.message(`You fail to pick the ${npc.name.toLowerCase()}'s pocket. "What do you think you're doing?!"`);
      this.message("You've been stunned!");
      p.stunnedUntil = this.tickCount + Math.max(1, STUN_TICKS - this.perkRank('escape_artist'));
      p.path = [];
      npc.target = p;
      this.sound('hurt');
      const [lo, hi] = def.damage;
      this.hurtPlayer(lo + Math.floor(rand() * (hi - lo + 1)), npc.name);
      return;
    }
    npc.picked++;
    const pick = RNG.getWeightedValue(Object.fromEntries(def.loot.map((l, i) => [i, l.weight])));
    const loot = def.loot[Number(pick)];
    const qty = (loot.min + Math.floor(rand() * (loot.max - loot.min + 1))) * (rand() < 0.1 * this.perkRank('master_thief') ? 2 : 1);
    this.emit({ type: 'obtain', item: loot.item, qty, source: 'pickpocket' });
    if (p.inventory.add(loot.item, qty)) this.countLoot(loot.item, qty);
    else this.dropOnTile(loot.item, qty, p.pos);
    this.message(`You pick the ${npc.name.toLowerCase()}'s pocket.${qty > 1 || loot.item !== 'coins' ? ` (${qty} x ${item(loot.item).name})` : ''}`);
    this.sound('pickup');
    this.stat('pickpockets');
    this.giveXp('thieving', def.xp * XP_RATE);
  }

  /** Thieves' Gloves relic. */
  private thievingBonus(): number {
    return (this.hasRelic('thieves_gloves') ? 0.15 : 0) + 0.03 * this.perkRank('nimble_fingers') + this.masteryOf('thieving');
  }

  private crossShortcut(node: ResourceNode): void {
    const p = this.player;
    const sc = node.shortcut!;
    const level = p.skills.level('agility');
    const kind = SHORTCUT_KINDS[sc.kind];
    if (level < sc.level) {
      this.message(`You need an Agility level of ${sc.level} to use this shortcut.`);
      return;
    }
    const boots = this.hasRelic('boots_of_lightness');
    const sure = boots || this.perkRank('shadowstep') > 0;
    if (!sure && rand() >= shortcutChance(level, sc.level) + 0.05 * this.perkRank('acrobat') + this.masteryOf('agility')) {
      this.message(`You slip trying to ${kind.verb.toLowerCase().replace('-', ' ')} the ${kind.name.toLowerCase()}.`);
      this.sound('hurt');
      this.hurtPlayer(1 + Math.floor(rand() * (1 + Math.ceil(this.depth / 3))), `a ${kind.name.toLowerCase()}`);
      return;
    }
    const to = samePos(p.pos, sc.a) ? sc.b : sc.a;
    if (this.npcAt(to.x, to.y)) {
      this.message('Something is blocking the other side.');
      return;
    }
    p.pos = { ...to };
    p.path = [];
    this.message(`You ${kind.verb.toLowerCase().replace('-', ' ')} the ${kind.name.toLowerCase()}.`);
    this.sound('stairs');
    this.stat('shortcuts');
    this.giveXp('agility', shortcutXp(sc.level) * XP_RATE * (boots ? 2 : 1));
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
    const cost = this.buyPrice(entry.price) * bundle;
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
    const each = this.sellPrice(stack.id);
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
    // Locked chests: pick the lock first. They hold twice the loot and are never Mimics.
    const locked = node.lockLevel;
    if (locked) {
      const level = this.player.skills.level('thieving');
      if (level < locked) {
        this.message(`This chest is locked. You need a Thieving level of ${locked} to pick it.`);
        return;
      }
      if (rand() >= thievingChance(level, locked, 0.5) + this.thievingBonus()) {
        this.message('You set off a trap! A dart shoots out of the lock.');
        this.sound('hurt');
        this.hurtPlayer(1 + Math.floor(rand() * (2 + Math.ceil(this.depth / 2))), 'a chest trap');
        return;
      }
      node.lockLevel = undefined;
      this.message('You pick the lock.');
      this.stat('locks');
      this.giveXp('thieving', lockXpFor(this.depth) * XP_RATE);
    }
    node.used = true;
    if (!locked && this.depth >= 3 && rand() < MIMIC_CHANCE) {
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
    const loot = locked ? [...chestLoot(this.depth), ...chestLoot(this.depth)] : chestLoot(this.depth);
    for (const { id, qty } of loot) {
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

  /** Herblore: mix a potion from the inventory (herb + secondary + vial of water). */
  mix(recipe: Recipe): void {
    if (this.over) return;
    const why = processBlocker(this.player, recipe);
    if (why) {
      this.message(why.replace('the ore for that', 'the ingredients for that'));
      return;
    }
    processStep(this, recipe);
    this.stat('potions');
  }

  /** Fletching: make a bow or arrows straight from the inventory (needs a knife). */
  fletch(recipe: Recipe): void {
    if (this.over) return;
    const why = processBlocker(this.player, recipe);
    if (why) {
      this.message(why);
      return;
    }
    processStep(this, recipe);
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
    const mult = this.mods.coinMult * (this.hasRelic('ring_of_wealth') ? 2 : 1) * (this.floorEvent === 'gilded' ? 2 : 1);
    return [Math.floor(lo * mult), Math.floor(hi * mult)];
  }

  hasRelic(id: string): boolean {
    return this.relics.includes(id);
  }

  /** Offers RELIC_CHOICES random relics the player doesn't have yet. */
  offerRelics(): void {
    if (this.hasModifier('relicless')) {
      this.message('Relicless: the relic crumbles to dust in your hands.');
      return;
    }
    const pool = RELICS.filter((r) => !this.hasRelic(r.id) && (!r.quest || this.questRelics.includes(r.id))).map((r) => r.id);
    if (!pool.length) return;
    this.pendingRelics = RNG.shuffle(pool).slice(0, RELIC_CHOICES + this.perkRank('relic_hunter'));
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
  /** Quick-eat (F): the food that best fits your missing HP (the smallest that fills it, else the biggest). */
  quickEat(): void {
    const p = this.player;
    const missing = p.maxHp - p.hp;
    const foods = p.inventory.slots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s && item(s.id).heal)
      .map(({ s, i }) => ({ i, heal: item(s!.id).heal! }));
    if (!foods.length) {
      this.message("You don't have any food.");
      return;
    }
    const fits = foods.filter((f) => f.heal >= missing).sort((a, b) => a.heal - b.heal)[0];
    const best = fits ?? foods.sort((a, b) => b.heal - a.heal)[0];
    this.useItem(best.i);
  }

  useItem(slot: number): void {
    if (this.over) return;
    const p = this.player;
    const stack = p.inventory.slots[slot];
    if (!stack) return;
    const def = item(stack.id);

    if (def.burnTicks) {
      this.lightFire(slot);
    } else if (def.boost) {
      if (p.eatCooldown > 0) return;
      if (!this.preserved()) p.inventory.take(slot, 1);
      const b = def.boost;
      for (const skill of b.skills) {
        const amount = b.base + Math.floor(p.skills.level(skill) * b.pct);
        p.boosts[skill] = Math.max(p.boosts[skill] ?? 0, amount);
      }
      p.eatCooldown = EAT_DELAY;
      p.hp = Math.min(p.maxHp, p.hp + 2 * this.perkRank('field_medic'));
      this.message(`You drink the ${def.name.toLowerCase()}. You feel your ${b.skills.map((s) => SKILL_LABELS[s]).join(', ')} rise.`);
      this.sound('eat');
    } else if (def.restoresPrayer) {
      if (p.eatCooldown > 0) return;
      if (!this.preserved()) p.inventory.take(slot, 1);
      const restore = potionRestore(p.maxPrayer) * (this.hasRelic('holy_wrench') ? 1.5 : 1) * (1 + 0.1 * this.perkRank('potent_brews'));
      p.hp = Math.min(p.maxHp, p.hp + 2 * this.perkRank('field_medic'));
      p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + Math.floor(restore));
      p.eatCooldown = EAT_DELAY;
      this.message('You drink the prayer potion.');
      this.sound('eat');
    } else if (def.heal) {
      if (p.eatCooldown > 0) return;
      p.inventory.take(slot, 1);
      const heal = (def.heal + this.mods.foodHealBonus) * (this.hasRelic('gourmet') ? 1.5 : 1) * (this.hasCurse('famine') ? 0.8 : 1)
        * (this.hasModifier('famished') ? 0.75 : 1);
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(heal));
      p.eatCooldown = EAT_DELAY;
      p.attackCooldown += Math.max(0, EAT_DELAY - this.perkRank('quick_eater'));
      this.message(`You eat the ${def.name.toLowerCase()}. It heals some health.`);
      this.runStats.foodEaten++;
      this.sound('eat');
    } else if (def.buryXp) {
      p.inventory.take(slot, 1);
      this.message('You bury the bones.');
      this.sound('bury');
      this.stat('bones');
      this.giveXp('prayer', def.buryXp * (1 + 0.25 * this.perkRank('bone_lore')));
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
    // Potion boosts fade by 1 level a minute (100 ticks), like OSRS.
    const fade = Math.round(100 * (1 + 0.5 * this.perkRank('herbal_infusion')));
    if (this.tickCount % fade === 0) {
      for (const k of Object.keys(p.boosts) as SkillName[]) {
        p.boosts[k] = Math.max(0, (p.boosts[k] ?? 0) - 1);
        if (!p.boosts[k]) delete p.boosts[k];
      }
    }
    if (this.tickCount % SPEC_REGEN_TICKS === 0) {
      p.specEnergy = Math.min(100, p.specEnergy + Math.round(SPEC_REGEN * (1 + 0.15 * this.perkRank('adrenaline'))));
    }
    const regen = Math.round(this.mods.hpRegenTicks / (this.hasRelic('regen_bracelet') ? 2 : 1));
    if (this.tickCount % regen === 0 && p.hp < p.maxHp && !this.hasCurse('unrest')) p.hp++;
    if (this.floorEvent === 'blessed' && this.tickCount % 10 === 0 && p.hp < p.maxHp) p.hp++;
    const renewal = this.enchantPower('renewal');
    if (renewal && this.tickCount % renewal === 0 && p.hp < p.maxHp) p.hp++;
    this.updateFov();
  }

  private updateFov(): void {
    const { x, y } = this.player.pos;
    const radius = this.isCamp ? CAMP_FOV : this.floorEvent === 'darkness' ? DARKNESS_FOV : FOV_RADIUS;
    this.visible = computeVisible(this.map, x, y, radius);
    for (const i of this.visible) this.explored[i] = 1;
  }

  private drainPrayer(): void {
    const p = this.player;
    if (!p.activePrayers.size) return;
    for (const id of p.activePrayers) p.prayerDrain += PRAYER_BY_ID[id].drain;
    const resistance = DRAIN_RESISTANCE * this.mods.drainResistMult * (this.hasRelic('holy_wrench') ? 1.15 : 1)
      / (1 - this.masteryOf('prayer')) * (this.floorEvent === 'blessed' ? 2 : 1)
      / (1 - Math.min(0.6, this.enchantPower('blessed')));
    while (p.prayerDrain >= resistance) {
      p.prayerDrain -= resistance;
      p.prayerPoints = Math.max(0, p.prayerPoints - 1);
    }
    if (p.prayerPoints === 0 && this.perkRank('saint') && !this.saintUsedFloor) {
      this.saintUsedFloor = true;
      p.prayerPoints = Math.ceil(p.maxPrayer / 2);
      this.message('Saint: your faith is rewarded, and your prayer returns.');
      return;
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

  /** Granite maul: an armed special hits right away, whatever the attack delay. */
  private instantSpecReady(): boolean {
    const p = this.player;
    const spec = SPEC_BY_WEAPON[p.equipment.weapon ?? ''];
    return !!spec?.instant && p.specArmed && p.specEnergy >= this.specCost(spec);
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
    if (this.tickCount < p.stunnedUntil) return;
    const intent = p.intent;

    switch (intent?.kind) {
      case 'pickpocket': {
        const npc = intent.npc;
        if (npc.dead || !this.npcs.includes(npc)) {
          p.intent = null;
          return;
        }
        const a = this.approach(npc.pos);
        if (a === 'moving') return;
        p.intent = null;
        if (a === 'unreachable') this.message("I can't reach that!");
        else this.tryPickpocket(npc);
        return;
      }
      case 'shortcut': {
        const a = this.approach(intent.node.pos);
        if (a === 'moving') return;
        p.intent = null;
        if (a === 'unreachable') this.message("I can't reach that!");
        else this.crossShortcut(intent.node);
        return;
      }
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
        } else if (a === 'adjacent' && (p.attackCooldown === 0 || this.instantSpecReady())) {
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
        } else if (node.kind === 'wanderer') {
          this.tradeWithWanderer(node);
        } else if (node.kind === 'dark_shrine') {
          if (node.used) {
            this.message('The dark shrine is silent.');
          } else {
            node.used = true;
            const pool = CURSES.filter((c) => !this.curses.includes(c.id));
            const curse = pool.length ? pool[Math.floor(rand() * pool.length)] : null;
            if (curse) {
              this.curses.push(curse.id);
              if (curse.id === 'frailty') this.applyFrailty();
              this.message(`The shrine takes its price. You are cursed with ${curse.name}: ${curse.desc}`);
            }
            this.sound('hurt');
            this.offerRelics();
          }
        } else if (node.kind === 'shrine') {
          if (node.used) {
            this.message('The shrine is dormant.');
          } else {
            node.used = true;
            this.offerRelics();
          }
        } else {
          const menu = node.kind === 'slayer_master' ? 'slayer' : node.kind === 'armourer' ? 'armoury'
            : node.kind === 'enchanter' ? 'enchanter'
              : node.kind === 'builder' || node.kind in STRUCTURE_BY_ID ? 'builder'
                : node.kind === 'quest_board' ? 'quests' : node.kind as 'mentor' | 'toolsmith';
          this.emit({ type: 'campMenu', kind: menu });
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
        if (this.perkRank('sanctuary')) {
          p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.5 * this.perkRank('sanctuary')));
          this.message('Sanctuary: the altar soothes your wounds.');
        }
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
      Math.floor(p.boostedLevel(skill) * (1 + p.prayerBoost(group)));
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
    const onTask = !!target && this.isOnTask(target);
    const slayer = (onTask ? 1 + SLAYER_BONUS_PER_LEVEL * s.level('slayer') : 1) * (onTask ? 1 + this.enchantPower('slayers') : 1);
    const keen = 1 + this.enchantPower('keen');
    const fireCape = target?.isBoss && this.hasRelic('fire_cape') ? 1.1 : 1;
    const brutal = 1 + this.enchantPower('brutal');
    const pm = this.perkMults(mode, target);
    return {
      mode,
      attackRoll: Math.floor(this.mods.combatMult * glory * slayer * keen * pm.acc * attackRoll),
      maxHit: Math.floor(this.mods.combatMult * glory * berserk * slayer * brutal * fireCape * this.campMaxHitMult(mode) * pm.dmg * max),
      speed,
      range: p.attackRange,
      spell,
      problem,
    };
  }

  /** Chance the player's next attack hits `npc` (weakness included). */
  hitChanceAgainst(npc: Npc, preview = this.combatPreview(npc)): number {
    const weakness = npc.def.weakness === preview.mode ? WEAKNESS_PENALTY : 0;
    const deadeye = preview.mode === 'ranged' && this.perkRank('deadeye') ? 0.75 : 1;
    const defence = Math.floor(npc.def.defence * (1 - npc.defenceDrain) * deadeye);
    const defRoll = roll(defence + 9, Math.max(-63, npc.def.defenceBonus - weakness));
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
    p.attackCooldown = speed;
    const spec = this.armedSpec();
    if (spec) {
      p.specEnergy -= this.specCost(spec);
      p.specArmed = false;
      this.message(`You use ${spec.name}!`);
      this.sound('spec');
    }
    if (mode === 'ranged') this.fireArrow(npc);
    if (spec?.weapon === 'magic_shortbow' && p.ammo > 0) this.fireArrow(npc);
    if (spell) this.castSpell(spell);
    if (mode !== 'melee') this.emit({ type: 'projectile', from: { ...p.pos }, to: { ...npc.pos }, style: mode, ticks: 1 });
    // Each hit: [accuracy multiplier, max hit multiplier]; most attacks are a single plain hit.
    const hits: Array<[number, number]> = !spec ? [[1, 1]]
      : spec.weapon === 'dragon_dagger' ? [[1.15, 1.15], [1.15, 1.15]]
        : spec.weapon === 'magic_shortbow' ? [[1.1, 1], [1.1, 1]]
          : spec.weapon === 'dragon_warhammer' ? [[1, 1.5]]
            : spec.weapon === 'ancient_staff' ? [[3, 1.3]]
              : [[1, 1]];
    // Warlord's Might (melee) and Volley (ranged): sometimes a free extra hit.
    if (!spec && mode === 'melee' && rand() < 0.1 * this.perkRank('warlords_might')) hits.push([1, 1]);
    if (!spec && mode === 'ranged' && rand() < 0.04 * this.perkRank('volley')) hits.push([1, 1]);
    if (spec?.weapon === 'dragon_claws') {
      this.clawSpec(npc, c);
    } else {
      for (const [acc, base] of hits) {
        if (npc.dead) break;
        const mult = base * (mode === 'melee' && rand() < 0.05 * this.perkRank('crushing_blow') ? 1.5 : 1);
        const dmg = this.strike(npc, { ...c, attackRoll: Math.floor(c.attackRoll * acc), maxHit: Math.floor(c.maxHit * mult) });
        if (spec?.weapon === 'dragon_warhammer' && dmg > 0) npc.defenceDrain = Math.min(0.9, 1 - (1 - npc.defenceDrain) * 0.7);
      }
    }
    npc.target = p;
    if (npc.dead) this.killNpc(npc);
  }

  /** The special attack the next swing will use, if it's armed and there's enough energy. */
  private armedSpec(): SpecDef | null {
    const p = this.player;
    const spec = p.specArmed ? SPEC_BY_WEAPON[p.equipment.weapon ?? ''] : undefined;
    if (!spec) return null;
    if (p.specEnergy < this.specCost(spec)) {
      p.specArmed = false;
      this.message('You do not have enough special attack energy left.');
      return null;
    }
    return spec;
  }

  /** Arm or disarm the special attack (E, or click the spec bar). */
  toggleSpec(): void {
    const p = this.player;
    const spec = SPEC_BY_WEAPON[p.equipment.weapon ?? ''];
    if (!spec) {
      this.message('Your weapon has no special attack.');
      return;
    }
    if (!p.specArmed && p.specEnergy < this.specCost(spec)) {
      this.message(`You need ${this.specCost(spec)}% special attack energy for ${spec.name}.`);
      return;
    }
    p.specArmed = !p.specArmed;
  }

  /** Dragon claws: four slashes. Damage cascades from the first slash that lands. */
  private clawSpec(npc: Npc, c: CombatPreview): void {
    const chance = this.hitChanceAgainst(npc, c);
    const pattern = [[1, 0.5, 0.25, 0.25], [0, 1, 0.5, 0.5], [0, 0, 0.75, 0.75], [0, 0, 0, 1.25]];
    for (let first = 0; first < 4; first++) {
      if (rand() >= chance) continue;
      const base = 1 + Math.floor(rand() * Math.max(1, c.maxHit));
      for (const share of pattern[first]) {
        if (npc.dead) return;
        if (share) this.strikeFixed(npc, Math.max(1, Math.floor(base * share)), c);
      }
      return;
    }
    // All four missed: two small consolation hits, as in OSRS.
    this.strikeFixed(npc, 1, c);
    if (!npc.dead) this.strikeFixed(npc, 1, c);
  }

  /** One hit roll against `npc` with on-hit effects and XP; returns the damage dealt. */
  private strike(npc: Npc, c: CombatPreview): number {
    const chance = this.hitChanceAgainst(npc, c);
    let raw = rollDamage(chance, c.maxHit, rand);
    // Sharpshooter: a hitting arrow sometimes lands for its maximum. Battle Mage: misses still sting.
    if (c.mode === 'ranged' && raw > 0 && rand() < 0.04 * this.perkRank('sharpshooter')) raw = c.maxHit;
    if (c.mode === 'magic' && raw === 0) raw = this.perkRank('battle_mage');
    const dmg = this.strikeFixed(npc, raw, c);
    if (c.mode === 'magic' && dmg > 1 && this.perkRank('chain_lightning')) this.chainLightning(npc, Math.floor(dmg / 2));
    return dmg;
  }

  /** Chain Lightning: half the damage arcs to the nearest other visible monster within 3 tiles. */
  private chainLightning(from: Npc, dmg: number): void {
    const other = this.npcs.find((n) => n !== from && !n.dead && chebyshev(n.pos, from.pos) <= 3 && this.isVisible(n.pos.x, n.pos.y));
    if (!other) return;
    this.emit({ type: 'projectile', from: { ...from.pos }, to: { ...other.pos }, style: 'magic', ticks: 1 });
    this.applyHit(other, Math.min(other.hp, dmg));
    other.target = this.player;
    if (other.dead) this.killNpc(other);
  }

  private strikeFixed(npc: Npc, raw: number, c: CombatPreview): number {
    const p = this.player;
    let dmg = Math.min(npc.hp, raw);
    if (dmg > 0) dmg = Math.min(npc.hp, dmg + this.enchantPower('flaming')); // Flaming: bonus fire damage on hits
    if (dmg > 0 && this.enchantPower('leeching')) {
      this.leechBank += dmg * this.enchantPower('leeching');
      const heal = Math.floor(this.leechBank);
      this.leechBank -= heal;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    if (dmg > 0 && this.hasRelic('vampyric_fang')) {
      this.lifestealBank += dmg;
      const heal = Math.floor(this.lifestealBank / 4);
      this.lifestealBank %= 4;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    this.applyHit(npc, dmg);
    this.giveCombatXp(c.mode, dmg, c.spell);
    return dmg;
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
    if (!this.npcs.includes(npc)) return;
    this.npcs.splice(this.npcs.indexOf(npc), 1);
    this.kills++;
    this.floorKills++;
    if (this.floorEvent === 'infested') this.bonusTokens += 1;
    if (this.floorEvent === 'cursed') this.bonusTokens += 2;
    if (npc.def.id === 'treasure_goblin') {
      this.stat('goblins');
      this.message('You catch the treasure goblin! Coins spill everywhere.');
      this.floorEvent = null;
    }
    const style = this.player.weaponType;
    // Bloodlust, Soul Siphon, Divine Favour.
    const p = this.player;
    if (style === 'melee') p.hp = Math.min(p.maxHp, p.hp + this.perkRank('bloodlust'));
    let prayer = style === 'magic' ? this.perkRank('soul_siphon') : 0;
    if (rand() < 0.05 * this.perkRank('divine_favor')) prayer += 3;
    if (prayer) p.prayerPoints = Math.min(p.maxPrayer, p.prayerPoints + prayer);
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
    if (npc.elite) {
      this.eliteKills++;
      this.stat('eliteKills');
      this.message(`You defeat the ${npc.name}! Elites drop double loot.`);
    }
    // Regular monsters sometimes drop a herb that grows at this depth; elites always do.
    if (!npc.isBoss && npc.def.id !== 'mimic' && (npc.elite || rand() < HERB_DROP_CHANCE * (1 + 0.25 * this.perkRank('forager')))) {
      this.groundItems.push(new GroundItem(herbForDepth(this.depth, rand), 1, { ...npc.pos }));
    }
    // Rarely, a special attack weapon.
    const specChance = npc.isBoss ? SPEC_DROP_CHANCE.boss : npc.elite ? SPEC_DROP_CHANCE.elite : SPEC_DROP_CHANCE.normal;
    const specPool = specWeaponsFor(this.depth);
    if (specPool.length && npc.def.id !== 'mimic' && rand() < specChance * this.mods.rareDropMult) {
      const w = specPool[Math.floor(rand() * specPool.length)].weapon;
      this.groundItems.push(new GroundItem(w, 1, { ...npc.pos }));
      this.emit({ type: 'obtain', item: w, qty: 1, source: npc.def.id });
      this.message(`Rare drop: ${item(w).name}!`);
      this.sound('levelup');
    }
    // Elites roll their whole table twice.
    for (const d of npc.elite ? [...npc.def.drops, ...npc.def.drops] : npc.def.drops) {
      if (rand() >= this.dropChance(d)) continue;
      const [lo, hi] = this.dropQuantity(d);
      const qty = lo + Math.floor(rand() * (hi - lo + 1));
      const buryXp = item(d.item).buryXp;
      if (buryXp && this.hasRelic('bonecrusher')) {
        this.giveXp('prayer', buryXp * qty * (1 + 0.25 * this.perkRank('bone_lore')));
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
    if (WORKBENCH_SKILLS.includes(skill)) amount *= 1 + this.campBonus.workbench;
    if (GATHER_SKILLS.includes(skill)) amount *= 1 + 0.1 * this.perkRank('gatherers_lore');
    if (COMBAT_SKILLS.includes(skill)) amount *= 1 + 0.1 * this.perkRank('battle_hardened');
    if (skill === 'thieving') amount *= 1 + 0.2 * this.perkRank('cutpurse');
    if (skill === 'crafting') amount *= 1 + 0.2 * this.perkRank('gem_cutter');
    if (this.floorEvent === 'darkness') amount *= 1.5;
    if (skill === 'agility') amount *= 1 + 0.25 * this.perkRank('parkour');
    if (skill === 'slayer') amount *= 1 + 0.2 * this.perkRank('slayer_lore');
    this.runStats.xp[skill] = (this.runStats.xp[skill] ?? 0) + amount;
    const gained = p.skills.addXp(skill, amount);
    this.emit({ type: 'xp', skill, amount });
    if (gained > 0) {
      const level = p.skills.level(skill);
      if (skill === 'hitpoints') p.hp += p.maxHp - hpBefore;
      if (skill === 'prayer') p.prayerPoints += p.maxPrayer - prayerBefore;
      // Carried starting gear you can now use.
      for (const s of p.inventory.slots) {
        const req = s ? item(s.id).equip?.req : undefined;
        if (req?.skill === skill && req.level > level - gained && req.level <= level) {
          this.message(`You can now wield your ${item(s!.id).name}!`);
        }
      }
      const label = SKILL_LABELS[skill];
      this.message(`Congratulations, you just advanced ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label} level. You are now level ${level}.`);
      this.emit({ type: 'levelup', skill, level });
    }
  }

  private processNpc(npc: Npc): void {
    const p = this.player;
    if (npc.attackCooldown > 0) npc.attackCooldown--;
    if (npc.def.id === 'treasure_goblin') {
      this.treasureGoblinTick(npc);
      return;
    }

    if (!npc.target) {
      const d = chebyshev(npc.pos, p.pos);
      const aggro = npc.def.aggroRadius + (this.hasModifier('frenzied') ? 3 : 0)
        - (npc.isBoss ? 0 : (this.hasRelic('graceful') ? 2 : 0) + this.perkRank('light_footed'));
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
    const def = Math.floor(p.boostedLevel('defence') * (1 + p.prayerBoost('defence')));
    const kiting = (p.weaponType === 'ranged' ? 1 - 0.05 * this.perkRank('kiting') : 1) * (this.hasCurse('exposure') ? 1.1 : 1);
    const attRoll = Math.floor(roll(d.attack + 9, d.attackBonus) * kiting);
    const petDefence = this.campBonus.pet?.kind === 'defence' ? this.campBonus.pet.amount : 0;
    const defRoll = Math.floor(roll(effectiveLevel(def, p.style === 'defensive' ? 3 : 0), p.bonuses().defence)
      * (1 + this.enchantPower('fortified') + petDefence + 0.03 * this.perkRank('toughness') + this.masteryOf('defence')));
    const max = Math.floor(maxHit(d.strength + 9, d.strengthBonus) * (this.floorEvent === 'cursed' ? 1.2 : 1)
      * (this.hasModifier('hardened') ? 1.25 : 1));
    const dmg = rollDamage(hitChance(attRoll, defRoll), max, rand);
    npc.attackCooldown = this.hasModifier('frenzied') ? Math.max(2, d.attackSpeed - 1) : d.attackSpeed;

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
    if (dmg > 0 && rand() < this.masteryOf('agility') / 2) {
      dmg = 0;
      this.message('You nimbly dodge the attack!');
    }
    if (dmg > 0 && style === 'melee' && rand() < 0.04 * this.perkRank('parry')) {
      dmg = 0;
      this.message('You parry the blow!');
    }
    if (dmg > 0) {
      // Defence perks: Missile Ward, Last Stand, Bulwark (first hit each floor), Juggernaut.
      let mult = 1;
      if (style !== 'melee') mult *= 1 - 0.05 * this.perkRank('missile_ward');
      if (p.hp < p.maxHp / 4) mult *= 1 - 0.1 * this.perkRank('last_stand');
      if (!this.hitThisFloor) mult *= 1 - 0.25 * this.perkRank('bulwark');
      mult *= 1 - 0.1 * this.perkRank('juggernaut');
      this.hitThisFloor = true;
      // Randomised rounding, so small hits are reduced fairly on average.
      if (mult < 1) dmg = Math.min(dmg, Math.floor(dmg * mult + rand()));
    }
    if (dmg > 0 && this.hasRelic('dragon_defender')) dmg -= 1;
    dmg = Math.min(p.hp, dmg);
    const reflect = (this.hasRelic('ring_of_recoil') ? 0.1 : 0) + this.enchantPower('thorns');
    if (dmg > 0 && reflect > 0 && !npc.dead && this.npcs.includes(npc)) {
      const recoil = Math.min(npc.hp, Math.max(1, Math.round(dmg * reflect)));
      this.applyHit(npc, recoil);
      if (npc.dead) this.killNpc(npc);
    }
    if (dmg >= p.hp && this.undyingLeft() > 0) {
      this.undyingUsed = true;
      this.undyingTimes++;
      dmg = p.hp - 1;
      this.message('You narrowly cheat death! (Undying)');
    }
    if (npc.isBoss && dmg > 0) this.bossDamage.set(npc, (this.bossDamage.get(npc) ?? 0) + dmg);
    if (npc.elite?.id === 'vampiric' && dmg > 0) npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(dmg / 2));
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

  /** The treasure goblin runs from you once it spots you, and escapes if you take too long. */
  private treasureGoblinTick(npc: Npc): void {
    const p = this.player;
    if (!npc.target && chebyshev(npc.pos, p.pos) <= npc.def.aggroRadius && this.isVisible(npc.pos.x, npc.pos.y)) {
      npc.target = p;
      this.message('The treasure goblin squeals and runs!');
    }
    if (!npc.target) {
      this.wander(npc);
      return;
    }
    if (++npc.fleeTicks >= GOBLIN_ESCAPE_TICKS) {
      this.npcs.splice(this.npcs.indexOf(npc), 1);
      this.floorEvent = null;
      this.message('The treasure goblin escapes through a crack in the wall!');
      return;
    }
    // Run directly away; if cornered, try any step that increases the distance.
    const away = { x: npc.pos.x * 2 - p.pos.x, y: npc.pos.y * 2 - p.pos.y };
    const before = { ...npc.pos };
    this.stepToward(npc, away);
    if (samePos(before, npc.pos)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const to = { x: npc.pos.x + dx, y: npc.pos.y + dy };
        if (chebyshev(to, p.pos) > chebyshev(npc.pos, p.pos) && this.canNpcStep(npc.pos, to)) {
          npc.pos = to;
          break;
        }
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
