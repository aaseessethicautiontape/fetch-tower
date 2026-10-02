import Phaser from 'phaser';
import { addMeadow, makeArt } from '../art.js';
import { api } from '../api.js';
import { FLOORS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { loadImages, trimmedTexture } from '../sprites.js';
import { state } from '../state.js';
import { CSS, PALETTE, body, drawSticker, goTo, heading, label, makeButton, sparkle, wipeIn } from '../ui.js';

const PODIUM = [
  { place: 2, x: 300, height: 112, colour: 0xdfe6f0 },
  { place: 1, x: 480, height: 152, colour: PALETTE.yellow },
  { place: 3, x: 660, height: 84, colour: 0xf0a868 },
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
    addMeadow(this, { hillsHeight: 120, flowers: 10, birds: 2 });

    makeButton(this, 72, 40, 'TOWER', () => goTo(this, 'TowerScene'), { width: 112, height: 46, size: 11, color: PALETTE.white }).setDepth(50);
    this.tabs = {
      board: makeButton(this, 400, 40, 'TROPHIES', () => this.showTab('board'), { width: 190, height: 46, size: 12 }),
      dex: makeButton(this, 610, 40, 'POKEDEX', () => this.showTab('dex'), { width: 190, height: 46, size: 12 }),
    };
    this.view = this.add.container(0, 0).setDepth(10);
    this.showTab(this.tab);
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
    view.add(this.add.text(480, 104, 'TOP TRAINERS', heading(26)).setOrigin(0.5));
    const loading = this.add.image(480, 300, 'ball').setScale(4);
    this.tweens.add({ targets: loading, angle: 360, duration: 800, repeat: -1 });
    view.add(loading);

    const res = await api.leaderboard();
    if (!this.sys.isActive() || this.tab !== 'board' || view !== this.view) return;
    loading.destroy();

    const players = res.ok ? [...(res.data.players ?? [])] : [];
    players.sort((a, b) => b.highestFloor - a.highestFloor || b.catches - a.catches);
    this.drawPodium(players.slice(0, 3));

    if (!res.ok) {
      this.note(res.offline ? 'The leaderboard opens when the game server is online.' : 'Could not load the leaderboard. Try again soon.', 560);
      return;
    }
    if (!players.length) {
      this.note('No trainers yet. Be the first to climb!', 560);
      return;
    }

    // Places 4 and up: sticker strips in two columns.
    players.slice(3, 11).forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col ? 690 : 270;
      const y = 520 + row * 46;
      const g = this.add.graphics({ x, y });
      drawSticker(g, 380, 38, { radius: 10, shadow: 4, stroke: 3 });
      view.add(g);
      view.add(this.add.text(x - 176, y + 1, `${i + 4}`, label(12, CSS.muted)).setOrigin(0, 0.5));
      view.add(this.add.text(x - 136, y, p.nickname, body(20)).setOrigin(0, 0.5));
      view.add(this.add.text(x + 176, y, `Floor ${p.highestFloor} · ${p.catches} caught`, body(17, CSS.muted)).setOrigin(1, 0.5));
    });
  }

  drawPodium(top3) {
    const view = this.view;
    PODIUM.forEach(({ place, x, height, colour }) => {
      const player = top3[place - 1];
      const g = this.add.graphics({ x, y: PODIUM_BASE });
      g.fillStyle(PALETTE.navy, 1).fillRect(-85 + 6, -height + 6, 170, height);
      g.fillStyle(colour, 1).fillRect(-85, -height, 170, height);
      g.fillStyle(0xffffff, 0.35).fillRect(-85, -height, 170, 10);
      g.lineStyle(4, PALETTE.navy, 1).strokeRect(-85, -height, 170, height);
      view.add(g);
      view.add(this.add.text(x, PODIUM_BASE - height / 2 + 6, String(place), heading(34, CSS.white)).setOrigin(0.5));

      const top = PODIUM_BASE - height;
      if (player) {
        const trainer = this.add.image(x, top, 'trainer').setOrigin(0.5, 1).setScale(3);
        this.tweens.add({ targets: trainer, y: top - 6, duration: 400 + place * 90, yoyo: true, repeat: -1, ease: 'Quad.Out' });
        const name = this.add.text(0, -9, player.nickname, body(20)).setOrigin(0.5);
        const stats = this.add.text(0, 12, `Floor ${player.highestFloor} · ${player.catches} caught`, body(14, CSS.muted)).setOrigin(0.5);
        const tagW = Math.max(name.width, stats.width) + 24;
        const tag = this.add.graphics();
        drawSticker(tag, tagW, 52, { radius: 10, shadow: 4, stroke: 3 });
        view.add([trainer, this.add.container(x, top - 82, [tag, name, stats])]);
        if (place === 1) {
          this.sparkleTimer = this.time.addEvent({
            delay: 240,
            loop: true,
            callback: () => sparkle(this, x + Phaser.Math.Between(-70, 70), top - Phaser.Math.Between(10, 120), { tint: PALETTE.yellow, depth: 20 }),
          });
        }
      } else {
        view.add(this.add.text(x, top - 30, '?', heading(28, CSS.white)).setOrigin(0.5));
      }
    });
  }

  note(message, y) {
    const t = this.add.text(480, y, message, body(20)).setOrigin(0.5);
    const g = this.add.graphics({ x: 480, y });
    drawSticker(g, t.width + 36, 46, { fill: PALETTE.yellow, radius: 23, shadow: 5 });
    this.view.add([g, t]);
  }

  // ---------- Pokédex: a grid of sticker cards ----------

  async showDex() {
    const view = this.view;
    const caughtById = new Map(state.pokedex.map((p) => [p.id, p]));
    const species = [...WEEK2_SPECIES];
    state.pokedex.forEach((p) => !species.some((s) => s.id === p.id) && species.push({ id: p.id, name: p.name }));

    view.add(this.add.text(480, 104, 'POKEDEX', heading(26)).setOrigin(0.5));
    view.add(this.add.text(480, 142, `${caughtById.size} of ${species.length} caught`, body(20, CSS.white, { stroke: CSS.navy, strokeThickness: 5 })).setOrigin(0.5));

    const cols = 6;
    const cardW = 132;
    const cardH = 176;
    const gap = 14;
    const startX = 480 - ((cols - 1) * (cardW + gap)) / 2;
    const cards = species.map((s, i) => {
      const x = startX + (i % cols) * (cardW + gap);
      const y = 262 + Math.floor(i / cols) * (cardH + gap);
      const caught = caughtById.get(s.id);
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      drawSticker(g, cardW, cardH, { fill: caught ? PALETTE.white : PALETTE.mist, radius: 12, shadow: 5 });
      g.fillStyle(caught ? PALETTE.skyBottom : 0xd5dbe8, 1).fillRoundedRect(-cardW / 2 + 10, -cardH / 2 + 10, cardW - 20, 82, 8);
      c.add(g);
      const number = this.add.text(-cardW / 2 + 14, -cardH / 2 + 14, `#${String(s.id).padStart(3, '0')}`, body(13, CSS.muted));
      c.add(number);
      if (caught) {
        c.add(this.add.text(0, 30, caught.name.toUpperCase(), label(9)).setOrigin(0.5));
        c.add(this.add.text(0, 50, `HP ${caught.hp}  ATK ${caught.attack}`, body(14, CSS.muted)).setOrigin(0.5));
        c.add(this.add.text(0, 68, `SPD ${caught.speed}`, body(14, CSS.muted)).setOrigin(0.5));
      } else {
        c.add(this.add.text(0, 34, '???', label(12, CSS.muted)).setOrigin(0.5));
        c.add(this.add.text(0, 60, 'Not caught yet', body(14, CSS.muted)).setOrigin(0.5));
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
        const img = this.add.image(0, -cardH / 2 + 51, trimmedTexture(this, `poke-${s.id}`));
        img.setScale(Math.max(img.width, img.height) * 2 <= 76 ? 2 : 1);
        if (!caught) img.setTintFill(PALETTE.navy);
        c.add(img);
        c.bringToTop(number);
      });
    });
  }
}
