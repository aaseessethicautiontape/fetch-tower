import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { TowerScene } from './scenes/TowerScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { DoorScene } from './scenes/DoorScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';
import { COLORS } from './ui.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  backgroundColor: COLORS.bg,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: {
    createContainer: true,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [TitleScene, TowerScene, ArenaScene, DoorScene, ResultsScene, LeaderboardScene],
};

// Wait for the pixel font so canvas text doesn't render in a fallback font.
document.fonts
  .load('16px "Press Start 2P"')
  .catch(() => {})
  .then(() => new Phaser.Game(config));
