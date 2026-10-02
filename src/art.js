// All the game's pixel art, drawn in code at low resolution.
// Images are shown at whole-number scales (2x, 3x) so pixels stay crisp.
import Phaser from 'phaser';
import { PALETTE } from './ui.js';

const NAVY = PALETTE.navy;

// ---------- Tiny painter for pixel canvases ----------

function rgb(color) {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

function painter(ctx, w, h) {
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  const p = {
    w,
    h,
    rect(x, y, rw, rh, c) {
      ctx.fillStyle = hex(c);
      ctx.fillRect(x, y, rw, rh);
    },
    px(x, y, c) {
      p.rect(x, y, 1, 1, c);
    },
    disc(cx, cy, r, c) {
      ctx.fillStyle = hex(c);
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    ellipse(cx, cy, rx, ry, c) {
      ctx.fillStyle = hex(c);
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) ctx.fillRect(x, y, 1, 1);
        }
      }
    },
    // Draw from strings: each character maps to a colour in `colors` ('.' = empty).
    grid(rows, colors, ox = 0, oy = 0) {
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (colors[ch] != null) p.px(ox + x, oy + y, colors[ch]);
        }),
      );
    },
    // Recolour filled pixels: fn(x, y) returns a colour or null to keep it.
    shade(fn) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0) continue;
          const c = fn(x, y);
          if (c == null) continue;
          [d[i], d[i + 1], d[i + 2]] = rgb(c);
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    // Add a 1px outline around everything drawn so far.
    outline(c = NAVY) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
      const edge = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) edge.push([x, y]);
        }
      }
      edge.forEach(([x, y]) => p.px(x, y, c));
    },
  };
  return p;
}

// Make a texture by drawing on a small canvas, optionally pre-scaled by a whole number.
export function pixelTexture(scene, key, w, h, draw, scale = 1) {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  draw(painter(ctx, w, h));
  let out = canvas;
  if (scale > 1) {
    out = document.createElement('canvas');
    out.width = w * scale;
    out.height = h * scale;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(canvas, 0, 0, w * scale, h * scale);
  }
  scene.textures.addCanvas(key, out);
  return key;
}

// Small deterministic random so decorations look the same every visit.
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- Shared textures ----------

export const FLAG_COLORS = { coral: PALETTE.coral, yellow: PALETTE.yellow, cyan: PALETTE.cyan, green: PALETTE.grassMid };

