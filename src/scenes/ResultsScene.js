import Phaser from 'phaser';
import { showPlaceholder } from '../ui.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create() {
    showPlaceholder(this, 'ResultsScene');
  }
}
