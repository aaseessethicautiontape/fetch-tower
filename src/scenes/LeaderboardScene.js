import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { FLOORS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { loadImages, trimmedTexture } from '../sprites.js';
import { state } from '../state.js';
import { CSS, PALETTE, body, drawSticker, goTo, heading, label, makeButton, restartOnResize, sparkle, wipeIn } from '../ui.js';

const PODIUM = [
  { place: 2, offsetX: -180, height: 112, colour: 0xdfe6f0 },
  { place: 1, offsetX: 0, height: 152, colour: PALETTE.yellow },
  { place: 3, offsetX: 180, height: 84, colour: 0xf0a868 },
];
const PODIUM_BASE = 470;

// Every species you can meet in Week 2, in floor order.
const WEEK2_SPECIES = [...new Map(FLOORS.flatMap((f) => [...f.wild, ...(f.boss ? [f.boss] : [])]).map((m) => [m.id, m])).values()];

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  init(data) {
    this.tab = data?.tab ?? 'board';
  }

  create() {
    makeArt(this);
    const { width, height } = this.scale;
    this.centerX = width / 2;
    this.compact = width < 900 || height > width;
    this.podiumScale = this.compact ? Math.min(1, (width - 32) / 530) : 1;
    this.layoutY = (designY) => (designY * height) / 640;
    addMeadow(this, { hillsHeight: 120, flowers: 10, birds: 2 });

    // Short screens (phones sideways): TOWER and both tabs share one top row.
    this.short = this.compact && height < 560 && width >= 600;
    if (this.short) {
      const tabWidth = Math.min(170, (width - 150) / 2);
      const mid = 112 + (width - 112) / 2;
      makeButton(this, 58, 28, 'TOWER', () => goTo(this, 'TowerScene'), { width: 96, height: 40, size: 10, color: PALETTE.white }).setDepth(50);
      this.tabs = {
        board: makeButton(this, mid - tabWidth / 2 - 6, 28, 'TROPHIES', () => this.showTab('board'), { width: tabWidth, height: 40, size: 10 }),
        dex: makeButton(this, mid + tabWidth / 2 + 6, 28, 'POKEDEX', () => this.showTab('dex'), { width: tabWidth, height: 40, size: 10 }),
      };
    } else if (this.compact) {
      const tabWidth = Math.min(190, (width - 32) / 2);
      makeButton(this, this.centerX, 28, 'TOWER', () => goTo(this, 'TowerScene'), { width: 112, height: 42, size: 10, color: PALETTE.white }).setDepth(50);
      this.tabs = {
        board: makeButton(this, this.centerX - tabWidth / 2 - 8, 84, 'TROPHIES', () => this.showTab('board'), { width: tabWidth, height: 44, size: 10 }),
        dex: makeButton(this, this.centerX + tabWidth / 2 + 8, 84, 'POKEDEX', () => this.showTab('dex'), { width: tabWidth, height: 44, size: 10 }),
      };
    } else {
      makeButton(this, 72, 40, 'TOWER', () => goTo(this, 'TowerScene'), { width: 112, height: 46, size: 11, color: PALETTE.white }).setDepth(50);
      this.tabs = {
        board: makeButton(this, this.centerX - 105, 40, 'TROPHIES', () => this.showTab('board'), { width: 190, height: 46, size: 12 }),
        dex: makeButton(this, this.centerX + 105, 40, 'POKEDEX', () => this.showTab('dex'), { width: 190, height: 46, size: 12 }),
      };
    }
    this.view = this.add.container(0, 0).setDepth(10);
    this.showTab(this.tab);
    restartOnResize(this, () => ({ tab: this.tab }));
    wipeIn(this);
  }

  showTab(tab) {
    this.tab = tab;
    Object.entries(this.tabs).forEach(([name, button]) => button.setColor(name === tab ? PALETTE.yellow : PALETTE.white));
    this.view.list.forEach((child) => this.tweens.killTweensOf(child));
    this.view.removeAll(true);
    this.sparkleTimer?.remove();
    if (tab === 'board') this.showBoard();
    else this.showDex();
  }

  // ---------- Leaderboard: podium for the top 3, then a list ----------

  async showBoard() {
    const view = this.view;
    const titleY = this.compact ? this.scale.height * 0.2 : this.layoutY(104);
    if (!this.short) view.add(this.add.text(this.centerX, titleY, 'TOP TRAINERS', heading(this.compact ? 16 : 26)).setOrigin(0.5));
    const loading = this.add.image(this.centerX, this.compact ? titleY + 100 : this.layoutY(300), 'ball').setScale(this.compact ? 3 : 4);
    this.tweens.add({ targets: loading, angle: 360, duration: 800, repeat: -1 });
    view.add(loading);

    const res = await api.leaderboard();
    if (!this.sys.isActive() || this.tab !== 'board' || view !== this.view) return;
    loading.destroy();

    const players = res.ok ? [...(res.data.players ?? [])] : [];
    players.sort((a, b) => b.highestFloor - a.highestFloor || b.catches - a.catches);
    // Short screens: the podium fills the height; places 4+ go in a column on the right.
    this.listOnRight = this.short && players.length > 3;
    this.podiumX = this.listOnRight ? this.scale.width * 0.34 : this.centerX;
    if (this.short) this.podiumScale = Math.min(this.podiumScale, (this.scale.height - 76) / 290, ((this.listOnRight ? this.scale.width * 0.66 : this.scale.width) - 24) / 530);
    this.drawPodium(players.slice(0, 3));

    if (!res.ok) {
      this.note(res.offline ? 'The leaderboard opens when the game server is online.' : 'Could not load the leaderboard. Try again soon.', this.short ? 72 : this.compact ? this.scale.height * 0.58 : this.layoutY(560));
      return;
    }
    if (!players.length) {
      this.note('No trainers yet. Be the first to climb!', this.short ? 72 : this.compact ? this.scale.height * 0.58 : this.layoutY(560));
      return;
    }

    // Places 4 and up: two columns on desktop, a compact single column on phones.
    players.slice(3, 11).forEach((p, i) => {
      const col = this.compact ? 0 : i % 2;
      const row = this.compact ? i : Math.floor(i / 2);
      const right = this.listOnRight;
      const x = right ? this.scale.width * 0.83 : this.compact ? this.centerX : this.centerX + (col ? 210 : -210);
      const y = right ? 78 + row * 34 : this.compact ? this.podiumBase + 30 + row * 34 : this.layoutY(520 + row * 46);
      const g = this.add.graphics({ x, y });
      const rowWidth = right ? this.scale.width * 0.3 : this.compact ? this.scale.width - 28 : 380;
      const rowHeight = this.compact ? 30 : 38;
      drawSticker(g, rowWidth, rowHeight, { radius: 10, shadow: 4, stroke: 3 });
      view.add(g);
      const side = rowWidth / 2;
      view.add(this.add.text(x - side + 12, y + 1, `${i + 4}`, label(this.compact ? 9 : 12, CSS.muted)).setOrigin(0, 0.5));
      view.add(this.add.text(x - side + 40, y, p.nickname, body(this.compact ? 13 : 20)).setOrigin(0, 0.5));
      view.add(this.add.text(x + side - 12, y, this.compact ? `F${p.highestFloor} · ${p.catches} caught` : `Floor ${p.highestFloor} · ${p.catches} caught`, body(this.compact ? 12 : 17, CSS.muted)).setOrigin(1, 0.5));
    });
  }

  drawPodium(top3) {
    const view = this.view;
    const scale = this.podiumScale;
    PODIUM.forEach(({ place, offsetX, height, colour }) => {
      const x = (this.podiumX ?? this.centerX) + offsetX * scale;
      const player = top3[place - 1];
      const podiumBase = this.short ? this.scale.height - 14 : this.compact ? this.scale.height * 0.51 : this.layoutY(PODIUM_BASE);
      this.podiumBase = podiumBase;
      const barWidth = 170 * scale;
      const barHeight = height * scale;
      const g = this.add.graphics({ x, y: podiumBase });
      g.fillStyle(PALETTE.navy, 1).fillRect(-barWidth / 2 + 6 * scale, -barHeight + 6 * scale, barWidth, barHeight);
      g.fillStyle(colour, 1).fillRect(-barWidth / 2, -barHeight, barWidth, barHeight);
      g.fillStyle(0xffffff, 0.35).fillRect(-barWidth / 2, -barHeight, barWidth, 10 * scale);
      g.lineStyle(4 * scale, PALETTE.navy, 1).strokeRect(-barWidth / 2, -barHeight, barWidth, barHeight);
      view.add(g);
      view.add(this.add.text(x, podiumBase - barHeight / 2 + 6 * scale, String(place), heading(this.compact ? 25 * scale : 34, CSS.white)).setOrigin(0.5));

      const top = podiumBase - barHeight;
      if (player) {
        const trainer = this.add.image(x, top, 'trainer').setOrigin(0.5, 1).setScale(3 * scale);
        this.tweens.add({ targets: trainer, y: top - 6 * scale, duration: 400 + place * 90, yoyo: true, repeat: -1, ease: 'Quad.Out' });
        const name = this.add.text(0, -8 * scale, player.nickname, body(this.compact ? 15 * scale : 20)).setOrigin(0.5);
        const stats = this.add.text(0, 12 * scale, `Floor ${player.highestFloor} · ${player.catches} caught`, body(this.compact ? 11 * scale : 14, CSS.muted)).setOrigin(0.5);
        const tagW = Math.max(name.width, stats.width) + 20 * scale;
        const tagH = 46 * scale;
        const tag = this.add.graphics();
        drawSticker(tag, tagW, tagH, { radius: 10 * scale, shadow: 4 * scale, stroke: 3 * scale });
        view.add([trainer, this.add.container(x, top - 72 * scale, [tag, name, stats])]);
        if (place === 1) {
          this.sparkleTimer = this.time.addEvent({
            delay: 240,
            loop: true,
            callback: () => sparkle(this, x + Phaser.Math.Between(-70, 70) * scale, top - Phaser.Math.Between(10, 120) * scale, { tint: PALETTE.yellow, depth: 20 }),
          });
        }
      } else {
        view.add(this.add.text(x, top - 30, '?', heading(28, CSS.white)).setOrigin(0.5));
      }
    });
  }

  note(message, y) {
    const t = this.add.text(this.centerX, y, message, body(this.compact ? 16 : 20, CSS.navy, { wordWrap: { width: this.scale.width - 48 }, align: 'center' })).setOrigin(0.5);
    const g = this.add.graphics({ x: this.centerX, y });
    drawSticker(g, Math.min(this.scale.width - 24, t.width + 36), this.compact ? t.height + 22 : 46, { fill: PALETTE.yellow, radius: 12, shadow: 5 });
    this.view.add([g, t]);
  }

  // ---------- Pokédex: a grid of sticker cards ----------

  async showDex() {
    const view = this.view;
    const caughtById = new Map(state.pokedex.map((p) => [p.id, p]));
    const species = [...WEEK2_SPECIES];
    state.pokedex.forEach((p) => !species.some((s) => s.id === p.id) && species.push({ id: p.id, name: p.name }));

    if (!this.short) view.add(this.add.text(this.centerX, this.compact ? this.scale.height * 0.19 : this.layoutY(104), 'POKEDEX', heading(this.compact ? 18 : 26)).setOrigin(0.5));
    view.add(this.add.text(this.centerX, this.short ? 66 : this.compact ? this.scale.height * 0.23 : this.layoutY(142), `${caughtById.size} of ${species.length} caught`, body(this.compact ? 15 : 20, CSS.white, { stroke: CSS.navy, strokeThickness: 5 })).setOrigin(0.5));

    const phoneGrid = this.scale.width < 700 || this.scale.height > this.scale.width;
    const columnGap = this.compact ? 8 : 14;
    const rowGap = this.compact ? 8 : 14;
    const cols = this.short ? 6 : phoneGrid ? 2 : this.compact ? 4 : 6;
    const cardW = this.compact ? Math.min(phoneGrid ? 168 : 132, (this.scale.width - 32 - (cols - 1) * columnGap) / cols) : 132;
    const gridTop = this.short ? 84 : this.compact ? this.scale.height * 0.29 : this.layoutY(262);
    const rowCount = Math.ceil(species.length / cols);
    const rowStep = this.compact ? (this.scale.height - gridTop - 20) / rowCount : 190;
    const cardH = this.compact ? Math.min(128, rowStep - rowGap) : 176;
    const previewHeight = this.compact ? Math.min(56, Math.max(30, cardH * 0.42)) : 82;
    const startX = this.centerX - ((cols - 1) * (cardW + columnGap)) / 2;
    const cards = species.map((s, i) => {
      const x = startX + (i % cols) * (cardW + columnGap);
      const y = gridTop + Math.floor(i / cols) * rowStep + cardH / 2;
      const caught = caughtById.get(s.id);
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      drawSticker(g, cardW, cardH, { fill: caught ? PALETTE.white : PALETTE.mist, radius: 12, shadow: 5 });
      g.fillStyle(caught ? PALETTE.skyBottom : 0xd5dbe8, 1).fillRoundedRect(-cardW / 2 + 10, -cardH / 2 + 10, cardW - 20, previewHeight, 8);
      c.add(g);
      const number = this.add.text(-cardW / 2 + 14, -cardH / 2 + 14, `#${String(s.id).padStart(3, '0')}`, body(13, CSS.muted));
      c.add(number);
      const lineGap = this.compact ? Math.min(18, cardH * 0.16) : 20;
      const nameY = this.compact ? cardH / 2 - lineGap * 2 - 10 : 30;
      if (caught) {
        c.add(this.add.text(0, nameY, caught.name.toUpperCase(), label(this.compact ? 7 : 9)).setOrigin(0.5));
        c.add(this.add.text(0, nameY + lineGap, `HP ${caught.hp}  ATK ${caught.attack}`, body(this.compact ? 9 : 14, CSS.muted)).setOrigin(0.5));
        c.add(this.add.text(0, nameY + lineGap * 2, `SPD ${caught.speed}`, body(this.compact ? 9 : 14, CSS.muted)).setOrigin(0.5));
      } else {
        c.add(this.add.text(0, nameY + lineGap / 2, '???', label(this.compact ? 9 : 12, CSS.muted)).setOrigin(0.5));
        c.add(this.add.text(0, nameY + lineGap * 1.5, 'Not caught yet', body(this.compact ? 9 : 14, CSS.muted)).setOrigin(0.5));
      }
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, delay: i * 50, duration: 260, ease: 'Back.Out' });
      view.add(c);
      return { c, s, caught, number };
    });

    // Sprites: real colours for caught ones, navy silhouettes for the rest.
    let pokemon;
    try {
      pokemon = await Promise.all(species.map((s) => getPokemon(s.id)));
    } catch {
      return;
    }
    if (!this.sys.isActive() || view !== this.view || this.tab !== 'dex') return;
    loadImages(this, pokemon.map((p) => [`poke-${p.id}`, p.sprite]), () => {
      if (this.tab !== 'dex') return;
      cards.forEach(({ c, s, caught, number }) => {
        if (!c.active) return;
        const img = this.add.image(0, -cardH / 2 + 10 + previewHeight / 2, trimmedTexture(this, `poke-${s.id}`));
        const spriteSize = Math.max(img.width, img.height);
        img.setScale(this.compact ? Math.min(1.2, (previewHeight - 8) / spriteSize) : spriteSize * 2 <= 76 ? 2 : 1);
        if (!caught) img.setTintFill(PALETTE.navy);
        c.add(img);
        c.bringToTop(number);
      });
    });
  }
}
