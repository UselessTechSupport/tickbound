import Phaser from 'phaser';
import { EquipSlot, item } from '../data/items';
import { SKILLS, SKILL_LABELS, SkillName } from '../data/skills';
import { AttackStyle } from '../entities/Player';
import { INVENTORY_SIZE } from '../entities/Inventory';
import { GameEvent, GameState } from '../game/GameState';
import { MAX_LEVEL, xpForLevel } from '../systems/xp';
import { TOOL_TIERS, nextUnlocks } from '../data/tools';
import { PRAYERS, PROTECTION_HOTKEYS } from '../data/prayers';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { RELIC_BY_ID } from '../data/relics';
import { sellPriceOf } from '../data/prices';
import { itemInfo, speedText } from '../ui/itemInfo';
import { ensureItemTexture } from '../render/sprites';
import { sfx } from '../audio/sfx';

const CONTROLS = [
  'Controls: left-click to walk, attack, take or use. Right-click for all options.',
  '1 / 2 / 3: Protect from Magic / Missiles / Melee.  R: run/walk.  M: mute.  Esc: close windows.',
  'Click the minimap to walk there. Hover skills for XP details, items for stats. Shift-click items to drop.',
];
import { BRANCHES, PERKS, nextRankCost, perkBlocker } from '../data/skillTree';
import { ContextMenu, MenuOption, describeOptions } from '../ui/ContextMenu';
import { FLOOR_HEIGHT, FLOOR_WIDTH } from '../world/dungeonGen';
import { Tile, tileAt } from '../world/tiles';
import { PANEL_W, type DungeonScene } from './DungeonScene';

const SLOT = 48;
const CHAT_W = 520;
const CHAT_H = 132;
const CHAT_LINES = 7;
const MINIMAP_SCALE = 3;
const SKILL_COL_W = 112;
const SKILL_ROW_H = 18;

const FONT = { fontFamily: 'monospace', fontSize: '13px', color: '#ffff00' };
const PANEL_BG = 0x3e3529;
const PANEL_EDGE = 0x1c1812;

type Tab = 'inventory' | 'prayer' | 'magic' | 'gear';
type ModalKind = 'mentor' | 'toolsmith' | 'merchant';
const TABS: Array<[Tab, string]> = [['inventory', 'Items'], ['prayer', 'Prayer'], ['magic', 'Magic'], ['gear', 'Gear']];
const TAB_W = 50;

/** Style button labels and what each trains, per weapon type. */
const STYLE_INFO: Record<'melee' | 'ranged' | 'magic', Array<[string, string]>> = {
  melee: [['Accurate', 'Attack'], ['Aggressive', 'Strength'], ['Defensive', 'Defence']],
  ranged: [['Accurate', 'Ranged, +accuracy'], ['Rapid', 'Ranged, attacks faster'], ['Longrange', 'Ranged + Defence, +2 range']],
  magic: [['Autocast', 'Magic'], ['Autocast', 'Magic'], ['Def. cast', 'Magic + Defence']],
};

const SKILL_SHORT: Record<SkillName, string> = {
  attack: 'Atk', strength: 'Str', defence: 'Def', hitpoints: 'HP', ranged: 'Rng', magic: 'Mage', prayer: 'Pray',
  mining: 'Mine', woodcutting: 'WC', fishing: 'Fish', cooking: 'Cook', smithing: 'Smith',
};

interface SlotView {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  qty: Phaser.GameObjects.Text;
}

interface SkillView {
  text: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle;
}

