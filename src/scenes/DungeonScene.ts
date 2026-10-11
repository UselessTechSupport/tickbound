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
import { AttackType } from '../data/prayers';
import { describeOptions, type MenuOption } from '../ui/ContextMenu';
import type { UIScene } from './UIScene';

export const TILE = 24;
export const PANEL_W = 236;

/** Colour coding for attack styles: projectiles, boss outlines, overhead prayers. */
export const STYLE_COLORS: Record<AttackType, number> = { melee: 0xd03030, ranged: 0x40b040, magic: 0x4080ff };
const OVERHEAD_LETTER: Record<AttackType, string> = { melee: 'S', ranged: 'R', magic: 'M' };

const COLORS = {
  wall: 0x2a2622,
  floor: 0x6b5d4a,
  stairs: 0xc9a227,
  player: 0x3fa7ff,
  hover: 0xffff00,
};

interface ActorView {
  body: Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
}

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
  private mapGfx!: Phaser.GameObjects.Graphics;
  private itemGfx!: Phaser.GameObjects.Graphics;
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

  constructor() {
    super('Dungeon');
  }

  create(): void {
    this.mapGfx = this.add.graphics();
    this.itemGfx = this.add.graphics();
    this.destMarker = this.add.rectangle(0, 0, TILE, TILE).setStrokeStyle(2, 0xff3333).setOrigin(0).setVisible(false);
    this.hover = this.add.rectangle(0, 0, TILE, TILE).setStrokeStyle(1, COLORS.hover, 0.6).setOrigin(0);
    this.playerView = this.makeActorView(COLORS.player);
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
    this.newRun();
    this.scene.launch('UI');
  }

  /** Keep the game view left of the side panel so the player stays centered in what's visible. */
  private fitCamera(): void {
    this.cameras.main.setViewport(0, 0, Math.max(100, this.scale.width - PANEL_W), this.scale.height);
  }

  newRun(): void {
    for (const v of this.npcViews.values()) this.destroyView(v);
    this.npcViews.clear();
    this.state = new GameState(randomSeed(), (e) => this.onGameEvent(e), this.meta.tools);
    this.onFloorChanged();
    this.bus.emit('newrun');
  }

  private onGameEvent(e: GameEvent): void {
    if (e.type === 'hit') this.addHitsplat(e.target, e.damage);
    if (e.type === 'projectile') this.fireProjectile(e.from, e.to, e.style, e.ticks);
    if (e.type === 'floor' && this.state) this.onFloorChanged();
    if (e.type === 'death') this.bankRun();
    this.bus.emit(e.type, e);
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
    this.drawMap();
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
      opts.push({ label: 'Climb-down Stairs', action: () => this.walkTo(t) });
      examines.push({ label: 'Examine Stairs', action: () => g.message('Stairs leading deeper into the dungeon.') });
    }
    if (tile !== Tile.Wall) opts.push({ label: 'Walk here', action: () => this.walkTo(t) });
    return [...opts, ...examines];
  }

  private onTick(): void {
    this.state.tick();
    if (!this.state.player.path.length) this.destMarker.setVisible(false);
    this.drawMap();
    this.bus.emit('tick');
  }

  private drawMap(): void {
    const g = this.mapGfx.clear();
    const game = this.state;
    const map = game.map;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!game.isExplored(x, y)) continue;
        const t = tileAt(map, x, y);
        const lit = game.isVisible(x, y);
        g.fillStyle(t === Tile.Wall ? COLORS.wall : t === Tile.StairsDown ? COLORS.stairs : COLORS.floor);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (t !== Tile.Wall && lit) g.lineStyle(1, 0x000000, 0.15).strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    for (const n of game.nodes) if (game.isExplored(n.pos.x, n.pos.y)) this.drawNode(g, n);

    const ig = this.itemGfx.clear();
    const drawn = new Set<number>();
    for (const gi of game.groundItems) {
      const k = gi.pos.y * map.width + gi.pos.x;
      if (drawn.has(k) || !game.isExplored(gi.pos.x, gi.pos.y)) continue;
      drawn.add(k);
      ig.fillStyle(item(gi.id).color, 1).lineStyle(1, 0x000000, 1);
      ig.fillRect(gi.pos.x * TILE + 7, gi.pos.y * TILE + 7, TILE - 14, TILE - 14);
      ig.strokeRect(gi.pos.x * TILE + 7, gi.pos.y * TILE + 7, TILE - 14, TILE - 14);
    }
  }

  private drawNode(g: Phaser.GameObjects.Graphics, n: ResourceNode): void {
    const x = n.pos.x * TILE;
    const y = n.pos.y * TILE;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    switch (n.kind) {
      case 'resource': {
        const def = n.def!;
        if (def.kind === 'rock') {
          g.fillStyle(0x5a5650).fillCircle(cx, cy, 9);
          if (!n.depleted) g.fillStyle(def.color).fillCircle(cx - 3, cy - 2, 3).fillCircle(cx + 3, cy + 3, 2.5);
        } else if (def.kind === 'tree') {
          if (n.depleted) {
            g.fillStyle(0x6b4a2a).fillRect(cx - 4, cy - 1, 8, 6);
          } else {
            g.fillStyle(0x5a3a1a).fillRect(cx - 2, cy + 2, 4, 9);
            g.fillStyle(def.color).fillCircle(cx, cy - 2, 9);
          }
        } else {
          g.fillStyle(n.depleted ? 0x1a2a3a : 0x2a5a8a).fillRect(x, y, TILE, TILE);
          if (!n.depleted) g.lineStyle(1, 0x9ad0ff, 0.8).strokeCircle(cx, cy, 4).strokeCircle(cx, cy, 8);
        }
        break;
      }
      case 'fire':
        g.fillStyle(0x5a3a1a).fillRect(cx - 7, cy + 4, 14, 4);
        g.fillStyle(0xd04010).fillCircle(cx, cy + 1, 7);
        g.fillStyle(0xffb020).fillCircle(cx, cy + 3, 4);
        break;
      case 'furnace':
        g.fillStyle(0x6a2a1a).fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        g.fillStyle(0xff8020).fillRect(cx - 4, cy, 8, 6);
        break;
      case 'altar':
        g.fillStyle(0x8a8a8a).fillRect(x + 3, y + 6, TILE - 6, TILE - 9);
        g.fillStyle(0xf0f0f0).fillRect(x + 3, y + 6, TILE - 6, 4);
        g.fillStyle(0xe0c040).fillRect(cx - 1, y + 2, 2, 6);
        break;
      case 'anvil':
        g.fillStyle(0x3a3a3a).fillRect(cx - 9, cy - 4, 18, 5).fillRect(cx - 4, cy + 1, 8, 7);
        break;
    }
  }

  private makeActorView(color: number, letter?: string): ActorView {
    const body = this.add.rectangle(0, 0, TILE - 6, TILE - 6, color).setStrokeStyle(1, 0x000000).setDepth(4);
    const label = letter
      ? this.add.text(0, 0, letter, { fontFamily: 'monospace', fontSize: '13px', color: '#000000' }).setOrigin(0.5).setDepth(4)
      : undefined;
    const hpBg = this.add.rectangle(0, 0, TILE - 4, 4, 0xcc0000).setOrigin(0, 0.5).setDepth(6);
    const hpFg = this.add.rectangle(0, 0, TILE - 4, 4, 0x00cc00).setOrigin(0, 0.5).setDepth(6);
    return { body, label, hpBg, hpFg };
  }

  private destroyView(v: ActorView): void {
    v.body.destroy();
    v.label?.destroy();
    v.hpBg.destroy();
    v.hpFg.destroy();
  }

  private placeView(v: ActorView, actor: Actor, alpha: number, visible: boolean): { x: number; y: number } {
    const x = Phaser.Math.Linear(actor.prev.x, actor.pos.x, alpha) * TILE + TILE / 2;
    const y = Phaser.Math.Linear(actor.prev.y, actor.pos.y, alpha) * TILE + TILE / 2;
    v.body.setPosition(x, y).setVisible(visible);
    v.label?.setPosition(x, y).setVisible(visible);
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
        v = this.makeActorView(npc.def.color, npc.name[0]);
        if (npc.isBoss) v.body.setSize(TILE + 2, TILE + 2);
        this.npcViews.set(npc, v);
      }
      // Bosses and ranged/magic monsters show their current attack style as an outline.
      if (npc.isBoss || npc.attackStyle !== 'melee') {
        v.body.setStrokeStyle(npc.isBoss ? 3 : 2, STYLE_COLORS[npc.attackStyle]);
      }
      this.placeView(v, npc, a, g.isVisible(npc.pos.x, npc.pos.y));
    }

    const now = this.time.now;
    this.splats = this.splats.filter((s) => {
      if (now > s.until) {
        s.view.destroy();
        return false;
      }
      const x = Phaser.Math.Linear(s.actor.prev.x, s.actor.pos.x, a) * TILE + TILE / 2;
      const y = Phaser.Math.Linear(s.actor.prev.y, s.actor.pos.y, a) * TILE + TILE / 2;
      s.view.setPosition(x, y);
      return true;
    });

    this.hoverText = this.describeHover();
  }
}
