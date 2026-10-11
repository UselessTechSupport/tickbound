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
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, TIERS, Tier, tierOf } from '../data/achievements';
import { SKIP_TASK_COST, SLAYER_BY_ID } from '../data/slayer';
import { MIMIC_CHANCE, NPCS } from '../data/npcs';
import { SPEC_BY_WEAPON } from '../data/specials';
import { QUESTS, describeReward, isQuestPosted, questProgress } from '../data/quests';
import { PET_BUFFS, PET_MAX_LEVEL, STRUCTURES, TROPHY_BONUS, TROPHY_MOUNTS, nextStructureLevel, petBonus, petLevel } from '../data/construction';
import { ARMOURY, ARMOURY_LINES, ArmouryLine, StartStyle, nextArmouryTier } from '../data/armoury';
import { ENCHANTS, ENCHANT_COSTS, ENCHANT_SWITCH_FEE, ROMAN, describeEnchant, enchantCost, lineKind } from '../data/enchants';
import { recipesFor } from '../data/recipes';
import { herbForDepth } from '../data/resources';
import { HERB_DROP_CHANCE } from '../game/GameState';
import { ALL_LOG_SLOTS, LOG_CATEGORIES, PET_BY_ID, PET_CHANCE, petForBoss } from '../data/collectionLog';
import { CHEST_SECOND_PICK, CHEST_TABLE, chestCoins, metalForDepth } from '../data/loot';
import type { Npc } from '../entities/Npc';
import type { Notice } from '../meta/tracker';
import { ensureItemTexture, npcSprite } from '../render/sprites';
import { sfx } from '../audio/sfx';
import { saveSettings, settings } from '../save/settings';

const CONTROLS = [
  'Controls: left-click to walk, attack, take or use. Right-click for all options.',
  '1 / 2 / 3: Protect from Magic / Missiles / Melee.  R: run/walk.  M: mute.  Esc: close windows.',
  'A: achievements.  L: collection log (pick your pet there).',
  'Click the minimap to walk there. Hover skills for XP details, items for stats. Shift-click items to drop.',
];
import { BRANCHES, PERKS, nextRankCost, perkBlocker } from '../data/skillTree';
import { ContextMenu, MenuOption, describeOptions } from '../ui/ContextMenu';
import { FLOOR_HEIGHT, FLOOR_WIDTH } from '../world/dungeonGen';
import { Tile, tileAt } from '../world/tiles';
import { LONG_PRESS_MS, PANEL_W, type DungeonScene } from './DungeonScene';

const SLOT = 46;
const CHAT_W = 520;
const CHAT_H = 132;
const CHAT_LINES = 7;
const MINIMAP_SCALE = 3;
/** Skills panel: 3 columns so all 17 skills fit. */
const SKILL_COLS = 3;
const SKILL_COL_W = 72;
const SKILL_ROW_H = 17;

const FONT = { fontFamily: 'monospace', fontSize: '13px', color: '#ffff00' };
const PANEL_BG = 0x3e3529;
const PANEL_EDGE = 0x1c1812;

type Tab = 'inventory' | 'prayer' | 'magic' | 'gear';
type ModalKind = 'mentor' | 'toolsmith' | 'merchant' | 'achievements' | 'log' | 'slayer' | 'settings' | 'drops'
  | 'armoury' | 'startRun' | 'enchanter' | 'builder' | 'quests';

/** What the drop-table window is showing. */
export type DropsSubject = { kind: 'npc'; npc: Npc } | { kind: 'chest'; depth: number };

/** "Always", or "1/20 (5%)". */
function formatChance(c: number): string {
  if (c >= 1) return 'Always';
  const pct = c * 100;
  return `1/${Math.round(1 / c)} (${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%)`;
}
const TABS: Array<[Tab, string]> = [['inventory', 'Items'], ['prayer', 'Prayer'], ['magic', 'Magic'], ['gear', 'Gear']];
const TAB_W = 50;
const MAX_TOASTS = 3;

/** Style button labels and what each trains, per weapon type. */
const STYLE_INFO: Record<'melee' | 'ranged' | 'magic', Array<[string, string]>> = {
  melee: [['Accurate', 'Attack'], ['Aggressive', 'Strength'], ['Defensive', 'Defence']],
  ranged: [['Accurate', 'Ranged, +accuracy'], ['Rapid', 'Ranged, attacks faster'], ['Longrange', 'Ranged + Defence, +2 range']],
  magic: [['Autocast', 'Magic'], ['Autocast', 'Magic'], ['Def. cast', 'Magic + Defence']],
};

