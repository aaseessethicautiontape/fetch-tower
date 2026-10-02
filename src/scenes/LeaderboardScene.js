import Phaser from 'phaser';
import { showPlaceholder } from '../ui.js';

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  create() {
    showPlaceholder(this, 'LeaderboardScene');
  }
}
