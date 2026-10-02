import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { DOORS, HINT_UNLOCK_MS, WRONG_IN_A_ROW_FOR_HINT } from '../data/doors.js';
import { sfx } from '../sfx.js';
import { save, session, startHintTimer, state } from '../state.js';
import { CSS, PALETTE, body, confetti, drawSticker, goTo, heading, label, makeButton, outlined, sparkle, toast, wipeIn, woodSign } from '../ui.js';

const SIGN_TOP = 20;
const GAP = 14;
const TAB_W = 150;
const TAB_H = 62;

const clock = (ms) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export class DoorScene extends Phaser.Scene {
  constructor() {
    super('DoorScene');
  }

  init(data) {
    this.door = data?.door ?? 1;
    this.info = DOORS[this.door];
    this.wrongStreak = 0;
    this.busy = false;
    this.opened = session.doorsOpened.includes(this.door);
    this.overlay = null;
  }

  create() {
    makeArt(this);
    const { width, height } = this.scale;
    this.compact = width < 900 || height > width;
    this.doorX = this.compact ? width / 2 : (214 / 960) * width;
    this.columnX = this.compact ? width / 2 : (680 / 960) * width;
    this.columnW = Math.max(1, this.compact ? width - 32 : Math.min(520, width - 80));
    this.doorFloor = height - 74;
    this.hintsY = height - (this.compact ? 62 : 72);
    this.contentTop = this.compact ? 72 : SIGN_TOP;
    this.tabW = this.compact ? Math.min(TAB_W, (width - 40) / 3) : TAB_W;
    this.tabH = this.compact ? 50 : TAB_H;
    this.tabGap = this.compact ? 6 : 30;
    addMeadow(this, { hillsHeight: 150, flowers: 9, birds: 1 });
    this.startedAt = startHintTimer(this.door);

    if (this.compact) {
      makeButton(this, 54, 30, 'TOWER', () => goTo(this, 'TowerScene'), { width: 88, height: 40, size: 10, color: PALETTE.white }).setDepth(50);
      this.add.text(width - 16, 31, `DOOR ${this.door}`, label(10, CSS.white, { stroke: CSS.navy, strokeThickness: 4 })).setOrigin(1, 0.5).setDepth(50);
    } else {
      this.drawDoor();
      makeButton(this, 72, 40, 'TOWER', () => goTo(this, 'TowerScene'), { width: 112, height: 46, size: 11, color: PALETTE.white }).setDepth(50);
    }
    this.drawQuestion();
    this.drawHintBar();
    this.shownUnlocked = this.unlockedCount();
    this.refreshHints(-1);
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickHints() });

    this.input.keyboard.addKey('ESC', false).on('down', () => this.closeHint());

    if (this.opened) this.showOpen(false);
    wipeIn(this);
  }

  // ---------- The big friendly door ----------

  drawDoor() {
    const fx = this.doorX;
    const fy = this.doorFloor;
    this.add.text(fx, fy - 300, `DOOR ${this.door}`, heading(22)).setOrigin(0.5).setDepth(5);
    this.add.image(fx, fy, 'door-frame').setOrigin(0.5, 1).setScale(3).setDepth(1);
    // Light waiting behind the door, then the door itself hinged on its left edge.
    this.doorLight = this.add.image(fx - 75, fy - 237, 'door-glow').setOrigin(0, 0).setScale(3).setDepth(2);
    this.leaf = this.add.image(fx - 78, fy - 240, 'door-leaf').setOrigin(0, 0).setScale(3).setDepth(3);
    this.add.graphics().setDepth(0).fillStyle(PALETTE.navy, 0.25).fillEllipse(fx, fy + 4, 260, 24);
  }

  wobbleDoor() {
    this.tweens.killTweensOf(this.leaf);
    this.leaf.setAngle(0);
    this.tweens.add({ targets: this.leaf, angle: { from: -3, to: 3 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => this.leaf.setAngle(0) });

    // A little "nope" puff.
    const puff = this.add.container(this.doorX + 70, this.doorFloor - 250).setDepth(20).setScale(0);
    puff.add([this.add.image(0, 0, 'puff').setScale(4), this.add.text(0, 2, 'NOPE', label(12))].map((o) => o.setOrigin(0.5)));
    this.tweens.add({ targets: puff, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: puff, y: puff.y - 30, alpha: 0, delay: 700, duration: 400, onComplete: () => puff.destroy() });
    sfx.nope();
  }

  // The door swings open with light and confetti.
  showOpen(celebrate) {
    this.tweens.add({ targets: this.leaf, scaleX: 0.4, duration: celebrate ? 700 : 0, ease: 'Back.In' });
    this.leaf.setTint(0xb8c0d0);
    this.tweens.add({ targets: this.doorLight, alpha: 0.75, duration: 600, yoyo: true, repeat: -1 });
    this.time.addEvent({
      delay: 180,
      loop: true,
      callback: () =>
        sparkle(this, this.doorX + Phaser.Math.Between(-70, 70), this.doorFloor - Phaser.Math.Between(20, 230), {
          tint: Phaser.Utils.Array.GetRandom([PALETTE.yellow, PALETTE.white, PALETTE.cyan]),
          depth: 6,
        }),
    });
    if (celebrate) {
      sfx.open();
      this.cameras.main.flash(300, 255, 250, 210);
      confetti(this, this.doorX, this.doorFloor - 120, 90);
      this.time.delayedCall(400, () => confetti(this, this.columnX, this.scale.height, 60));
    }
    this.answerInput.disabled = true;
    this.submit.setLabel('CLIMB!').setColor(PALETTE.cyan).setEnabled(true);
    this.setFeedback(celebrate ? 'Correct! The door is open.' : 'This door is already open!', PALETTE.grass);
  }

  // ---------- Sign (context + question), answer box, feedback ----------

  drawQuestion() {
    const left = this.columnX - this.columnW / 2 + 22;
    const wrap = { wordWrap: { width: this.columnW - 44 } };
    const top = this.contentTop;
    const title = this.add.text(left, top + 16, this.info.title.toUpperCase(), label(11, '#7a3d12')).setDepth(6);
    const context = this.add.text(left, title.y + title.height + 10, this.info.context, body(15, '#5c3410', { ...wrap, lineSpacing: -2 })).setDepth(6);
    const divider = context.y + context.height + 8;
    const question = this.add.text(left, divider + 10, this.info.question, body(21, CSS.navy, { ...wrap, lineSpacing: -1 })).setDepth(6);
    const signH = question.y + question.height + 16 - top;
    woodSign(this, this.columnX, top + signH / 2, this.columnW, signH, { posts: 0 }).setDepth(5);
    this.add.graphics().setDepth(6).fillStyle(0xb87436, 0.6).fillRect(left, divider, this.columnW - 44, 3);

    // Answer box and GO! button just under the sign.
    const inputY = top + signH + 44;
    const inputWidth = this.compact ? Math.max(120, this.columnW - 112) : 384;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ft-answer';
    input.placeholder = this.info.placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.width = `${inputWidth}px`;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onSubmit();
    });
    this.inputDom = this.add.dom(this.columnX - (this.compact ? 56 : 66), inputY, input).setDepth(10);
    this.answerInput = input;
    this.submit = makeButton(
      this,
      this.compact ? this.columnX + this.columnW / 2 - 48 : this.columnX + 196,
      inputY,
      'GO!',
      () => this.onSubmit(),
      { width: this.compact ? 96 : 110, height: 54, size: this.compact ? 13 : 16 },
    ).setDepth(10);

    // The message bubble hangs below the answer box (box + shadow end ~34px under its centre).
    this.feedbackTop = inputY + 34 + GAP;
    this.feedback = this.add.container(this.columnX, this.feedbackTop).setDepth(10);
  }

  // The bubble only grows downward from feedbackTop, so it never covers the answer box.
  // The hint tabs sit at the bottom with room for a few lines of message above them.
  setFeedback(message, fill = PALETTE.white) {
    this.tweens.killTweensOf(this.feedback);
    this.feedback.removeAll(true);
    if (!message) return;
    const textColor = fill === PALETTE.coral || fill === PALETTE.grass ? CSS.white : CSS.navy;
    const stroke = textColor === CSS.white ? { stroke: CSS.navy, strokeThickness: 4 } : {};
    const t = this.add.text(0, 8, message, body(18, textColor, { wordWrap: { width: this.columnW - 48 }, align: 'center', ...stroke })).setOrigin(0.5, 0);
    const h = t.height + 16;
    const g = this.add.graphics();
    drawSticker(g, Math.min(this.columnW, t.width + 32), h, { fill, radius: 12, shadow: 4, stroke: 3, oy: h / 2 });
    this.feedback.add([g, t]);
    this.feedback.setAlpha(0).setY(this.feedbackTop + 8);
    this.tweens.add({ targets: this.feedback, alpha: 1, y: this.feedbackTop, duration: 180, ease: 'Quad.Out' });
  }

  async onSubmit() {
    if (this.opened) {
      goTo(this, 'TowerScene');
      return;
    }
    const answer = this.answerInput.value.trim();
    if (this.busy || this.overlay) return;
    if (!answer) {
      this.setFeedback('Type your answer first.');
      return;
    }

    this.busy = true;
    this.submit.setLabel('...');
    const res = await api.door(this.door, answer);
    if (!this.sys.isActive()) return;
    this.busy = false;
    this.submit.setLabel('GO!');

    if (res.offline) {
      this.setFeedback("Can't reach the door server right now. Try again in a moment.", PALETTE.yellow);
      return;
    }
    if (res.ok && res.data.ok) {
      this.opened = true;
      session.doorsOpened = res.data.doorsOpened ?? [...session.doorsOpened, this.door];
      session.highestFloor = res.data.highestFloor ?? Math.max(session.highestFloor, this.door + 1);
      this.showOpen(true);
      return;
    }
    if (!res.ok && res.status >= 500) {
      this.setFeedback('Something went wrong on the server. Try again in a moment.', PALETTE.yellow);
      return;
    }

    // Wrong answer: the server's message points at the mistake.
    this.wobbleDoor();
    this.setFeedback(res.data.message ?? 'Not quite. Try again!', PALETTE.coral);
    this.wrongStreak++;
    if (this.wrongStreak >= WRONG_IN_A_ROW_FOR_HINT && this.unlockedCount() < 3) {
      this.wrongStreak = 0;
      state.hintsEarly[this.door] = (state.hintsEarly[this.door] ?? 0) + 1;
      save();
      toast(this, 'Three tries in a row: a hint unlocked early!', { color: PALETTE.yellow });
      this.tickHints();
    }
  }

  // ---------- Hints: three scroll tabs with countdowns, read in an overlay ----------

  elapsed() {
    return Date.now() - this.startedAt;
  }

  unlockedCount() {
    const byTime = HINT_UNLOCK_MS.filter((ms) => this.elapsed() >= ms).length;
    return Math.min(3, byTime + (state.hintsEarly[this.door] ?? 0));
  }

  // Milliseconds until hint k (0-based) unlocks by time.
  msUntil(k) {
    const early = state.hintsEarly[this.door] ?? 0;
    const threshold = HINT_UNLOCK_MS[k - early];
    return threshold == null ? 0 : Math.max(0, threshold - this.elapsed());
  }

  drawHintBar() {
    const tabW = this.tabW;
    const tabH = this.tabH;
    const top = this.hintsY - tabH / 2 - (this.compact ? 30 : 36);
    this.add.text(this.compact ? 16 : this.columnX - this.columnW / 2, top, 'HINTS', heading(this.compact ? 10 : 14, CSS.yellow)).setDepth(8);
    this.hintStatus = this.add
      .text(this.compact ? this.scale.width / 2 : this.columnX + this.columnW / 2, top + 2, '', outlined(this.compact ? 11 : 16, CSS.white, { wordWrap: { width: this.compact ? this.scale.width - 32 : undefined }, align: this.compact ? 'center' : 'right' }))
      .setOrigin(this.compact ? 0.5 : 1, 0)
      .setDepth(8);
    this.tabs = [0, 1, 2].map((k) => {
      const x = this.compact ? this.scale.width / 2 + (k - 1) * (tabW + this.tabGap) : this.columnX + (k - 1) * (tabW + this.tabGap);
      const tab = this.add.container(x, this.hintsY).setDepth(8).setSize(tabW, tabH);
      tab.setInteractive({ useHandCursor: true });
      tab.on('pointerover', () => !this.overlay && this.tweens.add({ targets: tab, y: this.hintsY - 5, duration: 100 }));
      tab.on('pointerout', () => this.tweens.add({ targets: tab, y: this.hintsY, duration: 100 }));
      tab.on('pointerdown', () => this.onTab(k));
      return tab;
    });
  }

  // Redraw the tabs. `fresh` = index of a hint that just unlocked (it pops in with sparkles).
  refreshHints(fresh) {
    const unlocked = this.unlockedCount();
    const tabW = this.tabW;
    const tabH = this.tabH;
    this.tabs.forEach((tab, k) => {
      tab.removeAll(true);
      tab.countdown = null;
      const open = k < unlocked;
      const g = this.add.graphics();
      if (open) g.lineStyle(6, PALETTE.cyan, 1).strokeRoundedRect(-tabW / 2 - 6, -tabH / 2 - 6, tabW + 12, tabH + 12, 14);
      // A rolled scroll: paper with wooden ends.
      g.fillStyle(PALETTE.navy, 1).fillRoundedRect(-tabW / 2 + 5, -tabH / 2 + 5, tabW, tabH, 10);
      g.fillStyle(open ? 0xfdf1d0 : 0xe9dcbc, 1).fillRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 10);
      g.fillStyle(open ? 0xfff8e4 : 0xf1e6cb, 1).fillRect(-tabW / 2 + 14, -tabH / 2 + 5, tabW - 28, 5);
      g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 10);
      [-tabW / 2 - 6, tabW / 2 - 6].forEach((x) => {
        g.fillStyle(PALETTE.woodDark, 1).fillRoundedRect(x, -tabH / 2 - 5, 12, tabH + 10, 5);
        g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(x, -tabH / 2 - 5, 12, tabH + 10, 5);
      });
      tab.add(g);
      tab.add(this.add.text(0, -10, `HINT ${k + 1}`, label(this.compact ? 8 : 11, open ? CSS.coral : CSS.muted)).setOrigin(0.5));
      if (open) {
        tab.add(this.add.text(0, 11, this.compact ? 'TAP TO READ' : 'Click to read', body(this.compact ? 12 : 16)).setOrigin(0.5));
      } else {
        tab.add(this.add.image(-tabW * 0.22, 11, 'padlock').setScale(this.compact ? 1.5 : 2));
        tab.countdown = this.add.text(-tabW * 0.09, 11, clock(this.msUntil(k)), label(this.compact ? 9 : 12)).setOrigin(0, 0.5);
        tab.add(tab.countdown);
      }
      if (k === fresh) {
        tab.setScale(0.6);
        this.tweens.add({ targets: tab, scale: 1, duration: 380, ease: 'Back.Out' });
        for (let i = 0; i < 6; i++) {
          this.time.delayedCall(i * 70, () =>
            sparkle(this, tab.x + Phaser.Math.Between(-tabW / 2, tabW / 2), tab.y + Phaser.Math.Between(-tabH / 2, tabH / 2), { tint: PALETTE.yellow, depth: 9 }),
          );
        }
      }
    });
    this.updateHintStatus();
  }

  updateHintStatus() {
    const unlocked = this.unlockedCount();
    if (unlocked >= 3) this.hintStatus.setText('All hints unlocked');
    else if (unlocked === 0) this.hintStatus.setText(`Try it yourself first! Hint 1 in ${clock(this.msUntil(0))}`);
    else this.hintStatus.setText(`Next hint in ${clock(this.msUntil(unlocked))}`);
  }

  tickHints() {
    const unlocked = this.unlockedCount();
    if (unlocked !== this.shownUnlocked) {
      const fresh = this.shownUnlocked;
      this.shownUnlocked = unlocked;
      this.refreshHints(fresh);
      sfx.ding(2);
      return;
    }
    this.tabs.forEach((tab, k) => tab.countdown?.setText(clock(this.msUntil(k))));
    this.updateHintStatus();
  }

  onTab(k) {
    if (this.overlay) return;
    if (k < this.unlockedCount()) {
      this.openHint(k);
      return;
    }
    const tab = this.tabs[k];
    this.tweens.add({ targets: tab, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => tab.setAngle(0) });
    toast(this, `Hint ${k + 1} unlocks in ${clock(this.msUntil(k))}. Keep trying!`);
  }

  // A big parchment over the screen that unrolls downward. Click outside, GOT IT or Esc closes it.
  openHint(k) {
    sfx.pop();
    this.inputDom.setVisible(false); // the HTML input would otherwise sit on top of the overlay
    const { width, height } = this.scale;
    const w = Math.min(640, width - (this.compact ? 32 : 0));
    const inset = this.compact ? 18 : 40;
    const fontSize = this.compact ? 17 : 20;
    const text = this.add.text(-w / 2 + inset, 66, this.info.hints[k], body(fontSize, CSS.navy, { wordWrap: { width: w - inset * 2 }, lineSpacing: 2 }));
    const h = Math.min(text.height + (this.compact ? 136 : 160), height - 36);
    const top = Math.max(30, (height - h) / 2);

    const shade = this.add.rectangle(0, 0, width, height, PALETTE.navy, 0.6).setOrigin(0).setInteractive();
    shade.on('pointerdown', () => this.closeHint());
    const paper = this.add.graphics();
    paper.fillStyle(PALETTE.navy, 1).fillRect(-w / 2 + 8, 8, w, h);
    paper.fillStyle(0xfdf1d0, 1).fillRect(-w / 2, 0, w, h);
    paper.fillStyle(0xf3e2b5, 1).fillRect(-w / 2, h - 12, w, 12);
    paper.lineStyle(4, PALETTE.navy, 1).strokeRect(-w / 2, 0, w, h);
    // Stop clicks on the paper from reaching the shade behind it.
    const blocker = this.add.zone(0, h / 2, w, h).setInteractive();
    const rod = (y) => {
      const r = this.add.graphics({ y });
      r.fillStyle(PALETTE.woodDark, 1).fillRoundedRect(-w / 2 - 22, -9, w + 44, 18, 8);
      r.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(-w / 2 - 22, -9, w + 44, 18, 8);
      return r;
    };
    const bottomRod = rod(0);
    const title = this.add.text(-w / 2 + inset, 28, `HINT ${k + 1} OF 3`, label(this.compact ? 11 : 14, CSS.coral));
    const done = makeButton(this, 0, h - 42, 'GOT IT', () => this.closeHint(), { width: Math.min(180, w - 36), height: 48, size: this.compact ? 12 : 14 });
    const scroll = this.add.container(width / 2, top, [paper, blocker, text, title, done, rod(0), bottomRod]);

    // Unroll: the paper grows from the top rod while the bottom rod slides down.
    paper.scaleY = 0.04;
    [text, title, done].forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: paper, scaleY: 1, duration: 450, ease: 'Quad.Out' });
    this.tweens.add({ targets: bottomRod, y: h, duration: 450, ease: 'Quad.Out' });
    this.tweens.add({ targets: [text, title, done], alpha: 1, delay: 320, duration: 200 });

    this.overlay = this.add.container(0, 0, [shade, scroll]).setDepth(9000);
  }

  closeHint() {
    if (!this.overlay) return;
    const overlay = this.overlay;
    this.overlay = null;
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        overlay.destroy();
        this.inputDom.setVisible(true);
      },
    });
  }
}
