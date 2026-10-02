import Phaser from 'phaser';
import { makeArt, seeded } from '../art.js';
import { BALANCE } from '../data/balance.js';
import { FLOORS } from '../data/floors.js';
import { getPokemon } from '../data/pokeapi.js';
import { toGameStats } from '../data/stats.js';
import { typeColor } from '../data/types.js';
import { sfx } from '../sfx.js';
import { trimmedTexture } from '../sprites.js';
import { state, session, addToPokedex } from '../state.js';
import { CSS, IS_TOUCH, PALETTE, body, confetti, drawSticker, goTo, heading, label, lighten, makeButton, sparkle, wipeIn } from '../ui.js';

// Walkable area. HUD stickers float over the grass around it.
const ARENA = { x: 24, y: 92, w: 912, h: 516 };

// Fixed by PRD section 5 (not balance knobs).
const CATCH_BELOW = 0.2; // HP fraction that shows the catch ring
const CATCH_CHANCE = 0.6;
const STAT_CARD_FOR = 3000;

// Whole-number sprite scales keep the pixel art crisp.
const WILD_SCALE = 2;
const BOSS_SCALE = 3;
const TEAM_SCALE = 2;

const FOLLOW_GAP = 50; // px between Pokémon in the follow line
const HP_BAR_BASE = 170; // px width of the HP bar at base max HP
const PARTY = [PALETTE.yellow, PALETTE.coral, PALETTE.cyan, PALETTE.white, 0xff7eb6];
const RAINBOW = [0xff5e5b, 0xff9a3d, 0xffd23f, 0x7ed957, 0x3de0ff, 0x9b6bff];

// Depth bands: sprites sort by their y inside 0-1000.
const DEPTH = { ground: -10, shadow: -5, fx: 1900, bars: 2000, text: 2100, hud: 3000, card: 3500, overlay: 5000 };

const spriteKey = (id) => `poke-${id}`;

export class ArenaScene extends Phaser.Scene {
  constructor() {
    super('ArenaScene');
  }

  init(data) {
    this.floorNum = data?.floor ?? 1;
    this.floor = FLOORS.find((f) => f.floor === this.floorNum) ?? FLOORS[0];
    this.phase = 'loading';
    this.elapsed = 0;
    this.nextWaveAt = BALANCE.waves.firstWaveAtMs;
    this.bossSpawned = false;
    this.invincibleUntil = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.defeated = 0;
    this.caught = 0;
    this.lives = 0; // extra lives reset every floor
    this.shots = [];
    this.seenSpecies = new Set();
    this.statCards = [];
    this.run = {}; // identifies this run, so a load from a previous run can't finish into it
  }

  create() {
    makeArt(this);
    this.drawArena();
    this.loading = this.add.container(480, 330).setDepth(DEPTH.overlay);
    const ball = this.add.image(0, -40, 'ball').setScale(4);
    this.tweens.add({ targets: ball, angle: 360, duration: 700, repeat: -1 });
    this.loading.add([ball, this.add.text(0, 30, `LOADING ${this.floor.label.toUpperCase()}...`, heading(18)).setOrigin(0.5)]);
    wipeIn(this);
    this.loadPokemon();
  }

  // ---------- Loading ----------

