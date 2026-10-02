import Phaser from 'phaser';

// PokéAPI sprites are 96×96 with lots of empty space around the Pokémon.
// trimmedTexture() makes a copy cropped to the visible pixels, so sprites,
// hitboxes, HP bars and rings all match what the player actually sees.

export function trimmedTexture(scene, key) {
  const trimmedKey = `${key}-trim`;
  if (scene.textures.exists(trimmedKey)) return trimmedKey;
  if (!scene.textures.exists(key)) return key;

  const source = scene.textures.get(key).getSourceImage();
  const { width, height } = source;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return key; // image loaded without CORS; fall back to the untrimmed sprite
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return key;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(source, minX, minY, w, h, 0, 0, w, h);
  scene.textures.addCanvas(trimmedKey, out);
  return trimmedKey;
}

// Official artwork is 475×475 and not pixel art. Shrink it once with smooth scaling
// so it can be shown at exactly 1x instead of being squashed by nearest-neighbour.
export function resizedTexture(scene, key, size) {
  const resizedKey = `${key}-${size}`;
  if (scene.textures.exists(resizedKey)) return resizedKey;
  if (!scene.textures.exists(key)) return key;
  const source = scene.textures.get(key).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, size, size);
  scene.textures.addCanvas(resizedKey, canvas);
  return resizedKey;
}

// Load PokéAPI images (by URL) under the given keys, then call done(). Uses CORS so they can be trimmed.
export function loadImages(scene, entries, done) {
  scene.load.setCORS('anonymous');
  entries.forEach(([key, url]) => {
    if (url && !scene.textures.exists(key)) scene.load.image(key, url);
  });
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => scene.sys.isActive() && done());
  scene.load.start();
}
