import Phaser from 'phaser';
import { showPlaceholder } from '../ui.js';

export class TowerScene extends Phaser.Scene {
  constructor() {
    super('TowerScene');
  }

  create() {
    showPlaceholder(this, 'TowerScene');
  }
}
