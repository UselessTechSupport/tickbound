import Phaser from 'phaser';
import { DungeonScene } from './scenes/DungeonScene';
import { UIScene } from './scenes/UIScene';
import { sfx } from './audio/sfx';

// Browsers only allow audio after a user gesture.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => sfx.unlock());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  disableContextMenu: true,
  // Sound effects are synthesised by src/audio/sfx.ts; Phaser's own audio isn't used.
  audio: { noAudio: true },
  scene: [DungeonScene, UIScene],
});

// Handy for debugging in the browser console: __game.scene.getScene('Dungeon').state
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