export function makeArt(scene) {
  if (scene.textures.exists('art-ready')) return;

  pixelTexture(scene, 'px', 2, 2, (p) => p.rect(0, 0, 2, 2, 0xffffff));
  pixelTexture(scene, 'confetti', 3, 2, (p) => p.rect(0, 0, 3, 2, 0xffffff));
  pixelTexture(scene, 'sparkle', 5, 5, (p) => p.grid(['..X..', '..X..', 'XXXXX', '..X..', '..X..'], { X: 0xffffff }));
  pixelTexture(scene, 'star', 7, 7, (p) =>
    p.grid(['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X'], { X: 0xffffff }),
  );
  pixelTexture(scene, 'shadow', 16, 6, (p) => p.ellipse(8, 3, 8, 3, NAVY));

  // Clouds: white puffs with a soft blue underside.
  const cloud = (key, w, h, discs, base) =>
    pixelTexture(scene, key, w, h, (p) => {
      discs.forEach(([x, y, r]) => p.disc(x, y, r, 0xffffff));
      p.rect(base[0], base[1], base[2], base[3], 0xffffff);
      p.shade((x, y) => (y >= h - 4 ? 0xd9f1ff : null));
      p.outline(0xa9dcf7);
    });
  cloud('cloud-a', 42, 20, [[11, 12, 7], [20, 9, 8], [29, 11, 7], [35, 14, 4.5]], [4, 13, 34, 5]);
  cloud('cloud-b', 30, 16, [[8, 10, 5.5], [15, 7, 6], [21, 9, 5]], [3, 10, 22, 4]);
  cloud('cloud-c', 58, 24, [[12, 15, 8], [24, 11, 10], [36, 12, 9], [46, 16, 6]], [5, 16, 46, 6]);

  // Birds, two wing frames.
  pixelTexture(scene, 'bird-0', 7, 4, (p) => p.grid(['X.....X', '.X...X.', '..X.X..', '...X...'], { X: NAVY }));
  pixelTexture(scene, 'bird-1', 7, 4, (p) => p.grid(['.......', 'XXX.XXX', '...X...', '.......'], { X: NAVY }));

  // Flowers: petals, centre, stem.
  [['pink', 0xff7eb6, 0xfff1a8], ['yellow', PALETTE.yellow, 0xff9a3d], ['white', 0xffffff, PALETTE.yellow]].forEach(
    ([name, petal, centre]) =>
      pixelTexture(scene, `flower-${name}`, 7, 10, (p) => {
        p.rect(3, 5, 1, 5, PALETTE.grassDark);
        p.px(4, 7, PALETTE.grassMid);
        p.px(2, 8, PALETTE.grassMid);
        p.disc(3.5, 3, 2.6, petal);
        p.px(3, 2, centre);
        p.px(3, 3, centre);
        p.outline(NAVY);
      }),
  );

  // Grass tiles, three variations, pre-scaled to 32px.
  [0, 1, 2].forEach((v) =>
    pixelTexture(
      scene,
      `grass-${v}`,
      16,
      16,
      (p) => {
        const rand = seeded(v * 97 + 13);
        p.rect(0, 0, 16, 16, PALETTE.grass);
        if (v === 2) {
          p.disc(5, 6, 3.2, 0x74d34f);
          p.disc(11, 11, 2.6, 0x74d34f);
        }
        const tufts = v === 0 ? 3 : 5;
        for (let i = 0; i < tufts; i++) {
          const x = 1 + Math.floor(rand() * 13);
          const y = 2 + Math.floor(rand() * 12);
          p.px(x, y, PALETTE.grassMid);
          p.px(x - 1, y - 1, PALETTE.grassMid);
          p.px(x + 1, y - 1, PALETTE.grassMid);
        }
        if (v === 1) {
          for (let i = 0; i < 4; i++) p.px(Math.floor(rand() * 16), Math.floor(rand() * 16), 0xa6ec7f);
        }
      },
      2,
    ),
  );

  pixelTexture(scene, 'rock', 13, 10, (p) => {
    p.ellipse(6.5, 5.5, 6, 4.5, 0xc6cedd);
    p.shade((x, y) => (y >= 7 ? 0x98a3bb : y <= 2 && x < 7 ? 0xeef2f8 : null));
    p.outline(NAVY);
  });

  pixelTexture(scene, 'bush', 20, 14, (p) => {
    [[5, 8, 5], [10, 6, 6], [15, 8, 4.5]].forEach(([x, y, r]) => p.disc(x, y, r, PALETTE.grassMid));
    p.rect(1, 8, 18, 5, PALETTE.grassMid);
    p.shade((x, y) => (y >= 10 ? PALETTE.grassDark : y <= 3 ? PALETTE.grass : null));
    [[6, 7], [12, 5], [14, 9]].forEach(([x, y]) => p.px(x, y, PALETTE.coral));
    p.outline(NAVY);
  });

  // The trainer: red cap, blue shirt.
  pixelTexture(scene, 'trainer', 14, 16, (p) => {
    p.grid(
      [
        '....RRRR....',
        '...RRRRRR...',
        '...RWWRRRR..',
        '..RRRRRRRRRR',
        '...SSSSSS...',
        '...SKSSKS...',
        '...SSSSSS...',
        '..BBBBBBBB..',
        '.SBBBBBBBBS.',
        '.SBBBBBBBBS.',
        '...PPPPPP...',
        '...PP..PP...',
        '...PP..PP...',
        '..KKK..KKK..',
      ],
      { R: PALETTE.coral, W: 0xffffff, S: 0xffd9b3, K: NAVY, B: 0x3d9bff, P: 0x4a5d8a },
      1,
      1,
    );
    p.outline(NAVY);
  });

  pixelTexture(scene, 'ball', 10, 10, (p) => {
    p.grid(
      ['..RRRR..', '.RRRRRR.', 'RRRRRRRR', 'KKKWWKKK', 'KKKWWKKK', 'WWWWWWWW', '.WWWWWW.', '..WWWW..'],
      { R: PALETTE.coral, W: 0xffffff, K: NAVY },
      1,
      1,
    );
    p.px(3, 2, 0xffffff);
    p.outline(NAVY);
  });

  // Projectile: white core so it can be tinted by type.
  pixelTexture(scene, 'orb', 8, 8, (p) => {
    p.disc(4, 4, 3.6, 0xffffff);
  });

  pixelTexture(scene, 'heart', 9, 8, (p) => {
    p.grid(['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], { R: PALETTE.coral, W: 0xffffff }, 1, 1);
    p.outline(NAVY);
  });

  pixelTexture(scene, 'arrow', 11, 11, (p) => {
    p.grid(['..YYYYY..', '..YYYYY..', '..YYYYY..', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '...YYY...', '....Y....'], { Y: PALETTE.yellow }, 1, 1);
    p.shade((x, y) => (y >= 6 ? 0xf0b400 : null));
    p.outline(NAVY);
  });

  pixelTexture(scene, 'padlock', 11, 13, (p) => {
    p.grid(['..GGGGG..', '.GG...GG.', '.G.....G.', '.G.....G.'], { G: 0xc6cedd }, 1, 1);
    p.rect(1, 5, 9, 7, PALETTE.yellow);
    p.rect(1, 5, 9, 1, 0xffe68a);
    p.rect(5, 7, 1, 3, NAVY);
    p.px(4, 7, NAVY);
    p.px(6, 7, NAVY);
    p.outline(NAVY);
  });

  // Doors on the tower map (20×30 + outline).
  const doorShape = (p, fill) => {
    p.disc(11, 11, 10, fill);
    p.rect(1, 11, 20, 20, fill);
  };
  pixelTexture(scene, 'door-wood', 22, 32, (p) => {
    doorShape(p, 0xd38b4a);
    p.shade((x, y) => {
      if (y === 9 || y === 10 || y === 22 || y === 23) return 0x6b5040;
      if (x === 7 || x === 14) return 0xa86a32;
      return null;
    });
    p.px(16, 17, PALETTE.yellow);
    p.outline(NAVY);
  });
  pixelTexture(scene, 'door-open', 22, 32, (p) => {
    doorShape(p, PALETTE.cyan);
    p.disc(11, 12, 7, 0xb8f6ff);
    p.rect(4, 12, 14, 19, 0xb8f6ff);
    p.rect(7, 14, 8, 17, 0xffffff);
    p.outline(NAVY);
  });
  pixelTexture(scene, 'door-cardboard', 22, 31, (p) => {
    p.rect(1, 1, 20, 29, 0xd9b77e);
    p.shade((x, y) => (y % 4 === 0 ? 0xc49a5a : x > 16 && y < 6 ? 0xe8cf9e : null));
    p.rect(1, 13, 20, 3, 0xf3e6c4);
    p.px(16, 18, NAVY);
    p.outline(0x8a6a3a);
  });

  // Brick tile for tower walls, pre-scaled to 48×24.
  pixelTexture(
    scene,
    'brick',
    16,
    8,
    (p) => {
      p.rect(0, 0, 16, 8, 0xf6eedd);
      p.rect(0, 3, 16, 1, 0xdccfb5);
      p.rect(0, 7, 16, 1, 0xdccfb5);
      p.rect(7, 0, 1, 3, 0xdccfb5);
      p.rect(15, 4, 1, 3, 0xdccfb5);
      p.rect(1, 0, 5, 1, 0xfffaf0);
      p.rect(9, 4, 5, 1, 0xfffaf0);
    },
    3,
  );

  // Title-screen tower: light stone with arched windows, crenellations on top.
  pixelTexture(scene, 'tower', 58, 126, (p) => {
    const stone = 0xf6eedd;
    const mortar = 0xdccfb5;
    p.rect(5, 8, 48, 118, stone);
    for (let x = 1; x < 57; x += 10) p.rect(x, 1, 6, 8, stone);
    p.rect(1, 6, 56, 5, stone);
    p.shade((x, y) => {
      if (y > 12 && y % 7 === 0) return mortar;
      if (y > 12 && (x + (Math.floor(y / 7) % 2) * 6) % 12 === 0) return mortar;
      if (x <= 8) return 0xe9dcc2;
      return null;
    });
    p.rect(1, 11, 56, 3, PALETTE.coral);
    const windowAt = (x, y) => {
      p.disc(x + 3.5, y + 3, 3.5, NAVY);
      p.rect(x, y + 3, 7, 7, NAVY);
      p.disc(x + 3.5, y + 4, 2.2, PALETTE.yellow);
      p.rect(x + 1, y + 4, 5, 5, PALETTE.yellow);
      p.rect(x + 3, y + 2, 1, 8, NAVY);
    };
    windowAt(25, 22);
    windowAt(14, 52);
    windowAt(37, 52);
    windowAt(25, 82);
    p.outline(NAVY);
  });

  // Waving flags: three frames per colour, played as an animation.
  Object.entries(FLAG_COLORS).forEach(([name, color]) => {
    for (let f = 0; f < 3; f++) {
      pixelTexture(scene, `flag-${name}-${f}`, 13, 10, (p) => {
        for (let x = 0; x < 12; x++) {
          const off = Math.round(Math.sin((x / 12) * Math.PI * 2 + (f * Math.PI * 2) / 3) * 1);
          const len = 7 - Math.floor(x / 4);
          const top = 1 + off + Math.floor(x / 5);
          p.rect(x, top, 1, len, color);
          p.px(x, top + len - 1, Phaser.Display.Color.IntegerToColor(color).darken(18).color);
        }
        p.outline(NAVY);
      });
    }
    if (!scene.anims.exists(`flag-${name}`)) {
      scene.anims.create({
        key: `flag-${name}`,
        frames: [0, 1, 2].map((f) => ({ key: `flag-${name}-${f}` })),
        frameRate: 6,
        repeat: -1,
      });
    }
  });
  pixelTexture(scene, 'pole', 3, 16, (p) => {
    p.rect(1, 1, 1, 15, 0x8a99b8);
    p.px(1, 0, PALETTE.yellow);
    p.outline(NAVY);
  });

  // Door scene: a big friendly stone door with a face.
  pixelTexture(scene, 'door-frame', 74, 90, (p) => {
    p.disc(37, 34, 34, 0xd7dce6);
    p.rect(3, 34, 68, 55, 0xd7dce6);
    p.shade((x, y) => ((x * 3 + y * 5) % 23 === 0 || y % 11 === 0 ? 0xb8c0d0 : null));
    p.disc(37, 36, 25, NAVY);
    p.rect(12, 36, 50, 53, NAVY);
    p.outline(NAVY);
  });
  // Leaf and glow fill the frame's opening exactly: 50 wide, 78 tall.
  pixelTexture(scene, 'door-glow', 50, 78, (p) => {
    p.disc(25, 25, 25, 0xfff6c2);
    p.rect(0, 25, 50, 53, 0xfff6c2);
    p.disc(25, 32, 17, 0xffffff);
    p.rect(8, 32, 34, 46, 0xffffff);
  });
  pixelTexture(scene, 'door-leaf', 52, 80, (p) => {
    p.disc(26, 26, 25, 0xc9d0dd);
    p.rect(1, 26, 50, 53, 0xc9d0dd);
    p.shade((x, y) => {
      if ((x * 7 + y * 3) % 31 === 0) return 0xaab3c5;
      if (x < 4 || y < 5) return 0xdde3ee;
      return null;
    });
    // Friendly face.
    p.rect(16, 30, 4, 6, NAVY);
    p.rect(32, 30, 4, 6, NAVY);
    p.px(17, 31, 0xffffff);
    p.px(33, 31, 0xffffff);
    p.rect(11, 38, 4, 2, 0xff9fb0);
    p.rect(37, 38, 4, 2, 0xff9fb0);
    p.rect(22, 41, 8, 1, NAVY);
    p.px(21, 40, NAVY);
    p.px(30, 40, NAVY);
    // Stone bands and a ring handle.
    p.rect(1, 56, 50, 2, 0xaab3c5);
    p.rect(1, 68, 50, 2, 0xaab3c5);
    p.disc(41, 62, 2.5, PALETTE.yellow);
    p.outline(NAVY);
  });
  pixelTexture(scene, 'puff', 24, 16, (p) => {
    [[7, 9, 5], [13, 6, 6], [18, 9, 5]].forEach(([x, y, r]) => p.disc(x, y, r, 0xffffff));
    p.rect(3, 9, 19, 5, 0xffffff);
    p.outline(NAVY);
  });

  pixelTexture(scene, 'art-ready', 1, 1, () => {});
}

// ---------- Scenery ----------

export function addSky(scene, w = scene.scale.width, h = scene.scale.height) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  const bands = 20;
  const top = Phaser.Display.Color.IntegerToColor(PALETTE.skyTop);
  const bottom = Phaser.Display.Color.IntegerToColor(PALETTE.skyBottom);
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, Math.floor((i * h) / bands), w, Math.ceil(h / bands) + 1);
  }
  return g;
}

