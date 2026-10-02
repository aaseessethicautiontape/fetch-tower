import Phaser from 'phaser';
import { showPlaceholder } from '../ui.js';

export class ArenaScene extends Phaser.Scene {
  constructor() {
    super('ArenaScene');
  }

  create() {
    showPlaceholder(this, 'ArenaScene');
  }
}
