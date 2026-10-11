import Phaser from 'phaser';
import { TickScheduler } from '../core/tick';
import { randomSeed } from '../core/rng';
import { item } from '../data/items';
import { CampSetup, GameEvent, GameState } from '../game/GameState';
import { Actor } from '../entities/Actor';
import { Npc } from '../entities/Npc';
import { Point, Tile, isWalkable, tileAt } from '../world/tiles';
import { recipesFor } from '../data/recipes';
import { UnlockKey, applyUnlock, nextUnlocks } from '../data/tools';
import { ResourceNode } from '../entities/ResourceNode';
import { MetaSave, loadMeta, saveMeta } from '../save/meta';
import { ARMOURER_PERK, nextRankCost, perkBlocker } from '../data/skillTree';
import { AttackType } from '../data/prayers';
import { describeOptions, type MenuOption } from '../ui/ContextMenu';
import { sfx } from '../audio/sfx';
import { saveSettings, settings } from '../save/settings';
import { priceOf } from '../data/prices';
import { Notice, ProgressTracker } from '../meta/tracker';
import { PET_BY_ID } from '../data/collectionLog';
import type { AchievementDef } from '../data/achievements';
import { SKIP_TASK_COST, SLAYER_BY_ID, SLAYER_UNLOCK_BOSS, assignTask } from '../data/slayer';
import { themeForDepth } from '../data/themes';
import { ArmouryLine, StartStyle, nextArmouryTier } from '../data/armoury';
import { catchUpFor } from '../data/catchup';
import { enchantCost } from '../data/enchants';
import { PICKPOCKET } from '../data/thieving';
import { Materials, STRUCTURES, STRUCTURE_BY_ID, StructureId, nextStructureLevel } from '../data/construction';
import { campSetupFor, settleRun } from '../meta/camp';
import { SHORTCUT_KINDS } from '../data/agility';
import { clearRun, loadRun, saveRun } from '../save/runSave';

/** Your first kill of this boss brings the Enchanter to camp. */
const ENCHANTER_UNLOCK_BOSS = 'tztok_jad';
import { BotMemory, botStep, newBotMemory } from '../sim/bot';
import { bodyLayer, ensureItemTexture, generateSprites, npcSprite, preloadSprites, shieldLayer, weaponLayer } from '../render/sprites';
import type { UIScene } from './UIScene';

export const TILE = 32;
export const PANEL_W = 236;

/** Colour coding for attack styles: projectiles, boss outlines, overhead prayers. */
export const STYLE_COLORS: Record<AttackType, number> = { melee: 0xd03030, ranged: 0x40b040, magic: 0x4080ff };
const OVERHEAD_LETTER: Record<AttackType, string> = { melee: 'S', ranged: 'R', magic: 'M' };

const HOVER_COLOR = 0xffff00;
/** Safety cap so autoplay always hands over eventually. */
const AUTOPLAY_MAX_TICKS = 40_000;
/** Back up the run every ~12 seconds, in case the browser closes without warning. */
const RUN_SAVE_TICKS = 20;
/** Hold this long on a touch screen to open the right-click menu. */
export const LONG_PRESS_MS = 450;


interface ActorView {
  /** Container the camera can follow; holds the sprite layers. */
  body: Phaser.GameObjects.Container;
  /** Coloured frame showing a monster's current attack style. */
  outline?: Phaser.GameObjects.Rectangle;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
}

interface PaperDoll {
  body: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image;
  weapon: Phaser.GameObjects.Image;
}

/** Pixel position between ticks; a running step passes through `via` so it never cuts corners. */
function renderPos(actor: Actor, alpha: number): { x: number; y: number } {
  const lerp = (a: Point, b: Point, t: number) => ({
    x: Phaser.Math.Linear(a.x, b.x, t) * TILE + TILE / 2,
    y: Phaser.Math.Linear(a.y, b.y, t) * TILE + TILE / 2,
  });
  if (!actor.via) return lerp(actor.prev, actor.pos, alpha);
  return alpha < 0.5 ? lerp(actor.prev, actor.via, alpha * 2) : lerp(actor.via, actor.pos, alpha * 2 - 1);
}

/** Ground-label colour by pile value (gp), like RuneLite's loot tiers. */
function valueColor(value: number): string {
  if (value >= 5000) return '#ff66ff';
  if (value >= 1500) return '#ff9a30';
  if (value >= 300) return '#60ff60';
  if (value >= 50) return '#80d0ff';
  return '#ffffff';
}

/** OSRS level colours: red is far stronger than you, green far weaker. */
function levelColor(diff: number): string {
  if (diff >= 10) return '#ff3030';
  if (diff >= 1) return '#ff9030';
  if (diff === 0) return '#ffff00';
  if (diff > -10) return '#a0ff40';
  return '#40ff40';
}

