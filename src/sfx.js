// Tiny synthesized blips (no audio files). Browsers only allow sound after the first click or key press,
// so anything played before that is silently skipped.

let ctx = null;

function audio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, duration, { type = 'square', volume = 0.06, slideTo, delay = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  click: () => tone(1400, 0.05, { volume: 0.04 }),
  // Rising dings for counting up results: pass 0, 1, 2...
  ding: (step = 0) => tone(880 * 2 ** ((step * 3) / 12), 0.25, { type: 'triangle', volume: 0.09 }),
  pop: () => tone(600, 0.12, { type: 'triangle', slideTo: 200, volume: 0.07 }),
  hit: () => tone(220, 0.08, { type: 'square', slideTo: 110, volume: 0.05 }),
  shake: () => tone(900, 0.04, { type: 'square', volume: 0.05 }),
  gotcha: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'square', volume: 0.05, delay: i * 0.08 })),
  nope: () => tone(180, 0.22, { type: 'sawtooth', slideTo: 120, volume: 0.05 }),
  open: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', volume: 0.08, delay: i * 0.09 })),
  heal: () => [660, 880].forEach((f, i) => tone(f, 0.12, { type: 'triangle', volume: 0.06, delay: i * 0.07 })),
};
