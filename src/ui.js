// Shared look for every scene: palette, fonts, sticker panels, buttons, transitions.
import Phaser from 'phaser';
import { sfx } from './sfx.js';

export const PALETTE = {
  skyTop: 0x5ec8ff,
  skyBottom: 0xb8ecff,
  grass: 0x7ed957,
  grassMid: 0x4cb944,
  grassDark: 0x2f9e44,
  yellow: 0xffd23f,
  coral: 0xff5e5b,
  cyan: 0x3de0ff,
  white: 0xffffff,
  navy: 0x1b2a4a,
  mist: 0xe6eef8, // empty bar backgrounds, disabled things
  wood: 0xe8ac64,
  woodDark: 0xb87436,
};

export const CSS = {
  navy: '#1b2a4a',
  yellow: '#ffd23f',
  coral: '#ff5e5b',
  cyan: '#3de0ff',
  white: '#ffffff',
  green: '#2f9e44',
  muted: '#5b6d92',
};

// Phones and tablets get on-screen controls instead of keyboard hints.
export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches);

export const HEAD_FONT = '"Press Start 2P", monospace';
// Jersey 10 instead of Pixelify Sans: Pixelify's C reads as O and its 5 as S, which matters for
// stat numbers, code in hints and typed answers. Jersey 10 is just as chunky and keeps them distinct.
export const BODY_FONT = '"Jersey 10", sans-serif';
const BODY_SCALE = 1.3; // Jersey 10 runs small; sizes passed to body() match the rest of the UI

const toCss = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function lighten(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  c.lighten(amount * 100);
  return c.color;
}

// Big chunky headings: Press Start 2P with a navy outline and a hard drop shadow.
export function heading(size, color = CSS.yellow, extra = {}) {
  const stroke = Math.max(4, Math.round(size / 4));
  return {
    fontFamily: HEAD_FONT,
    fontSize: `${size}px`,
    color,
    stroke: CSS.navy,
    strokeThickness: stroke,
    shadow: { offsetX: 0, offsetY: Math.max(3, Math.round(size / 6)), color: CSS.navy, blur: 0, stroke: true, fill: true },
    ...extra,
  };
}

// Small heading-font labels with no outline (for use on white panels).
export function label(size, color = CSS.navy, extra = {}) {
  return { fontFamily: HEAD_FONT, fontSize: `${size}px`, color, ...extra };
}

// Readable body text on light backgrounds.
export function body(size, color = CSS.navy, extra = {}) {
  return { fontFamily: BODY_FONT, fontSize: `${Math.round(size * BODY_SCALE)}px`, color, ...extra };
}

// Body text drawn straight on top of the game: white with a navy outline.
export function outlined(size, color = CSS.white, extra = {}) {
  return body(size, color, { stroke: CSS.navy, strokeThickness: Math.max(4, Math.round(size / 4)), ...extra });
}

// A white sticker panel with a thick navy outline and a hard drop shadow, centred on (x, y).
export function sticker(scene, x, y, w, h, { fill = PALETTE.white, radius = 12, shadow = 6, stroke = 4 } = {}) {
  const g = scene.add.graphics({ x, y });
  drawSticker(g, w, h, { fill, radius, shadow, stroke });
  return g;
}

export function drawSticker(g, w, h, { fill = PALETTE.white, radius = 12, shadow = 6, stroke = 4, ox = 0, oy = 0 } = {}) {
  const x = ox - w / 2;
  const y = oy - h / 2;
  if (shadow) g.fillStyle(PALETTE.navy, 1).fillRoundedRect(x + shadow, y + shadow, w, h, radius);
  g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(stroke, PALETTE.navy, 1).strokeRoundedRect(x, y, w, h, radius);
  return g;
}

