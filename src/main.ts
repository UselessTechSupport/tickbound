import Phaser from 'phaser';
import { DungeonScene } from './scenes/DungeonScene';
import { UIScene } from './scenes/UIScene';
import { sfx } from './audio/sfx';

// Browsers only allow audio after a user gesture.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => sfx.unlock());

/**
 * The UI is laid out for at least ~1100x700. Bigger screens get a resizable canvas
 * (more map visible); smaller ones (phones, tablets) get a fixed 1280x720 layout
 * scaled down to fit, so nothing is cut off.
 */
const SMALL_SCREEN = window.innerWidth < 1100 || window.innerHeight < 700;
/** Small screens: 720 tall, and as wide as the screen's shape allows (a wide phone sees more map, no black bars). */
const BASE_H = 720;
const baseWidth = () => Math.round(Math.max(1100, Math.min(1800, BASE_H * window.innerWidth / Math.max(1, window.innerHeight))));
const scale: Phaser.Types.Core.ScaleConfig = SMALL_SCREEN
  ? { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: baseWidth(), height: BASE_H }
  : { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' };

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  pixelArt: true,
  scale,
  input: { activePointers: 2 },
  disableContextMenu: true,
  // Sound effects are synthesised by src/audio/sfx.ts; Phaser's own audio isn't used.
  audio: { noAudio: true },
  scene: [DungeonScene, UIScene],
});

// Turning the phone (or entering fullscreen) changes the shape: refit the layout.
if (SMALL_SCREEN) {
  let pending = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      if (game.scale.width !== baseWidth()) game.scale.setGameSize(baseWidth(), BASE_H);
    }, 150);
  });
}

// Handy for debugging in the browser console: __game.scene.getScene('Dungeon').state
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
