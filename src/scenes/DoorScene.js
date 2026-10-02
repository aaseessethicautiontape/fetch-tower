import Phaser from 'phaser';
import { showPlaceholder } from '../ui.js';

export class DoorScene extends Phaser.Scene {
  constructor() {
    super('DoorScene');
  }

  create() {
    showPlaceholder(this, 'DoorScene');
  }
}