/** HUD overlay: hover text, side panel, minimap, chatbox, XP drops, context menu. */
export class UIScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private menu!: ContextMenu;
  private consumedFrame = -1;
  private hoverLabel!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private styleButtons = new Map<AttackStyle, Phaser.GameObjects.Text>();
  private skillViews = new Map<SkillName, SkillView>();
  private equipTexts = new Map<EquipSlot, Phaser.GameObjects.Text>();
  private slots: SlotView[] = [];
  private prayerText!: Phaser.GameObjects.Text;
  private prayerBar!: Phaser.GameObjects.Rectangle;
  private tab: Tab = 'inventory';
  private tabButtons = new Map<Tab, Phaser.GameObjects.Text>();
  private tabObjects: Record<Tab, Phaser.GameObjects.GameObject[]> = { inventory: [], prayer: [], magic: [], gear: [] };
  private gearText!: Phaser.GameObjects.Text;
  /** Item under the pointer in the inventory or equipment list, for the stats tooltip. */
  private hoveredItem: (() => string | undefined) | null = null;
  private spellCells = new Map<string, { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>();
  private autocastText!: Phaser.GameObjects.Text;
  private prayerCells = new Map<string, { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>();
  private bossBar!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private chat!: Phaser.GameObjects.Text;
  private runButton!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private shiftKey?: Phaser.Input.Keyboard.Key;
  private toolText!: Phaser.GameObjects.Text;
  private modal!: Phaser.GameObjects.Container;
  private relicPanel!: Phaser.GameObjects.Container;
  private relicText!: Phaser.GameObjects.Text;
  private modalKind: ModalKind | null = null;
  private minimap!: Phaser.GameObjects.Graphics;
  private minimapRect = new Phaser.Geom.Rectangle();
  private tooltip!: Phaser.GameObjects.Container;
  private tooltipText!: Phaser.GameObjects.Text;
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private deathOverlay!: Phaser.GameObjects.Container;
  private panelX = 0;
  /** Hover text supplied by panel widgets; overrides the map's hover text. */
  private panelHover: (() => string) | null = null;
  private hoveredSkill: SkillName | null = null;

  constructor() {
    super('UI');
  }

  private get dungeon(): DungeonScene {
    return this.scene.get('Dungeon') as DungeonScene;
  }

  private get state(): GameState {
    return this.dungeon.state;
  }

  create(): void {
    this.menu = new ContextMenu(this, () => (this.consumedFrame = this.game.loop.frame));
    this.build();
    this.scale.on('resize', () => this.build());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.menu.handlePointerMove(p.x, p.y));

    const bus = this.dungeon.bus;
    bus.on('xp', (e: Extract<GameEvent, { type: 'xp' }>) => this.xpDrop(e.skill, e.amount));
    bus.on('levelup', () => this.cameras.main.flash(250, 255, 255, 160));
    bus.on('death', () => this.deathOverlay.setVisible(true));
    bus.on('campMenu', (e: Extract<GameEvent, { type: 'campMenu' }>) => this.openModal(e.kind));
    bus.on('relicChoice', () => this.showRelicChoice());
    this.input.keyboard?.on('keydown-ESC', () => this.closeModal());
    this.input.keyboard?.on('keydown-M', () => sfx.toggleMute());
    // Not captured, so Shift still works normally in the browser.
    this.shiftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.input.keyboard?.on('keydown-R', () => this.dungeon.setRunning(!this.dungeon.running));
    this.input.keyboard?.on('keydown-H', () => {
      for (const line of CONTROLS) this.state.message(line);
    });
    bus.on('newrun', () => {
      this.deathOverlay?.setVisible(false);
      this.relicPanel?.setVisible(false);
      if (this.modal) this.closeModal();
      this.drawMinimap();
    });
    bus.on('tick', () => this.drawMinimap());
    bus.on('floor', () => this.drawMinimap());

    // 1/2/3 toggle Protect from Magic / Missiles / Melee for quick switching and flicking.
    (['ONE', 'TWO', 'THREE'] as const).forEach((key, i) => {
      this.input.keyboard?.on(`keydown-${key}`, () => this.state.togglePrayer(PROTECTION_HOTKEYS[i]));
    });
  }

  /** True if a click at (x, y) belongs to the UI rather than the game map. */
  isOverUi(x: number, y: number): boolean {
    if (this.menu.isOpen || this.consumedFrame === this.game.loop.frame) return true;
    if (x >= this.panelX) return true;
    if (x < CHAT_W && y > this.scale.height - CHAT_H) return true;
    if (this.minimapRect.contains(x, y)) return true;
    return (this.deathOverlay?.visible ?? false) || this.modal?.visible || this.relicPanel?.visible;
  }

  openMenu(x: number, y: number, options: MenuOption[]): void {
    if (options.length) this.menu.open(x, y, options);
  }

  private build(): void {
    this.menu?.close();
    this.root?.destroy(true);
    this.styleButtons.clear();
    this.skillViews.clear();
    this.equipTexts.clear();
    this.slots = [];
    this.panelHover = null;

    const W = this.scale.width;
    const H = this.scale.height;
    this.panelX = W - PANEL_W;
    const px = this.panelX;
    const root = (this.root = this.add.container(0, 0));

    this.hoverLabel = this.add.text(8, 6, '', { ...FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 3 });
    root.add(this.hoverLabel);

    // ---- Side panel ----
    root.add(this.add.rectangle(px, 0, PANEL_W, H, PANEL_BG).setOrigin(0).setStrokeStyle(2, PANEL_EDGE));
    let y = 8;
    this.header = this.add.text(px + 10, y, '', FONT);
    root.add(this.header);
    this.runButton = this.add.text(px + PANEL_W - 10, y - 2, '', {
      ...FONT, fontSize: '12px', backgroundColor: '#2a241c', padding: { x: 5, y: 2 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.runButton.on('pointerdown', () => this.dungeon.setRunning(!this.dungeon.running));
    this.hoverable(this.runButton, () => `Toggle Run (R): ${this.dungeon.running ? 'running 2 tiles' : 'walking 1 tile'} per tick`);
    root.add(this.runButton);
    y += 22;

    this.hpText = this.add.text(px + 10, y, '', { ...FONT, color: '#ffffff' });
    root.add(this.hpText);
    y += 18;
    root.add(this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x8b0000).setOrigin(0));
    this.hpBar = this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x00a000).setOrigin(0);
    root.add(this.hpBar);
    y += 12;

    this.prayerText = this.add.text(px + 10, y, '', { ...FONT, color: '#ffffff' });
    root.add(this.prayerText);
    y += 18;
    root.add(this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x1a2a4a).setOrigin(0));
    this.prayerBar = this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x40a0e0).setOrigin(0);
    root.add(this.prayerBar);
    y += 16;

    const styles: AttackStyle[] = ['accurate', 'aggressive', 'defensive'];
    styles.forEach((s, i) => {
      const b = this.add.text(px + 10 + i * 73, y, '', {
        ...FONT, fontSize: '11px', backgroundColor: '#2a241c', padding: { x: 4, y: 3 }, fixedWidth: 68, align: 'center',
      }).setInteractive({ useHandCursor: true });
      b.on('pointerdown', (p: Phaser.Input.Pointer) => p.leftButtonDown() && this.state.setStyle(s));
      this.hoverable(b, () => {
        const [label, trains] = STYLE_INFO[this.state.player.weaponType][i];
        return `Select ${label} (${trains})`;
      });
      this.styleButtons.set(s, b);
      root.add(b);
    });
    y += 28;

    SKILLS.forEach((s, i) => {
      const sx = px + 10 + (i % 2) * SKILL_COL_W;
      const sy = y + Math.floor(i / 2) * SKILL_ROW_H;
      const text = this.add.text(sx, sy, '', { ...FONT, fontSize: '12px', color: '#ffffff' });
      const track = this.add.rectangle(sx, sy + 14, SKILL_COL_W - 14, 2, 0x1c1812).setOrigin(0);
      const bar = this.add.rectangle(sx, sy + 14, 0, 2, 0x00b000).setOrigin(0);
      const hit = this.add.rectangle(sx, sy, SKILL_COL_W - 14, SKILL_ROW_H - 2, 0, 0).setOrigin(0).setInteractive();
      hit.on('pointerover', () => (this.hoveredSkill = s));
      hit.on('pointerout', () => this.hoveredSkill === s && (this.hoveredSkill = null));
      this.skillViews.set(s, { text, bar });
      root.add([text, track, bar, hit]);
    });
    y += Math.ceil(SKILLS.length / 2) * SKILL_ROW_H + 4;

    (['weapon', 'ammo', 'body', 'shield'] as EquipSlot[]).forEach((slot, i) => {
      const t = this.add.text(px + 10, y + i * 15, '', { ...FONT, fontSize: '12px', color: '#c8c8c8' })
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPanelClick(p, this.equipmentOptions(slot)));
      this.hoverable(t, () => this.describe(this.equipmentOptions(slot)));
      this.itemHover(t, () => this.state.player.equipment[slot]);
      this.equipTexts.set(slot, t);
      root.add(t);
    });
    y += 4 * 15 + 4;

    this.toolText = this.add.text(px + 10, y, '', { ...FONT, fontSize: '12px', color: '#9fd0ff', lineSpacing: 2 });
    root.add(this.toolText);
    y += 2 * 16 + 4;

    this.tabObjects = { inventory: [], prayer: [], magic: [], gear: [] };
    this.tabButtons.clear();
    TABS.forEach(([tab, label], i) => {
      const b = this.add.text(px + 10 + i * (TAB_W + 4), y, label, {
        ...FONT, fontSize: '12px', backgroundColor: '#2a241c', padding: { x: 2, y: 3 }, fixedWidth: TAB_W, align: 'center',
      }).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this.setTab(tab));
      this.hoverable(b, () => `Open ${label}`);
      this.tabButtons.set(tab, b);
      root.add(b);
    });
    y += 24;

    this.buildPrayerBook(px, y);
    this.buildSpellbook(px, y);
    this.gearText = this.add.text(px + 12, y + 2, '', { ...FONT, fontSize: '11px', color: '#ffffff', lineSpacing: 3 });
    this.tabObjects.gear.push(this.gearText);
    const gridX = px + (PANEL_W - SLOT * 4) / 2;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const sx = gridX + (i % 4) * SLOT;
      const sy = y + Math.floor(i / 4) * SLOT;
      const bg = this.add.rectangle(sx, sy, SLOT - 2, SLOT - 2, 0x2a241c).setOrigin(0).setInteractive();
      const icon = this.add.image(sx + SLOT / 2 - 1, sy + 18, 'item_coins');
      const label = this.add.text(sx + SLOT / 2 - 1, sy + SLOT - 3, '', {
        ...FONT, fontSize: '8px', color: '#ffffff', align: 'center', wordWrap: { width: SLOT - 4 }, lineSpacing: -2,
      }).setOrigin(0.5, 1);
      const qty = this.add.text(sx + 3, sy + 2, '', { ...FONT, fontSize: '11px' });
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPanelClick(p, this.inventoryOptions(i)));
      this.hoverable(bg, () => this.describe(this.inventoryOptions(i)));
      this.itemHover(bg, () => this.state.player.inventory.slots[i]?.id);
      this.slots.push({ icon, label, qty });
      root.add([bg, icon, label, qty]);
      this.tabObjects.inventory.push(bg, icon, label, qty);
    }
    for (const o of [...this.tabObjects.prayer, ...this.tabObjects.magic, ...this.tabObjects.gear]) root.add(o);
    this.setTab(this.tab);

    // ---- Boss HP bar (top centre of the game view) ----
    const bw = 320;
    this.bossName = this.add.text(0, 0, '', { ...FONT, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1);
    const bossBg = this.add.rectangle(-bw / 2, 4, bw, 12, 0x8b0000).setOrigin(0).setStrokeStyle(1, 0x000000);
    this.bossFill = this.add.rectangle(-bw / 2, 4, bw, 12, 0x00a000).setOrigin(0);
    this.bossBar = this.add.container(px / 2, 52, [this.bossName, bossBg, this.bossFill]).setVisible(false);
    this.bossBar.setData('width', bw);
    root.add(this.bossBar);

    this.soundText = this.add.text(W - 8, H - 4, '', { ...FONT, fontSize: '10px', color: '#a08a5a' }).setOrigin(1, 1);
    root.add(this.soundText);

    // ---- Minimap (top-right of the game view) ----
    const mw = FLOOR_WIDTH * MINIMAP_SCALE;
    const mh = FLOOR_HEIGHT * MINIMAP_SCALE;
    this.minimapRect.setTo(px - mw - 10, 8, mw, mh);
    const mmBg = this.add.rectangle(this.minimapRect.x, this.minimapRect.y, mw, mh, 0x000000, 0.8)
      .setOrigin(0).setStrokeStyle(2, PANEL_EDGE).setInteractive();
    mmBg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const r = this.minimapRect;
      this.dungeon.walkTo({ x: Math.floor((p.x - r.x) / MINIMAP_SCALE), y: Math.floor((p.y - r.y) / MINIMAP_SCALE) });
    });
    this.hoverable(mmBg, () => 'Walk here');
    this.minimap = this.add.graphics();
    root.add([mmBg, this.minimap]);
    this.drawMinimap();

    // ---- Chatbox ----
    root.add(this.add.rectangle(0, H - CHAT_H, CHAT_W, CHAT_H, 0xd6c7a1, 0.92).setOrigin(0).setStrokeStyle(2, PANEL_EDGE));
    this.chat = this.add.text(8, H - CHAT_H + 6, '', {
      ...FONT, color: '#000000', wordWrap: { width: CHAT_W - 16 }, lineSpacing: 2,
    });
    root.add(this.chat);

    // ---- Skill tooltip ----
    this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0xffffa0).setOrigin(0).setStrokeStyle(1, 0x000000);
    this.tooltipText = this.add.text(6, 4, '', { ...FONT, fontSize: '12px', color: '#000000' });
    this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipText]).setDepth(50).setVisible(false);
    root.add(this.tooltip);

    // ---- Death overlay ----
    const gameW = this.panelX;
    const dim = this.add.rectangle(0, 0, gameW, H, 0x000000, 0.75).setOrigin(0).setInteractive();
    const title = this.add.text(gameW / 2, H / 2 - 80, 'Oh dear, you are dead!', { ...FONT, fontSize: '28px', color: '#ff3030' }).setOrigin(0.5);
    const stats = this.add.text(gameW / 2, H / 2 - 20, '', { ...FONT, fontSize: '15px', color: '#ffffff', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    const back = this.add.text(gameW / 2, H / 2 + 50, '[ Return to camp ]', {
      ...FONT, fontSize: '18px', backgroundColor: '#2a241c', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.dungeon.toCamp());
    this.deathOverlay = this.add.container(0, 0, [dim, title, stats, back]).setDepth(20).setVisible(this.state?.over ?? false);
    this.deathOverlay.setData('stats', stats);
    root.add(this.deathOverlay);

    // ---- Relics owned (under the hover text) and the relic choice window ----
    this.relicText = this.add.text(8, 24, '', { ...FONT, fontSize: '11px', color: '#ffd040', stroke: '#000000', strokeThickness: 3 });
    root.add(this.relicText);
    this.relicPanel = this.add.container(0, 0).setDepth(35).setVisible(false);
    root.add(this.relicPanel);
    if (this.state?.pendingRelics) this.showRelicChoice();

    // ---- Camp windows (Toolsmith shop, Mentor skill tree) ----
    this.modal = this.add.container(0, 0).setDepth(30).setVisible(false);
    root.add(this.modal);
    if (this.modalKind) this.openModal(this.modalKind);
  }

  /** Pick 1 of 3 relics; the game is paused until you choose. */
  private showRelicChoice(): void {
    const options = this.state.pendingRelics;
    this.relicPanel.removeAll(true);
    if (!options) {
      this.relicPanel.setVisible(false);
      return;
    }
    this.relicPanel.setVisible(true);
    const W = this.panelX;
    const H = this.scale.height;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.relicPanel.add(o), o);
    add(this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive());
    add(this.add.text(W / 2, H / 2 - 150, 'Choose a relic', { ...FONT, fontSize: '24px', color: '#ff981f' }).setOrigin(0.5));
    add(this.add.text(W / 2, H / 2 - 120, 'It lasts for the rest of this run. The game is paused.', { ...FONT, color: '#c8c8c8' }).setOrigin(0.5));
    const cardW = Math.min(240, (W - 60) / options.length - 16);
    options.forEach((id, i) => {
      const r = RELIC_BY_ID[id];
      const x = W / 2 + (i - (options.length - 1) / 2) * (cardW + 16);
      const card = add(this.add.rectangle(x, H / 2, cardW, 170, 0x2e271e).setStrokeStyle(2, r.color).setInteractive({ useHandCursor: true }));
      add(this.add.text(x, H / 2 - 60, r.name, { ...FONT, fontSize: '15px', color: Phaser.Display.Color.IntegerToColor(r.color).rgba }).setOrigin(0.5));
      add(this.add.text(x, H / 2 + 5, r.desc, {
        ...FONT, color: '#ffffff', align: 'center', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5));
      card.on('pointerover', () => card.setFillStyle(0x4a3f2a));
      card.on('pointerout', () => card.setFillStyle(0x2e271e));
      card.on('pointerdown', () => {
        this.state.chooseRelic(id);
        this.showRelicChoice();
      });
    });
  }

  /** True while a window is open that should pause the game. */
  get pausesGame(): boolean {
    return !!this.modalKind;
  }

  openModal(kind: ModalKind): void {
    this.modalKind = kind;
    this.modal.removeAll(true);
    this.modal.setVisible(true);
    const W = this.panelX;
    const H = this.scale.height;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.modal.add(o), o);
    add(this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive());
    const title = { mentor: 'Mentor: Skill Tree', toolsmith: 'Toolsmith', merchant: 'Wandering Merchant' }[kind];
    add(this.add.text(W / 2, 24, title, { ...FONT, fontSize: '22px', color: '#ff981f' }).setOrigin(0.5, 0));
    const currency = kind === 'merchant'
      ? `Coins: ${this.state.player.inventory.count('coins').toLocaleString()}   (the game is paused)`
      : `Dungeoneering tokens: ${this.dungeon.meta.tokens}`;
    add(this.add.text(W / 2, 54, currency, { ...FONT, fontSize: '16px' }).setOrigin(0.5, 0));
    const close = add(this.add.text(W - 16, 16, '[ X ]', { ...FONT, fontSize: '16px', color: '#ff6060' }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }));
    close.on('pointerdown', () => this.closeModal());
    if (kind === 'mentor') this.buildSkillTree(add);
    else if (kind === 'merchant') this.buildMerchant(add);
    else this.buildToolsmith(add);
  }

  /** Buy list on the left, your sellable inventory on the right. */
  private buildMerchant(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const g = this.state;
    const W = this.panelX;
    const colW = Math.min(420, W / 2 - 30);
    const leftX = W / 2 - colW - 10;
    const rightX = W / 2 + 10;
    const rowStyle = (enabled: boolean) => ({
      ...FONT, fontSize: '13px', color: enabled ? '#ffffff' : '#7a7a7a',
      backgroundColor: enabled ? '#3e3529' : '#241f18', padding: { x: 8, y: 4 }, fixedWidth: colW,
    });
    const clickable = (row: Phaser.GameObjects.Text, onClick: () => void) => {
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#5d5447'));
      row.on('pointerout', () => row.setBackgroundColor('#3e3529'));
      row.on('pointerdown', () => {
        onClick();
        this.openModal('merchant');
      });
    };

    add(this.add.text(leftX, 90, 'Buy (click)', { ...FONT, color: '#c8c8c8' }));
    const coins = g.player.inventory.count('coins');
    (g.activeMerchant?.stock ?? []).forEach((s, i) => {
      const bundle = item(s.id).stackable ? Math.min(s.qty, 25) : 1;
      const can = s.qty > 0 && coins >= s.price * bundle;
      const label = s.qty > 0
        ? `${item(s.id).name}${bundle > 1 ? ` x${bundle}` : ''}  -  ${(s.price * bundle).toLocaleString()} gp  (${s.qty} left)`
        : `${item(s.id).name}  -  sold out`;
      const row = add(this.add.text(leftX, 112 + i * 28, label, rowStyle(can)));
      if (can) clickable(row, () => g.buy(i));
    });

    add(this.add.text(rightX, 90, 'Sell (click, whole stack)', { ...FONT, color: '#c8c8c8' }));
    const sellable = g.player.inventory.slots
      .map((s, slot) => ({ s, slot }))
      .filter(({ s }) => s && s.id !== 'coins' && sellPriceOf(s.id) > 0);
    sellable.slice(0, 16).forEach(({ s, slot }, i) => {
      const total = sellPriceOf(s!.id) * s!.qty;
      const row = add(this.add.text(rightX, 112 + i * 28, `${item(s!.id).name}${s!.qty > 1 ? ` x${s!.qty}` : ''}  -  ${total.toLocaleString()} gp`, rowStyle(true)));
      clickable(row, () => g.sell(slot));
    });
    if (!sellable.length) add(this.add.text(rightX, 112, 'Nothing the merchant wants.', { ...FONT, color: '#7a7a7a' }));
  }

  closeModal(): void {
    if (this.modalKind === 'merchant') this.state.closeShop();
    this.modalKind = null;
    this.modal.removeAll(true);
    this.modal.setVisible(false);
  }

  /** Lists the next unlock for each tool line; rebuilt after every purchase. */
  private buildToolsmith(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const cx = this.panelX / 2;
    add(this.add.text(cx, 90, 'Tools you buy are yours for every future run.', { ...FONT, color: '#c8c8c8' }).setOrigin(0.5, 0));
    const offers = nextUnlocks(d.meta.tools);
    offers.forEach((o, i) => {
      const affordable = o.cost <= d.meta.tokens;
      const row = add(this.add.text(cx, 130 + i * 32, `${o.label.padEnd(18)} ${String(o.cost).padStart(4)} tokens   ${o.detail}`, {
        ...FONT, fontSize: '14px', color: affordable ? '#ffffff' : '#7a7a7a',
        backgroundColor: affordable ? '#3e3529' : '#241f18', padding: { x: 10, y: 5 }, fixedWidth: Math.min(600, this.panelX - 40),
      }).setOrigin(0.5, 0));
      if (!affordable) return;
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#5d5447'));
      row.on('pointerout', () => row.setBackgroundColor('#3e3529'));
      row.on('pointerdown', () => d.buyUnlock(o.key) && this.openModal('toolsmith'));
    });
    if (!offers.length) add(this.add.text(cx, 130, 'Every tool is unlocked!', { ...FONT, color: '#00ff00' }).setOrigin(0.5, 0));
  }

  /** Five branch columns, perks as boxes linked to their prerequisite. */
  private buildSkillTree(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const ranks = d.meta.perks;
    const colW = Math.min(200, (this.panelX - 40) / BRANCHES.length);
    const x0 = (this.panelX - colW * BRANCHES.length) / 2;
    const boxW = colW - 14;
    const boxH = 70;
    const rowY = (tier: number) => 120 + tier * 92;
    const center = new Map<string, { x: number; y: number }>();
    for (const perk of PERKS) {
      const col = BRANCHES.findIndex((b) => b.id === perk.branch);
      center.set(perk.id, { x: x0 + col * colW + colW / 2, y: rowY(perk.tier) + boxH / 2 });
    }

    const lines = add(this.add.graphics());
    for (const perk of PERKS) {
      if (!perk.requires) continue;
      const a = center.get(perk.requires)!;
      const b = center.get(perk.id)!;
      lines.lineStyle(2, ranks[perk.requires] ? 0xc8a050 : 0x4a4038).lineBetween(a.x, a.y + boxH / 2, b.x, b.y - boxH / 2);
    }

    BRANCHES.forEach((b, i) => {
      add(this.add.text(x0 + i * colW + colW / 2, 92, b.name, { ...FONT, fontSize: '15px', color: Phaser.Display.Color.IntegerToColor(b.color).rgba })
        .setOrigin(0.5, 0));
    });

    const info = add(this.add.text(this.panelX / 2, rowY(4) + 4, 'Hover a perk to see what it does. Click to buy a rank.', {
      ...FONT, fontSize: '13px', color: '#ffffff', align: 'center', wordWrap: { width: this.panelX - 60 },
    }).setOrigin(0.5, 0));

    for (const perk of PERKS) {
      const c = center.get(perk.id)!;
      const rank = ranks[perk.id] ?? 0;
      const max = perk.costs.length;
      const blocker = perkBlocker(ranks, d.meta.tokens, perk.id);
      const color = BRANCHES.find((b) => b.id === perk.branch)!.color;
      const locked = !!perk.requires && !ranks[perk.requires];
      const box = add(this.add.rectangle(c.x, c.y, boxW, boxH, rank ? 0x4a3f2a : locked ? 0x1c1812 : 0x2e271e)
        .setStrokeStyle(rank === max ? 3 : 1, locked ? 0x4a4038 : color).setInteractive({ useHandCursor: !blocker }));
      const cost = nextRankCost(ranks, perk.id);
      add(this.add.text(c.x, c.y, `${perk.name}\nRank ${rank}/${max}\n${cost === null ? 'MAX' : `${cost} tokens`}`, {
        ...FONT, fontSize: '11px', align: 'center', lineSpacing: 2,
        color: locked ? '#6a6a6a' : rank === max ? '#00ff80' : !blocker ? '#ffffff' : '#c8b070',
      }).setOrigin(0.5));
      box.on('pointerover', () => info.setText(`${perk.name}: ${perk.desc}\n${blocker ?? `Click to buy rank ${rank + 1} for ${cost} tokens.`}`));
      box.on('pointerdown', () => d.buyPerk(perk.id) && this.openModal('mentor'));
    }
  }

  /** OSRS-style prayer book: 3 columns; click to toggle. */
  private buildPrayerBook(px: number, y: number): void {
    this.prayerCells.clear();
    const cw = 72;
    const ch = 48;
    const x0 = px + (PANEL_W - cw * 3) / 2;
    PRAYERS.forEach((pr, i) => {
      const cx = x0 + (i % 3) * cw;
      const cy = y + Math.floor(i / 3) * ch;
      const bg = this.add.rectangle(cx, cy, cw - 2, ch - 2, 0x2a241c).setOrigin(0).setInteractive({ useHandCursor: true });
      const text = this.add.text(cx + cw / 2 - 1, cy + ch / 2 - 1, `${pr.short}\nlvl ${pr.level}`, {
        ...FONT, fontSize: '9px', align: 'center', lineSpacing: -1,
      }).setOrigin(0.5);
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => p.leftButtonDown() && this.state.togglePrayer(pr.id));
      this.hoverable(bg, () => {
        const on = this.state.player.activePrayers.has(pr.id);
        const hotkey = PROTECTION_HOTKEYS.indexOf(pr.id as (typeof PROTECTION_HOTKEYS)[number]);
        return `${on ? 'Deactivate' : 'Activate'} ${pr.name}${hotkey >= 0 ? `  (hotkey ${hotkey + 1})` : ''}`;
      });
      this.prayerCells.set(pr.id, { bg, text });
      this.tabObjects.prayer.push(bg, text);
    });
    const hint = this.add.text(px + PANEL_W / 2, y + Math.ceil(PRAYERS.length / 3) * ch + 4, 'Hotkeys: 1 Magic  2 Missiles  3 Melee', {
      ...FONT, fontSize: '10px', color: '#c8c8c8',
    }).setOrigin(0.5, 0);
    this.tabObjects.prayer.push(hint);
  }

  /** Combat spells; click one to autocast it with a staff, click again for "strongest available". */
  private buildSpellbook(px: number, y: number): void {
    this.spellCells.clear();
    const cw = 72;
    const ch = 48;
    const x0 = px + (PANEL_W - cw * 3) / 2;
    SPELLS.forEach((sp, i) => {
      const cx = x0 + (i % 3) * cw;
      const cy = y + Math.floor(i / 3) * ch;
      const bg = this.add.rectangle(cx, cy, cw - 2, ch - 2, 0x2a241c).setOrigin(0).setInteractive({ useHandCursor: true });
      const text = this.add.text(cx + cw / 2 - 1, cy + ch / 2 - 1, `${sp.name.replace(' ', '\n')}\nlvl ${sp.level}`, {
        ...FONT, fontSize: '9px', align: 'center', lineSpacing: -1,
      }).setOrigin(0.5);
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!p.leftButtonDown()) return;
        const g = this.state;
        g.setAutocast(g.player.autocast === sp.id ? null : sp.id);
      });
      this.hoverable(bg, () => {
        const runes = Object.entries(sp.runes).map(([r, n]) => `${n} ${item(r).name.replace(' rune', '')}`).join(', ');
        return `Autocast ${sp.name}: max hit ${sp.maxHit}, needs ${runes}`;
      });
      this.spellCells.set(sp.id, { bg, text });
      this.tabObjects.magic.push(bg, text);
    });
    this.autocastText = this.add.text(px + PANEL_W / 2, y + Math.ceil(SPELLS.length / 3) * ch + 6, '', {
      ...FONT, fontSize: '11px', color: '#c8c8c8', align: 'center', wordWrap: { width: PANEL_W - 16 },
    }).setOrigin(0.5, 0);
    this.tabObjects.magic.push(this.autocastText);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    for (const [t] of TABS) {
      for (const o of this.tabObjects[t]) {
        (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(t === tab);
        if (o.input) o.input.enabled = t === tab;
      }
      this.tabButtons.get(t)?.setColor(t === tab ? '#ffffff' : '#a08a5a');
    }
  }

  /** Shows `text()` as the top-left hover text while the pointer is over `obj`. */
  private hoverable(obj: Phaser.GameObjects.GameObject, text: () => string): void {
    obj.on('pointerover', () => (this.panelHover = text));
    obj.on('pointerout', () => this.panelHover === text && (this.panelHover = null));
  }

  private describe(opts: MenuOption[]): string {
    if (!opts.length) return '';
    return describeOptions(opts);
  }

  /** Left-click runs the first option; right-click opens the full menu. */
  private onPanelClick(p: Phaser.Input.Pointer, opts: MenuOption[]): void {
    if (p.rightButtonDown()) this.openMenu(p.x, p.y, opts);
    else opts[0]?.action();
  }

  private inventoryOptions(slot: number): MenuOption[] {
    const g = this.state;
    const stack = g.player.inventory.slots[slot];
    if (!stack) return [];
    const def = item(stack.id);
    const opts: MenuOption[] = [];
    const verb = def.burnTicks ? 'Light' : def.restoresPrayer ? 'Drink' : def.heal ? 'Eat' : def.buryXp ? 'Bury' : def.equip ? (def.equip.slot === 'weapon' || def.equip.slot === 'ammo' ? 'Wield' : 'Wear') : null;
    // Items without a use get a harmless Examine as their left-click, never Drop...
    const examine = { label: `Examine ${def.name}`, action: () => g.message(def.examine + (stack.qty > 1 ? ` (${stack.qty.toLocaleString()})` : '')) };
    const drop = { label: `Drop ${def.name}`, action: () => g.dropItem(slot) };
    if (verb) opts.push({ label: `${verb} ${def.name}`, action: () => g.useItem(slot) });
    else opts.push(examine);
    opts.push(drop);
    if (verb) opts.push(examine);
    // ...unless Shift is held: then left-click drops, like OSRS shift-click dropping.
    if (this.shiftKey?.isDown) return [drop, ...opts.filter((o) => o !== drop)];
    return opts;
  }

  private equipmentOptions(slot: EquipSlot): MenuOption[] {
    const g = this.state;
    const id = g.player.equipment[slot];
    if (!id) return [];
    const def = item(id);
    const e = def.equip!;
    const fmt = (label: string, v = 0) => (v ? `${label} ${v > 0 ? '+' : ''}${v}` : '');
    const stats = [fmt('Att', e.attackBonus), fmt('Str', e.strengthBonus), fmt('Def', e.defenceBonus), fmt('Rng', e.rangedBonus),
      fmt('Rng str', e.rangedStrength), fmt('Mage', e.magicBonus)].filter(Boolean).join(', ') + '.';
    return [
      { label: `Remove ${def.name}`, action: () => g.unequip(slot) },
      { label: `Examine ${def.name}`, action: () => g.message(`${def.examine} ${stats}`) },
    ];
  }

  private drawMinimap(): void {
    const g = this.state;
    if (!g || !this.minimap) return;
    const m = this.minimap.clear();
    const r = this.minimapRect;
    const S = MINIMAP_SCALE;
    const map = g.map;
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (!g.isExplored(tx, ty)) continue;
        const t = tileAt(map, tx, ty);
        if (t === Tile.Wall) continue;
        m.fillStyle(t === Tile.StairsDown ? 0xc9a227 : 0x6b5d4a);
        m.fillRect(r.x + tx * S, r.y + ty * S, S, S);
      }
    }
    for (const n of g.nodes) {
      if (!g.isExplored(n.pos.x, n.pos.y)) continue;
      const kind = n.def?.kind;
      m.fillStyle(kind === 'rock' ? 0x9a9a9a : kind === 'tree' ? 0x3f9a3a : kind === 'fishing' ? 0x3a8ad0 : 0xff8020);
      m.fillRect(r.x + n.pos.x * S, r.y + n.pos.y * S, S, S);
    }
    // Dot colours follow OSRS: red items, yellow NPCs, white player.
    m.fillStyle(0xff0000);
    for (const gi of g.groundItems) if (g.isExplored(gi.pos.x, gi.pos.y)) m.fillRect(r.x + gi.pos.x * S, r.y + gi.pos.y * S, S, S);
    m.fillStyle(0xffff00);
    for (const n of g.npcs) if (g.isVisible(n.pos.x, n.pos.y)) m.fillRect(r.x + n.pos.x * S, r.y + n.pos.y * S, S, S);
    m.fillStyle(0xffffff);
    m.fillRect(r.x + g.player.pos.x * S - 1, r.y + g.player.pos.y * S - 1, S + 2, S + 2);
  }

  /** Newest messages that fit in the chatbox once word-wrapped. */
  private fitChat(messages: string[]): string {
    const lines: string[] = [];
    for (let i = messages.length - 1; i >= 0 && lines.length < CHAT_LINES; i--) {
      lines.unshift(...this.chat.getWrappedText(messages[i]));
    }
    return lines.slice(-CHAT_LINES).join('\n');
  }

  private xpDrop(skill: SkillName, amount: number): void {
    const t = this.add.text(this.minimapRect.x - 12, 40, `+${Math.round(amount)} ${SKILL_LABELS[skill]}`, {
      ...FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0);
    this.tweens.add({ targets: t, y: 4, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
  }

  /** Tracks which item `obj` shows, so hovering it brings up its stats tooltip. */
  private itemHover(obj: Phaser.GameObjects.GameObject, id: () => string | undefined): void {
    obj.on('pointerover', () => (this.hoveredItem = id));
    obj.on('pointerout', () => this.hoveredItem === id && (this.hoveredItem = null));
  }

  private tooltipLines(): string[] | null {
    if (this.menu.isOpen) return null;
    const p = this.state.player;
    const s = this.hoveredSkill;
    if (s) {
      const xp = Math.floor(p.skills.xp[s]);
      const level = p.skills.level(s);
      const lines = [`${SKILL_LABELS[s]} XP: ${xp.toLocaleString()}`];
      if (level < MAX_LEVEL) {
        const next = xpForLevel(level + 1);
        lines.push(`Next level at: ${next.toLocaleString()}`, `Remaining XP: ${(next - xp).toLocaleString()}`);
      }
      return lines;
    }
    const id = this.hoveredItem?.();
    return id ? itemInfo(id, p) : null;
  }

  private updateTooltip(): void {
    const lines = this.tooltipLines();
    if (!lines) {
      this.tooltip.setVisible(false);
      return;
    }
    this.tooltipText.setText(lines.join('\n'));
    this.tooltipBg.setSize(this.tooltipText.width + 12, this.tooltipText.height + 8);
    const p = this.input.activePointer;
    // Keep it on screen: flip above / left of the cursor near the edges.
    const w = this.tooltipBg.width;
    const h = this.tooltipBg.height;
    const x = p.x + 12 + w > this.scale.width ? p.x - w - 8 : p.x + 12;
    const y = p.y + 16 + h > this.scale.height ? p.y - h - 8 : p.y + 16;
    this.tooltip.setPosition(Math.max(4, x), Math.max(4, y)).setVisible(true);
  }

  /** Gear tab: total bonuses and what your next attack looks like. */
  private updateGear(): void {
    const g = this.state;
    const p = g.player;
    const b = p.bonuses();
    const c = g.combatPreview();
    const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`.padEnd(5);
    const [styleLabel, trains] = STYLE_INFO[c.mode][['accurate', 'aggressive', 'defensive'].indexOf(p.style)];
    const lines = [
      'Equipment bonuses',
      `Attack  ${signed(b.attack)}  Strength ${signed(b.strength)}`,
      `Defence ${signed(b.defence)}  Ranged   ${signed(b.ranged)}`,
      `Rng str ${signed(b.rangedStrength)}  Magic    ${signed(b.magic)}`,
      '',
      `Current attack (${c.mode})`,
      `Style:    ${styleLabel}`,
      `          trains ${trains}`,
      `Max hit:  ${c.maxHit}`,
      `Accuracy: ${c.attackRoll.toLocaleString()}`,
      `Speed:    ${speedText(c.speed)}`,
      `Range:    ${c.range} tile${c.range > 1 ? 's' : ''}${c.mode === 'melee' ? ' (no diagonals)' : ''}`,
    ];
    if (c.mode === 'ranged') {
      const ammo = p.equipment.ammo;
      lines.push(`Ammo:     ${ammo ? `${item(ammo).name} x${p.ammo}` : 'none'}`);
    }
    if (c.mode === 'magic') lines.push(`Spell:    ${c.spell ? `${c.spell.name}` : 'none castable'}`);
    if (c.problem) lines.push('', `! ${c.problem}`);
    const target = p.intent?.kind === 'attack' ? p.intent.npc : null;
    if (target && !target.dead) {
      const weak = target.def.weakness === c.mode ? ' (weak!)' : '';
      lines.push('', `vs ${target.name}:`, `  ${Math.round(100 * g.hitChanceAgainst(target, c))}% to hit${weak}`);
    }
    this.gearText.setText(lines.join('\n'));
  }

  update(): void {
    const g = this.state;
    if (!g) return;
    const p = g.player;

    let hover = '';
    if (!this.menu.isOpen) {
      const pointer = this.input.activePointer;
      hover = this.panelHover?.() ?? (this.isOverUi(pointer.x, pointer.y) ? '' : this.dungeon.hoverText);
    }
    this.hoverLabel.setText(hover);

    this.header.setText(g.isCamp ? `Camp  Tokens ${this.dungeon.meta.tokens}` : `Floor ${g.depth}  Combat ${p.combatLevel}`);
    const running = this.dungeon.running;
    this.runButton.setText(running ? 'Run: on' : 'Run: off').setColor(running ? '#ffff00' : '#a08a5a');
    this.hpText.setText(`Hitpoints ${p.hp}/${p.maxHp}`);
    this.hpBar.width = (PANEL_W - 20) * Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    this.prayerText.setText(`Prayer ${p.prayerPoints}/${p.maxPrayer}`);
    this.prayerBar.width = (PANEL_W - 20) * Phaser.Math.Clamp(p.prayerPoints / p.maxPrayer, 0, 1);
    const prayerLevel = p.skills.level('prayer');
    for (const pr of PRAYERS) {
      const cell = this.prayerCells.get(pr.id)!;
      const on = p.activePrayers.has(pr.id);
      cell.bg.setFillStyle(on ? 0x7a6a2a : 0x2a241c);
      cell.text.setColor(prayerLevel < pr.level ? '#6a6a6a' : on ? '#ffffff' : '#ffff00');
    }

    const boss = g.npcs.find((n) => n.isBoss && (n.target || g.isVisible(n.pos.x, n.pos.y)));
    this.bossBar.setVisible(!!boss && !g.over);
    if (boss) {
      this.bossName.setText(`${boss.name}  ${Math.max(0, boss.hp)}/${boss.maxHp}`);
      this.bossFill.width = (this.bossBar.getData('width') as number) * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    }

    const styleInfo = STYLE_INFO[p.weaponType];
    [...this.styleButtons.entries()].forEach(([s, b], i) => {
      b.setText(styleInfo[i][0]).setColor(p.style === s ? '#ffffff' : '#a08a5a');
    });
    const magicLevel = p.skills.level('magic');
    for (const sp of SPELLS) {
      const cell = this.spellCells.get(sp.id)!;
      const chosen = p.autocast === sp.id;
      cell.bg.setFillStyle(chosen ? 0x2a4a7a : 0x2a241c);
      cell.text.setColor(magicLevel < sp.level ? '#6a6a6a' : g.canCast(sp) ? '#d08040' : chosen ? '#ffffff' : '#ffff00');
    }
    const auto = p.autocast ? SPELL_BY_ID[p.autocast].name : 'strongest available';
    this.autocastText.setText(`Autocast: ${auto}${p.weaponType === 'magic' ? '' : '\n(wield a staff to cast)'}`);
    for (const [s, v] of this.skillViews) {
      const level = p.skills.level(s);
      v.text.setText(`${SKILL_SHORT[s].padEnd(5)} ${level}`);
      const lo = xpForLevel(level);
      const frac = level >= MAX_LEVEL ? 1 : (p.skills.xp[s] - lo) / (xpForLevel(level + 1) - lo);
      v.bar.width = (SKILL_COL_W - 14) * frac;
    }
    for (const [slot, t] of this.equipTexts) {
      const id = p.equipment[slot];
      const qty = slot === 'ammo' && id ? ` x${p.ammo}` : '';
      t.setText(`${slot.padEnd(6)}: ${id ? item(id).name : '-'}${qty}`);
    }

    const t = p.tools;
    const metal = (tier: number) => (tier ? TOOL_TIERS[tier - 1].name : '-');
    this.toolText.setText([
      `Pick: ${metal(t.pickaxe).padEnd(8)} Axe: ${metal(t.axe)}`,
      `Fish: ${(['-', 'Net', 'Rod', 'Pot', 'Harpoon'][t.fishing]).padEnd(8)} ${t.hammer ? 'Hammer ' : ''}${t.tinderbox ? 'Tinder' : ''}`,
    ].join('\n'));

    p.inventory.slots.forEach((stack, i) => {
      const v = this.slots[i];
      v.icon.setVisible(!!stack && this.tab === 'inventory');
      v.label.setText(stack ? item(stack.id).name : '');
      v.qty.setText(stack && stack.qty > 1 ? String(stack.qty) : '');
      if (stack) {
        const ref = ensureItemTexture(this, stack.id);
        if (v.icon.texture.key !== ref.key) v.icon.setTexture(ref.key);
        if (ref.tint !== undefined) v.icon.setTint(ref.tint);
        else v.icon.clearTint();
      }
    });

    this.updateTooltip();
    if (this.tab === 'gear') this.updateGear();
    this.relicText.setText(g.relics.length ? `Relics: ${g.relics.map((r) => RELIC_BY_ID[r].name).join(', ')}` : '');
    this.soundText.setText(`H: help   M: sound ${sfx.muted ? 'off' : 'on'}`);
    this.chat.setText(this.fitChat(g.messages));

    if (g.over) {
      (this.deathOverlay.getData('stats') as Phaser.GameObjects.Text)
        .setText([
          `Reached floor ${g.depth} with ${g.kills} kills${g.bossKills ? ` and ${g.bossKills} boss kill${g.bossKills > 1 ? 's' : ''}` : ''}.`,
          `This run earned ${this.dungeon.lastEarned} Dungeoneering tokens (total ${this.dungeon.meta.tokens}).`,
          'Spend them at camp with the Mentor and the Toolsmith.',
        ].join('\n'));
    }
  }
}
