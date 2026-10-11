import Phaser from 'phaser';
import { TickScheduler } from '../core/tick';
import { randomSeed } from '../core/rng';
import { item } from '../data/items';
import { GameEvent, GameState } from '../game/GameState';
import { Actor } from '../entities/Actor';
import { Npc } from '../entities/Npc';
import { Point, Tile, tileAt } from '../world/tiles';
import { recipesFor } from '../data/recipes';
import { UnlockKey, applyUnlock, nextUnlocks } from '../data/tools';
import { ResourceNode } from '../entities/ResourceNode';
import { MetaSave, loadMeta, saveMeta } from '../save/meta';
import { nextRankCost, perkBlocker } from '../data/skillTree';
import { AttackType } from '../data/prayers';
import { describeOptions, type MenuOption } from '../ui/ContextMenu';
import { sfx } from '../audio/sfx';
import { bodyLayer, ensureItemTexture, generateSprites, npcSprite, preloadSprites, shieldLayer, weaponLayer } from '../render/sprites';
import type { UIScene } from './UIScene';

export const TILE = 32;
export const PANEL_W = 236;

/** Colour coding for attack styles: projectiles, boss outlines, overhead prayers. */
export const STYLE_COLORS: Record<AttackType, number> = { melee: 0xd03030, ranged: 0x40b040, magic: 0x4080ff };
const OVERHEAD_LETTER: Record<AttackType, string> = { melee: 'S', ranged: 'R', magic: 'M' };

const HOVER_COLOR = 0xffff00;
const RUN_KEY = 'tickbound.run';

function loadRunPref(): boolean {
  try {
    return localStorage.getItem(RUN_KEY) !== '0';
  } catch {
    return true;
  }
}

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
  private runPref = loadRunPref();
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
    this.ticks.onTick(() => this.onTick());

    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.toCamp();
    this.scene.launch('UI');
  }

  /** Keep the game view left of the side panel so the player stays centered in what's visible. */
  private fitCamera(): void {
    this.cameras.main.setViewport(0, 0, Math.max(100, this.scale.width - PANEL_W), this.scale.height);
  }

  /** Return to the camp hub (game start, and after a death). */
  toCamp(): void {
    this.setState(new GameState(randomSeed(), (e) => this.onGameEvent(e), { camp: true, tools: this.meta.tools }));
  }

  /** Start a fresh dungeon run with every unlock and perk applied. */
  startRun(): void {
    this.setState(new GameState(randomSeed(), (e) => this.onGameEvent(e), { tools: this.meta.tools, perks: this.meta.perks }));
  }

  /** Run toggle, remembered across runs and sessions. */
  get running(): boolean {
    return this.runPref;
  }

  setRunning(on: boolean): void {
    this.runPref = on;
    this.state.setRunning(on);
    try {
      localStorage.setItem(RUN_KEY, on ? '1' : '0');
    } catch {
      // Not persisted; fine.
    }
  }

  private setState(state: GameState): void {
    for (const v of this.npcViews.values()) this.destroyView(v);
    this.npcViews.clear();
    state.setRunning(this.runPref);
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
    return true;
  }

  private onGameEvent(e: GameEvent): void {
    this.playSoundFor(e);
    if (e.type === 'hit') this.addHitsplat(e.target, e.damage);
    if (e.type === 'projectile') this.fireProjectile(e.from, e.to, e.style, e.ticks);
    if (e.type === 'floor' && this.state) this.onFloorChanged();
    if (e.type === 'death') this.bankRun();
    // Swap to the run after the current tick finishes rather than mid-tick.
    if (e.type === 'enterDungeon') this.startPending = true;
    this.bus.emit(e.type, e);
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
      case 'death': sfx.play('death'); break;
      case 'floor': if (e.depth > 1) sfx.play('stairs'); break;
      case 'enterDungeon': sfx.play('stairs'); break;
    }
  }

  /** Adds the finished run's tokens and stats to the persistent save. */
  private bankRun(): void {
    const g = this.state;
    this.lastEarned = g.tokensEarned;
    this.meta.tokens += this.lastEarned;
    this.meta.runs++;
    this.meta.bestDepth = Math.max(this.meta.bestDepth, g.depth);
    saveMeta(this.meta);
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
    this.drawMap();

    // Name labels over camp NPCs and the ladder.
    for (const l of this.labels) l.destroy();
    this.labels = [];
    if (this.state.isCamp) {
      const label = (x: number, y: number, text: string) => this.labels.push(this.add.text(x * TILE + TILE / 2, y * TILE - 4, text, {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffff00', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(6));
      for (const n of this.state.nodes) if (n.kind === 'mentor' || n.kind === 'toolsmith') label(n.pos.x, n.pos.y - 0.4, n.name);
      label(map.stairs.x, map.stairs.y, 'Dungeon');
    }
  }

  private get ui(): UIScene {
    return this.scene.get('UI') as UIScene;
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const ui = this.ui;
    if (!ui.isOverUi || ui.isOverUi(p.x, p.y)) return;
    const options = this.optionsAt(this.pointerTile(p));
    if (p.rightButtonDown()) ui.openMenu(p.x, p.y, options);
    else options[0]?.action();
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
      examines.push({ label: `Examine ${npc.name}`, action: () => g.message(npc.def.examine) });
    }
    for (const gi of [...g.itemsAt(t.x, t.y)].reverse()) {
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
      examines.push({ label: `Examine ${node.name}`, action: () => g.message(node.examine) });
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
    if (this.startPending) {
      this.startPending = false;
      this.startRun();
    }
    if (!this.state.player.path.length) this.destMarker.setVisible(false);
    this.drawMap();
    this.bus.emit('tick');
  }

  /** Creates sprites for every floor tile and every wall that borders one. */
  private buildTiles(): void {
    for (const img of this.tileImages) img?.destroy();
    const g = this.state;
    const map = g.map;
    this.tileImages = new Array(map.width * map.height).fill(null);
    const open = (x: number, y: number) => tileAt(map, x, y) !== Tile.Wall;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y);
        let key: string;
        if (t === Tile.Wall) {
          const bordersFloor = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => open(x + dx, y + dy)));
          if (!bordersFloor) continue;
          key = `wall_${variant(x, y, 4)}`;
        } else if (t === Tile.StairsDown) {
          key = g.isCamp ? 'ladder' : 'stairs';
        } else {
          key = g.isCamp ? `grass_${variant(x, y, 3)}` : `floor_${variant(x, y, 4)}`;
        }
        const img = this.add.image(x * TILE, y * TILE, key).setOrigin(0).setDepth(0).setVisible(false);
        // Limestone is bright; mute it to a dungeon-y tone that still reads clearly against walls.
        if (key.startsWith('floor_')) img.setTint(0xb0a088);
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
    }
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
    if (this.lastFrameAt !== undefined) this.ticks.update(wall - this.lastFrameAt);
    this.lastFrameAt = wall;
    const g = this.state;
    const a = this.ticks.alpha;

    this.updatePaperDoll();
    const pv = this.placeView(this.playerView, g.player, a, !g.player.dead);
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
        v = this.makeActorView([this.add.image(0, 0, npcSprite(npc.def.id))], styled);
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
  }
}
