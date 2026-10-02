import Phaser from 'phaser';
import { forceOpen } from './api.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TowerScene } from './scenes/TowerScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { DoorScene } from './scenes/DoorScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  backgroundColor: '#5ec8ff',
  pixelArt: true,
  scale: {
    // Match the game coordinate space to the viewport so UI can reflow at any size.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: {
    createContainer: true,
  },
  input: {
    activePointers: 3, // joystick thumb + a button at the same time
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [TitleScene, TowerScene, ArenaScene, DoorScene, ResultsScene, LeaderboardScene],
};

// The fake door on Floor 3 tells students to try this in the Console (PRD section 7).
window.tower = { forceOpen };

// Wait for both fonts so canvas text doesn't render in a fallback font.
Promise.all([
  document.fonts.load('16px "Press Start 2P"'),
  document.fonts.load('16px "Jersey 10"'),
])
  .catch(() => {})
  .then(() => new Phaser.Game(config));