/** Stable per-tile pick among texture variants so floors don't look tiled. */
const variant = (x: number, y: number, n: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % n;

interface Hitsplat {
  actor: Actor;
  view: Phaser.GameObjects.Container;
  until: number;
}

export class DungeonScene extends Phaser.Scene {
  state!: GameState;
  /** Forwards GameState events to the UI scene. */
  bus = new Phaser.Events.EventEmitter();
  /** OSRS-style top-left action text for whatever is under the cursor. */
  hoverText = '';
  /** Extra coloured detail (HP, hit chance) when hovering a monster. */
  hoverDetail: { text: string; color: string } | null = null;
  /** Between-run progress (tokens, unlocked tools). */
  meta: MetaSave = loadMeta();
  /** Tokens awarded for the run that just ended. */
  lastEarned = 0;

  private ticks = new TickScheduler();
  /** One image per drawable map tile, indexed y * width + x. */
  private tileImages: (Phaser.GameObjects.Image | null)[] = [];
  /** Node, ground-item and effect objects, rebuilt every tick. */
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private doll!: PaperDoll;
  private hover!: Phaser.GameObjects.Rectangle;
  private destMarker!: Phaser.GameObjects.Rectangle;
  private playerView!: ActorView;
  private overhead!: Phaser.GameObjects.Container;
  private overheadIcon!: Phaser.GameObjects.Arc;
  private overheadText!: Phaser.GameObjects.Text;
  private npcViews = new Map<Npc, ActorView>();
  private splats: Hitsplat[] = [];
  private hoverTile = { x: -1, y: -1 };
  private lastFrameAt?: number;
  private startPending = false;
  /** Materials the last run brought home (shown on the death screen). */
  lastMaterials: Materials | null = null;
  /** Autoplay in progress: target floor and the bot's memory. */
  autoplay: { target: number; memo: BotMemory; floorTicks: number; floor: number } | null = null;
  private touchHold?: number;
  /** The current touch already opened a menu, so its release does nothing. */
  private touchConsumed = false;
  private tracker = new ProgressTracker(this.meta);
  private pet?: Phaser.GameObjects.Image;
  /** The pet trails one step behind the player. */
  private petTile = { prev: { x: 0, y: 0 }, pos: { x: 0, y: 0 } };
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Dungeon');
  }

  preload(): void {
    preloadSprites(this);
  }

  create(): void {
    generateSprites(this);
    this.fx = this.add.graphics().setDepth(2);
    this.destMarker = this.add.rectangle(0, 0, TILE, TILE).setStrokeStyle(2, 0xff3333).setOrigin(0).setVisible(false).setDepth(3);
    this.hover = this.add.rectangle(0, 0, TILE, TILE).setStrokeStyle(1, HOVER_COLOR, 0.6).setOrigin(0).setDepth(3);
    const base = this.add.image(0, 0, 'pd_base');
    this.doll = { body: this.add.image(0, 0, 'pd_plate'), shield: this.add.image(0, 0, 'pd_kiteshield'), weapon: this.add.image(0, 0, 'pd_dagger') };
    this.playerView = this.makeActorView([base, this.doll.body, this.doll.shield, this.doll.weapon]);
    this.playerView.body.setDepth(5);
    this.overheadIcon = this.add.circle(0, 0, 7, 0xffffff).setStrokeStyle(1, 0x000000);
    this.overheadText = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);
    this.overhead = this.add.container(0, 0, [this.overheadIcon, this.overheadText]).setDepth(7).setVisible(false);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hoverTile = this.pointerTile(p);
      this.hover.setPosition(this.hoverTile.x * TILE, this.hoverTile.y * TILE);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onTouchRelease(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      if (!this.ui.isOverUi(p.x, p.y)) this.setZoom(settings.zoom + (dy > 0 ? -0.25 : 0.25));
    });
    this.input.keyboard?.on('keydown-G', () => this.goToStairs());
    this.cameras.main.setZoom(settings.zoom);
    this.ticks.onTick(() => this.onTick());

    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    // Pick up a run left by a refresh or closed tab, otherwise start at camp.
    const resumed = loadRun((e) => this.onGameEvent(e));
    if (resumed) {
      this.setState(resumed);
      resumed.message('Welcome back! Your run has been restored.');
    } else {
      this.toCamp();
    }
    const saveNow = () => this.saveRunNow();
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());
    this.scene.launch('UI');
  }

  /** Keep the game view left of the side panel so the player stays centered in what's visible. */
  private fitCamera(): void {
    this.cameras.main.setViewport(0, 0, Math.max(100, this.scale.width - PANEL_W), this.scale.height);
  }

  /** Return to the camp hub (game start, and after a death). */
  toCamp(): void {
    this.setState(new GameState(randomSeed(), (e) => this.onGameEvent(e), {
      camp: true, tools: this.meta.tools, slayerUnlocked: this.meta.slayerUnlocked,
      armourerUnlocked: (this.meta.perks[ARMOURER_PERK] ?? 0) > 0, enchanterUnlocked: this.meta.enchanterUnlocked,
      built: STRUCTURES.filter((s) => (this.meta.structures[s.id] ?? 0) > 0).map((s) => s.id),
    }));
  }

  /** Start a fresh dungeon run with every unlock and perk applied. */
  /**
   * Start a fresh run. `startDepth` skips ahead with catch-up (half rewards);
   * `autoplayTo` lets the bot play fast until that floor, then hands over.
   */
  startRun(opts: { startDepth?: number; autoplayTo?: number } = {}): void {
    this.setState(new GameState(randomSeed(), (e) => this.onGameEvent(e), {
      tools: this.meta.tools, perks: this.meta.perks, slayerTask: this.meta.slayerTask,
      armoury: this.meta.armoury, startStyle: this.meta.startStyle, startDepth: opts.startDepth, enchants: this.meta.enchants,
      campSetup: this.campSetup(),
    }));
    if (opts.autoplayTo && opts.autoplayTo > 1) {
      this.autoplay = { target: opts.autoplayTo, memo: newBotMemory(), floorTicks: 0, floor: 1 };
      this.bus.emit('autoplay', this.autoplay);
    }
    const task = this.meta.slayerTask;
    if (task) {
      this.state.message(`Slayer task: kill ${task.remaining} more ${SLAYER_BY_ID[task.category].name.toLowerCase()}.`);
    } else if (this.meta.slayerUnlocked) {
      this.state.message('Tip: the Slayer master at camp hands out tasks that pay bonus tokens.');
    }
  }

  /** Run toggle, remembered across runs and sessions. */
  get running(): boolean {
    return settings.run;
  }

  setRunning(on: boolean): void {
    settings.run = on;
    saveSettings();
    this.state.setRunning(on);
  }

  private setState(state: GameState): void {
    for (const v of this.npcViews.values()) this.destroyView(v);
    this.npcViews.clear();
    state.setRunning(settings.run);
    state.autoPickup = settings.autoPickup;
    this.state = state;
    this.onFloorChanged();
    this.bus.emit('newrun');
  }

  /** Spends tokens on a skill-tree rank; returns false if it can't be bought. */
  buyPerk(id: string): boolean {
    const cost = nextRankCost(this.meta.perks, id);
    if (cost === null || perkBlocker(this.meta.perks, this.meta.tokens, id)) return false;
    this.meta.tokens -= cost;
    this.meta.perks[id] = (this.meta.perks[id] ?? 0) + 1;
    saveMeta(this.meta);
    sfx.play('buy');
    if (id === ARMOURER_PERK) {
      this.state.addCampNpc('armourer');
      this.onFloorChanged(); // redraw the camp and its name labels
      this.state.message('The Armourer has set up shop at camp!');
      this.bus.emit('notice', { kind: 'unlock', name: 'The Armourer has set up shop at camp!' });
    }
    return true;
  }

  private onGameEvent(e: GameEvent): void {
    // Autoplay fast-forwards: skip effects, popups and achievement tracking, keep the essentials.
    if (this.autoplay) {
      if (e.type === 'floor' && this.state) this.onFloorChanged();
      if (e.type === 'death') {
        this.autoplay = null;
        this.bankRun();
        this.bus.emit('autoplay', null);
        this.bus.emit('death', e);
      }
      return;
    }
    this.playSoundFor(e);
    if (e.type === 'hit') this.addHitsplat(e.target, e.damage);
    if (e.type === 'projectile') this.fireProjectile(e.from, e.to, e.style, e.ticks);
    if (e.type === 'floor' && this.state) {
      this.onFloorChanged();
      // Saved after the tick that changed floor, once the new floor is fully set up.
      this.time.delayedCall(0, () => this.saveRunNow());
    }
    if (e.type === 'death') this.bankRun();
    // Swap to the run after the current tick finishes rather than mid-tick.
    if (e.type === 'enterDungeon') this.startPending = true;
    if (e.type === 'kill' && e.boss) this.meta.deepestBoss = Math.max(this.meta.deepestBoss, this.state.depth);
    if (e.type === 'kill' && e.npcId === ENCHANTER_UNLOCK_BOSS && !this.meta.enchanterUnlocked) this.unlockEnchanter();
    if (e.type === 'kill' && e.npcId === SLAYER_UNLOCK_BOSS && !this.meta.slayerUnlocked) this.unlockSlayer();
    if (e.type === 'slayerDone') {
      this.meta.tokens += e.tokens;
      this.meta.slayerTask = null;
      saveMeta(this.meta);
    }
    this.bus.emit(e.type, e);
    if (this.state) this.announce(this.tracker.handle(e, this.state));
  }

  /** Chat lines and toasts for achievements, new collection log slots and pets. */
  private announce(notices: Notice[]): void {
    if (!notices.length) return;
    for (const n of notices) {
      if (n.kind === 'collection') this.state.message(`New item added to your collection log: ${n.name}`);
      if (n.kind === 'achievement') {
        this.state.message(`Achievement completed: ${n.name} (+${n.reward} Dungeoneering tokens)`);
        sfx.play('levelup');
      }
      if (n.kind === 'pet') sfx.play('levelup');
      this.bus.emit('notice', n);
    }
    saveMeta(this.meta);
  }

  private playSoundFor(e: GameEvent): void {
    switch (e.type) {
      case 'sound': sfx.play(e.name); break;
      case 'hit':
        if (e.target === this.state?.player) sfx.play(e.damage > 0 ? 'hurt' : 'block');
        else sfx.play(e.damage > 0 ? 'hit' : 'miss');
        break;
      case 'projectile': sfx.play(e.style === 'magic' ? 'magic' : 'arrow'); break;
      case 'levelup': sfx.play('levelup'); break;
      case 'death': sfx.play(this.state?.forfeited ? 'stairs' : 'death'); break;
      case 'floor': if (e.depth > 1) sfx.play('stairs'); break;
      case 'enterDungeon': sfx.play('stairs'); break;
    }
  }

  /** Adds the finished run's tokens and stats to the persistent save. */
  /** Keep the run in progress safe across refreshes (nothing to save at camp or after it ends). */
  private saveRunNow(): void {
    const g = this.state;
    if (!g || g.isCamp || g.over || this.autoplay) return;
    saveRun(g);
  }

  private campSetup(): CampSetup {
    const setup = campSetupFor(this.meta);
    saveMeta(this.meta);
    return setup;
  }

  private settleCamp(g: GameState): void {
    const mats = settleRun(this.meta, g);
    if (mats.timber || mats.metal) this.lastMaterials = mats;
  }

  /** Builder: build or upgrade a camp structure. */
  build(id: StructureId): boolean {
    const m = this.meta;
    const next = nextStructureLevel(m.structures, id);
    if (!next || m.tokens < next.tokens || m.materials.timber < next.timber || m.materials.metal < next.metal) return false;
    m.tokens -= next.tokens;
    m.materials.timber -= next.timber;
    m.materials.metal -= next.metal;
    m.structures[id] = (m.structures[id] ?? 0) + 1;
    if (id === 'relic_altar' && !m.startRelic) m.startRelic = m.relicsFound[0] ?? null;
    saveMeta(m);
    sfx.play('smith');
    if (m.structures[id] === 1) {
      this.state.addCampNpc(id);
      this.onFloorChanged();
    }
    return true;
  }

  /** Relic altar: step to the next relic you've found (or none). */
  cycleStartRelic(): void {
    const m = this.meta;
    const options = [...m.relicsFound, null];
    m.startRelic = options[(options.indexOf(m.startRelic) + 1) % options.length];
    saveMeta(m);
  }

  private bankRun(): void {
    clearRun();
    const g = this.state;
    this.lastMaterials = null;
    this.settleCamp(g);
    this.lastEarned = g.tokensEarned;
    this.meta.tokens += this.lastEarned;
    this.meta.runs++;
    this.meta.bestDepth = Math.max(this.meta.bestDepth, g.depth);
    saveMeta(this.meta);
  }

  achievementProgress(a: AchievementDef): [number, number] | null {
    return this.tracker.progress(a);
  }

  private unlockEnchanter(): void {
    this.meta.enchanterUnlocked = true;
    saveMeta(this.meta);
    this.state.message('The Enchanter has heard of your victory and will await you at camp, ready to enchant your Armourer gear.');
    this.bus.emit('notice', { kind: 'unlock', name: 'Enchanter unlocked! She awaits you at camp.' });
    sfx.play('levelup');
  }

  /** Enchanter: put (or upgrade) an enchantment on an Armourer gear line. */
  enchant(line: ArmouryLine, id: string): boolean {
    const current = this.meta.enchants[line];
    const cost = enchantCost(current, id);
    if (cost === null || this.meta.tokens < cost || !this.meta.armoury[line]) return false;
    this.meta.tokens -= cost;
    this.meta.enchants[line] = { id, rank: current?.id === id ? current.rank + 1 : 1 };
    saveMeta(this.meta);
    sfx.play('buy');
    return true;
  }

  private unlockSlayer(): void {
    this.meta.slayerUnlocked = true;
    saveMeta(this.meta);
    this.state.message('Slayer unlocked! A Slayer master has arrived at camp with monster-hunting tasks for you.');
    this.bus.emit('notice', { kind: 'unlock', name: 'Slayer unlocked! A Slayer master has arrived at camp.' });
    sfx.play('levelup');
  }

  /** Slayer master: hand out a task if you don't have one. */
  getSlayerTask(): void {
    if (this.meta.slayerTask || !this.meta.slayerUnlocked) return;
    this.meta.slayerTask = assignTask(this.meta.bestDepth, Math.random);
    saveMeta(this.meta);
    sfx.play('buy');
  }

  /** Slayer master: swap your task for another, for tokens. */
  skipSlayerTask(): boolean {
    const task = this.meta.slayerTask;
    if (!task || this.meta.tokens < SKIP_TASK_COST) return false;
    this.meta.tokens -= SKIP_TASK_COST;
    this.meta.slayerTask = assignTask(this.meta.bestDepth, Math.random, task.category);
    saveMeta(this.meta);
    sfx.play('buy');
    return true;
  }

  /** Ways to start a run: floor 1, the floor after each beaten boss, and autoplay. */
  runStartOptions(): Array<{ label: string; detail: string; start: () => void }> {
    const opts = [{ label: 'Start at floor 1', detail: 'Full rewards.', start: () => this.startRun() }];
    for (let floor = 5; floor <= this.meta.deepestBoss; floor += 5) {
      const depth = floor + 1;
      const c = catchUpFor(depth, this.meta.startStyle);
      opts.push({
        label: `Skip to floor ${depth}`,
        detail: `Start with ${this.meta.startStyle} levels ~${c.levels.defence}, HP ${c.levels.hitpoints} and supplies. Skipped floors pay half tokens.`,
        start: () => this.startRun({ startDepth: depth }),
      });
    }
    if (settings.allowAutoplay && this.meta.bestDepth > 1) {
      opts.push({
        label: `Autoplay to floor ${this.meta.bestDepth}`,
        detail: 'The bot plays fast until your best floor, then hands over. It can die! Autoplayed floors pay half tokens.',
        start: () => this.startRun({ autoplayTo: this.meta.bestDepth }),
      });
    }
    return opts;
  }

  /** Run the bot for a burst of ticks; hand over at the target floor or when cancelled. */
  private stepAutoplay(): void {
    const a = this.autoplay!;
    const g = this.state;
    const deadline = performance.now() + 25;
    while (performance.now() < deadline && this.autoplay && !g.over) {
      if (g.depth !== a.floor) {
        a.floor = g.depth;
        a.floorTicks = 0;
      }
      if (g.depth >= a.target || g.tickCount > AUTOPLAY_MAX_TICKS) {
        this.finishAutoplay();
        return;
      }
      botStep(g, a.memo, a.floorTicks > 3000);
      g.tick();
      a.floorTicks++;
    }
    this.lastFrameAt = performance.now();
    this.bus.emit('autoplay', this.autoplay);
  }

  /** Stop fast-forwarding and give the player control (also used by the Cancel button). */
  finishAutoplay(): void {
    if (!this.autoplay) return;
    this.autoplay = null;
    const g = this.state;
    if (g.pendingRelics) g.chooseRelic(g.pendingRelics[0]);
    g.player.intent = null;
    g.player.path = [];
    g.endAutoplay();
    this.onFloorChanged();
    this.bus.emit('autoplay', null);
  }

  /** Armourer: buy the next starting-gear tier in a line. */
  buyArmoury(line: ArmouryLine): boolean {
    const tier = nextArmouryTier(this.meta.armoury, line);
    if (!tier || this.meta.tokens < tier.cost) return false;
    this.meta.tokens -= tier.cost;
    this.meta.armoury[line]++;
    saveMeta(this.meta);
    sfx.play('buy');
    return true;
  }

  setStartStyle(style: StartStyle): void {
    this.meta.startStyle = style;
    saveMeta(this.meta);
  }

  /** Pick which owned pet follows you (null = none). */
  setActivePet(id: string | null): void {
    this.meta.activePet = id;
    saveMeta(this.meta);
    this.pet?.destroy();
    this.pet = undefined;
  }

  /** Spends tokens on a tool unlock; returns false if unaffordable. */
  buyUnlock(key: UnlockKey): boolean {
    const offer = nextUnlocks(this.meta.tools).find((o) => o.key === key);
    if (!offer || offer.cost > this.meta.tokens) return false;
    this.meta.tokens -= offer.cost;
    applyUnlock(this.meta.tools, key);
    saveMeta(this.meta);
    sfx.play('buy');
    return true;
  }

  private onFloorChanged(): void {
    for (const v of this.npcViews.values()) this.destroyView(v);
    this.npcViews.clear();
    this.destMarker.setVisible(false);
    const map = this.state.map;
    const cam = this.cameras.main;
    cam.setBounds(-200, -200, map.width * TILE + 400, map.height * TILE + 400);
    cam.startFollow(this.playerView.body, true, 0.15, 0.15);
    this.buildTiles();
    // The pet starts beside you rather than hidden under you.
    const { x, y } = this.state.player.pos;
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .find((t) => isWalkable(this.state.map, t.x, t.y)) ?? { x, y };
    this.petTile = { prev: { ...beside }, pos: { ...beside } };
    this.drawMap();

    // Name labels over camp NPCs and the ladder.
    for (const l of this.labels) l.destroy();
    this.labels = [];
    if (this.state.isCamp) {
      const label = (x: number, y: number, text: string) => this.labels.push(this.add.text(x * TILE + TILE / 2, y * TILE - 4, text, {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffff00', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(6));
      for (const n of this.state.nodes) {
        if ((['mentor', 'toolsmith', 'slayer_master', 'armourer', 'enchanter', 'builder'].includes(n.kind) || n.kind in STRUCTURE_BY_ID)) label(n.pos.x, n.pos.y - 0.4, n.name);
      }
      label(map.stairs.x, map.stairs.y, 'Dungeon');
    }
  }

  private get ui(): UIScene {
    return this.scene.get('UI') as UIScene;
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const ui = this.ui;
    if (!ui.isOverUi || ui.isOverUi(p.x, p.y)) return;
    if (p.wasTouch) {
      // Touch: a quick tap acts on release; holding opens the menu, like a right-click.
      this.hoverTile = this.pointerTile(p);
      window.clearTimeout(this.touchHold);
      // Wall-clock timer: Phaser's scene clock runs slow at low frame rates (common on phones).
      this.touchHold = window.setTimeout(() => {
        this.touchHold = undefined;
        this.touchConsumed = true;
        ui.openMenu(p.x, p.y, this.optionsAt(this.pointerTile(p)));
      }, LONG_PRESS_MS);
      this.touchConsumed = false;
      return;
    }
    const options = this.optionsAt(this.pointerTile(p));
    if (p.rightButtonDown()) ui.openMenu(p.x, p.y, options);
    else options[0]?.action();
  }

  private onTouchRelease(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch || this.touchConsumed) return;
    if (this.touchHold !== undefined) {
      window.clearTimeout(this.touchHold);
      this.touchHold = undefined;
      this.optionsAt(this.pointerTile(p))[0]?.action();
    }
  }

  /** Camera zoom, clamped to sensible steps and remembered. */
  setZoom(z: number): void {
    settings.zoom = Phaser.Math.Clamp(Math.round(z * 4) / 4, 0.5, 2);
    saveSettings();
    this.cameras.main.setZoom(settings.zoom);
  }

  /** Walk to the stairs (or ladder) once you've found them. */
  goToStairs(): void {
    const { stairs } = this.state.map;
    if (this.state.over) return;
    if (!this.state.isExplored(stairs.x, stairs.y)) {
      this.state.message("You haven't found the way down yet.");
      return;
    }
    this.walkTo(stairs);
  }

  /** Walks to a tile and shows the red destination marker, as in OSRS. */
  walkTo(t: Point): void {
    this.state.walkTo(t);
    if (this.state.player.path.length) this.destMarker.setPosition(t.x * TILE, t.y * TILE).setVisible(true);
  }

  private nodeOptions(node: ResourceNode): MenuOption[] {
    const g = this.state;
    const inv = g.player.inventory;
    if (node.kind === 'resource') {
      return node.depleted ? [] : [{ label: `${node.def!.verb} ${node.name}`, action: () => g.gather(node) }];
    }
    const name = (id: string) => item(id).name;
    const has = (id: string) => inv.count(id) > 0;
    if (node.kind === 'fire') {
      const cookable = recipesFor('fire').filter((r) => has(r.inputs[0].item));
      if (!cookable.length) return [{ label: 'Cook Fire', action: () => g.message('You have nothing to cook.') }];
      return cookable.map((r) => ({ label: `Cook ${name(r.inputs[0].item)}`, action: () => g.process(node, r) }));
    }
    if (node.kind === 'furnace') {
      const smeltable = recipesFor('furnace').filter((r) => has(r.inputs[0].item));
      if (!smeltable.length) return [{ label: 'Smelt Furnace', action: () => g.message('You have no ore to smelt.') }];
      return smeltable.map((r) => ({ label: `Smelt ${name(r.output)}`, action: () => g.process(node, r) }));
    }
    if (node.kind === 'altar') return [{ label: 'Pray-at Altar', action: () => g.prayAt(node) }];
    if (node.kind === 'mentor') return [{ label: 'Talk-to Mentor', action: () => g.talkTo(node) }];
    if (node.kind === 'toolsmith') return [{ label: 'Trade Toolsmith', action: () => g.talkTo(node) }];
    if (node.kind === 'slayer_master') return [{ label: 'Get-task Slayer master', action: () => g.talkTo(node) }];
    if (node.kind === 'armourer') return [{ label: 'Trade Armourer', action: () => g.talkTo(node) }];
    if (node.kind === 'enchanter') return [{ label: 'Enchant Enchanter', action: () => g.talkTo(node) }];
    if (node.kind === 'builder') return [{ label: 'Build Builder', action: () => g.talkTo(node) }];
    if (node.kind in STRUCTURE_BY_ID) return [{ label: `Use ${node.name}`, action: () => g.talkTo(node) }];
    if (node.kind === 'shrine') return node.used ? [] : [{ label: 'Touch Relic shrine', action: () => g.talkTo(node) }];
    if (node.kind === 'merchant') return [{ label: 'Trade Wandering merchant', action: () => g.talkTo(node) }];
    if (node.kind === 'chest') {
      if (node.used) return [];
      return [{ label: node.lockLevel ? 'Picklock Locked chest' : 'Open Chest', action: () => g.talkTo(node) }];
    }
    if (node.kind === 'shortcut') {
      const sc = node.shortcut!;
      return [{ label: `${SHORTCUT_KINDS[sc.kind].verb} ${node.name} (Agility ${sc.level})`, action: () => g.useShortcut(node) }];
    }
    // Anvil: "Smith" opens a second menu listing what your bars can make.
    return [{
      label: 'Smith Anvil',
      action: () => {
        const choices = recipesFor('anvil')
          .filter((r) => has(r.inputs[0].item))
          .map((r) => ({
            label: `Smith ${name(r.output)} (${r.inputs[0].qty} bars, lvl ${r.level})`,
            action: () => g.process(node, r, false),
          }));
        if (!choices.length) {
          g.message("You don't have any bars to smith.");
          return;
        }
        const p = this.input.activePointer;
        this.ui.openMenu(p.x, p.y, choices);
      },
    }];
  }

  /** OSRS-style menu entries for a map tile; the first entry is the left-click action. */
  optionsAt(t: Point): MenuOption[] {
    const g = this.state;
    const opts: MenuOption[] = [];
    if (!g.isExplored(t.x, t.y)) return opts;
    const examines: MenuOption[] = [];

    const npc = g.npcAt(t.x, t.y);
    if (npc && g.isVisible(t.x, t.y)) {
      const name = `${npc.name} (level-${npc.level})`;
      opts.push({ label: `Attack ${name}`, action: () => { g.attack(npc); this.destMarker.setVisible(false); } });
      if (PICKPOCKET[npc.def.id]) opts.push({ label: `Pickpocket ${npc.name}`, action: () => g.pickpocket(npc) });
      const weak = npc.def.weakness ? ` It looks weak to ${npc.def.weakness === 'melee' ? 'melee' : npc.def.weakness}.` : '';
      examines.push({
        label: `Examine ${npc.name}`,
        action: () => {
          g.message(npc.def.examine + weak);
          this.ui.openDrops({ kind: 'npc', npc });
        },
      });
    }
    const pile = g.itemsAt(t.x, t.y);
    if (pile.length > 1) {
      opts.push({
        label: `Take all (${pile.length} items)`,
        action: () => {
          g.take(pile[pile.length - 1], true);
          if (g.player.path.length) this.destMarker.setPosition(t.x * TILE, t.y * TILE).setVisible(true);
        },
      });
    }
    for (const gi of [...pile].reverse()) {
      const def = item(gi.id);
      const name = def.name + (gi.qty > 1 ? ` (${gi.qty})` : '');
      opts.push({
        label: `Take ${name}`,
        action: () => {
          g.take(gi);
          if (g.player.path.length) this.destMarker.setPosition(t.x * TILE, t.y * TILE).setVisible(true);
        },
      });
      examines.push({ label: `Examine ${def.name}`, action: () => g.message(def.examine) });
    }
    const node = g.nodeAt(t.x, t.y);
    if (node) {
      opts.push(...this.nodeOptions(node));
      examines.push({
        label: `Examine ${node.name}`,
        action: () => {
          g.message(node.examine);
          if (node.kind === 'chest' && !node.used) this.ui.openDrops({ kind: 'chest', depth: g.depth });
        },
      });
    }
    const tile = tileAt(g.map, t.x, t.y);
    if (tile === Tile.StairsDown) {
      const what = g.isCamp ? 'Ladder' : 'Stairs';
      opts.push({ label: `Climb-down ${what}`, action: () => this.walkTo(t) });
      examines.push({
        label: `Examine ${what}`,
        action: () => g.message(g.isCamp ? 'A ladder down into the dungeon. Each run starts here.' : 'Stairs leading deeper into the dungeon.'),
      });
    }
    if (tile !== Tile.Wall) opts.push({ label: 'Walk here', action: () => this.walkTo(t) });
    return [...opts, ...examines];
  }

  private onTick(): void {
    this.state.tick();
    if (this.state.tickCount % RUN_SAVE_TICKS === 0) this.saveRunNow();
    if (this.startPending) {
      this.startPending = false;
      // With skip-ahead or autoplay available, let the player choose how to start.
      if (this.runStartOptions().length > 1) this.ui.openModal('startRun');
      else this.startRun();
    }
    if (!this.state.player.path.length) this.destMarker.setVisible(false);
    this.drawMap();
    this.bus.emit('tick');
    // Counters change constantly; persist them at most once per tick.
    if (this.tracker.takeDirty()) saveMeta(this.meta);
    this.stepPet();
  }

  /** Creates sprites for every floor tile and every wall that borders one. */
  private buildTiles(): void {
    for (const img of this.tileImages) img?.destroy();
    const g = this.state;
    const map = g.map;
    this.tileImages = new Array(map.width * map.height).fill(null);
    const open = (x: number, y: number) => tileAt(map, x, y) !== Tile.Wall;
    const theme = themeForDepth(map.depth);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y);
        let key: string;
        if (t === Tile.Wall) {
          const bordersFloor = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => open(x + dx, y + dy)));
          if (!bordersFloor) continue;
          key = theme.wallKeys[variant(x, y, theme.wallKeys.length)];
        } else if (t === Tile.StairsDown) {
          key = g.isCamp ? 'ladder' : 'stairs';
        } else {
          key = g.isCamp ? `grass_${variant(x, y, 3)}` : theme.floorKeys[variant(x, y, theme.floorKeys.length)];
        }
        const img = this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(0).setVisible(false);
        if (theme.floorTint && theme.floorKeys.includes(key)) img.setTint(theme.floorTint);
        if (theme.wallTint && theme.wallKeys.includes(key)) img.setTint(theme.wallTint);
        this.tileImages[y * map.width + x] = img;
      }
    }
  }

  /** Reveals explored tiles and redraws nodes, ground items and effects. */
  private drawMap(): void {
    const game = this.state;
    const map = game.map;
    this.tileImages.forEach((img, i) => img?.setVisible(game.explored[i] === 1));

    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const fx = this.fx.clear();
    for (const n of game.nodes) if (game.isExplored(n.pos.x, n.pos.y)) this.drawNode(fx, n);

    const drawn = new Set<number>();
    for (let i = game.groundItems.length - 1; i >= 0; i--) {
      const gi = game.groundItems[i];
      const k = gi.pos.y * map.width + gi.pos.x;
      if (drawn.has(k) || !game.isExplored(gi.pos.x, gi.pos.y)) continue;
      drawn.add(k);
      const ref = ensureItemTexture(this, gi.id);
      const img = this.add.image(gi.pos.x * TILE + TILE / 2, gi.pos.y * TILE + TILE / 2, ref.key).setDepth(2).setScale(0.8);
      if (ref.tint) img.setTint(ref.tint);
      this.dynamic.push(img);
      if (settings.groundLabels) this.labelPile(gi.pos);
    }
  }

  /** RuneLite-style label over a pile: top item, how many more, coloured by total value. */
  private labelPile(pos: Point): void {
    const pile = this.state.itemsAt(pos.x, pos.y);
    const top = pile[pile.length - 1];
    const value = pile.reduce((v, gi) => v + priceOf(gi.id) * gi.qty, 0);
    const name = `${item(top.id).name}${top.qty > 1 ? ` (${top.qty})` : ''}${pile.length > 1 ? ` +${pile.length - 1}` : ''}`;
    const label = this.add.text(pos.x * TILE + TILE / 2, pos.y * TILE - 2, name, {
      fontFamily: 'monospace', fontSize: '10px', color: valueColor(value), stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(7);
    this.dynamic.push(label);
  }

  private drawNode(fx: Phaser.GameObjects.Graphics, n: ResourceNode): void {
    const cx = n.pos.x * TILE + TILE / 2;
    const cy = n.pos.y * TILE + TILE / 2;
    const sprite = (key: string, tint?: number) => {
      const img = this.add.image(cx, cy, key).setDepth(1);
      if (tint !== undefined) img.setTint(tint);
      this.dynamic.push(img);
      return img;
    };
    switch (n.kind) {
      case 'resource': {
        const def = n.def!;
        if (def.kind === 'rock') {
          sprite('boulder', n.depleted ? 0x707070 : undefined);
          if (!n.depleted) {
            fx.fillStyle(def.color).fillRect(cx - 7, cy - 4, 4, 4).fillRect(cx + 3, cy + 1, 4, 4).fillRect(cx - 2, cy + 5, 3, 3);
            fx.fillStyle(0xffffff, 0.5).fillRect(cx - 7, cy - 4, 2, 2).fillRect(cx + 3, cy + 1, 2, 2);
          }
        } else if (def.kind === 'herb') {
          sprite('herb_patch', n.depleted ? 0x6a5a40 : undefined);
        } else if (def.kind === 'tree') {
          if (n.depleted) sprite('gen_stump');
          else sprite('tree', Phaser.Display.Color.IntegerToColor(def.color).lighten(35).color);
        } else {
          sprite('water', n.depleted ? 0x556677 : undefined);
          if (!n.depleted) fx.lineStyle(1, 0xd0f0ff, 0.9).strokeCircle(cx, cy, 5).strokeCircle(cx, cy, 11);
        }
        break;
      }
      case 'furnace':
      case 'anvil':
        sprite(`gen_${n.kind}`);
        break;
      case 'chest':
        sprite(n.used ? 'chest_open' : n.lockLevel ? 'chest_locked' : 'chest');
        break;
      case 'herb_garden':
        sprite('herb_patch');
        break;
      case 'workbench':
        sprite('gen_anvil', 0xc8a070);
        break;
      case 'relic_altar':
        sprite('shrine');
        fx.lineStyle(2, 0xc080ff, 0.7).strokeCircle(cx, cy, 14);
        break;
      case 'shortcut': {
        // A jagged gap through the wall with rubble at its foot, along the crossing direction.
        const sc = n.shortcut!;
        const across = sc.a.x !== sc.b.x; // crossing left-right: the crack runs top to bottom
        const h = TILE / 2 - 2;
        const zig = [-h, -h / 2, 0, h / 2, h].map((t, i) => (i % 2 ? 4 : -3));
        const pts = [-h, -h / 2, 0, h / 2, h].map((t, i) => (across ? { x: cx + zig[i], y: cy + t } : { x: cx + t, y: cy + zig[i] }));
        fx.lineStyle(7, 0x0c0a08, 1).strokePoints(pts);
        fx.lineStyle(2, 0x6a5a48, 1).strokePoints(pts.map((p) => ({ x: p.x + 2, y: p.y + 2 })));
        fx.fillStyle(0x8a7a64, 1);
        for (const [dx, dy] of [[-8, 9], [6, 11], [10, 6], [-11, -7], [9, -10]]) {
          fx.fillCircle(cx + (across ? dx : dy), cy + (across ? dy : dx), 2.5);
        }
        fx.lineStyle(1, 0xffd040, 0.45).strokeRect(n.pos.x * TILE + 1, n.pos.y * TILE + 1, TILE - 2, TILE - 2);
        break;
      }
      case 'shrine':
        sprite('shrine', n.used ? 0x606060 : undefined);
        if (!n.used) fx.lineStyle(2, 0xffd040, 0.7).strokeCircle(cx, cy, 14);
        break;
      default:
        sprite(n.kind);
    }
  }

  private makeActorView(layers: Phaser.GameObjects.GameObject[], outline = false): ActorView {
    const frame = outline ? this.add.rectangle(0, 0, TILE - 2, TILE - 2).setStrokeStyle(2, 0xffffff) : undefined;
    const body = this.add.container(0, 0, frame ? [frame, ...layers] : layers).setDepth(4);
    const hpBg = this.add.rectangle(0, 0, TILE - 4, 4, 0xcc0000).setOrigin(0, 0.5).setDepth(6);
    const hpFg = this.add.rectangle(0, 0, TILE - 4, 4, 0x00cc00).setOrigin(0, 0.5).setDepth(6);
    return { body, outline: frame, hpBg, hpFg };
  }

  private destroyView(v: ActorView): void {
    v.body.destroy();
    v.hpBg.destroy();
    v.hpFg.destroy();
  }

  /** Shows the player's equipped weapon, platebody and shield on their sprite. */
  private stepPet(): void {
    const p = this.state.player;
    this.petTile.prev = { ...this.petTile.pos };
    // Follow to where the player stood at the start of this tick.
    if (p.prev.x !== p.pos.x || p.prev.y !== p.pos.y) this.petTile.pos = { ...(p.via ?? p.prev) };
  }

  private drawPet(alpha: number): void {
    const petId = this.meta.activePet;
    if (!petId || this.state.over) {
      this.pet?.setVisible(false);
      return;
    }
    if (!this.pet) {
      const bossId = PET_BY_ID[petId]?.bossId;
      if (!bossId) return;
      this.pet = this.add.image(0, 0, npcSprite(bossId)).setScale(0.6).setDepth(4);
    }
    const { prev, pos } = this.petTile;
    this.pet.setVisible(true).setPosition(
      Phaser.Math.Linear(prev.x, pos.x, alpha) * TILE + TILE / 2,
      Phaser.Math.Linear(prev.y, pos.y, alpha) * TILE + TILE / 2 + 6,
    );
  }

  private updatePaperDoll(): void {
    const eq = this.state.player.equipment;
    const apply = (img: Phaser.GameObjects.Image, ref: { key: string; tint?: number } | null) => {
      img.setVisible(!!ref);
      if (!ref) return;
      if (img.texture.key !== ref.key) img.setTexture(ref.key);
      if (ref.tint !== undefined) img.setTint(ref.tint);
      else img.clearTint();
    };
    apply(this.doll.body, bodyLayer(eq.body));
    apply(this.doll.shield, shieldLayer(eq.shield));
    apply(this.doll.weapon, weaponLayer(eq.weapon));
  }

  private placeView(v: ActorView, actor: Actor, alpha: number, visible: boolean): { x: number; y: number } {
    const { x, y } = renderPos(actor, alpha);
    v.body.setPosition(x, y).setVisible(visible);
    // HP bar shows for a few ticks after being hit, as in OSRS.
    const showHp = visible && this.state.tickCount - actor.lastHitTick < 8 && !actor.dead;
    v.hpBg.setPosition(x - (TILE - 4) / 2, y - TILE / 2 - 2).setVisible(showHp);
    v.hpFg.setPosition(x - (TILE - 4) / 2, y - TILE / 2 - 2).setVisible(showHp);
    v.hpFg.width = (TILE - 4) * Phaser.Math.Clamp(actor.hp / actor.maxHp, 0, 1);
    return { x, y };
  }

  private fireProjectile(from: Point, to: Point, style: AttackType, ticks: number): void {
    const start = { x: from.x * TILE + TILE / 2, y: from.y * TILE + TILE / 2 };
    const end = { x: to.x * TILE + TILE / 2, y: to.y * TILE + TILE / 2 };
    const shot = style === 'magic'
      ? this.add.circle(start.x, start.y, 5, STYLE_COLORS.magic).setStrokeStyle(1, 0xffffff)
      : this.add.rectangle(start.x, start.y, 10, 3, 0xc8a060)
        .setRotation(Math.atan2(end.y - start.y, end.x - start.x)).setStrokeStyle(1, STYLE_COLORS.ranged);
    shot.setDepth(9);
    this.tweens.add({ targets: shot, x: end.x, y: end.y, duration: ticks * 600 - 60, onComplete: () => shot.destroy() });
  }

  private addHitsplat(actor: Actor, damage: number): void {
    const circle = this.add.circle(0, 0, 9, damage > 0 ? 0xb01010 : 0x2050c0).setStrokeStyle(1, 0x000000);
    const text = this.add.text(0, 0, String(damage), {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    const view = this.add.container(0, 0, [circle, text]).setDepth(8);
    this.splats.push({ actor, view, until: this.time.now + 1000 });
  }

  /** HP and hit chance for a hovered monster, coloured by level like OSRS. */
  private describeHoveredNpc(): { text: string; color: string } | null {
    const g = this.state;
    const { x, y } = this.hoverTile;
    if (!g || x < 0) return null;
    const npc = g.npcAt(x, y);
    if (!npc || !g.isVisible(x, y)) return null;
    const chance = Math.round(100 * g.hitChanceAgainst(npc));
    const weak = npc.def.weakness === g.player.weaponType ? ', weak to your style' : '';
    return { text: `HP ${npc.hp}/${npc.maxHp}  ${chance}% to hit${weak}`, color: levelColor(npc.level - g.player.combatLevel) };
  }

  private describeHover(): string {
    if (this.hoverTile.x < 0 || !this.state) return '';
    return describeOptions(this.optionsAt(this.hoverTile));
  }

  private pointerTile(p: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
  }

  update(): void {
    // Game ticks follow the wall clock. Phaser's smoothed frame delta runs slow
    // when the frame rate drops, which would stretch the 600ms tick.
    const wall = performance.now();
    // The game waits while a relic choice is on screen.
    if (this.autoplay) {
      this.stepAutoplay();
      return;
    }
    const paused = !!this.state.pendingRelics || this.ui.pausesGame;
    if (this.lastFrameAt !== undefined && !paused) this.ticks.update(wall - this.lastFrameAt);
    this.lastFrameAt = wall;
    const g = this.state;
    const a = this.ticks.alpha;

    this.updatePaperDoll();
    const pv = this.placeView(this.playerView, g.player, a, !g.player.dead);
    this.drawPet(a);
    const protect = (['melee', 'ranged', 'magic'] as AttackType[]).find((s) => g.player.isProtectedFrom(s));
    this.overhead.setVisible(!!protect && !g.player.dead).setPosition(pv.x, pv.y - TILE + 2);
    if (protect) {
      this.overheadIcon.setFillStyle(STYLE_COLORS[protect]);
      this.overheadText.setText(OVERHEAD_LETTER[protect]);
    }

    for (const [npc, v] of this.npcViews) {
      if (!g.npcs.includes(npc)) {
        this.destroyView(v);
        this.npcViews.delete(npc);
      }
    }
    for (const npc of g.npcs) {
      let v = this.npcViews.get(npc);
      if (!v) {
        const styled = npc.isBoss || npc.attackStyle !== 'melee';
        const img = this.add.image(0, 0, npcSprite(npc.def.id));
        if (npc.def.id === 'mimic') img.setTint(0xff8080); // a chest with teeth
        // Elites stand in a gold aura.
        const aura = npc.elite ? [this.add.ellipse(0, 10, TILE + 4, 14, 0xffc040, 0.55).setStrokeStyle(2, 0xffe080)] : [];
        v = this.makeActorView([...aura, img], styled);
        if (npc.isBoss) v.body.setScale(1.3);
        this.npcViews.set(npc, v);
      }
      // Bosses and ranged/magic monsters show their current attack style as a coloured frame.
      v.outline?.setStrokeStyle(npc.isBoss ? 3 : 2, STYLE_COLORS[npc.attackStyle], 0.9);
      this.placeView(v, npc, a, g.isVisible(npc.pos.x, npc.pos.y));
    }

    const now = this.time.now;
    this.splats = this.splats.filter((s) => {
      if (now > s.until) {
        s.view.destroy();
        return false;
      }
      const { x, y } = renderPos(s.actor, a);
      s.view.setPosition(x, y);
      return true;
    });

    this.hoverText = this.describeHover();
    this.hoverDetail = this.describeHoveredNpc();
  }
}
