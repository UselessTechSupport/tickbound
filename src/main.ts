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
const scale: Phaser.Types.Core.ScaleConfig = SMALL_SCREEN
  ? { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 }
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

// Handy for debugging in the browser console: __game.scene.getScene('Dungeon').state
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
