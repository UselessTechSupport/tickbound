import Phaser from 'phaser';

export interface MenuOption {
  label: string;
  action: () => void;
}

/** OSRS-style hover text: the left-click action plus how many others the menu has. */
export function describeOptions(opts: MenuOption[]): string {
  if (!opts.length) return '';
  const more = opts.length - 1;
  return opts[0].label + (more ? ` / ${more} more option${more > 1 ? 's' : ''}` : '');
}

const ROW_H = 18;
const PAD = 6;
const FONT = { fontFamily: 'monospace', fontSize: '13px' };
/** How far the cursor can stray outside the menu before it closes (OSRS behaviour). */
const CLOSE_MARGIN = 12;

/** OSRS-style right-click "Choose Option" menu. */
export class ContextMenu {
  private root?: Phaser.GameObjects.Container;
  private blocker?: Phaser.GameObjects.Rectangle;
  private bounds = new Phaser.Geom.Rectangle();
  private openedFrame = -1;

  /** Called whenever the menu consumes a click, so lower layers can ignore it. */
  constructor(private scene: Phaser.Scene, private onConsume: () => void) {}

  get isOpen(): boolean {
    return !!this.root;
  }

  open(x: number, y: number, options: MenuOption[]): void {
    this.close();
    this.openedFrame = this.scene.game.loop.frame;
    const all = [...options, { label: 'Cancel', action: () => {} }];
    const s = this.scene;

    const texts = all.map((o) => s.add.text(0, 0, o.label, { ...FONT, color: o.label === 'Cancel' ? '#ffffff' : '#ffff00' }));
    const header = s.add.text(PAD, 2, 'Choose Option', { ...FONT, color: '#5d5447' });
    const w = Math.max(header.width, ...texts.map((t) => t.width)) + PAD * 2;
    const h = ROW_H * (all.length + 1) + 4;
    const left = Phaser.Math.Clamp(x - w / 2, 0, s.scale.width - w);
    const top = Phaser.Math.Clamp(y - 4, 0, s.scale.height - h);
    this.bounds.setTo(left, top, w, h);

    // Full-screen catcher: clicking anywhere else just closes the menu.
    this.blocker = s.add.rectangle(0, 0, s.scale.width, s.scale.height, 0x000000, 0.001)
      .setOrigin(0).setDepth(99).setInteractive();
    this.blocker.on('pointerdown', () => {
      if (this.justOpened) return;
      this.onConsume();
      this.close();
    });

    const root = (this.root = s.add.container(left, top).setDepth(100));
    root.add(s.add.rectangle(0, 0, w, h, 0x5d5447).setOrigin(0).setStrokeStyle(1, 0x000000));
    root.add(s.add.rectangle(1, 1, w - 2, ROW_H, 0x000000).setOrigin(0));
    root.add(header);

    all.forEach((opt, i) => {
      const rowY = ROW_H * (i + 1) + 2;
      const hl = s.add.rectangle(1, rowY, w - 2, ROW_H, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      texts[i].setPosition(PAD, rowY + 1);
      hl.on('pointerover', () => hl.setFillStyle(0x000000, 0.35));
      hl.on('pointerout', () => hl.setFillStyle(0xffffff, 0));
      hl.on('pointerdown', () => {
        if (this.justOpened) return;
        this.onConsume();
        this.close();
        opt.action();
      });
      root.add([hl, texts[i]]);
    });
  }

  /** The right-click that opened the menu must not also select or dismiss it. */
  private get justOpened(): boolean {
    return this.scene.game.loop.frame === this.openedFrame;
  }

  /** Closes the menu once the cursor wanders away from it. */
  handlePointerMove(x: number, y: number): void {
    if (!this.root) return;
    const b = this.bounds;
    if (x < b.left - CLOSE_MARGIN || x > b.right + CLOSE_MARGIN || y < b.top - CLOSE_MARGIN || y > b.bottom + CLOSE_MARGIN) {
      this.close();
    }
  }

  close(): void {
    this.root?.destroy(true);
    this.blocker?.destroy();
    this.root = undefined;
    this.blocker = undefined;
  }
}
