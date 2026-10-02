import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { DOORS, HINT_UNLOCK_MS, WRONG_IN_A_ROW_FOR_HINT } from '../data/doors.js';
import { sfx } from '../sfx.js';
import { save, session, startHintTimer, state } from '../state.js';
import { CSS, PALETTE, body, confetti, drawSticker, goTo, heading, label, makeButton, outlined, sparkle, toast, wipeIn, woodSign } from '../ui.js';

const DOOR_X = 214; // centre of the stone door
const DOOR_FLOOR = 566; // bottom of the stone door
const COL_X = 680; // centre of the right-hand column
const COL_W = 520;
const SIGN_TOP = 20;
const GAP = 14;
const HINTS_Y = 568; // centre of the hint tabs
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
    addMeadow(this, { hillsHeight: 150, flowers: 9, birds: 1 });
    this.startedAt = startHintTimer(this.door);

    this.drawDoor();
    this.drawQuestion();
    this.drawHintBar();
    this.shownUnlocked = this.unlockedCount();
    this.refreshHints(-1);
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickHints() });

    makeButton(this, 72, 40, 'TOWER', () => goTo(this, 'TowerScene'), { width: 112, height: 46, size: 11, color: PALETTE.white }).setDepth(50);
    this.input.keyboard.addKey('ESC', false).on('down', () => this.closeHint());

    if (this.opened) this.showOpen(false);
    wipeIn(this);
  }

  // ---------- The big friendly door ----------

  drawDoor() {
    const fx = DOOR_X;
    const fy = DOOR_FLOOR;
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
    const puff = this.add.container(DOOR_X + 70, DOOR_FLOOR - 250).setDepth(20).setScale(0);
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
        sparkle(this, DOOR_X + Phaser.Math.Between(-70, 70), DOOR_FLOOR - Phaser.Math.Between(20, 230), {
          tint: Phaser.Utils.Array.GetRandom([PALETTE.yellow, PALETTE.white, PALETTE.cyan]),
          depth: 6,
        }),
    });
    if (celebrate) {
      sfx.open();
      this.cameras.main.flash(300, 255, 250, 210);
      confetti(this, DOOR_X, DOOR_FLOOR - 120, 90);
      this.time.delayedCall(400, () => confetti(this, COL_X, 640, 60));
    }
    this.answerInput.disabled = true;
    this.submit.setLabel('CLIMB!').setColor(PALETTE.cyan).setEnabled(true);
    this.setFeedback(celebrate ? 'Correct! The door is open.' : 'This door is already open!', PALETTE.grass);
  }

  // ---------- Sign (context + question), answer box, feedback ----------

  drawQuestion() {
    const left = COL_X - COL_W / 2 + 22;
    const wrap = { wordWrap: { width: COL_W - 44 } };
    const title = this.add.text(left, SIGN_TOP + 16, this.info.title.toUpperCase(), label(11, '#7a3d12')).setDepth(6);
    const context = this.add.text(left, title.y + title.height + 10, this.info.context, body(15, '#5c3410', { ...wrap, lineSpacing: -2 })).setDepth(6);
    const divider = context.y + context.height + 8;
    const question = this.add.text(left, divider + 10, this.info.question, body(21, CSS.navy, { ...wrap, lineSpacing: -1 })).setDepth(6);
    const signH = question.y + question.height + 16 - SIGN_TOP;
    woodSign(this, COL_X, SIGN_TOP + signH / 2, COL_W, signH, { posts: 0 }).setDepth(5);
    this.add.graphics().setDepth(6).fillStyle(0xb87436, 0.6).fillRect(left, divider, COL_W - 44, 3);

    // Answer box and GO! button just under the sign.
    const inputY = SIGN_TOP + signH + 44;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ft-answer';
    input.placeholder = this.info.placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.width = '384px';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.onSubmit();
    });
    this.inputDom = this.add.dom(COL_X - 66, inputY, input).setDepth(10);
    this.answerInput = input;
    this.submit = makeButton(this, COL_X + 196, inputY, 'GO!', () => this.onSubmit(), { width: 110, height: 54, size: 16 }).setDepth(10);

    // The message bubble hangs below the answer box (box + shadow end ~34px under its centre).
    this.feedbackTop = inputY + 34 + GAP;
    this.feedback = this.add.container(COL_X, this.feedbackTop).setDepth(10);
  }

  // The bubble only grows downward from feedbackTop, so it never covers the answer box.
  // The hint tabs sit at the bottom with room for a few lines of message above them.
  setFeedback(message, fill = PALETTE.white) {
    this.tweens.killTweensOf(this.feedback);
    this.feedback.removeAll(true);
    if (!message) return;
    const textColor = fill === PALETTE.coral || fill === PALETTE.grass ? CSS.white : CSS.navy;
    const stroke = textColor === CSS.white ? { stroke: CSS.navy, strokeThickness: 4 } : {};
    const t = this.add.text(0, 8, message, body(18, textColor, { wordWrap: { width: COL_W - 48 }, align: 'center', ...stroke })).setOrigin(0.5, 0);
    const h = t.height + 16;
    const g = this.add.graphics();
    drawSticker(g, Math.min(COL_W, t.width + 32), h, { fill, radius: 12, shadow: 4, stroke: 3, oy: h / 2 });
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
    const top = HINTS_Y - TAB_H / 2 - 36;
    this.add.text(COL_X - COL_W / 2, top, 'HINTS', heading(14, CSS.yellow)).setDepth(8);
    this.hintStatus = this.add.text(COL_X + COL_W / 2, top + 2, '', outlined(16)).setOrigin(1, 0).setDepth(8);
    this.tabs = [0, 1, 2].map((k) => {
      const x = COL_X + (k - 1) * (TAB_W + 30);
      const tab = this.add.container(x, HINTS_Y).setDepth(8).setSize(TAB_W, TAB_H);
      tab.setInteractive({ useHandCursor: true });
      tab.on('pointerover', () => !this.overlay && this.tweens.add({ targets: tab, y: HINTS_Y - 5, duration: 100 }));
      tab.on('pointerout', () => this.tweens.add({ targets: tab, y: HINTS_Y, duration: 100 }));
      tab.on('pointerdown', () => this.onTab(k));
      return tab;
    });
  }

  // Redraw the tabs. `fresh` = index of a hint that just unlocked (it pops in with sparkles).
  refreshHints(fresh) {
    const unlocked = this.unlockedCount();
    this.tabs.forEach((tab, k) => {
      tab.removeAll(true);
      tab.countdown = null;
      const open = k < unlocked;
      const g = this.add.graphics();
      if (open) g.lineStyle(6, PALETTE.cyan, 1).strokeRoundedRect(-TAB_W / 2 - 11, -TAB_H / 2 - 9, TAB_W + 22, TAB_H + 18, 14);
      // A rolled scroll: paper with wooden ends.
      g.fillStyle(PALETTE.navy, 1).fillRoundedRect(-TAB_W / 2 + 5, -TAB_H / 2 + 5, TAB_W, TAB_H, 10);
      g.fillStyle(open ? 0xfdf1d0 : 0xe9dcbc, 1).fillRoundedRect(-TAB_W / 2, -TAB_H / 2, TAB_W, TAB_H, 10);
      g.fillStyle(open ? 0xfff8e4 : 0xf1e6cb, 1).fillRect(-TAB_W / 2 + 14, -TAB_H / 2 + 5, TAB_W - 28, 5);
      g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(-TAB_W / 2, -TAB_H / 2, TAB_W, TAB_H, 10);
      [-TAB_W / 2 - 6, TAB_W / 2 - 6].forEach((x) => {
        g.fillStyle(PALETTE.woodDark, 1).fillRoundedRect(x, -TAB_H / 2 - 5, 12, TAB_H + 10, 5);
        g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(x, -TAB_H / 2 - 5, 12, TAB_H + 10, 5);
      });
      tab.add(g);
      tab.add(this.add.text(0, -12, `HINT ${k + 1}`, label(11, open ? CSS.coral : CSS.muted)).setOrigin(0.5));
      if (open) {
        tab.add(this.add.text(0, 13, 'Click to read', body(16)).setOrigin(0.5));
      } else {
        tab.add(this.add.image(-34, 13, 'padlock').setScale(2));
        tab.countdown = this.add.text(-14, 13, clock(this.msUntil(k)), label(12)).setOrigin(0, 0.5);
        tab.add(tab.countdown);
      }
      if (k === fresh) {
        tab.setScale(0.6);
        this.tweens.add({ targets: tab, scale: 1, duration: 380, ease: 'Back.Out' });
        for (let i = 0; i < 6; i++) {
          this.time.delayedCall(i * 70, () =>
            sparkle(this, tab.x + Phaser.Math.Between(-80, 80), tab.y + Phaser.Math.Between(-34, 34), { tint: PALETTE.yellow, depth: 9 }),
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
    const w = 640;
    const text = this.add.text(-w / 2 + 40, 66, this.info.hints[k], body(20, CSS.navy, { wordWrap: { width: w - 80 }, lineSpacing: 2 }));
    const h = text.height + 160;
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
    const title = this.add.text(-w / 2 + 40, 28, `HINT ${k + 1} OF 3`, label(14, CSS.coral));
    const done = makeButton(this, 0, h - 52, 'GOT IT', () => this.closeHint(), { width: 180, height: 50, size: 14 });
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