// A wooden sign: plank with grain, nails and two posts. Centred on (x, y).
export function woodSign(scene, x, y, w, h, { posts = 40 } = {}) {
  const g = scene.add.graphics({ x, y });
  const left = -w / 2;
  const top = -h / 2;
  if (posts) {
    [left + 28, -left - 40].forEach((px) => {
      g.fillStyle(PALETTE.woodDark, 1).fillRect(px, top + h - 6, 12, posts);
      g.lineStyle(3, PALETTE.navy, 1).strokeRect(px, top + h - 6, 12, posts);
    });
  }
  g.fillStyle(PALETTE.navy, 1).fillRect(left + 5, top + 6, w, h);
  g.fillStyle(PALETTE.wood, 1).fillRect(left, top, w, h);
  g.fillStyle(lighten(PALETTE.wood, 0.12), 1).fillRect(left, top, w, 6);
  g.fillStyle(PALETTE.woodDark, 0.22); // faint grain so text on the sign stays readable
  for (let row = 14; row < h - 6; row += 12) {
    g.fillRect(left + 10 + ((row * 7) % 30), top + row, w * 0.35, 2);
    g.fillRect(left + w * 0.55 - ((row * 5) % 24), top + row + 5, w * 0.3, 2);
  }
  g.fillStyle(PALETTE.navy, 1);
  [[left + 8, top + 8], [-left - 12, top + 8], [left + 8, top + h - 12], [-left - 12, top + h - 12]].forEach(([nx, ny]) =>
    g.fillRect(nx, ny, 4, 4),
  );
  g.lineStyle(4, PALETTE.navy, 1).strokeRect(left, top, w, h);
  return g;
}

// Big chunky button that squishes when pressed. Returns a container with setEnabled() and setLabel().
export function makeButton(scene, x, y, text, onClick, { width = 240, height = 60, color = PALETTE.yellow, size = 16 } = {}) {
  const button = scene.add.container(x, y);
  const shadow = scene.add.graphics();
  shadow.fillStyle(PALETTE.navy, 1).fillRoundedRect(-width / 2, -height / 2 + 6, width, height, 14);
  const face = scene.add.graphics();
  const caption = scene.add.text(0, 1, text, label(size, CSS.navy)).setOrigin(0.5);
  const top = scene.add.container(0, 0, [face, caption]);
  button.add([shadow, top]);

  let enabled = true;
  let fill = color;
  const paint = () => {
    const base = enabled ? fill : PALETTE.mist;
    face.clear();
    face.fillStyle(base, 1).fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    face.fillStyle(lighten(base, 0.18), 1).fillRoundedRect(-width / 2 + 8, -height / 2 + 6, width - 16, 8, 4);
    face.lineStyle(4, PALETTE.navy, 1).strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    caption.setColor(enabled ? CSS.navy : CSS.muted);
  };
  paint();

  button.setSize(width, height + 6).setInteractive({ useHandCursor: true });
  button.on('pointerover', () => enabled && scene.tweens.add({ targets: top, y: -3, duration: 90 }));
  button.on('pointerout', () => scene.tweens.add({ targets: top, y: 0, duration: 90 }));
  button.on('pointerdown', () => {
    if (!enabled) {
      scene.tweens.add({ targets: button, x: x + 6, duration: 50, yoyo: true, repeat: 2, onComplete: () => button.setX(x) });
      return;
    }
    sfx.click();
    top.y = 3;
    scene.tweens.add({
      targets: button,
      scaleX: 1.08,
      scaleY: 0.86,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        top.y = 0;
        onClick();
      },
    });
  });

  button.setEnabled = (value) => {
    enabled = value;
    paint();
    if (button.input) button.input.cursor = value ? 'pointer' : 'default';
    return button;
  };
  button.setLabel = (value) => {
    caption.setText(value);
    return button;
  };
  button.setColor = (value) => {
    fill = value;
    paint();
    return button;
  };
  return button;
}

// ---------- Scene transitions: a pixel wipe ----------

const WIPE_CELL = 48;
const WIPE_STEP = 14; // ms delay per diagonal