  async loadPokemon() {
    const run = this.run;
    const live = () => this.sys.isActive() && this.run === run;
    const starterId = state.starter ?? 25;
    const ids = [starterId, ...session.squad.map((m) => m.id), ...this.floor.wild.map((w) => w.id)];
    if (this.floor.boss) ids.push(this.floor.boss.id);

    let pokemon;
    try {
      pokemon = await Promise.all([...new Set(ids)].map((id) => getPokemon(id)));
    } catch {
      if (!live()) return;
      this.loading.removeAll(true);
      this.loading.add(this.add.text(0, -20, "Couldn't reach PokéAPI.\nCheck your internet.", heading(16, CSS.white, { align: 'center' })).setOrigin(0.5));
      makeButton(this, 480, 420, 'BACK', () => goTo(this, 'TowerScene')).setDepth(DEPTH.overlay);
      return;
    }
    if (!live()) return;

    this.pokemon = new Map(pokemon.map((p) => [p.id, p]));
    this.load.setCORS('anonymous');
    pokemon.forEach((p) => {
      if (p.sprite && !this.textures.exists(spriteKey(p.id))) this.load.image(spriteKey(p.id), p.sprite);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!live()) return;
      // Crop the empty space off each sprite so hitboxes match the visible Pokémon.
      this.spriteKeys = new Map(pokemon.map((p) => [p.id, trimmedTexture(this, spriteKey(p.id))]));
      this.loading.destroy();
      this.startFloor(starterId);
    });
    this.load.start();
  }

  // ---------- The meadow ----------

  // Grass tiles, flowers baked into one texture; rocks and bushes around the edges.
  drawArena() {
    const { width, height } = this.scale;
    const rand = seeded(this.floorNum * 7919);
    const rt = this.add.renderTexture(0, 0, width, height).setOrigin(0).setDepth(DEPTH.ground);
    for (let y = 0; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        const r = rand();
        rt.draw(r < 0.6 ? 'grass-0' : r < 0.85 ? 'grass-1' : 'grass-2', x, y);
      }
    }
    const flower = this.make.image({ key: 'flower-pink', add: false }).setScale(2).setOrigin(0.5, 1);
    for (let i = 0; i < 46; i++) {
      flower.setTexture(['flower-pink', 'flower-yellow', 'flower-white'][i % 3]);
      rt.draw(flower, Math.floor(rand() * width), 30 + Math.floor(rand() * (height - 30)));
    }
    flower.destroy();

    // Edge decorations (no collision): bushes and rocks just outside the walkable area.
    const edge = [];
    for (let x = 30; x < width; x += 110) {
      edge.push([x + rand() * 40, ARENA.y - 18], [x + rand() * 40, ARENA.y + ARENA.h + 26]);
    }
    for (let y = ARENA.y + 70; y < ARENA.y + ARENA.h; y += 120) {
      edge.push([8 + rand() * 10, y + rand() * 30], [width - 8 - rand() * 10, y + rand() * 30]);
    }
    edge.forEach(([x, y], i) => {
      const key = (i + Math.floor(rand() * 3)) % 3 === 0 ? 'rock' : 'bush';
      const deco = this.add.image(x, y, key).setScale(3).setOrigin(0.5, 0.8);
      deco.setDepth(y);
    });
  }

  // ---------- Setup ----------

  startFloor(starterId) {
    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    const starter = this.pokemon.get(starterId);
    this.baseMaxHp = toGameStats(starter).maxHp * BALANCE.player.hpMultiplier;
    this.maxHp = this.boostedMaxHp();
    this.hp = this.maxHp;

    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;

    this.player = this.physics.add.sprite(cx, cy, 'trainer').setScale(3).setCollideWorldBounds(true);
    this.player.body.setSize(8, 10).setOffset(3, 5);
    this.addShadow(this.player, 3);

    // Team slot 0 is the starter, slots 1-3 are caught Pokémon carried over this session.
    this.team = [starter, ...session.squad].map((mon, i) => this.makeMember(mon, cx - 50 - i * FOLLOW_GAP, cy + 10));
    if (!this.team[session.lead]) session.lead = 0;

    this.wilds = this.physics.add.group();
    this.physics.add.collider(this.wilds, this.wilds);
    this.physics.add.overlap(this.player, this.wilds, (_player, wild) => this.hitPlayer(wild));

    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.hitFx = this.add
      .particles(0, 0, 'px', {
        speed: { min: 90, max: 240 },
        scale: { start: 3, end: 0 },
        lifespan: 420,
        gravityY: 320,
        tint: PARTY,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.starFx = this.add
      .particles(0, 0, 'star', {
        speed: { min: 140, max: 330 },
        scale: { start: 3, end: 0 },
        rotate: { start: 0, end: 360 },
        lifespan: 750,
        tint: PARTY,
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,C,SPACE,ENTER,ONE,TWO,THREE,FOUR', false);
    this.keys.C.on('down', () => this.throwBall());
    this.keys.SPACE.on('down', () => this.dash());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((name, slot) => this.keys[name].on('down', () => this.setLead(slot)));

    this.createHud(starter);
    this.stick = { id: null, vec: new Phaser.Math.Vector2() };
    if (IS_TOUCH) this.createTouchControls();
    this.phase = 'fight';
  }

  makeMember(mon, x, y) {
    const color = typeColor(mon);
    const img = this.add.image(x, y, this.spriteKeys.get(mon.id) ?? spriteKey(mon.id)).setScale(TEAM_SCALE);
    this.addShadow(img, 2);
    const trail = this.add
      .particles(0, 0, 'px', { lifespan: 240, scale: { start: 3, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [color, lighten(color, 0.25)], emitting: false })
      .setDepth(DEPTH.fx - 1);
    return { mon, stats: toGameStats(mon), color, img, trail, nextAttackAt: 0 };
  }

  // Soft round shadow that follows a sprite (positioned in update).
  addShadow(obj, scale) {
    obj.shadow = this.add.image(obj.x, obj.y, 'shadow').setScale(scale).setAlpha(0.22).setDepth(DEPTH.shadow);
    return obj.shadow;
  }

  // ---------- HUD: white sticker panels ----------

  createHud(starter) {
    const { width, height } = this.scale;

    // Top-left: starter portrait, name, HP bar, hearts, dash meter.
    this.hud = this.add.container(14, 10).setDepth(DEPTH.hud);
    this.hudPanel = this.add.graphics();
    this.hpBar = this.add.graphics();
    this.hpGlow = this.add.graphics().setAlpha(0);
    this.hud.add([this.hudPanel, this.hpGlow, this.hpBar]);
    const icon = this.add.image(34, 38, this.spriteKeys.get(starter.id));
    icon.setScale(Math.max(icon.width, icon.height) <= 46 ? 1 : 0.5);
    this.hud.add(icon);
    this.hud.add(this.add.text(64, 8, starter.name.toUpperCase(), label(10)));
    this.hpText = this.add.text(0, 6, '', body(16, CSS.muted)).setOrigin(1, 0);
    this.dashLabel = this.add.text(64 + 128, 54, IS_TOUCH ? 'DASH' : 'SPACE', label(7, CSS.muted)).setOrigin(0, 0.5);
    this.hud.add([this.hpText, this.dashLabel]);
    this.hearts = [];
    this.displayHp = this.hp;
    this.hudKey = '';

    // Top-centre: the big countdown.
    const timerPanel = this.add.graphics({ x: width / 2, y: 42 }).setDepth(DEPTH.hud);
    drawSticker(timerPanel, 150, 60, { radius: 14 });
    this.timerText = this.add.text(width / 2, 44, '', label(26)).setOrigin(0.5).setDepth(DEPTH.hud);

    // Top-right: floor badge.
    const boss = !!this.floor.boss;
    const badge = this.add.graphics({ x: width - 98, y: 40 }).setDepth(DEPTH.hud);
    drawSticker(badge, 168, 50, { fill: boss ? PALETTE.coral : PALETTE.yellow, radius: 25 });
    this.add
      .text(width - 98, 41, boss ? 'BOSS!' : this.floor.label.toUpperCase(), label(14, boss ? CSS.white : CSS.navy))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    // Catch prompt, pulsing above the squad slots.
    const promptText = this.add.text(0, 1, IS_TOUCH ? 'TAP CATCH!' : 'PRESS C TO CATCH!', label(12)).setOrigin(0.5);
    const promptPanel = this.add.graphics();
    drawSticker(promptPanel, promptText.width + 36, 42, { fill: PALETTE.cyan, radius: 21, shadow: 5 });
    this.catchPrompt = this.add.container(width / 2, height - 122, [promptPanel, promptText]).setDepth(DEPTH.hud).setVisible(false);
    this.tweens.add({ targets: this.catchPrompt, scale: 1.08, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.squadSlots = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.refreshSquadSlots();
    this.updateHud(0);
  }

  // Redraw the top-left panel when max HP or lives change (the bar grows with max HP).
  drawHudPanel(barW) {
    const w = 64 + barW + 22 + this.lives * 22;
    const g = this.hudPanel.clear();
    drawSticker(g, w, 72, { radius: 12, shadow: 5, ox: w / 2, oy: 36 });
    g.fillStyle(PALETTE.skyBottom, 1).fillRoundedRect(10, 14, 48, 48, 8);
    g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(10, 14, 48, 48, 8);
    this.hpGlow.clear().fillStyle(PALETTE.yellow, 1).fillRoundedRect(58, 24, barW + 12, 26, 8);
    this.hpText.setX(64 + barW);
    this.hearts.forEach((h) => h.destroy());
    this.hearts = Array.from({ length: this.lives }, (_, i) => this.add.image(64 + barW + 22 + i * 22, 37, 'heart').setScale(2));
    this.hud.add(this.hearts);
  }

  // Four portrait slots at the bottom: 1 = starter, 2-4 = caught squad. The lead is highlighted.
  refreshSquadSlots() {
    this.squadSlots.removeAll(true);
    const size = 60;
    const gap = 14;
    const total = 4 * size + 3 * gap;
    const y = this.scale.height - 40;
    for (let slot = 0; slot < 4; slot++) {
      const x = this.scale.width / 2 - total / 2 + size / 2 + slot * (size + gap);
      const member = this.team[slot];
      const isLead = slot === session.lead;
      const g = this.add.graphics({ x, y });
      if (isLead) g.lineStyle(6, PALETTE.cyan, 1).strokeRoundedRect(-size / 2 - 6, -size / 2 - 6, size + 12, size + 12, 14);
      drawSticker(g, size, size, { fill: isLead ? PALETTE.yellow : member ? PALETTE.white : PALETTE.mist, radius: 10, shadow: 4, stroke: 3 });
      this.squadSlots.add(g);
      // Click or tap a portrait to make it the lead (same as keys 1-4).
      const hit = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: !!member });
      hit.on('pointerdown', () => this.setLead(slot));
      this.squadSlots.add(hit);
      if (member) {
        const portrait = this.add.image(x, y + 3, member.img.texture.key);
        portrait.setScale(Math.max(portrait.width, portrait.height) <= 50 ? 1 : 0.5);
        this.squadSlots.add(portrait);
      }
      const chip = this.add.graphics({ x: x - size / 2 + 2, y: y - size / 2 + 2 });
      chip.fillStyle(PALETTE.navy, 1).fillRoundedRect(-8, -8, 20, 20, 5);
      this.squadSlots.add([chip, this.add.text(x - size / 2 + 4, y - size / 2 + 4, String(slot + 1), label(9, CSS.white)).setOrigin(0.5)]);
      if (isLead) this.squadSlots.add(this.add.text(x, y - size / 2 - 16, 'LEAD', heading(9, CSS.yellow)).setOrigin(0.5));
    }
  }

  // ---------- Touch controls (phones and tablets) ----------

  // A joystick that appears wherever your left thumb lands, plus DASH and CATCH buttons on the right.
  createTouchControls() {
    const { width, height } = this.scale;
    const radius = 60;
    this.stickBase = this.add.circle(0, 0, radius, PALETTE.white, 0.3).setStrokeStyle(5, PALETTE.navy, 0.7).setDepth(DEPTH.hud).setVisible(false);
    this.stickKnob = this.add.circle(0, 0, 28, PALETTE.white, 0.95).setStrokeStyle(5, PALETTE.navy).setDepth(DEPTH.hud).setVisible(false);

    this.input.on('pointerdown', (pointer, over) => {
      if (over.length || this.stick.id !== null || pointer.x > width * 0.62 || this.phase !== 'fight') return;
      this.stick.id = pointer.id;
      this.stickBase.setPosition(pointer.x, pointer.y).setVisible(true);
      this.stickKnob.setPosition(pointer.x, pointer.y).setVisible(true);
    });
    this.input.on('pointermove', (pointer) => {
      if (pointer.id !== this.stick.id) return;
      const v = new Phaser.Math.Vector2(pointer.x - this.stickBase.x, pointer.y - this.stickBase.y);
      const len = Math.min(v.length(), radius);
      v.normalize();
      this.stickKnob.setPosition(this.stickBase.x + v.x * len, this.stickBase.y + v.y * len);
      this.stick.vec.copy(v).scale(len / radius);
    });
    const release = (pointer) => {
      if (pointer.id !== this.stick.id) return;
      this.stick.id = null;
      this.stick.vec.set(0, 0);
      this.stickBase.setVisible(false);
      this.stickKnob.setVisible(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.touchButton(width - 172, height - 62, 42, PALETTE.cyan, 'DASH', () => this.dash());
    this.catchButton = this.touchButton(width - 72, height - 104, 54, PALETTE.yellow, 'CATCH', () => this.throwBall());
  }

  touchButton(x, y, r, colour, text, action) {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.navy, 1).fillCircle(4, 6, r);
    g.fillStyle(colour, 1).fillCircle(0, 0, r);
    g.fillStyle(lighten(colour, 0.2), 1).fillCircle(-r * 0.3, -r * 0.35, r * 0.28);
    g.lineStyle(5, PALETTE.navy, 1).strokeCircle(0, 0, r);
    const button = this.add.container(x, y, [g, this.add.text(0, 2, text, label(r > 50 ? 12 : 11)).setOrigin(0.5)]).setDepth(DEPTH.hud);
    button.setSize(r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r + 8), Phaser.Geom.Circle.Contains);
    button.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: 0.88, duration: 60, yoyo: true });
      action();
    });
    return button;
  }

  setLead(slot) {
    if (this.phase !== 'fight' || !this.team[slot] || slot === session.lead) return;
    session.lead = slot;
    const lead = this.team[slot];
    lead.nextAttackAt = Math.min(lead.nextAttackAt, this.elapsed + BALANCE.team.leadAttackEveryMs);
    this.popText(lead.img.x, lead.img.y - 40, 'LEAD!', CSS.yellow);
    sparkle(this, lead.img.x, lead.img.y, { tint: PALETTE.cyan, depth: DEPTH.fx });
    sfx.click();
    this.refreshSquadSlots();
  }

  // ---------- Main loop ----------

  update(time, delta) {
    if (this.phase === 'fight') {
      this.elapsed += delta;
      this.movePlayer();
      this.moveWilds();
      this.spawnWaves();
      this.teamAttacks();
      this.moveShots(delta);
      if (this.elapsed >= this.floor.timer * 1000) this.clearFloor();
    }
    if (this.phase === 'fight' || this.phase === 'clearing') {
      this.moveTeam(delta);
      this.drawBars(time);
      this.updateHud(delta);
      this.shimmerCards(delta);
    }
    if (this.player) this.sortAndShadow();
  }

  // Sprites lower on screen draw in front; shadows stay under feet.
  sortAndShadow() {
    const place = (obj) => {
      obj.setDepth(obj.y);
      if (obj.shadow) obj.shadow.setPosition(obj.x, obj.y + obj.displayHeight / 2 - 3).setVisible(obj.visible && obj.alpha > 0.3);
    };
    place(this.player);
    this.team.forEach((m) => place(m.img));
    this.wilds.getChildren().forEach(place);
  }

  movePlayer() {
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const dir = new Phaser.Math.Vector2(dx, dy).normalize();
    // The on-screen joystick wins when a thumb is on it.
    if (this.stick.id !== null && this.stick.vec.length() > 0.25) dir.copy(this.stick.vec).normalize();
    if (dir.lengthSq() > 0) this.facing.copy(dir);

    if (this.elapsed < this.dashUntil) {
      this.player.setVelocity(this.facing.x * BALANCE.dash.speed, this.facing.y * BALANCE.dash.speed);
    } else {
      this.player.setVelocity(dir.x * BALANCE.player.speed, dir.y * BALANCE.player.speed);
    }
    if (Math.abs(dir.x) > 0.1) this.player.setFlipX(dir.x < 0);
  }

  // Short burst in the direction you're moving (or last moved).
  dash() {
    if (this.phase !== 'fight' || this.elapsed < this.dashReadyAt) return;
    this.dashUntil = this.elapsed + BALANCE.dash.durationMs;
    this.dashReadyAt = this.elapsed + BALANCE.dash.cooldownMs;
    sfx.pop();
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 40, () => {
        const ghost = this.add
          .image(this.player.x, this.player.y, 'trainer')
          .setScale(3)
          .setFlipX(this.player.flipX)
          .setAlpha(0.5)
          .setTintFill(PALETTE.cyan)
          .setDepth(this.player.y - 1);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 240, onComplete: () => ghost.destroy() });
      });
    }
  }

  // Lead first, right behind the player; the rest follow in a line, each trailing the one ahead.
  followOrder() {
    return [this.team[session.lead], ...this.team.filter((_, i) => i !== session.lead)];
  }

  moveTeam(delta) {
    let leader = this.player;
    this.followOrder().forEach((member) => {
      const img = member.img;
      const dist = Phaser.Math.Distance.Between(img.x, img.y, leader.x, leader.y);
      if (dist > FOLLOW_GAP) {
        const speed = Math.max(member.stats.speed, BALANCE.player.speed) * (dist > FOLLOW_GAP * 2.5 ? 1.8 : 1.1);
        const step = Math.min(dist - FOLLOW_GAP, (speed * delta) / 1000);
        img.x += ((leader.x - img.x) / dist) * step;
        img.y += ((leader.y - img.y) / dist) * step;
        img.setFlipX(leader.x > img.x); // front sprites face left
      }
      leader = img;
    });
  }

  moveWilds() {
    this.liveWilds().forEach((w) => {
      if (w.beingCaught) return;
      this.physics.moveToObject(w, this.player, w.stats.speed);
      w.setFlipX(w.body.velocity.x > 0);
    });
  }

  liveWilds() {
    return this.wilds.getChildren().filter((w) => w.active && !w.dead && !w.leaving);
  }

  // ---------- Spawning ----------

  spawnWaves() {
    const waves = BALANCE.waves;
    const progress = Math.min(1, this.elapsed / (this.floor.timer * 1000));

    if (this.floor.boss && !this.bossSpawned && this.elapsed >= 2000) {
      this.bossSpawned = true;
      this.spawnWild(this.floor.boss.id, true);
    }

    if (this.elapsed < this.nextWaveAt) return;
    const cap = this.elapsed < waves.earlyCapForMs ? waves.earlyCap : waves.cap;
    const room = cap - this.liveWilds().length;
    if (room <= 0) {
      this.nextWaveAt = this.elapsed + 500; // screen is full, try again shortly
      return;
    }

    // Waves grow from startSize to maxSize and come faster as the timer runs down.
    const size = Math.min(waves.maxSize, waves.startSize + Math.floor(progress * (waves.maxSize - waves.startSize + 1)));
    for (let i = 0; i < Math.min(size, room); i++) {
      this.spawnWild(Phaser.Utils.Array.GetRandom(this.floor.wild).id);
    }
    this.nextWaveAt = this.elapsed + Phaser.Math.Linear(waves.intervalStartMs, waves.intervalEndMs, progress);
  }

  spawnWild(id, isBoss = false) {
    const mon = this.pokemon.get(id);
    if (!mon || !this.textures.exists(spriteKey(id))) return;

    const edge = Phaser.Math.Between(0, 3);
    const pad = 40;
    const x = edge === 0 ? ARENA.x + pad : edge === 1 ? ARENA.x + ARENA.w - pad : Phaser.Math.Between(ARENA.x + pad, ARENA.x + ARENA.w - pad);
    const y = edge === 2 ? ARENA.y + pad : edge === 3 ? ARENA.y + ARENA.h - pad : Phaser.Math.Between(ARENA.y + pad, ARENA.y + ARENA.h - pad);

    const scale = isBoss ? BOSS_SCALE : WILD_SCALE;
    const wild = this.wilds.create(x, y, this.spriteKeys.get(id)).setScale(scale);
    // Sprite is already trimmed to the visible Pokémon; shrink the box a little so touches feel fair.
    wild.body.setSize(wild.width * 0.75, wild.height * 0.75, true);
    wild.mon = mon;
    wild.stats = toGameStats(mon);
    wild.maxHp = Math.round(wild.stats.maxHp * BALANCE.wild.hpMultiplier);
    wild.hp = wild.maxHp;
    wild.contactDamage = Math.max(1, Math.round(wild.stats.damage * BALANCE.wild.contactDamageMultiplier));
    wild.isBoss = isBoss;
    wild.baseScale = scale;
    wild.thrown = false;
    this.addShadow(wild, isBoss ? 6 : 3);

    // Pop in with a little puff.
    wild.setScale(0);
    this.tweens.add({ targets: wild, scale, duration: 280, ease: 'Back.Out' });
    const puff = this.add.image(x, y + 10, 'puff').setScale(2).setAlpha(0.9).setDepth(y + 1);
    this.tweens.add({ targets: puff, scale: 4, alpha: 0, duration: 400, onComplete: () => puff.destroy() });

    if (!this.seenSpecies.has(id)) {
      this.seenSpecies.add(id);
      this.showStatCard(mon);
    }
  }

  // ---------- Combat ----------

  // Every team member fires on its own clock: the lead fast and hard, the rest slower at their own damage.
  teamAttacks() {
    const t = BALANCE.team;
    this.team.forEach((member, slot) => {
      if (this.elapsed < member.nextAttackAt) return;
      const isLead = slot === session.lead;
      member.nextAttackAt = this.elapsed + (isLead ? t.leadAttackEveryMs : t.memberAttackEveryMs);

      const target = this.physics.closest(member.img, this.liveWilds().filter((w) => !w.beingCaught));
      if (!target) return;
      const damage = member.stats.damage * (isLead ? t.leadDamageMultiplier : t.memberDamageMultiplier);
      const orb = this.add.image(member.img.x, member.img.y, 'orb').setTint(member.color).setDepth(DEPTH.fx).setScale(isLead ? 3 : 2);
      this.shots.push({ orb, target, damage, member, miss: Math.random() < t.missChance });
    });
  }

  // Homing projectiles steer toward the target every frame. If the target is gone,
  // they pick the next closest one. A missed shot veers off just before it lands.
  moveShots(delta) {
    const step = (BALANCE.team.projectileSpeed * delta) / 1000;
    this.shots = this.shots.filter((shot) => {
      const { orb } = shot;
      shot.member.trail.emitParticleAt(orb.x, orb.y, 1);
      if (shot.veer) {
        orb.x += shot.veer.x * step;
        orb.y += shot.veer.y * step;
        orb.alpha -= delta / 250;
        if (orb.alpha > 0) return true;
        orb.destroy();
        return false;
      }
      if (!this.isTargetable(shot.target)) {
        shot.target = this.physics.closest(orb, this.liveWilds().filter((w) => !w.beingCaught));
        if (!shot.target) {
          orb.destroy();
          return false;
        }
      }
      const { target } = shot;
      const dist = Phaser.Math.Distance.Between(orb.x, orb.y, target.x, target.y);
      if (shot.miss && dist <= step + 34) {
        const angle = Math.atan2(target.y - orb.y, target.x - orb.x) + (Math.random() < 0.5 ? -0.7 : 0.7);
        shot.veer = { x: Math.cos(angle), y: Math.sin(angle) };
        this.popText(target.x, target.y - target.displayHeight / 2 - 10, 'MISS', CSS.white, 10);
        return true;
      }
      if (dist <= step + 8) {
        orb.destroy();
        this.damageWild(target, shot.damage);
        return false;
      }
      orb.x += ((target.x - orb.x) / dist) * step;
      orb.y += ((target.y - orb.y) / dist) * step;
      return true;
    });
  }

  isTargetable(wild) {
    return wild && wild.active && !wild.dead && !wild.leaving && !wild.beingCaught;
  }

  damageWild(wild, baseDamage) {
    // Pokémon showing the catch ring take less damage so there's time to throw.
    const wasCatchable = this.isCatchable(wild);
    const multiplier = wasCatchable ? BALANCE.team.catchableDamageMultiplier : 1;
    const amount = Math.max(1, Math.round(baseDamage * multiplier));
    wild.hp = Math.max(0, wild.hp - amount);
    // Like False Swipe: a big hit can't skip the catch window. It stops just inside catch range.
    if (!wasCatchable && !wild.thrown && wild.hp / wild.maxHp < CATCH_BELOW) {
      wild.hp = Math.max(wild.hp, Math.max(1, Math.ceil(wild.maxHp * CATCH_BELOW) - 1));
    }
    this.damageNumber(wild.x, wild.y - wild.displayHeight / 2, amount);
    this.hitFx.explode(8, wild.x, wild.y);

    wild.setTintFill(0xffffff);
    this.time.delayedCall(70, () => wild.active && !wild.beingCaught && wild.clearTint());
    if (wild.hp > 0) return;

    wild.dead = true;
    wild.body.enable = false;
    this.defeated++;
    this.hitFx.explode(16, wild.x, wild.y);
    this.tweens.add({
      targets: wild,
      alpha: 0,
      scale: wild.scale * 0.3,
      duration: 260,
      onComplete: () => {
        wild.shadow.destroy();
        wild.destroy();
      },
    });
  }

  hitPlayer(wild) {
    if (this.phase !== 'fight' || wild.dead || wild.leaving || wild.beingCaught) return;
    if (this.elapsed < this.invincibleUntil) return;

    this.hp = Math.max(0, this.hp - wild.contactDamage);
    this.damageNumber(this.player.x, this.player.y - 34, wild.contactDamage, CSS.coral);
    this.cameras.main.shake(110, 0.005);
    sfx.hit();
    this.makeInvincible(BALANCE.player.invincibleMs, 0xff5050);

    if (this.hp <= 0) {
      if (this.lives > 0) this.useExtraLife();
      else this.faint();
    }
  }

  // Blink for the whole invincibility window.
  makeInvincible(ms, tint) {
    this.invincibleUntil = this.elapsed + ms;
    this.tweens.killTweensOf(this.player);
    this.player.setTint(tint);
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: Math.max(1, Math.round(ms / 160)) - 1,
      onComplete: () => this.player.setAlpha(1).clearTint(),
    });
  }

  useExtraLife() {
    this.lives--;
    this.hp = Math.round(this.maxHp * BALANCE.catchRewards.reviveHp);
    this.makeInvincible(BALANCE.catchRewards.reviveInvincibleMs, 0xffe066);
    this.cameras.main.flash(260, 255, 240, 160);
    sfx.heal();
    this.popText(this.player.x, this.player.y - 60, 'EXTRA LIFE!', CSS.yellow, 16);
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 60, () =>
        sparkle(this, this.player.x + Phaser.Math.Between(-40, 40), this.player.y + Phaser.Math.Between(-40, 30), { tint: PALETTE.yellow, depth: DEPTH.fx }),
      );
    }
  }

  // White number with a navy outline that bounces up and fades.
  damageNumber(x, y, amount, color = CSS.white) {
    const t = this.add
      .text(x + Phaser.Math.Between(-10, 10), y, String(amount), heading(14, color))
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    this.tweens.add({ targets: t, y: y - 30, duration: 320, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 380, duration: 260, onComplete: () => t.destroy() });
  }

  popText(x, y, message, color, size = 12) {
    const t = this.add.text(x, y, message, heading(size, color)).setOrigin(0.5).setDepth(DEPTH.text).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  // ---------- Catching ----------

  isCatchable(wild) {
    return !wild.thrown && !wild.dead && wild.hp / wild.maxHp < CATCH_BELOW;
  }

  // The ball arcs over, swallows the Pokémon, shakes three times, then GOTCHA (or it breaks free).
  throwBall() {
    if (this.phase !== 'fight') return;
    const candidates = this.liveWilds().filter((w) => this.isCatchable(w) && !w.beingCaught);
    const target = this.physics.closest(this.player, candidates);
    if (!target) return;

    target.thrown = true; // one throw per Pokémon, a miss uses it up
    target.beingCaught = true;
    const success = Math.random() < CATCH_CHANCE;
    const ball = this.add.image(this.player.x, this.player.y, 'ball').setScale(3).setDepth(DEPTH.fx);
    const from = { x: this.player.x, y: this.player.y };
    sfx.click();

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      onUpdate: (tween) => {
        const t = tween.getValue();
        ball.setPosition(Phaser.Math.Linear(from.x, target.x, t), Phaser.Math.Linear(from.y, target.y, t) - Math.sin(t * Math.PI) * 70);
        ball.rotation = t * Math.PI * 4;
      },
      onComplete: () => {
        if (!target.active || target.dead) {
          target.beingCaught = false;
          this.tweens.add({ targets: ball, alpha: 0, duration: 200, onComplete: () => ball.destroy() });
          return;
        }
        // Swallow the Pokémon.
        sfx.pop();
        ball.rotation = 0;
        target.body.enable = false;
        target.setVelocity(0, 0);
        target.setTintFill(0xffffff);
        this.tweens.add({ targets: target, scale: 0, duration: 180, onComplete: () => target.setVisible(false) });
        this.tweens.add({ targets: ball, y: target.y + 14, duration: 300, ease: 'Bounce.Out' });

        // Three shakes, a click each.
        for (let k = 0; k < 3; k++) {
          this.time.delayedCall(420 + k * 520, () => {
            sfx.shake();
            this.tweens.add({ targets: ball, angle: { from: -26, to: 26 }, duration: 110, yoyo: true, onComplete: () => ball.setAngle(0) });
          });
        }
        this.time.delayedCall(420 + 3 * 520 + 80, () => {
          if (!this.sys.isActive()) return;
          if (success) this.catchWild(target, ball);
          else this.breakFree(target, ball);
        });
      },
    });
  }

  breakFree(target, ball) {
    sfx.pop();
    this.hitFx.explode(12, ball.x, ball.y);
    ball.destroy();
    target.beingCaught = false;
    target.setVisible(true).clearTint();
    this.tweens.add({ targets: target, scale: target.baseScale, duration: 220, ease: 'Back.Out' });
    this.popText(target.x, target.y - 50, 'IT BROKE FREE!', CSS.coral, 11);
    if (this.phase === 'fight') target.body.enable = true;
    else this.tweens.add({ targets: [target, target.shadow], alpha: 0, duration: 400, onComplete: () => target.destroy() });
  }

  catchWild(wild, ball) {
    wild.dead = true;
    this.caught++;
    const { id, name, sprite, hp, attack, speed } = wild.mon;
    addToPokedex({ id, name, sprite, hp, attack, speed });

    sfx.gotcha();
    this.starFx.explode(18, ball.x, ball.y);
    const gotcha = this.add.text(ball.x, ball.y - 70, 'GOTCHA!', heading(26)).setOrigin(0.5).setDepth(DEPTH.text).setScale(0);
    this.tweens.add({ targets: gotcha, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: gotcha, y: gotcha.y - 30, alpha: 0, delay: 900, duration: 400, onComplete: () => gotcha.destroy() });
    this.tweens.add({ targets: ball, alpha: 0, scale: 4, delay: 500, duration: 300, onComplete: () => ball.destroy() });

    const x = wild.x;
    const y = wild.y;
    wild.shadow.destroy();
    wild.destroy();
    this.addToSquad(wild.mon, x, y);
    this.applyCatchRewards();
  }

  // The new catch joins the follow line. A full squad drops its oldest member.
  addToSquad(mon, x, y) {
    if (session.squad.length >= BALANCE.squad.maxSize) {
      session.squad.shift();
      const [gone] = this.team.splice(1, 1);
      // Its shots still in the air go with it (their trail emitter is about to be destroyed).
      this.shots = this.shots.filter((shot) => {
        if (shot.member !== gone) return true;
        shot.orb.destroy();
        return false;
      });
      this.tweens.add({
        targets: [gone.img, gone.img.shadow],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          gone.img.shadow.destroy();
          gone.img.destroy();
          gone.trail.destroy();
        },
      });
      // Slot 1 was the oldest; keep the same Pokémon as lead if it's still here.
      if (session.lead === 1) session.lead = 0;
      else if (session.lead > 1) session.lead--;
    }
    session.squad.push(mon);
    const member = this.makeMember(mon, x, y);
    member.img.setScale(0);
    this.tweens.add({ targets: member.img, scale: TEAM_SCALE, duration: 300, ease: 'Back.Out' });
    member.nextAttackAt = this.elapsed + BALANCE.team.memberAttackEveryMs;
    this.team.push(member);
    this.refreshSquadSlots();
  }

  // Each catch: bigger max HP (capped), a heal, and every few catches an extra life.
  applyCatchRewards() {
    const r = BALANCE.catchRewards;
    session.boostCatches++;
    const oldMax = this.maxHp;
    this.maxHp = this.boostedMaxHp();
    const heal = Math.round(this.maxHp * r.heal);
    this.hp = Math.min(this.maxHp, this.hp + heal);

    if (this.maxHp > oldMax) {
      this.time.delayedCall(300, () => this.popText(this.player.x, this.player.y - 56, '+MAX HP', CSS.yellow, 13));
      this.hpGlow.setAlpha(1);
      this.tweens.add({ targets: this.hpGlow, alpha: 0, duration: 800 });
    }
    this.damageNumber(this.player.x, this.player.y - 30, `+${heal}`, '#7ed957');
    sfx.heal();

    if (this.caught % r.catchesPerLife === 0 && this.lives < r.maxLives) {
      this.lives++;
      this.time.delayedCall(650, () => this.popText(this.player.x, this.player.y - 80, '+1 LIFE', CSS.coral, 13));
    }
  }

  boostedMaxHp() {
    const r = BALANCE.catchRewards;
    const boost = Math.min(r.maxHpBoostCap, session.boostCatches * r.maxHpBoost);
    return Math.round(this.baseMaxHp * (1 + boost));
  }

  // ---------- Drawing ----------

  drawBars(time) {
    const g = this.bars.clear();
    const pulse = 3 * Math.sin(time / 110);

    this.wilds.getChildren().forEach((w) => {
      if (!w.active || w.dead || !w.visible || w.beingCaught) return;
      const width = w.isBoss ? 96 : 48;
      const top = w.y - w.displayHeight / 2 - 14;
      const frac = w.hp / w.maxHp;

      g.fillStyle(PALETTE.navy, 1).fillRoundedRect(w.x - width / 2 - 3, top - 3, width + 6, 12, 4);
      g.fillStyle(PALETTE.white, 1).fillRect(w.x - width / 2, top, width, 6);
      g.fillStyle(frac < CATCH_BELOW ? PALETTE.coral : frac < 0.5 ? PALETTE.yellow : PALETTE.grassMid, 1);
      g.fillRect(w.x - width / 2, top, width * frac, 6);

      if (this.isCatchable(w) && !w.leaving) {
        const radius = Math.max(w.displayWidth, w.displayHeight) / 2 + 10 + pulse;
        g.lineStyle(8, PALETTE.navy, 0.5).strokeCircle(w.x, w.y, radius);
        g.lineStyle(4, PALETTE.cyan, 0.9).strokeCircle(w.x, w.y, radius);
      }
    });

    const anyCatchable = this.phase === 'fight' && this.liveWilds().some((w) => this.isCatchable(w) && !w.beingCaught);
    this.catchPrompt.setVisible(anyCatchable);
    if (this.catchButton) this.catchButton.setAlpha(anyCatchable ? 1 : 0.55);
  }

  updateHud(delta) {
    // The bar is longer when max HP is boosted, and drains smoothly toward the real value.
    this.displayHp += (this.hp - this.displayHp) * Math.min(1, delta / 140);
    const barW = Math.round((HP_BAR_BASE * this.maxHp) / this.baseMaxHp);
    const key = `${barW}:${this.lives}`;
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.drawHudPanel(barW);
    }

    const frac = Phaser.Math.Clamp(this.displayHp / this.maxHp, 0, 1);
    const colour = frac < 0.25 ? PALETTE.coral : frac < 0.5 ? PALETTE.yellow : PALETTE.grassMid;
    const g = this.hpBar.clear();
    g.fillStyle(PALETTE.mist, 1).fillRoundedRect(64, 28, barW, 18, 6);
    if (frac > 0) {
      g.fillStyle(colour, 1).fillRoundedRect(64, 28, Math.max(12, barW * frac), 18, 6);
      g.fillStyle(lighten(colour, 0.18), 1).fillRect(70, 31, Math.max(0, barW * frac - 12), 4);
    }
    g.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(64, 28, barW, 18, 6);

    // Dash meter.
    const dashLeft = Math.max(0, this.dashReadyAt - this.elapsed);
    const ready = 1 - dashLeft / BALANCE.dash.cooldownMs;
    g.fillStyle(PALETTE.mist, 1).fillRoundedRect(64, 51, 120, 8, 4);
    g.fillStyle(dashLeft === 0 ? PALETTE.cyan : 0x9fb4d6, 1).fillRoundedRect(64, 51, Math.max(8, 120 * ready), 8, 4);
    g.lineStyle(2, PALETTE.navy, 1).strokeRoundedRect(64, 51, 120, 8, 4);
    this.dashLabel.setColor(dashLeft === 0 ? CSS.navy : CSS.muted);

    this.hpText.setText(`${this.hp}/${this.maxHp}`);

    const left = Math.max(0, Math.ceil(this.floor.timer - this.elapsed / 1000));
    this.timerText.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.timerText.setColor(left <= 10 ? CSS.coral : CSS.navy);
    this.timerText.setScale(left <= 10 ? 1 + 0.06 * Math.abs(Math.sin(this.elapsed / 160)) : 1);
  }

  // ---------- Stat card: a shiny trading card ----------

  // Raw PokéAPI stats on the left, game numbers on the right (PRD section 5).
  showStatCard(mon) {
    const W = 300;
    const H = 196;
    let slot = 0;
    while (this.statCards.some((c) => c.slot === slot)) slot++;

    const restX = this.scale.width - 18 - W;
    const y = 82 + slot * (H + 12);
    const game = toGameStats(mon);
    const card = this.add.container(this.scale.width + 20, y).setDepth(DEPTH.card);

    const frame = this.add.graphics();
    drawSticker(frame, W, H, { fill: PALETTE.yellow, radius: 14, ox: W / 2, oy: H / 2 });
    frame.fillStyle(PALETTE.white, 1).fillRoundedRect(8, 8, W - 16, H - 16, 10);
    frame.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(8, 8, W - 16, H - 16, 10);
    frame.fillStyle(PALETTE.skyBottom, 1).fillRoundedRect(18, 40, 86, 64, 8);
    frame.fillStyle(PALETTE.grass, 1).fillRect(18, 88, 86, 16);
    frame.lineStyle(3, PALETTE.navy, 1).strokeRoundedRect(18, 40, 86, 64, 8);
    const shimmer = this.add.graphics();
    card.add([frame, shimmer]);

    const icon = this.add.image(61, 74, this.spriteKeys.get(mon.id));
    icon.setScale(icon.width * 2 <= 80 && icon.height * 2 <= 60 ? 2 : 1);
    card.add(icon);
    card.add(this.add.text(18, 18, mon.name.toUpperCase(), label(11)));
    card.add(this.add.text(W - 18, 15, `#${String(mon.id).padStart(3, '0')}`, body(15, CSS.muted)).setOrigin(1, 0));

    const newBadge = this.add.graphics({ x: 168, y: 56 });
    drawSticker(newBadge, 76, 28, { fill: PALETTE.coral, radius: 14, shadow: 3, stroke: 3 });
    card.add([newBadge, this.add.text(168, 57, 'NEW!', label(10, CSS.white)).setOrigin(0.5)]);
    card.add(this.add.text(118, 78, 'PokéAPI numbers\nbecome game numbers', body(13, CSS.muted, { lineSpacing: 0 })));

    card.add(this.add.text(18, 114, 'POKEAPI', label(7, CSS.muted)));
    card.add(this.add.text(160, 114, 'GAME', label(7, CSS.muted)));
    const rows = [
      ['hp', mon.hp, 'Max HP', game.maxHp],
      ['attack', mon.attack, 'Damage', game.damage],
      ['speed', mon.speed, 'Speed', game.speed],
    ];
    rows.forEach(([rawLabel, rawValue, gameLabel, gameValue], i) => {
      const ry = 128 + i * 20;
      card.add(this.add.text(18, ry, rawLabel, body(16, CSS.muted)));
      card.add(this.add.text(120, ry, String(rawValue), body(16)).setOrigin(1, 0));
      card.add(this.add.text(132, ry + 4, '>', label(8, CSS.coral)));
      card.add(this.add.text(160, ry, gameLabel, body(16, CSS.muted)));
      card.add(this.add.text(W - 18, ry + 3, String(gameValue), label(10)).setOrigin(1, 0));
    });

    const entry = { card, shimmer, W, H, slot, t: 0 };
    this.statCards.push(entry);
    this.tweens.add({ targets: card, x: restX, duration: 340, ease: 'Back.Out' });
    entry.dismiss = () => {
      if (entry.dismissed) return;
      entry.dismissed = true;
      this.tweens.add({
        targets: card,
        x: this.scale.width + 20,
        duration: 300,
        ease: 'Back.In',
        onComplete: () => {
          card.destroy();
          this.statCards = this.statCards.filter((c) => c !== entry);
        },
      });
    };
    this.time.delayedCall(STAT_CARD_FOR, entry.dismiss);
  }

  // A rainbow band sweeping diagonally across each card.
  shimmerCards(delta) {
    this.statCards.forEach((c) => {
      c.t += delta;
      const span = c.W + c.H * 0.6;
      const s = ((c.t / 1300) % 1.4) * span - 60;
      const g = c.shimmer.clear();
      for (let x = 10; x < c.W - 10; x += 4) {
        const y0 = Phaser.Math.Clamp((s - x) / 0.6, 10, c.H - 10);
        const y1 = Phaser.Math.Clamp((s + 50 - x) / 0.6, 10, c.H - 10);
        if (y1 <= y0) continue;
        g.fillStyle(RAINBOW[Math.floor(x / 12) % RAINBOW.length], 0.3).fillRect(x, y0, 4, y1 - y0);
      }
    });
  }

  // ---------- End of floor ----------

  clearFloor() {
    this.phase = 'clearing';
    this.player.setVelocity(0, 0);
    this.statCards.forEach((c) => c.dismiss());
    this.shots.forEach((shot) => shot.orb.destroy());
    this.shots = [];
    this.catchPrompt.setVisible(false);

    // Remaining wild Pokémon run away off the screen.
    this.liveWilds().forEach((w) => {
      if (w.beingCaught) return;
      w.leaving = true;
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, w.x, w.y);
      w.body.setVelocity(Math.cos(angle) * w.stats.speed * 2, Math.sin(angle) * w.stats.speed * 2);
      w.setFlipX(w.body.velocity.x > 0);
      this.tweens.add({ targets: w, alpha: 0, delay: 900, duration: 600 });
    });

    sfx.open();
    const banner = this.add.text(480, 300, 'FLOOR CLEARED!', heading(40)).setOrigin(0.5).setDepth(DEPTH.overlay).setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 420, ease: 'Back.Out' });
    this.tweens.add({ targets: banner, y: 290, duration: 600, yoyo: true, repeat: -1, delay: 420, ease: 'Sine.InOut' });
    confetti(this, 80, 660, 70, DEPTH.overlay);
    confetti(this, 880, 660, 70, DEPTH.overlay);

    this.time.delayedCall(2400, () => {
      goTo(this, 'ResultsScene', {
        floor: this.floorNum,
        timeSurvived: Math.round(this.elapsed / 1000),
        defeated: this.defeated,
        caught: this.caught,
      });
    });
  }

  faint() {
    this.phase = 'fainted';
    this.physics.pause();
    this.catchPrompt.setVisible(false);
    sfx.nope();

    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, PALETTE.navy, 0.55).setOrigin(0).setDepth(DEPTH.overlay);
    const panel = this.add.graphics({ x: width / 2, y: height / 2 }).setDepth(DEPTH.overlay);
    drawSticker(panel, 460, 250, { radius: 18, shadow: 8 });
    this.add.text(width / 2, height / 2 - 72, 'OH NO!', heading(30, CSS.coral)).setOrigin(0.5).setDepth(DEPTH.overlay);
    this.add
      .text(width / 2, height / 2 - 20, 'You fainted. Your squad is still with you!', body(20, CSS.navy, { align: 'center', wordWrap: { width: 380 } }))
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay);
    const retry = () => goTo(this, 'ArenaScene', { floor: this.floorNum });
    makeButton(this, width / 2, height / 2 + 62, 'TRY AGAIN', retry, { width: 260 }).setDepth(DEPTH.overlay);
    this.keys.ENTER.once('down', retry);
  }
}