// Clouds drifting slowly to the right, wrapping around.
export function addClouds(scene, { count = 6, minY = 20, maxY = 300, depth = -90, scrollFactor = 0, width = scene.scale.width, seed = 7 } = {}) {
  const rand = seeded(seed);
  const keys = ['cloud-a', 'cloud-b', 'cloud-c'];
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const scale = 3 + Math.floor(rand() * 2);
    const cloud = scene.add
      .image(rand() * width, minY + rand() * (maxY - minY), keys[i % 3])
      .setScale(scale)
      .setDepth(depth)
      .setScrollFactor(scrollFactor);
    cloud.speed = 6 + rand() * 10;
    clouds.push(cloud);
  }
  const update = (_t, delta) =>
    clouds.forEach((c) => {
      c.x += (c.speed * delta) / 1000;
      if (c.x - c.displayWidth / 2 > width) c.x = -c.displayWidth / 2;
    });
  scene.events.on('update', update);
  scene.events.once('shutdown', () => scene.events.off('update', update));
  return clouds;
}

// A few birds flapping across the sky.
export function addBirds(scene, { count = 3, minY = 50, maxY = 200, depth = -80, scrollFactor = 0 } = {}) {
  const width = scene.scale.width;
  const birds = [];
  for (let i = 0; i < count; i++) {
    const bird = scene.add.image(-40 - i * 260, Phaser.Math.Between(minY, maxY), 'bird-0').setScale(3).setDepth(depth).setScrollFactor(scrollFactor);
    bird.speed = 50 + Math.random() * 30;
    bird.base = bird.y;
    bird.t = Math.random() * 10;
    birds.push(bird);
  }
  const update = (_time, delta) =>
    birds.forEach((b) => {
      b.t += delta / 1000;
      b.x += (b.speed * delta) / 1000;
      b.y = b.base + Math.sin(b.t * 2) * 6;
      b.setTexture(Math.floor(b.t * 6) % 2 ? 'bird-1' : 'bird-0');
      if (b.x > width + 40) {
        b.x = -40 - Math.random() * 300;
        b.base = Phaser.Math.Between(minY, maxY);
      }
    });
  scene.events.on('update', update);
  scene.events.once('shutdown', () => scene.events.off('update', update));
  return birds;
}