function wipeCells(scene, startScale) {
  const cam = scene.cameras.main;
  const cells = [];
  const cols = Math.ceil(cam.width / WIPE_CELL);
  const rows = Math.ceil(cam.height / WIPE_CELL);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = scene.add
        .rectangle(c * WIPE_CELL + WIPE_CELL / 2, r * WIPE_CELL + WIPE_CELL / 2, WIPE_CELL + 1, WIPE_CELL + 1, PALETTE.navy)
        .setScrollFactor(0)
        .setDepth(100000)
        .setScale(startScale);
      cell.order = c + r;
      cells.push(cell);
    }
  }
  return cells;
}

function setDomVisible(scene, visible) {
  scene.children.list.forEach((child) => child.type === 'DOMElement' && child.setVisible(visible));
}

// Cover the screen with navy pixels, then start the next scene.
export function goTo(scene, key, data) {
  if (scene.leaving) return;
  scene.leaving = true;
  setDomVisible(scene, false);
  const cells = wipeCells(scene, 0);
  let last = 0;
  cells.forEach((cell) => {
    last = Math.max(last, cell.order * WIPE_STEP + 140);
    scene.tweens.add({ targets: cell, scale: 1, delay: cell.order * WIPE_STEP, duration: 140, ease: 'Quad.Out' });
  });
  scene.time.delayedCall(last + 30, () => scene.scene.start(key, data));
}

// Call at the end of create(): the pixels clear away to reveal the scene.
export function wipeIn(scene) {
  scene.leaving = false;
  setDomVisible(scene, false);
  const cells = wipeCells(scene, 1);
  let last = 0;
  cells.forEach((cell) => {
    last = Math.max(last, cell.order * WIPE_STEP + 140);
    scene.tweens.add({
      targets: cell,
      scale: 0,
      delay: cell.order * WIPE_STEP,
      duration: 140,
      ease: 'Quad.In',
      onComplete: () => cell.destroy(),
    });
  });
  scene.time.delayedCall(last * 0.6, () => setDomVisible(scene, true));
}

// ---------- Little celebrations ----------

const PARTY = [PALETTE.yellow, PALETTE.coral, PALETTE.cyan, PALETTE.grass, 0xff7eb6, PALETTE.white];

export function confetti(scene, x, y, count = 60, depth = 5000) {
  const emitter = scene.add.particles(x, y, 'confetti', {
    speed: { min: 220, max: 520 },
    angle: { min: 220, max: 320 },
    gravityY: 650,
    lifespan: 2600,
    rotate: { start: 0, end: 720 },
    scale: { min: 2, max: 3 },
    tint: PARTY,
    emitting: false,
  });
  emitter.setDepth(depth);
  emitter.explode(count);
  scene.time.delayedCall(2800, () => emitter.destroy());
}

// A twinkle that pops up and fades.
export function sparkle(scene, x, y, { tint = PALETTE.white, depth = 50, scale = 3 } = {}) {
  const s = scene.add.image(x, y, 'sparkle').setTint(tint).setScale(0).setDepth(depth);
  scene.tweens.add({
    targets: s,
    scale,
    angle: 90,
    duration: 220,
    yoyo: true,
    ease: 'Quad.Out',
    onComplete: () => s.destroy(),
  });
  return s;
}

// A sticker toast at the bottom of the screen that fades away.
export function toast(scene, message, { color = PALETTE.white, y } = {}) {
  scene.activeToast?.destroy();
  const t = scene.add.text(0, 0, message, body(20)).setOrigin(0.5);
  const w = t.width + 40;
  const panel = scene.add.graphics();
  drawSticker(panel, w, 48, { fill: color, radius: 24, shadow: 5 });
  const c = scene.add
    .container(scene.cameras.main.width / 2, y ?? scene.cameras.main.height - 60, [panel, t])
    .setScrollFactor(0)
    .setDepth(9000)
    .setScale(0.6)
    .setAlpha(0);
  scene.activeToast = c;
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
  scene.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 300, onComplete: () => c.destroy() });
  return c;
}

export { toCss };
