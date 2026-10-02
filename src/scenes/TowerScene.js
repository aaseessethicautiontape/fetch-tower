import Phaser from 'phaser';
import { addBirds, addClouds, addFlowers, addSky, hillsTexture, makeArt, seeded } from '../art.js';
import { syncProgress } from '../api.js';
import { FLOORS, FUTURE_WEEKS, STARTERS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { loadImages, trimmedTexture } from '../sprites.js';
import { session, state } from '../state.js';
import { CSS, IS_TOUCH, PALETTE, body, drawSticker, goTo, heading, label, lighten, makeButton, outlined, restartOnResize, sparkle, toast, wipeIn, woodSign } from '../ui.js';

const FLOOR_H = 190;
const GROUND = 250; // world space below Floor 1
const ROOF = 300; // world space above the top floor
const TX0 = 170; // tower left edge
const TX1 = 790; // tower right edge
const CX = (TX0 + TX1) / 2;
const SLAB_H = 30;
const FLOOR_COLORS = [0x4cb944, 0x3d9bff, 0x9b6bff, 0xff9a3d, 0xff7eb6, 0xffd23f];
const TOTAL_FLOORS = FLOORS.length + FUTURE_WEEKS.length;
const WORLD_H = GROUND + TOTAL_FLOORS * FLOOR_H + ROOF;

// y of the top of floor index i's slab (i = 0 is Floor 1).
const floorBottom = (i) => WORLD_H - GROUND - i * FLOOR_H;

export class TowerScene extends Phaser.Scene {
  constructor() {
    super('TowerScene');
  }

  init(data) {
    this.resizeScrollY = data?.scrollY;
  }

  create() {
    makeArt(this);
    const cam = this.cameras.main;
    // The tower art uses a 960px layout; center it in any extra width Phaser expands into.
    this.worldOffsetX = (this.scale.width - 960) / 2;
    cam.setBounds(-this.worldOffsetX, 0, this.scale.width, WORLD_H);
    cam.scrollX = -this.worldOffsetX;
    const restoredScroll = this.resizeScrollY != null;
    cam.scrollY = restoredScroll
      ? Phaser.Math.Clamp(this.resizeScrollY, 0, WORLD_H - this.scale.height)
      : WORLD_H - this.scale.height;

    addSky(this);
    addClouds(this, { count: 7, minY: 20, maxY: 600, depth: -90, seed: 11 });
    addBirds(this, { count: 2, minY: 80, maxY: 300 });

    this.drawTower();
    this.drawGround();
    this.drawFutureWeeks();
    this.dynamic = this.add.container(0, 0).setDepth(15);
    this.floorParts = [];
    FLOORS.forEach((floor, i) => this.drawFloor(floor, i));

    this.createHud();
    this.setupScrolling();
    restartOnResize(this, () => ({ scrollY: this.cameras.main.scrollY }));
    this.renderProgress();
    this.loadPokemonSprites();

    // The fake door's Console trick (PRD section 7).
    const onForceOpen = (e) => this.onForceOpen(e.detail);
    window.addEventListener('tower-force-open', onForceOpen);
    this.events.once('shutdown', () => window.removeEventListener('tower-force-open', onForceOpen));

    wipeIn(this);
    if (!restoredScroll) this.time.delayedCall(500, () => this.panToFloor(session.highestFloor));

    // Ask the server where this player really is, then redraw doors and locks.
    syncProgress().then(() => {
      if (!this.sys.isActive()) return;
      this.renderProgress();
      this.offlineChip.setVisible(!session.online);
    });
  }

  // ---------- Static tower ----------

  drawTower() {
    const top = floorBottom(TOTAL_FLOORS - 1) - FLOOR_H;
    const bottom = WORLD_H - 70;
    this.walls = [];
    for (let i = 0; i < TOTAL_FLOORS; i++) {
      const wall = this.add.tileSprite(TX0, floorBottom(i) - FLOOR_H, TX1 - TX0, FLOOR_H, 'brick').setOrigin(0).setDepth(1);
      this.walls.push(wall);
    }
    this.add.tileSprite(TX0, floorBottom(0), TX1 - TX0, bottom - floorBottom(0), 'brick').setOrigin(0).setDepth(1);

    const g = this.add.graphics().setDepth(2);
    // Corner pillars and outline.
    g.fillStyle(0xe9dcc2, 1).fillRect(TX0, top, 22, bottom - top).fillRect(TX1 - 22, top, 22, bottom - top);
    g.lineStyle(6, PALETTE.navy, 1).strokeRect(TX0, top, TX1 - TX0, bottom - top);

    // Crenellations and flags on the roof.
    const roof = this.add.graphics().setDepth(2);
    for (let x = TX0 - 10; x < TX1 + 10; x += 62) {
      roof.fillStyle(PALETTE.navy, 1).fillRect(x + 5, top - 34, 40, 40);
      roof.fillStyle(0xf6eedd, 1).fillRect(x, top - 40, 40, 44);
      roof.lineStyle(5, PALETTE.navy, 1).strokeRect(x, top - 40, 40, 44);
    }
    roof.fillStyle(PALETTE.coral, 1).fillRect(TX0 - 14, top - 6, TX1 - TX0 + 28, 14);
    roof.lineStyle(5, PALETTE.navy, 1).strokeRect(TX0 - 14, top - 6, TX1 - TX0 + 28, 14);
    ['coral', 'yellow', 'cyan', 'green', 'coral'].forEach((colour, i) => {
      const x = TX0 + 40 + i * ((TX1 - TX0 - 80) / 4);
      this.add.image(x, top - 38, 'pole').setOrigin(0.5, 1).setScale(4).setDepth(1);
      this.add.sprite(x + 4, top - 38 - 60, `flag-${colour}-0`).setOrigin(0, 0).setScale(4).setDepth(1).play(`flag-${colour}`);
    });
    this.add.text(CX, top - 140, 'FETCH TOWER', heading(30)).setOrigin(0.5).setDepth(3);
  }

  drawGround() {
    const { width } = this.scale;
    const left = -this.worldOffsetX;
    this.add.image(left, WORLD_H, hillsTexture(this, width, 270)).setOrigin(0, 1).setDepth(20);
    const rand = seeded(5);
    const spots = Array.from({ length: 18 }, (_, i) => [
      Math.round(left + (i + 0.5) * (width / 18) + (rand() - 0.5) * 30),
      Math.round(WORLD_H - 8 - rand() * 110),
    ]);
    addFlowers(this, spots, { depth: 21 });
  }

  // Slab + floor label for floor index i.
  drawSlab(i, colour, text) {
    const y = floorBottom(i);
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(PALETTE.navy, 0.25).fillRect(TX0, y + SLAB_H, TX1 - TX0, 10);
    g.fillStyle(PALETTE.navy, 1).fillRoundedRect(TX0 - 26 + 5, y + 5, TX1 - TX0 + 52, SLAB_H, 8);
    g.fillStyle(colour, 1).fillRoundedRect(TX0 - 26, y, TX1 - TX0 + 52, SLAB_H, 8);
    g.fillStyle(lighten(colour, 0.15), 1).fillRect(TX0 - 18, y + 4, TX1 - TX0 + 36, 6);
    g.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(TX0 - 26, y, TX1 - TX0 + 52, SLAB_H, 8);
    if (text) this.add.text(TX0 - 8, y + SLAB_H / 2 + 1, text, heading(12, CSS.white, { shadow: undefined })).setOrigin(0, 0.5).setDepth(11);
  }

  drawFloor(floor, i) {
    const bottom = floorBottom(i);
    const colour = FLOOR_COLORS[i];
    const name = floor.boss ? 'BOSS FLOOR' : floor.label.toUpperCase();
    this.drawSlab(i, colour, `${name} · ${floor.timer}s`);

    // Arena entrance arch in the middle of the floor.
    const archW = 180;
    const archH = 112;
    const arch = this.add.graphics({ x: CX, y: bottom }).setDepth(5);
    arch.fillStyle(PALETTE.navy, 1).fillRoundedRect(-archW / 2 - 8, -archH - 8, archW + 16, archH + 8, { tl: 60, tr: 60, bl: 0, br: 0 });
    arch.fillStyle(PALETTE.skyBottom, 1).fillRoundedRect(-archW / 2, -archH, archW, archH, { tl: 54, tr: 54, bl: 0, br: 0 });
    arch.fillStyle(PALETTE.grass, 1).fillRect(-archW / 2, -40, archW, 40);
    arch.fillStyle(PALETTE.grassMid, 1).fillRect(-archW / 2, -40, archW, 5);
    arch.fillStyle(0xffffff, 1).fillRect(-50, -86, 30, 8).fillRect(-40, -94, 20, 8).fillRect(30, -76, 26, 7);

    const glow = this.add.graphics({ x: CX, y: bottom }).setDepth(4).setAlpha(0);
    glow.lineStyle(8, PALETTE.cyan, 1).strokeRoundedRect(-archW / 2 - 14, -archH - 14, archW + 28, archH + 14, { tl: 66, tr: 66, bl: 0, br: 0 });

    const zone = this.add.zone(CX, bottom - archH / 2, archW + 16, archH + 8).setInteractive({ useHandCursor: true }).setDepth(6);
    zone.on('pointerover', () => this.isReachable(floor.floor) && glow.setAlpha(1));
    zone.on('pointerout', () => glow.setAlpha(0));
    this.onTap(zone, () => this.enterFloor(floor.floor, zone));

    // Pennant on the left wall (Floor 3 gets the cardboard door instead).
    if (!floor.fakeDoor) {
      const pennant = this.add.graphics({ x: TX0 + 92, y: bottom - FLOOR_H + 30 }).setDepth(4);
      pennant.fillStyle(PALETTE.navy, 1).fillRect(-30, -4, 60, 6);
      pennant.fillStyle(colour, 1).fillTriangle(-24, 2, 24, 2, 0, 74);
      pennant.lineStyle(4, PALETTE.navy, 1).strokeTriangle(-24, 2, 24, 2, 0, 74);
      pennant.fillStyle(0xffffff, 1).fillCircle(0, 24, 8);
      this.add.text(TX0 + 92, bottom - FLOOR_H + 55, floor.boss ? '!' : String(floor.floor), label(10)).setOrigin(0.5).setDepth(5);
    } else {
      this.drawFakeDoor(bottom);
    }

    this.floorParts[floor.floor] = { bottom, zone, glow, wall: this.walls[i], wilds: [] };
  }

  // Floor 3's side door: obviously cardboard, with a hand-written sign.
  drawFakeDoor(bottom) {
    this.fakeDoor = this.add.image(TX0 + 62, bottom, 'door-cardboard').setOrigin(0.5, 1).setScale(3).setDepth(6);
    this.fakeDoor.setInteractive({ useHandCursor: true });
    this.onTap(this.fakeDoor, () => {
      this.shake(this.fakeDoor);
      toast(this, "It's cardboard. Read the sign!");
    });

    // Taped to the wall above the cardboard door.
    const sign = this.add.container(TX0 + 108, bottom - 128).setDepth(6).setAngle(-4);
    const card = this.add.graphics();
    card.fillStyle(0x8a6a3a, 1).fillRect(-82 + 4, -32 + 4, 164, 64);
    card.fillStyle(0xe3c48e, 1).fillRect(-82, -32, 164, 64);
    card.fillStyle(0xf3e6c4, 0.9).fillRect(-74, -38, 34, 12).fillRect(40, -38, 34, 12);
    const scrawl = this.add.text(0, 1, 'Too lazy to climb?\nTry tower.forceOpen()\nin the Console', body(12, '#3b3026', { align: 'center', lineSpacing: -2 }));
    scrawl.setOrigin(0.5);
    sign.add([card, scrawl]);
    this.fakeSign = sign;
  }

  // Weeks 3-6: floors hidden behind fluffy clouds with "Coming soon" signs.
  drawFutureWeeks() {
    FUTURE_WEEKS.forEach((week, k) => {
      const i = FLOORS.length + k;
      this.drawSlab(i, 0xc6cedd, null);
      const mid = floorBottom(i) - FLOOR_H / 2;
      const rand = seeded(week * 13);
      for (let c = 0; c < 4; c++) {
        const cloud = this.add
          .image(TX0 + 40 + c * 170 + rand() * 30, mid + (rand() - 0.5) * 60, c % 2 ? 'cloud-c' : 'cloud-a')
          .setScale(5)
          .setDepth(30);
        this.tweens.add({ targets: cloud, x: cloud.x + 14, duration: 2200 + c * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      woodSign(this, CX, mid + 6, 300, 74, { posts: 0 }).setDepth(31);
      this.add.text(CX, mid - 8, `WEEK ${week}`, label(16)).setOrigin(0.5).setDepth(32);
      this.add.text(CX, mid + 20, 'Coming soon', body(20)).setOrigin(0.5).setDepth(32);
    });
  }

  // ---------- Pokémon on each floor ----------

  async loadPokemonSprites() {
    const ids = new Set([state.starter ?? 25]);
    FLOORS.forEach((f) => {
      f.wild.forEach((w) => ids.add(w.id));
      if (f.boss) ids.add(f.boss.id);
    });
    let pokemon;
    try {
      pokemon = await Promise.all([...ids].map((id) => getPokemon(id)));
    } catch {
      return; // the map still works without the little sprites
    }
    if (!this.sys.isActive()) return;
    loadImages(this, pokemon.map((p) => [`poke-${p.id}`, p.sprite]), () => {
      FLOORS.forEach((floor) => {
        const parts = this.floorParts[floor.floor];
        const mons = floor.boss ? [floor.boss, ...floor.wild] : floor.wild;
        mons.forEach((m, k) => {
          const key = trimmedTexture(this, `poke-${m.id}`);
          const x = CX + (k - (mons.length - 1) / 2) * 64;
          const sprite = this.add.image(x, parts.bottom - 6, key).setOrigin(0.5, 1).setDepth(7);
          this.tweens.add({ targets: sprite, y: sprite.y - 4, duration: 500 + k * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          parts.wilds.push(sprite);
        });
      });
      this.starterKey = trimmedTexture(this, `poke-${state.starter ?? 25}`);
      this.renderProgress();
    });
  }

  // ---------- Progress: doors, locks, the arrow ----------

  isReachable(floorNum) {
    return floorNum <= session.highestFloor;
  }

  renderProgress() {
    this.dynamic.list.forEach((child) => this.tweens.killTweensOf(child));
    this.dynamic.removeAll(true);
    this.doorSparkles?.remove();
    const openDoors = [];

    FLOORS.forEach((floor, i) => {
      const parts = this.floorParts[floor.floor];
      const reachable = this.isReachable(floor.floor);
      parts.wall.setTint(reachable ? 0xffffff : 0xd5dbe8);
      parts.wilds.forEach((w) => (reachable ? w.clearTint() : w.setTintFill(PALETTE.navy)));

      if (!reachable) {
        // Iron bars over the arch.
        const bars = this.add.graphics({ x: CX, y: parts.bottom });
        for (let x = -78; x <= 78; x += 26) bars.fillStyle(PALETTE.navy, 1).fillRect(x - 3, -118, 6, 118);
        bars.fillStyle(PALETTE.navy, 1).fillRect(-90, -74, 180, 6);
        this.dynamic.add(bars);
      }

      if (floor.door) {
        const open = session.doorsOpened.includes(floor.door);
        const x = TX1 - 92;
        if (open) {
          const glow = this.add.rectangle(x, parts.bottom - 48, 86, 110, PALETTE.cyan, 0.35);
          this.tweens.add({ targets: glow, alpha: 0.1, duration: 700, yoyo: true, repeat: -1 });
          this.dynamic.add(glow);
          openDoors.push([x, parts.bottom - 48]);
        }
        const door = this.add.image(x, parts.bottom, open ? 'door-open' : 'door-wood').setOrigin(0.5, 1).setScale(3);
        door.setInteractive({ useHandCursor: true });
        this.onTap(door, () => this.tryDoor(floor, door));
        this.dynamic.add(door);
        if (!open) this.dynamic.add(this.add.image(x, parts.bottom - 46, 'padlock').setScale(3));
        this.dynamic.add(this.add.text(x, parts.bottom - 110, `DOOR ${floor.door}`, outlined(16)).setOrigin(0.5));
      } else {
        // Top of Week 2: a trophy instead of a door.
        const t = this.add.image(TX1 - 92, parts.bottom - 40, 'star').setScale(8).setTint(PALETTE.yellow);
        this.tweens.add({ targets: t, angle: 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.dynamic.add(t);
        this.dynamic.add(this.add.text(TX1 - 92, parts.bottom - 100, 'WEEK 2!', outlined(16)).setOrigin(0.5));
      }
    });

    // You are here: trainer, starter, and a bouncing arrow over the current floor.
    const current = this.floorParts[session.highestFloor];
    if (current) {
      const arrow = this.add.image(CX, current.bottom - 144, 'arrow').setScale(3);
      this.tweens.add({ targets: arrow, y: arrow.y + 12, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.InOut' });
      const trainer = this.add.image(CX - 128, current.bottom, 'trainer').setOrigin(0.5, 1).setScale(3);
      this.dynamic.add([arrow, trainer]);
      if (this.starterKey) this.dynamic.add(this.add.image(CX - 176, current.bottom, this.starterKey).setOrigin(0.5, 1));
    }

    if (openDoors.length) {
      this.doorSparkles = this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          const [x, y] = Phaser.Utils.Array.GetRandom(openDoors);
          sparkle(this, x + Phaser.Math.Between(-40, 40), y + Phaser.Math.Between(-50, 50), { tint: PALETTE.cyan, depth: 16 });
        },
      });
    }
  }

  enterFloor(floorNum, zone) {
    if (!this.isReachable(floorNum)) {
      this.shake(zone);
      toast(this, `Open Door ${floorNum - 1} to reach Floor ${floorNum}!`);
      return;
    }
    goTo(this, 'ArenaScene', { floor: floorNum });
  }

  tryDoor(floor, door) {
    const n = floor.door;
    if (session.doorsOpened.includes(n)) {
      goTo(this, 'DoorScene', { door: n }); // look back at the question, the answer and the hints
      return;
    }
    // A door can be tried after surviving its floor (or if you've already been there: the hint timer keeps running).
    if (session.clearedFloors.has(floor.floor) || state.hintTimers[n]) {
      goTo(this, 'DoorScene', { door: n });
      return;
    }
    this.shake(door);
    toast(this, this.isReachable(floor.floor) ? `Clear ${floor.label} first!` : 'That door is way up there. Keep climbing!');
  }

  onForceOpen(res) {
    if (!this.sys.isActive() || !this.fakeDoor) return;
    this.panToFloor(3);
    this.time.delayedCall(700, () => {
      this.shake(this.fakeDoor, 10);
      if (res.offline) {
        toast(this, "The server didn't answer. The door stays shut.");
        return;
      }
      if (this.fakeAnswer) return;
      const x = this.fakeDoor.x + 10;
      const y = this.fakeDoor.y - 150;
      const t = this.add.text(0, 0, 'How did the server know?\nUnlocks in Week 5.', body(17, CSS.navy, { align: 'center' })).setOrigin(0.5);
      const panel = this.add.graphics();
      drawSticker(panel, t.width + 28, t.height + 20, { fill: PALETTE.yellow, radius: 10, shadow: 5 });
      this.fakeAnswer = this.add.container(x + 40, y, [panel, t]).setDepth(40).setScale(0);
      this.tweens.add({ targets: this.fakeAnswer, scale: 1, duration: 300, ease: 'Back.Out' });
    });
  }

  shake(target, amount = 6) {
    const x = target.x;
    this.tweens.add({ targets: target, x: x + amount, duration: 50, yoyo: true, repeat: 3, onComplete: () => target.setX(x) });
  }

  // ---------- Camera ----------

  panToFloor(floorNum) {
    const cam = this.cameras.main;
    const target = Phaser.Math.Clamp(floorBottom(floorNum - 1) - FLOOR_H / 2 - this.scale.height / 2 + 40, 0, WORLD_H - this.scale.height);
    this.tweens.add({ targets: cam, scrollY: target, duration: 1300, ease: 'Sine.InOut' });
  }

  setupScrolling() {
    const cam = this.cameras.main;
    const scrollBy = (dy) => {
      this.tweens.killTweensOf(cam);
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, WORLD_H - this.scale.height);
    };
    this.input.on('wheel', (_p, _o, _dx, dy) => scrollBy(dy * 0.8));
    // Drag (finger or mouse) to scroll the tower.
    let lastY = null;
    this.input.on('pointerdown', (p) => (lastY = p.y));
    this.input.on('pointermove', (p) => {
      if (!p.isDown || lastY === null) return;
      scrollBy(lastY - p.y);
      lastY = p.y;
    });
    this.input.on('pointerup', () => (lastY = null));
    this.scrollBy = scrollBy;
    this.scrollKeys = this.input.keyboard.addKeys('UP,DOWN,W,S', false);
  }

  // A tap or click that didn't turn into a drag.
  onTap(target, fn) {
    target.on('pointerup', (p) => {
      if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) < 12) fn();
    });
  }

  update(_time, delta) {
    const k = this.scrollKeys;
    if (k.UP.isDown || k.W.isDown) this.scrollBy((-600 * delta) / 1000);
    if (k.DOWN.isDown || k.S.isDown) this.scrollBy((600 * delta) / 1000);
  }

  // ---------- HUD ----------

  createHud() {
    const { width, height } = this.scale;
    const compact = width < 760 || height > width;
    const titleWidth = compact ? Math.min(112, (width - 40) * 0.38) : 112;
    const trophiesWidth = compact ? Math.min(180, (width - 40) * 0.56) : 180;
    const buttonY = compact ? 34 : 40;
    const titleX = compact ? 12 + titleWidth / 2 : 72;
    const trophiesX = compact ? width - 12 - trophiesWidth / 2 : width - 104;
    makeButton(this, titleX, buttonY, 'TITLE', () => goTo(this, 'TitleScene'), { width: titleWidth, height: 46, size: compact ? 9 : 11, color: PALETTE.white })
      .setScrollFactor(0)
      .setDepth(1000);

    const tagText = this.add.text(0, 0, state.nickname || 'Trainer', body(22)).setOrigin(0, 0.5);
    const starter = STARTERS.find((s) => s.id === state.starter);
    const sub = this.add.text(0, 0, starter ? `& ${starter.name}` : '', body(15, CSS.muted)).setOrigin(0, 0.5);
    const w = Math.max(tagText.width, sub.width) + 32;
    const tag = this.add.graphics();
    drawSticker(tag, w, 54, { radius: 12, shadow: 5, ox: w / 2 });
    tagText.setPosition(16, -9);
    sub.setPosition(16, 13);
    this.add.container(compact ? width / 2 : 144, compact ? 100 : 40, [tag, tagText, sub]).setScrollFactor(0).setDepth(1000);

    makeButton(this, trophiesX, buttonY, 'TROPHIES', () => goTo(this, 'LeaderboardScene'), { width: trophiesWidth, height: 46, size: compact ? 10 : 12, color: PALETTE.cyan })
      .setScrollFactor(0)
      .setDepth(1000);

    const offText = this.add.text(0, 0, 'Offline: progress is not saved yet', body(15, CSS.white)).setOrigin(0.5);
    const off = this.add.graphics();
    drawSticker(off, offText.width + 24, 30, { fill: PALETTE.coral, radius: 15, shadow: 3, stroke: 3 });
    this.offlineChip = this.add.container(width / 2, compact ? 150 : 88, [off, offText]).setScrollFactor(0).setDepth(1000).setVisible(false);

    const hint = this.add.text(width / 2, height - 28, IS_TOUCH ? 'Drag up and down to look around' : 'Scroll, drag or use the arrow keys to look around', outlined(compact ? 13 : 17, CSS.white, { wordWrap: { width: width - 32 }, align: 'center' })).setOrigin(0.5);
    hint.setScrollFactor(0).setDepth(1000);
    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });
  }
}