// Rolling green hills, two layers. Returns the texture key (w × h, pre-scaled 3x).
export function hillsTexture(scene, w = 960, h = 210) {
  const key = `hills-${w}x${h}`;
  const lw = Math.ceil(w / 3);
  const lh = Math.ceil(h / 3);
  return pixelTexture(
    scene,
    key,
    lw,
    lh,
    (p) => {
      const back = (x) => Math.round(lh * 0.18 + Math.sin(x / 23) * 5 + Math.sin(x / 9 + 1) * 2);
      const front = (x) => Math.round(lh * 0.48 + Math.sin(x / 31 + 2) * 7 + Math.sin(x / 13) * 2);
      for (let x = 0; x < lw; x++) {
        const b = back(x);
        p.rect(x, b, 1, lh - b, PALETTE.grass);
        p.px(x, b, PALETTE.grassDark);
        const f = front(x);
        p.rect(x, f, 1, lh - f, PALETTE.grassMid);
        p.px(x, f, PALETTE.grassDark);
        p.px(x, f + 1, 0x6fd04c);
      }
      const rand = seeded(w + h);
      for (let i = 0; i < lw / 3; i++) {
        const x = Math.floor(rand() * lw);
        const y = front(x) + 4 + Math.floor(rand() * (lh - front(x) - 5));
        p.px(x, y, PALETTE.grassDark);
        p.px(x + 1, y - 1, PALETTE.grassDark);
      }
    },
    3,
  );
}