const SKILL_SHORT: Record<SkillName, string> = {
  attack: 'Atk', strength: 'Str', defence: 'Def', hitpoints: 'HP', ranged: 'Rng', magic: 'Mage', prayer: 'Pray',
  mining: 'Mine', woodcutting: 'WC', fishing: 'Fish', cooking: 'Cook', smithing: 'Smith', herblore: 'Herb',
  fletching: 'Flet', thieving: 'Thie', agility: 'Agil', slayer: 'Slay',
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
  private specBar!: Phaser.GameObjects.Rectangle;
  private specText!: Phaser.GameObjects.Text;
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
  private stairsButton!: Phaser.GameObjects.Text;
  private invGrid = { x: 0, y: 0 };
  /** Inventory drag in progress: from slot, press position, whether it has moved yet. */
  private drag: { from: number; x: number; y: number; moved: boolean } | null = null;
  private dragGhost?: Phaser.GameObjects.Image;
  private hoverDetail!: Phaser.GameObjects.Text;
  private lowHp!: Phaser.GameObjects.Graphics;
  private wasLowHp = false;
  private quickButton!: Phaser.GameObjects.Text;
  private quickSetupButton!: Phaser.GameObjects.Text;
  /** Prayer tab is in "choose quick-prayers" mode. */
  private quickSetup = false;
  private forfeitButton!: Phaser.GameObjects.Text;
  private forfeitConfirm?: Phaser.GameObjects.Container;
  private deathTitle!: Phaser.GameObjects.Text;
  private shiftKey?: Phaser.Input.Keyboard.Key;
  private toolText!: Phaser.GameObjects.Text;
  private modal!: Phaser.GameObjects.Container;
  private relicPanel!: Phaser.GameObjects.Container;
  private relicText!: Phaser.GameObjects.Text;
  private modalKind: ModalKind | null = null;
  private logCategory = LOG_CATEGORIES[0].id;
  private dropsSubject: DropsSubject | null = null;
  private autoplayOverlay?: Phaser.GameObjects.Container;
  /** Enchanter window: which gear line is selected. */
  private enchantLine?: ArmouryLine;
  private achievementTier: Tier = 'easy';
  private taskText!: Phaser.GameObjects.Text;
  /** Toasts currently on screen, and the ones waiting for a free spot. */
  private toasts = 0;
  private toastQueue: Array<{ text: string; color: string }> = [];
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
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.menu.handlePointerMove(p.x, p.y);
      this.updateDrag(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endDrag(p));

    const bus = this.dungeon.bus;
    bus.on('xp', (e: Extract<GameEvent, { type: 'xp' }>) => this.xpDrop(e.skill, e.amount));
    bus.on('levelup', () => this.cameras.main.flash(250, 255, 255, 160));
    bus.on('death', () => this.deathOverlay.setVisible(true));
    bus.on('campMenu', (e: Extract<GameEvent, { type: 'campMenu' }>) => this.openModal(e.kind));
    bus.on('relicChoice', () => this.showRelicChoice());
    bus.on('notice', (n: Notice) => this.toast(n));
    bus.on('autoplay', (a: { target: number; floor: number } | null) => this.updateAutoplayOverlay(a));
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.forfeitConfirm) this.closeForfeitConfirm();
      else this.closeModal();
    });
    this.input.keyboard?.on('keydown-M', () => sfx.toggleMute());
    this.input.keyboard?.on('keydown-A', () => this.toggleModal('achievements'));
    this.input.keyboard?.on('keydown-O', () => this.toggleModal('settings'));
    this.input.keyboard?.on('keydown-Q', () => this.state.toggleQuickPrayers(settings.quickPrayers));
    this.input.keyboard?.on('keydown-E', () => !this.modalKind && this.state.toggleSpec());
    this.input.keyboard?.on('keydown-L', () => this.toggleModal('log'));
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
    return (this.deathOverlay?.visible ?? false) || this.modal?.visible || this.relicPanel?.visible || !!this.forfeitConfirm;
  }

  openMenu(x: number, y: number, options: MenuOption[]): void {
    if (options.length) this.menu.open(x, y, options);
  }

  private build(): void {
    this.menu?.close();
    // Rebuilding destroys every UI object; a dialog left open on resize just closes.
    this.forfeitConfirm = undefined;
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
    this.hoverDetail = this.add.text(0, 6, '', { ...FONT, stroke: '#000000', strokeThickness: 3 });
    root.add(this.hoverDetail);
    // Pulsing red edge when HP is low.
    this.lowHp = this.add.graphics().setDepth(19).setVisible(false);
    this.lowHp.lineStyle(14, 0xff0000, 1).strokeRect(7, 7, W - PANEL_W - 14, H - 14);
    root.add(this.lowHp);
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
    this.quickButton = this.add.text(px + PANEL_W - 10, y - 1, '', {
      ...FONT, fontSize: '11px', backgroundColor: '#2a241c', padding: { x: 5, y: 2 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.quickButton.on('pointerdown', () => this.state.toggleQuickPrayers(settings.quickPrayers));
    this.hoverable(this.quickButton, () => (settings.quickPrayers.length
      ? 'Toggle quick-prayers (Q)' : 'No quick-prayers set: use "Set up" in the Prayer tab'));
    root.add(this.quickButton);
    root.add(this.prayerText);
    y += 18;
    root.add(this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x1a2a4a).setOrigin(0));
    this.prayerBar = this.add.rectangle(px + 10, y, PANEL_W - 20, 8, 0x40a0e0).setOrigin(0);
    root.add(this.prayerBar);
    y += 12;

    // Special attack bar: click (or E) to arm the wielded weapon's special.
    const specBg = this.add.rectangle(px + 10, y, PANEL_W - 20, 13, 0x2a2010).setOrigin(0).setStrokeStyle(1, 0x000000)
      .setInteractive({ useHandCursor: true });
    specBg.on('pointerdown', () => this.state.toggleSpec());
    this.hoverable(specBg, () => {
      const spec = SPEC_BY_WEAPON[this.state.player.equipment.weapon ?? ''];
      return spec ? `Use special attack: ${spec.name} (${spec.cost}%), E` : 'Special attack: wield a special weapon (rare drops)';
    });
    this.specBar = this.add.rectangle(px + 11, y + 1, PANEL_W - 22, 11, 0x40a040).setOrigin(0);
    this.specText = this.add.text(px + PANEL_W / 2, y + 1, '', { ...FONT, fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 0);
    root.add([specBg, this.specBar, this.specText]);
    y += 19;

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
      const sx = px + 10 + (i % SKILL_COLS) * SKILL_COL_W;
      const sy = y + Math.floor(i / SKILL_COLS) * SKILL_ROW_H;
      const text = this.add.text(sx, sy, '', { ...FONT, fontSize: '12px', color: '#ffffff' });
      const track = this.add.rectangle(sx, sy + 14, SKILL_COL_W - 8, 2, 0x1c1812).setOrigin(0);
      const bar = this.add.rectangle(sx, sy + 14, 0, 2, 0x00b000).setOrigin(0);
      const hit = this.add.rectangle(sx, sy, SKILL_COL_W - 8, SKILL_ROW_H - 2, 0, 0).setOrigin(0).setInteractive();
      hit.on('pointerover', () => (this.hoveredSkill = s));
      hit.on('pointerout', () => this.hoveredSkill === s && (this.hoveredSkill = null));
      this.skillViews.set(s, { text, bar });
      root.add([text, track, bar, hit]);
    });
    y += Math.ceil(SKILLS.length / SKILL_COLS) * SKILL_ROW_H + 4;

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
    this.invGrid = { x: gridX, y };
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const sx = gridX + (i % 4) * SLOT;
      const sy = y + Math.floor(i / 4) * SLOT;
      const bg = this.add.rectangle(sx, sy, SLOT - 2, SLOT - 2, 0x2a241c).setOrigin(0).setInteractive();
      const icon = this.add.image(sx + SLOT / 2 - 1, sy + 18, 'item_coins');
      const label = this.add.text(sx + SLOT / 2 - 1, sy + SLOT - 3, '', {
        ...FONT, fontSize: '8px', color: '#ffffff', align: 'center', wordWrap: { width: SLOT - 4 }, lineSpacing: -2,
      }).setOrigin(0.5, 1);
      const qty = this.add.text(sx + 3, sy + 2, '', { ...FONT, fontSize: '11px' });
      // Right-click opens the menu at once; left-click acts on release so you can drag instead.
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.rightButtonDown()) this.onPanelClick(p, this.inventoryOptions(i));
        else if (this.state.player.inventory.slots[i]) {
          this.drag = { from: i, x: p.x, y: p.y, moved: false };
          // Touch: holding a slot opens its menu instead.
          if (p.wasTouch) {
            window.setTimeout(() => {
              if (this.drag?.from !== i || this.drag.moved) return;
              this.drag = null;
              this.openMenu(p.x, p.y, this.inventoryOptions(i));
            }, LONG_PRESS_MS);
          }
        }
      });
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
    const footerButton = (x: number, label: string, kind: 'achievements' | 'log') => {
      const b = this.add.text(x, H - 17, label, { ...FONT, fontSize: '10px', color: '#ffd040' }).setOrigin(0, 1)
        .setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this.toggleModal(kind));
      this.hoverable(b, () => `Open ${label.slice(1, -1)} (${kind === 'log' ? 'L' : 'A'})`);
      root.add(b);
    };
    footerButton(px + 8, '[Achievements]', 'achievements');
    footerButton(px + 110, '[Collection log]', 'log');
    const settingsButton = this.add.text(px + 110, H - 4, '[Settings]', { ...FONT, fontSize: '10px', color: '#ffd040' })
      .setOrigin(0, 1).setInteractive({ useHandCursor: true });
    settingsButton.on('pointerdown', () => this.toggleModal('settings'));
    this.hoverable(settingsButton, () => 'Open settings (O)');
    root.add(settingsButton);
    this.forfeitButton = this.add.text(px + 8, H - 4, '[Forfeit run]', { ...FONT, fontSize: '10px', color: '#d06060' })
      .setOrigin(0, 1).setInteractive({ useHandCursor: true });
    this.forfeitButton.on('pointerdown', () => this.showForfeitConfirm());
    this.hoverable(this.forfeitButton, () => 'End this run now and bank your tokens');
    root.add(this.forfeitButton);
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
    this.stairsButton = this.add.text(this.minimapRect.right, this.minimapRect.bottom + 4, '[G] Go to stairs', {
      ...FONT, fontSize: '11px', color: '#ffd040', backgroundColor: '#2a241ccc', padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setVisible(false);
    this.stairsButton.on('pointerdown', () => this.dungeon.goToStairs());
    this.hoverable(this.stairsButton, () => 'Walk to the stairs (G)');
    root.add([mmBg, this.minimap, this.stairsButton]);
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
    this.deathTitle = title;
    const stats = this.add.text(gameW / 2, H / 2 + 10, '', { ...FONT, fontSize: '14px', color: '#ffffff', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    title.setY(H / 2 - 170);
    const back = this.add.text(gameW / 2, H / 2 + 170, '[ Return to camp ]', {
      ...FONT, fontSize: '18px', backgroundColor: '#2a241c', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.dungeon.toCamp());
    this.deathOverlay = this.add.container(0, 0, [dim, title, stats, back]).setDepth(20).setVisible(this.state?.over ?? false);
    this.deathOverlay.setData('stats', stats);
    root.add(this.deathOverlay);

    // ---- Relics owned (under the hover text) and the relic choice window ----
    this.relicText = this.add.text(8, 24, '', { ...FONT, fontSize: '11px', color: '#ffd040', stroke: '#000000', strokeThickness: 3 });
    this.taskText = this.add.text(8, 40, '', { ...FONT, fontSize: '11px', color: '#ff9a9a', stroke: '#000000', strokeThickness: 3 });
    root.add(this.taskText);
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
    return !!this.modalKind || !!this.forfeitConfirm;
  }

  /** Confirmation before forfeiting, so a stray click can't end a run. Pauses the game. */
  private showForfeitConfirm(): void {
    const g = this.state;
    if (g.over || g.isCamp) return;
    this.forfeitConfirm?.destroy(true);
    const W = this.panelX;
    const H = this.scale.height;
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive();
    const box = this.add.rectangle(W / 2, H / 2, 420, 170, 0x2e271e).setStrokeStyle(2, 0xd06060);
    const title = this.add.text(W / 2, H / 2 - 52, 'Forfeit this run?', { ...FONT, fontSize: '20px', color: '#ff6060' }).setOrigin(0.5);
    const info = this.add.text(W / 2, H / 2 - 12, `You'll bank ${g.tokensEarned} Dungeoneering tokens,\nthe same as dying here.`, {
      ...FONT, color: '#ffffff', align: 'center',
    }).setOrigin(0.5);
    const button = (x: number, label: string, color: string, onClick: () => void) => {
      const b = this.add.text(x, H / 2 + 45, label, { ...FONT, fontSize: '15px', color, backgroundColor: '#3e3529', padding: { x: 12, y: 6 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
      b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
      b.on('pointerdown', onClick);
      return b;
    };
    const close = () => this.closeForfeitConfirm();
    const yes = button(W / 2 - 80, 'Forfeit', '#ff6060', () => {
      close();
      this.state.forfeit();
    });
    const no = button(W / 2 + 80, 'Keep playing', '#ffffff', close);
    this.forfeitConfirm = this.add.container(0, 0, [dim, box, title, info, yes, no]).setDepth(40);
    this.root.add(this.forfeitConfirm);
  }

  private closeForfeitConfirm(): void {
    this.forfeitConfirm?.destroy(true);
    this.forfeitConfirm = undefined;
  }

  openModal(kind: ModalKind): void {
    this.modalKind = kind;
    this.modal.removeAll(true);
    this.modal.setVisible(true);
    const W = this.panelX;
    const H = this.scale.height;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.modal.add(o), o);
    add(this.add.rectangle(0, 0, W, H, 0x0c0a08, 0.94).setOrigin(0).setInteractive());
    const title = {
      mentor: 'Mentor: Skill Tree', toolsmith: 'Toolsmith', merchant: 'Wandering Merchant',
      achievements: 'Achievements', log: 'Collection Log', slayer: 'Slayer master', settings: 'Settings',
      armoury: 'Armourer: starting gear', startRun: 'Enter the dungeon', enchanter: 'Enchanter', builder: 'Builder: camp structures', quests: 'Quest board',
      drops: this.dropsSubject?.kind === 'npc' ? `${this.dropsSubject.npc.name}: drops` : `Chest: possible loot (floor ${this.dropsSubject?.depth})`,
    }[kind];
    add(this.add.text(W / 2, 24, title, { ...FONT, fontSize: '22px', color: '#ff981f' }).setOrigin(0.5, 0));
    const meta = this.dungeon.meta;
    const currency = {
      merchant: `Coins: ${this.state.player.inventory.count('coins').toLocaleString()}   (the game is paused)`,
      achievements: `Completed ${meta.achievements.length} / ${ACHIEVEMENTS.length}   Tokens earned: ${meta.achievements
        .reduce((n, id) => n + tierOf(ACHIEVEMENT_BY_ID[id]).reward, 0)}`,
      log: `Unique items: ${ALL_LOG_SLOTS.filter((id) => meta.collection[id]).length} / ${ALL_LOG_SLOTS.length}`,
      mentor: `Dungeoneering tokens: ${meta.tokens}`,
      toolsmith: `Dungeoneering tokens: ${meta.tokens}`,
      slayer: `Dungeoneering tokens: ${meta.tokens}   Tasks completed: ${meta.lifetime.tasks ?? 0}`,
      settings: 'Saved in this browser',
      armoury: `Dungeoneering tokens: ${meta.tokens}`,
      enchanter: `Dungeoneering tokens: ${meta.tokens}`,
      builder: `Tokens: ${meta.tokens}   Timber: ${meta.materials.timber}   Metal: ${meta.materials.metal}`,
      quests: `Quests complete: ${meta.questsDone.length}/${QUESTS.length}`,
      startRun: `Best floor: ${meta.bestDepth}   Deepest boss beaten: ${meta.deepestBoss ? `floor ${meta.deepestBoss}` : 'none yet'}`,
      drops: this.dropsSubject?.kind === 'npc' ? this.dropsSubject.npc.def.examine : 'Opening it gives coins plus one or two bonus items.',
    }[kind];
    add(this.add.text(W / 2, 54, currency, { ...FONT, fontSize: '16px' }).setOrigin(0.5, 0));
    const close = add(this.add.text(W - 16, 16, '[ X ]', { ...FONT, fontSize: '16px', color: '#ff6060' }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }));
    close.on('pointerdown', () => this.closeModal());
    if (kind === 'mentor') this.buildSkillTree(add);
    else if (kind === 'merchant') this.buildMerchant(add);
    else if (kind === 'achievements') this.buildAchievements(add);
    else if (kind === 'log') this.buildCollectionLog(add);
    else if (kind === 'slayer') this.buildSlayer(add);
    else if (kind === 'settings') this.buildSettings(add);
    else if (kind === 'drops') this.buildDrops(add);
    else if (kind === 'armoury') this.buildArmoury(add);
    else if (kind === 'enchanter') this.buildEnchanter(add);
    else if (kind === 'builder') this.buildBuilder(add);
    else if (kind === 'quests') this.buildQuests(add);
    else if (kind === 'startRun') this.buildStartRun(add);
    else this.buildToolsmith(add);
  }

  /** Hotkeys toggle these windows; they never replace a shop or relic choice in progress. */
  private toggleModal(kind: 'achievements' | 'log' | 'settings'): void {
    if (this.modalKind === kind) this.closeModal();
    else if (!this.modalKind || ['achievements', 'log', 'settings'].includes(this.modalKind)) this.openModal(kind);
  }

  /** One tier at a time (tabs), two columns of achievements with progress bars for counter goals. */
  private buildAchievements(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const meta = this.dungeon.meta;
    const W = this.panelX;
    TIERS.forEach((tier, i) => {
      const list = ACHIEVEMENTS.filter((a) => a.tier === tier.id);
      const done = list.filter((a) => meta.achievements.includes(a.id)).length;
      const selected = this.achievementTier === tier.id;
      const tab = add(this.add.text(W / 2 + (i - 1.5) * 170, 84, `${tier.name} ${done}/${list.length}`, {
        ...FONT, fontSize: '13px', color: Phaser.Display.Color.IntegerToColor(tier.color).rgba,
        backgroundColor: selected ? '#5d5447' : '#2a241c', padding: { x: 8, y: 4 }, fixedWidth: 160, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }));
      tab.on('pointerdown', () => {
        this.achievementTier = tier.id;
        this.openModal('achievements');
      });
    });
    const tier = TIERS.find((t) => t.id === this.achievementTier)!;
    add(this.add.text(W / 2, 114, `${tier.reward} Dungeoneering tokens each`, { ...FONT, fontSize: '12px', color: '#c8c8c8' }).setOrigin(0.5, 0));

    const list = ACHIEVEMENTS.filter((a) => a.tier === tier.id);
    const colW = Math.min(480, (W - 50) / 2);
    const rowH = 30;
    const perCol = Math.ceil(list.length / 2);
    list.forEach((a, i) => {
      const x = W / 2 + (i < perCol ? -colW - 8 : 8);
      const y = 140 + (i % perCol) * rowH;
      const complete = meta.achievements.includes(a.id);
      add(this.add.rectangle(x, y, colW, rowH - 3, complete ? 0x2a3a22 : 0x2a241c).setOrigin(0));
      add(this.add.text(x + 6, y + 2, `${complete ? '[x]' : '[ ]'} ${a.name}`, {
        ...FONT, fontSize: '12px', color: complete ? '#80ff80' : '#ffffff',
      }));
      add(this.add.text(x + 6, y + 15, a.desc, { ...FONT, fontSize: '10px', color: '#b8b0a0' }));
      const prog = this.dungeon.achievementProgress(a);
      if (prog && !complete) {
        const [cur, target] = prog;
        add(this.add.rectangle(x + colW - 86, y + 10, 80, 6, 0x1c1812).setOrigin(0));
        add(this.add.rectangle(x + colW - 86, y + 10, 80 * (cur / target), 6, tier.color).setOrigin(0));
        add(this.add.text(x + colW - 90, y + 7, `${cur}/${target}`, { ...FONT, fontSize: '10px', color: '#c8c8c8' }).setOrigin(1, 0));
      }
    });
  }

  /** Armourer: buy the next tier per gear line, and choose which weapon style to start wielding. */
  private buildArmoury(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const meta = d.meta;
    const W = this.panelX;
    const x0 = W / 2 - 330;
    add(this.add.text(W / 2, 88, 'Gear you buy is yours at the start of every run. Anything above your level\n'
      + 'starts in your pack, and you are told when you can wield it.', {
      ...FONT, fontSize: '12px', color: '#c8c8c8', align: 'center',
    }).setOrigin(0.5, 0));
    let y = 130;
    for (const line of ARMOURY_LINES) {
      const { name, tiers } = ARMOURY[line];
      const rank = meta.armoury[line];
      const current = rank ? tiers[rank - 1].label : 'nothing';
      const next = nextArmouryTier(meta.armoury, line);
      add(this.add.text(x0, y + 4, `${name.padEnd(14)} ${rank}/${tiers.length}`, { ...FONT, fontSize: '13px', color: '#ff981f' }));
      add(this.add.text(x0 + 170, y + 4, `Have: ${current}`, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      if (next) {
        const affordable = meta.tokens >= next.cost;
        const b = add(this.add.text(x0 + 660, y, `Buy ${next.label} (${next.cost})`, {
          ...FONT, fontSize: '12px', color: affordable ? '#ffffff' : '#7a7a7a',
          backgroundColor: affordable ? '#3e3529' : '#241f18', padding: { x: 8, y: 4 },
        }).setOrigin(1, 0));
        if (affordable) {
          b.setInteractive({ useHandCursor: true });
          b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
          b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
          b.on('pointerdown', () => d.buyArmoury(line) && this.openModal('armoury'));
        }
      } else {
        add(this.add.text(x0 + 660, y + 4, 'Maxed', { ...FONT, fontSize: '12px', color: '#60ff60' }).setOrigin(1, 0));
      }
      y += 36;
    }
    y += 10;
    add(this.add.text(x0, y + 4, 'Start wielding:', { ...FONT, fontSize: '13px', color: '#ff981f' }));
    (['melee', 'ranged', 'magic'] as StartStyle[]).forEach((style, i) => {
      const on = meta.startStyle === style;
      const b = add(this.add.text(x0 + 170 + i * 110, y, style[0].toUpperCase() + style.slice(1), {
        ...FONT, fontSize: '13px', color: on ? '#ffffff' : '#a08a5a', backgroundColor: on ? '#5d5447' : '#2a241c',
        padding: { x: 12, y: 4 },
      }).setInteractive({ useHandCursor: true }));
      b.on('pointerdown', () => {
        d.setStartStyle(style);
        this.openModal('armoury');
      });
    });
    add(this.add.text(x0, y + 32, 'Your other bought weapons start in your pack, so you can switch mid-run.', {
      ...FONT, fontSize: '11px', color: '#c8c8c8',
    }));
  }

  /** Enchanter: one enchantment per Armourer line, ranks I-III; pick a line, then an enchantment. */
  private buildEnchanter(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const meta = d.meta;
    const W = this.panelX;
    const x0 = W / 2 - 340;
    const owned = ARMOURY_LINES.filter((l) => meta.armoury[l] > 0);
    add(this.add.text(W / 2, 86, `Enchantments last forever and follow the line as you upgrade it. Upgrades: ${ENCHANT_COSTS.join(' / ')} tokens.\n`
      + `Switching to a different enchantment costs ${ENCHANT_SWITCH_FEE} extra and starts again at rank I.`, {
      ...FONT, fontSize: '11px', color: '#c8c8c8', align: 'center',
    }).setOrigin(0.5, 0));
    if (!owned.length) {
      add(this.add.text(W / 2, 160, 'Buy some gear from the Armourer first.', { ...FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0));
      return;
    }
    if (!this.enchantLine || !owned.includes(this.enchantLine)) this.enchantLine = owned[0];
    const line = this.enchantLine;
    // Line tabs.
    owned.forEach((l, i) => {
      const on = l === line;
      const b = add(this.add.text(x0 + i * 136, 124, ARMOURY[l].name, {
        ...FONT, fontSize: '12px', color: on ? '#ffffff' : '#a08a5a', backgroundColor: on ? '#5d5447' : '#2a241c',
        padding: { x: 6, y: 4 }, fixedWidth: 128, align: 'center',
      }).setInteractive({ useHandCursor: true }));
      b.on('pointerdown', () => {
        this.enchantLine = l;
        this.openModal('enchanter');
      });
    });
    const current = meta.enchants[line];
    const piece = ARMOURY[line].tiers[meta.armoury[line] - 1].label;
    add(this.add.text(x0, 160, `${piece}: ${current ? describeEnchant(current) : 'not enchanted'}`, {
      ...FONT, fontSize: '13px', color: current ? '#60ff60' : '#ffffff',
    }));
    let y = 192;
    for (const ench of ENCHANTS.filter((e) => e.kind === lineKind(line))) {
      const mine = current?.id === ench.id;
      const rank = mine ? current.rank : 0;
      const nextV = ench.values[Math.min(2, rank)];
      add(this.add.text(x0, y + 4, `${ench.name}${rank ? ` ${ROMAN[rank]}` : ''}`, { ...FONT, fontSize: '13px', color: '#ff981f' }));
      add(this.add.text(x0 + 130, y + 4, rank >= 3 ? ench.describe(ench.values[2]) : `${rank ? 'Next: ' : ''}${ench.describe(nextV)}`, {
        ...FONT, fontSize: '12px', color: '#ffffff',
      }));
      const cost = enchantCost(current, ench.id);
      if (cost === null) {
        add(this.add.text(x0 + 680, y + 4, 'Maxed', { ...FONT, fontSize: '12px', color: '#60ff60' }).setOrigin(1, 0));
      } else {
        const ok = meta.tokens >= cost;
        const verb = mine ? `Upgrade to ${ROMAN[rank + 1]}` : current ? 'Switch' : 'Enchant';
        const b = add(this.add.text(x0 + 680, y, `${verb} (${cost})`, {
          ...FONT, fontSize: '12px', color: ok ? '#ffffff' : '#7a7a7a', backgroundColor: ok ? '#3e3529' : '#241f18', padding: { x: 8, y: 4 },
        }).setOrigin(1, 0));
        if (ok) {
          b.setInteractive({ useHandCursor: true });
          b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
          b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
          b.on('pointerdown', () => d.enchant(line, ench.id) && this.openModal('enchanter'));
        }
      }
      y += 34;
    }
  }

  /** Quest board: every posted quest with its giver, progress and reward; claim finished ones. */
  private buildQuests(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const m = d.meta;
    const x0 = this.panelX / 2 - 340;
    let y = 92;
    const posted = QUESTS.filter((q) => isQuestPosted(q, m));
    for (const q of posted) {
      const done = m.questsDone.includes(q.id);
      const [have, need] = questProgress(q, m);
      const relicName = q.reward.relic ? RELIC_BY_ID[q.reward.relic].name : undefined;
      add(this.add.text(x0, y, `${q.name}`, { ...FONT, fontSize: '13px', color: done ? '#60ff60' : '#ff981f' }));
      add(this.add.text(x0 + 200, y + 1, `${q.giver}: ${q.desc}`, { ...FONT, fontSize: '11px', color: done ? '#8a8a8a' : '#ffffff' }));
      add(this.add.text(x0 + 200, y + 15, `Reward: ${describeReward(q.reward, relicName)}`, { ...FONT, fontSize: '11px', color: '#c8c8c8' }));
      if (done) {
        add(this.add.text(x0 + 680, y + 4, 'Done', { ...FONT, fontSize: '11px', color: '#60ff60' }).setOrigin(1, 0));
      } else if (have >= need) {
        const b = add(this.add.text(x0 + 680, y + 1, 'Claim reward', {
          ...FONT, fontSize: '12px', color: '#000000', backgroundColor: '#ffd040', padding: { x: 8, y: 4 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true }));
        b.on('pointerdown', () => d.claimQuestReward(q.id) && this.openModal('quests'));
      } else {
        add(this.add.text(x0 + 680, y + 4, `${have}/${need}`, { ...FONT, fontSize: '12px', color: '#ffff00' }).setOrigin(1, 0));
      }
      y += 36;
    }
    const hidden = QUESTS.length - posted.length;
    if (hidden) add(this.add.text(x0, y + 4, `${hidden} more quest${hidden > 1 ? 's' : ''} will be posted as new folk arrive at camp.`, { ...FONT, fontSize: '11px', color: '#8a8a8a' }));
  }

  /** Builder: build and upgrade camp structures; also where you set the altar's relic and see the bank and pet. */
  private buildBuilder(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const m = d.meta;
    const W = this.panelX;
    const x0 = W / 2 - 340;
    add(this.add.text(W / 2, 84, 'Materials come from the logs, ores and bars you are carrying when a run ends.', {
      ...FONT, fontSize: '11px', color: '#c8c8c8',
    }).setOrigin(0.5, 0));
    let y = 106;
    const small = { ...FONT, fontSize: '11px', color: '#c8c8c8' };
    for (const s of STRUCTURES) {
      const level = m.structures[s.id] ?? 0;
      const next = nextStructureLevel(m.structures, s.id);
      // Row: name and build button, then what it does now, then details.
      add(this.add.text(x0, y + 2, `${s.name}  ${level}/${s.levels.length}`, { ...FONT, fontSize: '13px', color: level ? '#ff981f' : '#a08a5a' }));
      if (next) {
        const ok = m.tokens >= next.tokens && m.materials.timber >= next.timber && m.materials.metal >= next.metal;
        const cost = [`${next.tokens} tokens`, next.timber ? `${next.timber} timber` : '', next.metal ? `${next.metal} metal` : ''].filter(Boolean).join(', ');
        const b = add(this.add.text(x0 + 680, y, `${level ? 'Upgrade' : 'Build'} (${cost})`, {
          ...FONT, fontSize: '11px', color: ok ? '#ffffff' : '#7a7a7a', backgroundColor: ok ? '#3e3529' : '#241f18', padding: { x: 6, y: 3 },
        }).setOrigin(1, 0));
        this.hoverable(b, () => `Next level: ${next.effect}`);
        if (ok) {
          b.setInteractive({ useHandCursor: true });
          b.on('pointerdown', () => d.build(s.id) && this.openModal('builder'));
        }
      } else {
        add(this.add.text(x0 + 680, y + 2, 'Maxed', { ...FONT, fontSize: '11px', color: '#60ff60' }).setOrigin(1, 0));
      }
      add(this.add.text(x0 + 16, y + 19, level ? s.levels[level - 1].effect : `Not built. First level: ${s.levels[0].effect}`, {
        ...FONT, fontSize: '11px', color: level ? '#ffffff' : '#8a8a8a',
      }));
      let detail = '';
      if (s.id === 'bank_chest' && level) {
        detail = m.bank.length ? `Kept for your next run: ${m.bank.map((b) => `${b.qty > 1 ? `${b.qty} x ` : ''}${item(b.id).name}`).join(', ')}` : 'Nothing kept yet.';
      }
      if (s.id === 'trophy_room' && level) {
        const bosses = Object.values(NPCS).filter((n) => n.boss && (m.killCounts[n.id] ?? 0) > 0).length;
        const mounted = Math.min(bosses, TROPHY_MOUNTS[level]);
        detail = `Bosses defeated: ${bosses}. Trophies mounted: ${mounted} (+${Math.round(mounted * TROPHY_BONUS * 100)}% max hit).`;
      }
      if (s.id === 'pet_kennel') {
        const pet = m.activePet ? PET_BUFFS[m.activePet] : undefined;
        const floors = m.activePet ? m.petFloors[m.activePet] ?? 0 : 0;
        detail = !m.activePet ? 'No pet following you (pick one in the Collection log).'
          : !pet ? 'Your pet has no bonus.'
            : `${PET_BY_ID[m.activePet].name}: level ${petLevel(floors)}/${PET_MAX_LEVEL}${level ? `, +${Math.round(petBonus(floors, level) * 100)}% ${pet.label}` : ` (build the kennel for +${petLevel(floors)}% ${pet.label})`}`;
      }
      if (s.id === 'relic_altar' && level) {
        const relic = m.startRelic ? RELIC_BY_ID[m.startRelic] : null;
        detail = m.relicsFound.length ? `Starting relic: ${relic ? `${relic.name}: ${relic.desc}` : 'none'}`
          : 'Pick a relic in a run first; every relic you find can be chosen here.';
        if (m.relicsFound.length) {
          const c = add(this.add.text(x0 + 680, y + 33, '[Change relic]', { ...FONT, fontSize: '11px', color: '#ffff00' }).setOrigin(1, 0)
            .setInteractive({ useHandCursor: true }));
          c.on('pointerdown', () => {
            d.cycleStartRelic();
            this.openModal('builder');
          });
        }
      }
      if (detail) add(this.add.text(x0 + 16, y + 33, detail, small));
      y += 54;
    }
  }

  /** Taking the ladder: floor 1, skip past a beaten boss, or autoplay to your best floor. */
  private buildStartRun(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const W = this.panelX;
    let y = 100;
    for (const opt of this.dungeon.runStartOptions()) {
      const b = add(this.add.text(W / 2, y, opt.label, {
        ...FONT, fontSize: '16px', color: '#ffffff', backgroundColor: '#3e3529', padding: { x: 14, y: 6 }, fixedWidth: 360, align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }));
      b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
      b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
      b.on('pointerdown', () => {
        this.closeModal();
        opt.start();
      });
      add(this.add.text(W / 2, y + 34, opt.detail, { ...FONT, fontSize: '11px', color: '#c8c8c8', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5, 0));
      y += 76;
    }
  }

  /** Autoplay: "fast-forwarding" banner with a button to take control early. */
  private updateAutoplayOverlay(a: { target: number; floor: number } | null): void {
    this.autoplayOverlay?.destroy(true);
    this.autoplayOverlay = undefined;
    if (!a) return;
    const W = this.panelX;
    const H = this.scale.height;
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive();
    const text = this.add.text(W / 2, H / 2 - 30, `Autoplaying... floor ${this.state.depth} of ${a.target}`, {
      ...FONT, fontSize: '22px', color: '#ff981f',
    }).setOrigin(0.5);
    const sub = this.add.text(W / 2, H / 2 + 5, `Combat ${this.state.player.combatLevel}   HP ${this.state.player.hp}/${this.state.player.maxHp}   Kills ${this.state.kills}`, {
      ...FONT, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);
    const take = this.add.text(W / 2, H / 2 + 50, '[ Take control now ]', {
      ...FONT, fontSize: '16px', backgroundColor: '#3e3529', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    take.on('pointerdown', () => this.dungeon.finishAutoplay());
    this.autoplayOverlay = this.add.container(0, 0, [dim, text, sub, take]).setDepth(38);
    this.root.add(this.autoplayOverlay);
  }

  /** Examine: a monster's stats and drop table, or a chest's loot table, with live chances. */
  openDrops(subject: DropsSubject): void {
    this.dropsSubject = subject;
    this.openModal('drops');
  }

  private buildDrops(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const subject = this.dropsSubject;
    if (!subject) return;
    const g = this.state;
    const meta = this.dungeon.meta;
    const W = this.panelX;
    const x0 = W / 2 - 300;
    let y = 90;
    const info = (text: string, color = '#c8c8c8') => {
      add(this.add.text(W / 2, y, text, { ...FONT, fontSize: '13px', color, align: 'center' }).setOrigin(0.5, 0));
      y += 20;
    };
    const header = () => {
      y += 6;
      for (const [label, x] of [['Item', 40], ['Quantity', 330], ['Chance', 440]] as const) {
        add(this.add.text(x0 + x, y, label, { ...FONT, fontSize: '12px', color: '#ff981f' }));
      }
      y += 20;
    };
    const row = (icon: { key: string; tint?: number; scale?: number }, name: string, qty: string, chance: string, note = '') => {
      add(this.add.rectangle(x0, y - 2, 600, 28, 0x2a241c).setOrigin(0));
      const img = add(this.add.image(x0 + 18, y + 12, icon.key).setScale(icon.scale ?? 0.75));
      if (icon.tint !== undefined) img.setTint(icon.tint);
      add(this.add.text(x0 + 40, y + 5, name, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      add(this.add.text(x0 + 330, y + 5, qty, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      add(this.add.text(x0 + 440, y + 5, chance, { ...FONT, fontSize: '12px', color: '#ffff00' }));
      if (note) add(this.add.text(x0 + 594, y + 5, note, { ...FONT, fontSize: '10px', color: note === 'logged' ? '#60ff60' : '#80d0ff' }).setOrigin(1, 0));
      y += 30;
    };
    /** Collection-log status for an item: logged, not yet logged, or not a log item. */
    const logNote = (id: string) => (ALL_LOG_SLOTS.includes(id) ? (meta.collection[id] ? 'logged' : 'new log slot') : '');
    const range = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : `${lo}-${hi}`);

    if (subject.kind === 'npc') {
      const { npc } = subject;
      const d = npc.def;
      const style = npc.isBoss ? d.boss!.styles.join(' / ') : npc.attackStyle;
      info(`Level ${npc.level}   HP ${npc.maxHp}   Attacks: ${style}${npc.attackRange > 1 ? ` (range ${npc.attackRange})` : ''}`
        + `${d.weakness ? `   Weak to ${d.weakness}` : ''}`, '#ffffff');
      info(`You have killed ${meta.killCounts[d.id] ?? 0}.   Chances include your current perks and relics.`);
      if (npc.elite) info(`ELITE (${npc.elite.name}): ${npc.elite.desc} Rolls its drop table twice.`, '#ffc040');
      header();
      for (const drop of d.drops) {
        const chance = g.dropChance(drop);
        const base = chance !== drop.chance ? `  (base ${formatChance(drop.chance)})` : '';
        row(ensureItemTexture(this, drop.item), item(drop.item).name, range(g.dropQuantity(drop)), formatChance(chance) + base, logNote(drop.item));
      }
      if (!npc.isBoss && d.id !== 'mimic') {
        row(ensureItemTexture(this, herbForDepth(g.depth, () => 0)), 'Random herb (for this depth)', '1',
          npc.elite ? 'Always' : formatChance(HERB_DROP_CHANCE));
      }
      const pet = npc.isBoss ? petForBoss(d.id) : undefined;
      if (pet) row({ key: npcSprite(d.id), scale: 0.6 }, `${pet.name} (pet)`, '1', formatChance(PET_CHANCE), meta.pets.includes(pet.id) ? 'logged' : 'new log slot');
      return;
    }

    const depth = subject.depth;
    info(`Coins: ${range(chestCoins(depth))} (always)   Bonus items: 1 (${Math.round((1 - CHEST_SECOND_PICK) * 100)}%) or 2 (${Math.round(CHEST_SECOND_PICK * 100)}%)`, '#ffffff');
    info('Armour and weapons are one metal tier better 30% of the time.');
    if (depth >= 3) info(`Careful: ${Math.round(MIMIC_CHANCE * 100)}% of chests from floor 3 are Mimics.`, '#ff8080');
    header();
    for (const e of CHEST_TABLE) {
      if (e.label === 'Armour or weapon') {
        const metal = metalForDepth(depth);
        row(ensureItemTexture(this, `${metal}_scimitar`), `${metal[0].toUpperCase()}${metal.slice(1)} scimitar/kiteshield/platebody`,
          '1', `${formatChance(e.chance)} per item`);
      } else {
        const id = e.item(depth);
        row(ensureItemTexture(this, id), item(id).name, range(e.qty), `${formatChance(e.chance)} per item`);
      }
    }
  }

  /** Sound, gameplay toggles, zoom and the full keybind list. */
  private buildSettings(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const W = this.panelX;
    const x0 = W / 2 - 260;
    let y = 96;
    const heading = (text: string) => {
      add(this.add.text(x0, y, text, { ...FONT, fontSize: '14px', color: '#ff981f' }));
      y += 24;
    };
    const button = (x: number, text: string, onClick: () => void) => {
      const b = add(this.add.text(x, y, text, {
        ...FONT, fontSize: '12px', color: '#ffffff', backgroundColor: '#3e3529', padding: { x: 6, y: 2 },
      }).setInteractive({ useHandCursor: true }));
      b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
      b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
      b.on('pointerdown', () => {
        onClick();
        saveSettings();
        this.openModal('settings');
      });
      return b;
    };
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      add(this.add.text(x0 + 10, y + 2, label, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      button(x0 + 260, get() ? 'On ' : 'Off', () => set(!get())).setColor(get() ? '#60ff60' : '#ff8080');
      y += 24;
    };
    const stepper = (label: string, value: string, dec: () => void, inc: () => void) => {
      add(this.add.text(x0 + 10, y + 2, label, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      button(x0 + 260, '-', dec);
      add(this.add.text(x0 + 290, y + 2, value, { ...FONT, fontSize: '12px', color: '#ffffff' }));
      button(x0 + 340, '+', inc);
      y += 24;
    };

    heading('Sound');
    stepper('Volume', `${Math.round(settings.volume * 100)}%`, () => sfx.setVolume(settings.volume - 0.1), () => sfx.setVolume(settings.volume + 0.1));
    toggle('Sound effects', () => !settings.muted, () => sfx.toggleMute());
    heading('Gameplay');
    toggle('Run by default', () => settings.run, (v) => this.dungeon.setRunning(v));
    toggle('Low-HP warning', () => settings.lowHpWarning, (v) => (settings.lowHpWarning = v));
    toggle('Ground item labels', () => settings.groundLabels, (v) => (settings.groundLabels = v));
    toggle('Unlock toasts', () => settings.showToasts, (v) => (settings.showToasts = v));
    toggle('Offer autoplay at the ladder', () => settings.allowAutoplay, (v) => (settings.allowAutoplay = v));
    toggle('Auto-pickup coins', () => settings.autoPickup.coins, (v) => (settings.autoPickup.coins = v));
    toggle('Auto-pickup arrows', () => settings.autoPickup.arrows, (v) => (settings.autoPickup.arrows = v));
    toggle('Auto-pickup runes', () => settings.autoPickup.runes, (v) => (settings.autoPickup.runes = v));
    heading('View');
    stepper('Zoom (or mouse wheel)', `${Math.round(settings.zoom * 100)}%`, () => this.dungeon.setZoom(settings.zoom - 0.25), () => this.dungeon.setZoom(settings.zoom + 0.25));

    add(this.add.text(x0 + 400, 96, [
      'Keys',
      'Left-click   walk / attack / use',
      'Right-click  all options',
      '  (touch: tap / long-press)',
      'Shift+click  drop item',
      'Drag item    move slot',
      'Wheel        zoom',
      '1 2 3        protect prayers',
      'Q            quick-prayers',
      'E            special attack',
      'R            run / walk',
      'G            go to stairs',
      'A / L        achievements / log',
      'O            settings',
      'M            mute',
      'H            help in chat',
      'Esc          close windows',
    ].join('\n'), { ...FONT, fontSize: '12px', color: '#c8c8c8', lineSpacing: 4 }));
  }

  /** Slayer master: your task, and getting or skipping one. */
  private buildSlayer(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const d = this.dungeon;
    const W = this.panelX;
    const task = d.meta.slayerTask;
    const lines = task
      ? [
        `Your task: ${SLAYER_BY_ID[task.category].name}`,
        `${task.remaining} of ${task.total} left to kill.`,
        `Reward on completion: ${SLAYER_BY_ID[task.category].tokensPerKill * task.total} tokens, plus Slayer XP per kill.`,
        `Monsters: ${SLAYER_BY_ID[task.category].npcIds.map((id) => NPCS[id]?.name ?? id).join(', ')}`,
      ]
      : ["You don't have a Slayer task. Want one?"];
    lines.push('', 'Tasks carry across runs until they are done.',
      'On task, your Slayer level boosts accuracy and max hit (+0.5% per level).');
    add(this.add.text(W / 2, 110, lines.join('\n'), { ...FONT, fontSize: '14px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    const button = (x: number, label: string, enabled: boolean, onClick: () => void) => {
      const b = add(this.add.text(x, 330, label, {
        ...FONT, fontSize: '15px', color: enabled ? '#ffffff' : '#7a7a7a', backgroundColor: enabled ? '#3e3529' : '#241f18', padding: { x: 12, y: 6 },
      }).setOrigin(0.5));
      if (!enabled) return;
      b.setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setBackgroundColor('#5d5447'));
      b.on('pointerout', () => b.setBackgroundColor('#3e3529'));
      b.on('pointerdown', () => {
        onClick();
        this.openModal('slayer');
      });
    };
    if (!task) button(W / 2, 'Get a task', true, () => d.getSlayerTask());
    else button(W / 2, `Skip task (${SKIP_TASK_COST} tokens)`, d.meta.tokens >= SKIP_TASK_COST, () => d.skipSlayerTask());
  }

  /** Category list on the left, that page's slots on the right (dim = not yet obtained). */
  private buildCollectionLog(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const meta = this.dungeon.meta;
    const W = this.panelX;
    const listX = Math.max(16, W / 2 - 380);
    LOG_CATEGORIES.forEach((cat, i) => {
      const got = cat.slots.filter((id) => meta.collection[id]).length;
      const selected = cat.id === this.logCategory;
      const row = add(this.add.text(listX, 90 + i * 26, `${cat.name.padEnd(18)} ${got}/${cat.slots.length}`, {
        ...FONT, fontSize: '12px', color: got === cat.slots.length ? '#80ff80' : '#ffffff',
        backgroundColor: selected ? '#5d5447' : '#2a241c', padding: { x: 6, y: 4 }, fixedWidth: 220,
      }).setInteractive({ useHandCursor: true }));
      row.on('pointerdown', () => {
        this.logCategory = cat.id;
        this.openModal('log');
      });
    });

    const cat = LOG_CATEGORIES.find((c) => c.id === this.logCategory) ?? LOG_CATEGORIES[0];
    const gx = listX + 240;
    add(this.add.text(gx, 88, cat.name, { ...FONT, fontSize: '16px', color: '#ff981f' }));
    if (cat.killCountOf) {
      const kc = meta.killCounts[cat.killCountOf] ?? 0;
      add(this.add.text(gx, 110, `${cat.killCountOf === 'mimic' ? 'Mimics' : cat.name} killed: ${kc}`, { ...FONT, fontSize: '12px', color: '#c8c8c8' }));
    }
    const caption = add(this.add.text(gx, 130, 'Hover a slot to see what it is.', { ...FONT, fontSize: '12px', color: '#ffffff' }));
    const cell = 46;
    const perRow = Math.max(4, Math.floor((W - gx - 20) / cell));
    cat.slots.forEach((id, i) => {
      const x = gx + (i % perRow) * cell;
      const y = 152 + Math.floor(i / perRow) * cell;
      const count = meta.collection[id] ?? 0;
      const pet = PET_BY_ID[id];
      const bg = add(this.add.rectangle(x, y, cell - 4, cell - 4, count ? 0x3e3529 : 0x1c1812).setOrigin(0).setInteractive());
      const ref = pet ? { key: npcSprite(pet.bossId), tint: undefined } : ensureItemTexture(this, id);
      const icon = add(this.add.image(x + cell / 2 - 2, y + cell / 2 - 2, ref.key).setScale(pet ? 0.9 : 1));
      if (ref.tint !== undefined) icon.setTint(ref.tint);
      if (!count) icon.setTint(0x000000).setAlpha(0.35); // silhouette until obtained
      if (count > 1) add(this.add.text(x + 2, y + 1, String(count), { ...FONT, fontSize: '10px' }));
      const name = pet ? pet.name : item(id).name;
      bg.on('pointerover', () => caption.setText(count ? `${name}: obtained ${count}` : `${name}: not obtained yet`));
      if (pet && count) {
        const active = meta.activePet === id;
        if (active) bg.setStrokeStyle(2, 0xffd040);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => caption.setText(`${name}: ${active ? 'following you (click to dismiss)' : 'click to have it follow you'}`));
        bg.on('pointerdown', () => {
          this.dungeon.setActivePet(active ? null : id);
          this.openModal('log');
        });
      }
    });
  }

  /** End-of-run report: how far, what killed you, damage, XP and loot. */
  private runSummary(g: GameState): string[] {
    const r = g.runStats;
    const xp = (Object.entries(r.xp) as Array<[SkillName, number]>)
      .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([s, v]) => `${SKILL_LABELS[s]} +${Math.round(v).toLocaleString()}`);
    const bosses = g.bossKills ? ` and ${g.bossKills} boss${g.bossKills > 1 ? 'es' : ''}` : '';
    return [
      `Floor ${g.depth} reached, ${g.kills} kills${bosses}, ${g.tickCount.toLocaleString()} ticks (${Math.round(g.tickCount * 0.6 / 60)} min).`,
      g.forfeited ? 'You chose to leave.' : `Killed by: ${r.killedBy || 'unknown'}`,
      '',
      `Damage dealt ${r.damageDealt.toLocaleString()}   Damage taken ${r.damageTaken.toLocaleString()}   Food eaten ${r.foodEaten}`,
      `Loot picked up: ${r.itemsLooted} items, ${r.coinsLooted.toLocaleString()} coins   Relics: ${g.relics.length}`,
      `XP gained: ${xp.join(', ') || 'none'}`,
      '',
      `This run earned ${this.dungeon.lastEarned} Dungeoneering tokens (total ${this.dungeon.meta.tokens}).`,
      ...(this.dungeon.lastMaterials
        ? [`Materials brought home: ${this.dungeon.lastMaterials.timber} timber, ${this.dungeon.lastMaterials.metal} metal (for the Builder).`] : []),
      'Spend them at camp with the Mentor, the Toolsmith and the Builder.',
    ];
  }

  /** Pulsing red border and a warning beep when HP drops below a quarter. */
  private updateLowHp(g: GameState): void {
    const p = g.player;
    const low = settings.lowHpWarning && !g.isCamp && !g.over && p.hp > 0 && p.hp < p.maxHp * 0.25;
    if (low && !this.wasLowHp) sfx.play('warning');
    this.wasLowHp = low;
    this.lowHp.setVisible(low);
    if (low) this.lowHp.setAlpha(0.25 + 0.2 * Math.sin(this.time.now / 180));
  }

  /** Brief banner for unlocks: at most MAX_TOASTS on screen, the rest wait their turn. */
  private toast(n: Notice): void {
    const text = n.kind === 'achievement' ? `Achievement completed: ${n.name}  (+${n.reward} tokens)`
      : n.kind === 'pet' ? `New pet: ${n.name}! It will follow you (change it in the Collection log).`
        : n.kind === 'unlock' ? n.name
          : `Collection log: ${n.name}`;
    if (!settings.showToasts) return;
    this.toastQueue.push({ text, color: n.kind === 'collection' ? '#ffffff' : '#ffd040' });
    this.showToasts();
  }

  private showToasts(): void {
    while (this.toasts < MAX_TOASTS && this.toastQueue.length) {
      const { text, color } = this.toastQueue.shift()!;
      // Just above the chatbox, stacking upwards, so they never cover window headers.
      const t = this.add.text(this.panelX / 2, this.scale.height - CHAT_H - 8 - this.toasts * 28, text, {
        ...FONT, fontSize: '14px', color, backgroundColor: '#2a241ce0', padding: { x: 10, y: 4 },
      }).setOrigin(0.5, 1).setDepth(45);
      this.toasts++;
      this.tweens.add({
        targets: t, alpha: 0, delay: 2600, duration: 500,
        onComplete: () => {
          t.destroy();
          this.toasts--;
          this.showToasts();
        },
      });
    }
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
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!p.leftButtonDown()) return;
        if (!this.quickSetup) {
          this.state.togglePrayer(pr.id);
          return;
        }
        // Set-up mode: clicking picks which prayers the quick-prayer button uses.
        const q = settings.quickPrayers;
        settings.quickPrayers = q.includes(pr.id) ? q.filter((id) => id !== pr.id) : [...q, pr.id];
        saveSettings();
      });
      this.hoverable(bg, () => {
        const on = this.state.player.activePrayers.has(pr.id);
        const hotkey = PROTECTION_HOTKEYS.indexOf(pr.id as (typeof PROTECTION_HOTKEYS)[number]);
        return `${on ? 'Deactivate' : 'Activate'} ${pr.name}${hotkey >= 0 ? `  (hotkey ${hotkey + 1})` : ''}`;
      });
      this.prayerCells.set(pr.id, { bg, text });
      this.tabObjects.prayer.push(bg, text);
    });
    const below = y + Math.ceil(PRAYERS.length / 3) * ch;
    const hint = this.add.text(px + PANEL_W / 2, below + 2, '1/2/3: protect   Q: quick-prayers', {
      ...FONT, fontSize: '10px', color: '#c8c8c8',
    }).setOrigin(0.5, 0);
    this.quickSetupButton = this.add.text(px + PANEL_W / 2, below + 16, '', {
      ...FONT, fontSize: '10px', backgroundColor: '#3e3529', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.quickSetupButton.on('pointerdown', () => (this.quickSetup = !this.quickSetup));
    this.hoverable(this.quickSetupButton, () => (this.quickSetup
      ? 'Finish choosing quick-prayers' : 'Choose which prayers the quick-prayer button (Q) toggles'));
    this.tabObjects.prayer.push(hint, this.quickSetupButton);
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
    // Herbs: Mix the potion they make (first one you have the ingredients for).
    const mixes = recipesFor('mix').filter((r) => r.inputs[0].item === stack.id);
    if (mixes.length) {
      const ready = mixes.find((r) => r.inputs.every((i) => g.player.inventory.count(i.item) >= i.qty)) ?? mixes[0];
      opts.push({ label: `Mix ${item(ready.output).name}`, action: () => g.mix(ready) });
    }
    // Logs and bars: Fletch what they make (bows from logs; arrows from a bar + logs).
    for (const r of recipesFor('fletch').filter((r) => r.inputs[0].item === stack.id)) {
      opts.push({ label: `Fletch ${r.outputQty ? `${r.outputQty} ` : ''}${item(r.output).name}${r.outputQty ? 's' : ''}`, action: () => g.fletch(r) });
    }
    const verb = def.burnTicks ? 'Light' : def.restoresPrayer || def.boost ? 'Drink' : def.heal ? 'Eat' : def.buryXp ? 'Bury' : def.equip ? (def.equip.slot === 'weapon' || def.equip.slot === 'ammo' ? 'Wield' : 'Wear') : null;
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
    // Stairs get a big, outlined marker once found.
    const st = map.stairs;
    if (g.isExplored(st.x, st.y)) {
      m.fillStyle(0x000000).fillRect(r.x + st.x * S - 3, r.y + st.y * S - 3, S + 6, S + 6);
      m.fillStyle(0xffd040).fillRect(r.x + st.x * S - 2, r.y + st.y * S - 2, S + 4, S + 4);
    }
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

  /** Inventory slot under a screen point, or -1. */
  private slotAt(x: number, y: number): number {
    const col = Math.floor((x - this.invGrid.x) / SLOT);
    const row = Math.floor((y - this.invGrid.y) / SLOT);
    if (this.tab !== 'inventory' || col < 0 || col > 3 || row < 0 || row > 6) return -1;
    return row * 4 + col;
  }

  private updateDrag(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 6) {
      d.moved = true;
      const stack = this.state.player.inventory.slots[d.from];
      if (!stack) {
        this.drag = null;
        return;
      }
      const ref = ensureItemTexture(this, stack.id);
      this.dragGhost = this.add.image(p.x, p.y, ref.key).setDepth(60).setAlpha(0.85);
      if (ref.tint !== undefined) this.dragGhost.setTint(ref.tint);
      this.slots[d.from].icon.setAlpha(0.3);
    }
    this.dragGhost?.setPosition(p.x, p.y);
  }

  /** Drop onto another slot to swap; a plain click (no drag) uses the item. */
  private endDrag(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.dragGhost?.destroy();
    this.dragGhost = undefined;
    this.slots[d.from]?.icon.setAlpha(1);
    if (!d.moved) {
      this.inventoryOptions(d.from)[0]?.action();
      return;
    }
    const to = this.slotAt(p.x, p.y);
    if (to >= 0 && to !== d.from) this.state.swapSlots(d.from, to);
  }

  /** Tracks which item `obj` shows, so hovering it brings up its stats tooltip. */
  private itemHover(obj: Phaser.GameObjects.GameObject, id: () => string | undefined): void {
    obj.on('pointerover', () => (this.hoveredItem = id));
    obj.on('pointerout', () => this.hoveredItem === id && (this.hoveredItem = null));
  }

  private tooltipLines(): string[] | null {
    if (this.menu.isOpen || this.modalKind || this.relicPanel?.visible) return null;
    const p = this.state.player;
    const s = this.hoveredSkill;
    if (s === 'slayer' && !this.dungeon.meta.slayerUnlocked) return ['Slayer (locked)', 'Defeat the Goblin Warlord (floor 5) to unlock it.'];
    if (s) {
      const xp = Math.floor(p.skills.xp[s]);
      const level = p.skills.level(s);
      const lines = [`${SKILL_LABELS[s]} XP: ${xp.toLocaleString()}`];
      if (p.boosts[s]) lines.push(`Boosted +${p.boosts[s]} (fades 1 level per minute)`);
      if (level < MAX_LEVEL) {
        const next = xpForLevel(level + 1);
        lines.push(`Next level at: ${next.toLocaleString()}`, `Remaining XP: ${(next - xp).toLocaleString()}`);
      }
      return lines;
    }
    const id = this.hoveredItem?.();
    if (!id) return null;
    const ench = this.state.enchantOn(id);
    return ench ? [...itemInfo(id, p), `Enchanted: ${describeEnchant(ench)}`] : itemInfo(id, p);
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
    const detail = !this.menu.isOpen && !this.panelHover && hover === this.dungeon.hoverText ? this.dungeon.hoverDetail : null;
    this.hoverDetail.setText(detail ? detail.text : '').setColor(detail?.color ?? '#ffffff')
      .setPosition(this.hoverLabel.x + this.hoverLabel.width + 10, this.hoverLabel.y);
    this.updateLowHp(g);

    this.header.setText(g.isCamp ? `Camp  Tokens ${this.dungeon.meta.tokens}` : `Floor ${g.depth}  Combat ${p.combatLevel}`);
    const running = this.dungeon.running;
    this.runButton.setText(running ? 'Run: on' : 'Run: off').setColor(running ? '#ffff00' : '#a08a5a');
    this.hpText.setText(`Hitpoints ${p.hp}/${p.maxHp}`);
    this.hpBar.width = (PANEL_W - 20) * Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    this.prayerText.setText(`Prayer ${p.prayerPoints}/${p.maxPrayer}`);
    this.prayerBar.width = (PANEL_W - 20) * Phaser.Math.Clamp(p.prayerPoints / p.maxPrayer, 0, 1);
    const spec = SPEC_BY_WEAPON[p.equipment.weapon ?? ''];
    this.specBar.width = (PANEL_W - 22) * p.specEnergy / 100;
    this.specBar.setFillStyle(!spec ? 0x3a4a3a : p.specArmed ? 0xe0c040 : p.specEnergy >= spec.cost ? 0x40a040 : 0x6a7a4a);
    this.specText.setText(`Special attack: ${p.specEnergy}%${spec ? (p.specArmed ? ' (ARMED)' : ` - ${spec.name}`) : ''}`)
      .setColor(p.specArmed ? '#000000' : '#ffffff');
    const prayerLevel = p.skills.level('prayer');
    for (const pr of PRAYERS) {
      const cell = this.prayerCells.get(pr.id)!;
      const on = p.activePrayers.has(pr.id);
      cell.bg.setFillStyle(on ? 0x7a6a2a : 0x2a241c);
      // In set-up mode, quick-prayer picks get a green outline.
      cell.bg.setStrokeStyle(2, 0x40e040, this.quickSetup && settings.quickPrayers.includes(pr.id) ? 1 : 0);
      cell.text.setColor(prayerLevel < pr.level ? '#6a6a6a' : on ? '#ffffff' : '#ffff00');
    }

    const quickOn = settings.quickPrayers.some((id) => p.activePrayers.has(id));
    this.quickButton.setText(quickOn ? 'Quick: on' : 'Quick: off').setColor(quickOn ? '#60ff60' : '#a08a5a');
    this.quickSetupButton.setText(this.quickSetup ? 'Done choosing quick-prayers' : 'Set up quick-prayers');

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
      const locked = s === 'slayer' && !this.dungeon.meta.slayerUnlocked;
      const boost = p.boosts[s] ?? 0;
      // Potion boosts show the boosted level in green, like OSRS.
      v.text.setText(`${SKILL_SHORT[s].padEnd(5)} ${locked ? '--' : level + boost}`)
        .setColor(locked ? '#6a6a6a' : boost ? '#60ff60' : '#ffffff');
      const lo = xpForLevel(level);
      const frac = level >= MAX_LEVEL ? 1 : (p.skills.xp[s] - lo) / (xpForLevel(level + 1) - lo);
      v.bar.width = (SKILL_COL_W - 8) * frac;
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
      `Fish: ${(['-', 'Net', 'Rod', 'Pot', 'Harpoon'][t.fishing]).padEnd(8)} ${t.hammer ? 'Hammer ' : ''}${t.tinderbox ? 'Tinder ' : ''}${t.knife ? 'Knife' : ''}`,
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
    const task = g.slayerTask ?? (g.isCamp ? this.dungeon.meta.slayerTask : null);
    this.taskText.setText(task && task.remaining > 0
      ? `Slayer task: ${task.remaining}/${task.total} ${SLAYER_BY_ID[task.category].name.toLowerCase()} left` : '');
    this.soundText.setText('H: help');
    const st = g.map.stairs;
    this.stairsButton.setVisible(!g.over && g.isExplored(st.x, st.y) && !this.modalKind);
    this.forfeitButton.setVisible(!g.isCamp && !g.over);
    this.deathTitle.setText(g.forfeited ? 'Run forfeited' : 'Oh dear, you are dead!').setColor(g.forfeited ? '#ff981f' : '#ff3030');
    this.chat.setText(this.fitChat(g.messages));

    if (g.over) {
      (this.deathOverlay.getData('stats') as Phaser.GameObjects.Text)
        .setText(this.runSummary(g).join('\n'));
    }
  }
}
