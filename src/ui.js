// Shared colors, text styles and widgets so every scene looks the same.

export const COLORS = {
  bg: '#14141f',
  panel: 0x20202e,
  panelHover: 0x2a2a3d,
  border: 0x3a3a52,
  accent: 0xffcb05,
  blue: 0x3d7dca,
  text: '#f2f2f7',
  muted: '#8a8aa3',
  accentText: '#ffcb05',
  error: '#ff6b6b',
};

export const FONT = '"Press Start 2P", monospace';

export function textStyle(size, color = COLORS.text, extra = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}

// A flat pixel button. Returns the container; call setEnabled(false) to grey it out.
export function makeButton(scene, x, y, label, onClick, { width = 220, height = 52, size = 16 } = {}) {
  const bg = scene.add.rectangle(0, 0, width, height, COLORS.accent).setStrokeStyle(4, 0xffffff);
  const text = scene.add.text(0, 2, label, textStyle(size, '#14141f')).setOrigin(0.5);
  const button = scene.add.container(x, y, [bg, text]).setSize(width, height);
  let enabled = true;

  button.setInteractive({ useHandCursor: true });
  button.on('pointerover', () => enabled && bg.setFillStyle(0xffe066));
  button.on('pointerout', () => enabled && bg.setFillStyle(COLORS.accent));
  button.on('pointerdown', () => enabled && onClick());

  button.setEnabled = (value) => {
    enabled = value;
    bg.setFillStyle(value ? COLORS.accent : COLORS.border);
    bg.setStrokeStyle(4, value ? 0xffffff : COLORS.border);
    text.setColor(value ? '#14141f' : COLORS.muted);
    if (button.input) button.input.cursor = value ? 'pointer' : 'default';
    return button;
  };
  return button;
}

// Temporary screen for scenes that aren't built yet.
export function showPlaceholder(scene, name) {
  const { width, height } = scene.scale;
  scene.add.text(width / 2, height / 2 - 40, name, textStyle(32)).setOrigin(0.5);
  scene.add.text(width / 2, height / 2 + 10, 'Coming soon', textStyle(12, COLORS.muted)).setOrigin(0.5);
  makeButton(scene, width / 2, height / 2 + 90, 'BACK', () => scene.scene.start('TitleScene'));
}