// Flowers that sway gently in the breeze.
export function addFlowers(scene, spots, { depth = 5, scrollFactor = 1 } = {}) {
  const colours = ['pink', 'yellow', 'white'];
  return spots.map(([x, y], i) => {
    const f = scene.add
      .image(x, y, `flower-${colours[i % 3]}`)
      .setOrigin(0.5, 1)
      .setScale(3)
      .setDepth(depth)
      .setScrollFactor(scrollFactor);
    f.angle = -6;
    scene.tweens.add({ targets: f, angle: 6, duration: 1100 + (i % 4) * 180, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: (i * 137) % 900 });
    return f;
  });
}

// Shared backdrop for menu-style screens: sky, clouds, birds, hills, flowers.
export function addMeadow(scene, { hillsHeight = 180, flowers = 10, birds = 2 } = {}) {
  const { width, height } = scene.scale;
  addSky(scene);
  addClouds(scene, { count: 6, maxY: height - hillsHeight - 40 });
  if (birds) addBirds(scene, { count: birds, maxY: Math.min(220, height - hillsHeight - 60) });
  scene.add.image(0, height, hillsTexture(scene, width, hillsHeight)).setOrigin(0, 1).setDepth(-50);
  const rand = seeded(flowers * 31 + hillsHeight);
  const spots = Array.from({ length: flowers }, (_, i) => [
    Math.round(((i + 0.5) / flowers) * width + (rand() - 0.5) * 50),
    Math.round(height - 8 - rand() * (hillsHeight * 0.38)),
  ]);
  addFlowers(scene, spots, { depth: -40 });
}
