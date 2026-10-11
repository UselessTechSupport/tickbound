import Phaser from 'phaser';
import { DungeonScene } from './scenes/DungeonScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  disableContextMenu: true,
  scene: [DungeonScene, UIScene],
});

// Handy for debugging in the browser console: __game.scene.getScene('Dungeon').state
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
