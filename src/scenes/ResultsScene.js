import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { BALANCE } from '../data/balance.js';
import { FLOORS } from '../data/floors.js';
import { sfx } from '../sfx.js';
import { session } from '../state.js';
import { CSS, PALETTE, body, confetti, drawSticker, goTo, heading, label, makeButton, restartOnResize, sparkle, wipeIn } from '../ui.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
  }

  create(data) {
    makeArt(this);
    this.resultData = {
      floor: data?.floor ?? 1,
      timeSurvived: data?.timeSurvived ?? 0,
      defeated: data?.defeated ?? 0,
      caught: data?.caught ?? 0,
    };
    const { width, height } = this.scale;
    const cx = width / 2;
    const layoutY = (designY) => (designY * height) / 640;
    const compact = width < 900 || height > width;
    const stackButtons = width < 480 || height > width;
    const panelWidth = compact ? width - 24 : 580;
    const panelTop = compact ? (height > width ? height * 0.23 : height * 0.2) : 146 * (height / 640);
    const panelBottom = height - (stackButtons ? 164 : 84);
    const panelHeight = compact ? Math.min(344, panelBottom - panelTop) : 344;
    const panelY = compact ? (panelTop + panelBottom) / 2 : layoutY(318);
    const rowHeight = compact ? (height < 560 ? 32 : 40) : 50;
    const rowGap = compact ? (height < 560 ? 8 : 10) : 16;
    const floorNum = data?.floor ?? 1;
    const floor = FLOORS.find((f) => f.floor === floorNum) ?? FLOORS[0];
    const { timeSurvived = 0, defeated = 0, caught = 0 } = data ?? {};
    const s = BALANCE.score;
    const score = timeSurvived * s.perSecond + defeated * s.perDefeat + caught * s.perCatch;

    session.clearedFloors.add(floorNum);
    if (!data?.scoreSent) api.score(caught, score); // the server keeps the totals; failures are fine here

    addMeadow(this, { hillsHeight: 150, flowers: 12, birds: 2 });

    // Panel with a ribbon across the top.
    const panel = this.add.graphics({ x: cx, y: panelY }).setDepth(1);
    drawSticker(panel, panelWidth, panelHeight, { radius: 18, shadow: 8 });

    const ribbonY = compact ? (height > width ? height * 0.16 : height * 0.11) : layoutY(150);
    const ribbonHalfWidth = compact ? (width - 48) / 2 : 322;
    const ribbon = this.add.graphics({ x: cx, y: ribbonY }).setDepth(2);
    ribbon.fillStyle(PALETTE.navy, 1).fillRect(-ribbonHalfWidth, -26 + 6, ribbonHalfWidth * 2, 56);
    ribbon.fillStyle(0xd94442, 1).fillTriangle(-ribbonHalfWidth - 28, -20, -ribbonHalfWidth + 22, -20, -ribbonHalfWidth + 22, 30).fillTriangle(ribbonHalfWidth + 28, -20, ribbonHalfWidth - 22, -20, ribbonHalfWidth - 22, 30);
    ribbon.fillStyle(PALETTE.coral, 1).fillRect(-ribbonHalfWidth, -26, ribbonHalfWidth * 2, 56);
    ribbon.fillStyle(0xff8a88, 1).fillRect(-ribbonHalfWidth + 8, -20, ribbonHalfWidth * 2 - 16, 6);
    ribbon.lineStyle(4, PALETTE.navy, 1).strokeRect(-ribbonHalfWidth, -26, ribbonHalfWidth * 2, 56);
    const titleText = floor.boss ? 'WEEK 2 CLEARED!' : `${floor.label.toUpperCase()} CLEARED!`;
    const title = this.add.text(cx, ribbonY + 2, titleText, heading(compact ? (width < 360 ? 14 : 18) : 24, CSS.yellow)).setOrigin(0.5).setDepth(3).setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 400, delay: 250, ease: 'Back.Out' });

    if (floor.boss) {
      const trophy = this.add.image(cx, compact ? ribbonY - 48 : layoutY(84), 'star').setScale(compact ? 5 : 8).setTint(PALETTE.yellow).setDepth(3);
      this.tweens.add({ targets: trophy, angle: 12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const rows = [
      ['Time survived', timeSurvived, 's'],
      ['Pokémon defeated', defeated, ''],
      ['Pokémon caught', caught, ''],
      ['Score', score, ''],
    ];
    rows.forEach(([name, value, unit], i) => {
      const step = rowHeight + rowGap;
      const firstY = panelY - (step * (rows.length - 1)) / 2;
      const y = firstY + i * step;
      const isScore = i === rows.length - 1;
      const strip = this.add.graphics({ x: cx, y }).setDepth(2);
      const rowWidth = panelWidth - 32;
      strip.fillStyle(isScore ? PALETTE.yellow : PALETTE.mist, 1).fillRoundedRect(-rowWidth / 2, -rowHeight / 2, rowWidth, rowHeight, 12);
      if (isScore) strip.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(-rowWidth / 2, -rowHeight / 2, rowWidth, rowHeight, 12);
      this.add.text(cx - rowWidth / 2 + 16, y + 1, name, body(compact ? 18 : isScore ? 26 : 24)).setOrigin(0, 0.5).setDepth(3);
      const valueText = this.add.text(cx + rowWidth / 2 - 16, y + 2, `0${unit}`, label(compact ? 16 : isScore ? 22 : 20)).setOrigin(1, 0.5).setDepth(3).setAlpha(0.3);

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
            confetti(this, cx, height, 70);
            this.buttons.forEach((b) => this.tweens.add({ targets: b, alpha: 1, y: b.restY, duration: 300, ease: 'Back.Out' }));
          }
        },
      });
    });

    // Confetti as soon as the screen opens.
    this.time.delayedCall(350, () => {
      confetti(this, 60, height + 20, 60);
      confetti(this, width - 60, height + 20, 60);
    });

    const doorOpen = floor.door && session.doorsOpened.includes(floor.door);
    this.buttons = [];
    if (floor.door && !doorOpen) {
      if (stackButtons) {
        const buttonWidth = Math.min(300, width - 32);
        this.buttons.push(makeButton(this, cx, height - 120, 'TOWER', () => goTo(this, 'TowerScene'), { width: buttonWidth, height: 54, size: 14, color: PALETTE.white }));
        this.buttons.push(makeButton(this, cx, height - 56, `TO DOOR ${floor.door}`, () => goTo(this, 'DoorScene', { door: floor.door }), { width: buttonWidth, height: 54, size: 14 }));
      } else if (compact) {
        const buttonWidth = Math.min(220, (width - 36) / 2);
        const buttonY = height - 44;
        this.buttons.push(makeButton(this, cx - buttonWidth / 2 - 6, buttonY, 'TOWER', () => goTo(this, 'TowerScene'), { width: buttonWidth, height: 54, size: 14, color: PALETTE.white }));
        this.buttons.push(makeButton(this, cx + buttonWidth / 2 + 6, buttonY, `TO DOOR ${floor.door}`, () => goTo(this, 'DoorScene', { door: floor.door }), { width: buttonWidth, height: 54, size: 12 }));
      } else {
        this.buttons.push(makeButton(this, cx - 130, layoutY(586), 'TOWER', () => goTo(this, 'TowerScene'), { width: 200, color: PALETTE.white }));
        this.buttons.push(makeButton(this, cx + 120, layoutY(586), `TO DOOR ${floor.door}`, () => goTo(this, 'DoorScene', { door: floor.door }), { width: 260 }));
      }
    } else {
      const buttonWidth = compact ? Math.min(300, width - 32) : 300;
      this.buttons.push(makeButton(this, cx, compact ? height - 56 : layoutY(586), 'BACK TO TOWER', () => goTo(this, 'TowerScene'), { width: buttonWidth, height: compact ? 54 : 60, size: compact ? 14 : 16 }));
    }
    this.buttons.forEach((b) => {
      b.restY = b.y;
      b.setDepth(5).setAlpha(0).setY(b.y + 30);
    });

    restartOnResize(this, () => ({ ...this.resultData, scoreSent: true }));
    wipeIn(this);
  }
}
