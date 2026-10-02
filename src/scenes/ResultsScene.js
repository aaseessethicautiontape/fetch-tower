import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { BALANCE } from '../data/balance.js';
import { FLOORS } from '../data/floors.js';
import { sfx } from '../sfx.js';
import { session } from '../state.js';
import { CSS, PALETTE, body, confetti, drawSticker, goTo, heading, label, makeButton, sparkle, wipeIn } from '../ui.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(data) {
    makeArt(this);
    const { width } = this.scale;
    const cx = width / 2;
    const floorNum = data?.floor ?? 1;
    const floor = FLOORS.find((f) => f.floor === floorNum) ?? FLOORS[0];
    const { timeSurvived = 0, defeated = 0, caught = 0 } = data ?? {};
    const s = BALANCE.score;
    const score = timeSurvived * s.perSecond + defeated * s.perDefeat + caught * s.perCatch;

    session.clearedFloors.add(floorNum);
    api.score(caught, score); // the server keeps the totals; failures are fine here

    addMeadow(this, { hillsHeight: 150, flowers: 12, birds: 2 });

    // Panel with a ribbon across the top.
    const panelY = 318;
    const panel = this.add.graphics({ x: cx, y: panelY }).setDepth(1);
    drawSticker(panel, 580, 344, { radius: 18, shadow: 8 });

    const ribbon = this.add.graphics({ x: cx, y: 150 }).setDepth(2);
    ribbon.fillStyle(PALETTE.navy, 1).fillRect(-322, -26 + 6, 644, 56);
    ribbon.fillStyle(0xd94442, 1).fillTriangle(-350, -20, -300, -20, -300, 30).fillTriangle(350, -20, 300, -20, 300, 30);
    ribbon.fillStyle(PALETTE.coral, 1).fillRect(-322, -26, 644, 56);
    ribbon.fillStyle(0xff8a88, 1).fillRect(-314, -20, 628, 6);
    ribbon.lineStyle(4, PALETTE.navy, 1).strokeRect(-322, -26, 644, 56);
    const titleText = floor.boss ? 'WEEK 2 CLEARED!' : `${floor.label.toUpperCase()} CLEARED!`;
    const title = this.add.text(cx, 152, titleText, heading(24, CSS.yellow)).setOrigin(0.5).setDepth(3).setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 400, delay: 250, ease: 'Back.Out' });

    if (floor.boss) {
      const trophy = this.add.image(cx, 84, 'star').setScale(8).setTint(PALETTE.yellow).setDepth(3);
      this.tweens.add({ targets: trophy, angle: 12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const rows = [
      ['Time survived', timeSurvived, 's'],
      ['Pokémon defeated', defeated, ''],
      ['Pokémon caught', caught, ''],
      ['Score', score, ''],
    ];
    rows.forEach(([name, value, unit], i) => {
      const y = 222 + i * 66;
      const isScore = i === rows.length - 1;
      const strip = this.add.graphics({ x: cx, y }).setDepth(2);
      strip.fillStyle(isScore ? PALETTE.yellow : PALETTE.mist, 1).fillRoundedRect(-250, -24, 500, 50, 12);
      if (isScore) strip.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(-250, -24, 500, 50, 12);
      this.add.text(cx - 226, y + 1, name, body(isScore ? 26 : 24)).setOrigin(0, 0.5).setDepth(3);
      const valueText = this.add.text(cx + 226, y + 2, `0${unit}`, label(isScore ? 22 : 20)).setOrigin(1, 0.5).setDepth(3).setAlpha(0.3);

      // Count up one row at a time, with a ding at the end of each.
      this.tweens.addCounter({
        from: 0,
        to: value,
        duration: Math.min(700, 250 + value * 15),
        delay: 800 + i * 650,
        onStart: () => valueText.setAlpha(1),
        onUpdate: (tween) => valueText.setText(`${Math.round(tween.getValue())}${unit}`),
        onComplete: () => {
          valueText.setText(`${value}${unit}`);
          sfx.ding(i);
          this.tweens.add({ targets: valueText, scale: 1.3, duration: 90, yoyo: true });
          sparkle(this, cx + 226 - valueText.width / 2, y, { tint: PALETTE.yellow, depth: 4 });
          if (isScore) {
            confetti(this, cx, 640, 70);
            this.buttons.forEach((b) => this.tweens.add({ targets: b, alpha: 1, y: b.restY, duration: 300, ease: 'Back.Out' }));
          }
        },
      });
    });

    // Confetti as soon as the screen opens.
    this.time.delayedCall(350, () => {
      confetti(this, 60, 660, 60);
      confetti(this, width - 60, 660, 60);
    });

    const doorOpen = floor.door && session.doorsOpened.includes(floor.door);
    this.buttons = [];
    if (floor.door && !doorOpen) {
      this.buttons.push(makeButton(this, cx - 130, 586, 'TOWER', () => goTo(this, 'TowerScene'), { width: 200, color: PALETTE.white }));
      this.buttons.push(makeButton(this, cx + 120, 586, `TO DOOR ${floor.door}`, () => goTo(this, 'DoorScene', { door: floor.door }), { width: 260 }));
    } else {
      this.buttons.push(makeButton(this, cx, 586, 'BACK TO TOWER', () => goTo(this, 'TowerScene'), { width: 300 }));
    }
    this.buttons.forEach((b) => {
      b.restY = b.y;
      b.setDepth(5).setAlpha(0).setY(b.y + 30);
    });

    wipeIn(this);
  }
}
