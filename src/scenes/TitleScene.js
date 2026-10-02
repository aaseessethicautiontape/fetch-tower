import Phaser from 'phaser';
import { addBirds, addClouds, addFlowers, addSky, hillsTexture, makeArt, seeded } from '../art.js';
import { syncProgress } from '../api.js';
import { STARTERS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { TYPE_COLORS } from '../data/types.js';
import { loadImages, resizedTexture } from '../sprites.js';
import { state, setPlayer } from '../state.js';
import { CSS, IS_TOUCH, PALETTE, body, drawSticker, goTo, heading, label, makeButton, sparkle, woodSign, wipeIn } from '../ui.js';

const CARD_W = 168;
const CARD_H = 204;
const CARD_GAP = 22;
const CARD_Y = 428;
const ART_SIZE = 120;

// Type strip colours from the art direction (grass green, fire orange, water blue, electric yellow).
const STARTER_TYPES = { 1: 'grass', 4: 'fire', 7: 'water', 25: 'electric' };

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    makeArt(this);
    const { width, height } = this.scale;
    const cx = width / 2;
    this.selected = state.starter;
    this.cards = new Map();

    // Sky, clouds and birds behind everything.
    addSky(this);
    addClouds(this, { count: 7, maxY: 320 });
    addBirds(this, { count: 3, minY: 60, maxY: 190 });

    // The tower, flags waving on top.
    const towerTop = 206;
    this.add.image(cx, towerTop, 'tower').setOrigin(0.5, 0).setScale(3).setDepth(-60);
    [[-66, 'coral', 0], [0, 'yellow', 0], [66, 'cyan', 0]].forEach(([dx, colour, lift]) => {
      const poleBottom = towerTop + 6 - lift;
      const poleTop = poleBottom - 48;
      this.add.image(cx + dx, poleBottom, 'pole').setOrigin(0.5, 1).setScale(3).setDepth(-61);
      this.add.sprite(cx + dx + 3, poleTop + 3, `flag-${colour}-0`).setOrigin(0, 0).setScale(3).setDepth(-61).play(`flag-${colour}`);
    });

    // Rolling hills and swaying flowers.
    this.add.image(0, height, hillsTexture(this, width, 228)).setOrigin(0, 1).setDepth(-50);
    const rand = seeded(42);
    const spots = Array.from({ length: 16 }, (_, i) => [
      Math.round((i + 0.5) * (width / 16) + (rand() - 0.5) * 30),
      Math.round(height - 6 - rand() * 70),
    ]);
    addFlowers(this, spots, { depth: -40 });

    // Big bouncing title.
    const title = this.add.text(cx, 72, 'FETCH TOWER', heading(54)).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: title, y: 62, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const badge = this.add.graphics({ x: cx, y: 140 }).setDepth(10);
    drawSticker(badge, 236, 34, { fill: PALETTE.coral, radius: 17, shadow: 4, stroke: 3 });
    this.add.text(cx, 141, 'WEEK 2 · CATCH & CLIMB', body(18, CSS.white)).setOrigin(0.5).setDepth(10);

    this.createNicknameSign(cx, 262);

    const rowWidth = STARTERS.length * CARD_W + (STARTERS.length - 1) * CARD_GAP;
    STARTERS.forEach((starter, i) => {
      const x = cx - rowWidth / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      this.cards.set(starter.id, this.createCard(x, CARD_Y, starter, i));
    });

    this.playButton = makeButton(this, cx, 592, 'PLAY!', () => this.play(), { width: 320, height: 64, size: 20 });

    // Sparkles keep popping around the selected card.
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const card = this.cards.get(this.selected);
        if (!card) return;
        const edge = Math.random() * 4;
        const t = Math.random();
        const sx = edge < 2 ? (t - 0.5) * CARD_W : (edge < 3 ? -1 : 1) * (CARD_W / 2 + 6);
        const sy = edge < 2 ? (edge < 1 ? -1 : 1) * (CARD_H / 2 + 6) : (t - 0.5) * CARD_H;
        const tints = [PALETTE.yellow, PALETTE.cyan, PALETTE.white];
        sparkle(this, card.container.x + sx, card.container.y + sy, { tint: tints[Math.floor(Math.random() * 3)], depth: 30 });
      },
    });

    this.refresh();
    this.loadStarterArt();
    wipeIn(this);
  }

  // A wooden sign with the nickname typed straight onto it.
  createNicknameSign(x, y) {
    woodSign(this, x, y, 400, 62, { posts: 44 }).setDepth(5);
    this.signGlow = this.add.graphics({ x, y }).setDepth(4);
    this.signGlow.lineStyle(6, PALETTE.cyan, 1).strokeRect(-205, -36, 410, 72).setAlpha(0);
    const tag = this.add.graphics({ x: x - 150, y: y - 38 }).setDepth(6);
    drawSticker(tag, 116, 26, { fill: PALETTE.yellow, radius: 13, shadow: 3, stroke: 3 });
    this.add.text(x - 150, y - 37, 'YOUR NAME', label(9)).setOrigin(0.5).setDepth(6);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ft-sign-input';
    input.maxLength = 16;
    input.placeholder = 'Type it here';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = state.nickname;
    input.addEventListener('input', () => this.refresh());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.play();
    });
    input.addEventListener('focus', () => this.tweens.add({ targets: this.signGlow, alpha: 1, duration: 150 }));
    input.addEventListener('blur', () => this.tweens.add({ targets: this.signGlow, alpha: 0, duration: 150 }));

    this.add.dom(x, y + 2, input).setDepth(7);
    this.nicknameInput = input;
  }

  createCard(x, y, starter, index) {
    const type = STARTER_TYPES[starter.id];
    const strip = TYPE_COLORS[type];

    const glow = this.add.graphics();
    glow.lineStyle(8, PALETTE.cyan, 1).strokeRoundedRect(-CARD_W / 2 - 8, -CARD_H / 2 - 8, CARD_W + 16, CARD_H + 16, 20);
    glow.setAlpha(0);

    const panel = this.add.graphics();
    drawSticker(panel, CARD_W, CARD_H, { radius: 14 });
    panel.fillStyle(strip, 1).fillRoundedRect(-CARD_W / 2 + 2, -CARD_H / 2 + 2, CARD_W - 4, 32, { tl: 12, tr: 12, bl: 0, br: 0 });
    panel.lineStyle(4, PALETTE.navy, 1).lineBetween(-CARD_W / 2, -CARD_H / 2 + 34, CARD_W / 2, -CARD_H / 2 + 34);
    panel.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);

    const typeText = this.add.text(-CARD_W / 2 + 12, -CARD_H / 2 + 18, type.toUpperCase(), body(17, CSS.white, { stroke: CSS.navy, strokeThickness: 4 })).setOrigin(0, 0.5);
    const number = this.add.text(CARD_W / 2 - 12, -CARD_H / 2 + 18, `#${String(starter.id).padStart(3, '0')}`, body(15, CSS.navy)).setOrigin(1, 0.5);
    const loading = this.add.image(0, 2, 'ball').setScale(3);
    this.tweens.add({ targets: loading, angle: 360, duration: 800, repeat: -1 });
    const name = this.add.text(0, CARD_H / 2 - 24, starter.name.toUpperCase(), label(12)).setOrigin(0.5);

    const container = this.add.container(x, y, [glow, panel, typeText, number, loading, name]).setDepth(20);
    container.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    const card = { container, glow, loading, name, id: starter.id, baseY: y, tilt: index % 2 ? 3 : -3 };

    container.on('pointerover', () => {
      if (this.selected === starter.id) return;
      this.tweens.add({ targets: container, y: y - 12, duration: 140, yoyo: true, ease: 'Quad.Out' });
    });
    container.on('pointerdown', () => {
      this.selected = starter.id;
      this.refresh();
    });
    return card;
  }

  // Fetch each starter from PokéAPI, then load its official artwork into the card.
  async loadStarterArt() {
    let pokemon;
    try {
      pokemon = await Promise.all(STARTERS.map((s) => getPokemon(s.id)));
    } catch {
      if (!this.sys.isActive()) return;
      this.cards.forEach((c) => c.loading.setVisible(false));
      this.showError("Couldn't reach PokéAPI. Check your internet and reload.");
      return;
    }
    if (!this.sys.isActive()) return;

    loadImages(this, pokemon.map((p) => [`art-${p.id}`, p.artwork]), () => {
      pokemon.forEach((p) => {
        const card = this.cards.get(p.id);
        card.name.setText(p.name.toUpperCase());
        if (!this.textures.exists(`art-${p.id}`)) return;
        card.loading.destroy();
        const art = this.add.image(0, 2, resizedTexture(this, `art-${p.id}`, ART_SIZE)).setScale(0);
        card.container.addAt(art, 2);
        this.tweens.add({ targets: art, scale: 1, duration: 350, ease: 'Back.Out' });
      });
    });
  }

  showError(message) {
    const t = this.add.text(this.scale.width / 2, 196, message, body(18, CSS.white, { backgroundColor: CSS.coral, padding: { x: 12, y: 6 } }));
    t.setOrigin(0.5).setDepth(50);
  }

  refresh() {
    this.cards.forEach((c) => {
      const isSelected = c.id === this.selected;
      this.tweens.killTweensOf(c.container);
      this.tweens.add({
        targets: c.container,
        y: isSelected ? c.baseY - 18 : c.baseY,
        angle: isSelected ? c.tilt : 0,
        scale: isSelected ? 1.04 : 1,
        duration: 260,
        ease: 'Back.Out',
      });
      c.glow.setAlpha(isSelected ? 1 : 0);
      c.container.setDepth(isSelected ? 25 : 20);
    });

    const nickname = this.nicknameInput.value.trim();
    if (!nickname) this.playButton.setLabel('TYPE YOUR NAME').setEnabled(false);
    else if (this.selected == null) this.playButton.setLabel('PICK A STARTER').setEnabled(false);
    else this.playButton.setLabel('PLAY!').setEnabled(true);
  }

  play() {
    const nickname = this.nicknameInput.value.trim();
    if (!nickname || this.selected == null) return;

    setPlayer(nickname, this.selected);
    // On phones, go fullscreen and hold landscape where the browser allows it (Android; iOS ignores this).
    if (IS_TOUCH && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
        screen.orientation?.lock?.('landscape').catch(() => {});
      } catch {
        // not supported: the game still fits the screen
      }
    }
    syncProgress(); // ask the server where this player is; the tower map waits for it
    goTo(this, 'TowerScene');
  }
}
