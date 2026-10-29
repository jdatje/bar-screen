// Spooky sounds for the Halloween looks: now and then, at a random moment,
// a creaking door, a howl, wind, thunder or a ghostly "woooo" plays through the
// bar speakers. All made with Web Audio (no sound files). Switch them off in the
// settings ("Griezelgeluiden") or the admin page.
import { SPOOKY_THEMES } from './tiles.js';

let ctx;
let audio = null;
let timer = null;
let busy = () => false;

const MIN_GAP = 6 * 60 * 1000; // between two sounds: 6–15 minutes
const MAX_GAP = 15 * 60 * 1000;

export function init(c, { quiet } = {}) {
  ctx = c;
  if (quiet) busy = quiet;
  schedule();
}

// call when the settings or the look change
export function update() {
  if (!enabled()) {
    clearTimeout(timer);
    timer = null;
  } else if (!timer) schedule();
}

const enabled = () => SPOOKY_THEMES.includes(ctx?.state.settings.theme) && ctx.state.settings.spookySounds !== false;

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (!enabled()) return;
  timer = setTimeout(() => {
    timer = null;
    if (enabled() && !busy()) playRandom();
    schedule();
  }, MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP));
}

function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

function out(volume = 0.5) {
  const a = ac();
  const g = a.createGain();
  g.gain.value = volume;
  g.connect(a.destination);
  return g;
}

function noise(seconds) {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

// ---------- the sounds ----------
function creak() {
  const a = ac(), t = a.currentTime, dest = out(0.35);
  const o = a.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(140, t + 0.7);
  o.frequency.linearRampToValueAtTime(90, t + 1.6);
  o.frequency.linearRampToValueAtTime(160, t + 2.3);
  // a fast wobble makes it "stick" like an old hinge
  const lfo = a.createOscillator(), lg = a.createGain();
  lfo.frequency.value = 23;
  lg.gain.value = 30;
  lfo.connect(lg).connect(o.frequency);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 6;
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.15);
  env.gain.setValueAtTime(1, t + 2.2);
  env.gain.linearRampToValueAtTime(0, t + 2.6);
  o.connect(bp).connect(env).connect(dest);
  o.start(t); lfo.start(t);
  o.stop(t + 2.7); lfo.stop(t + 2.7);
}

function wind() {
  const a = ac(), t = a.currentTime, dest = out(0.45);
  const n = noise(7);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 8;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.linearRampToValueAtTime(900, t + 2.5);
  bp.frequency.linearRampToValueAtTime(400, t + 4.5);
  bp.frequency.linearRampToValueAtTime(1100, t + 6.5);
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 1.5);
  env.gain.linearRampToValueAtTime(0.6, t + 4);
  env.gain.linearRampToValueAtTime(0, t + 7);
  n.connect(bp).connect(env).connect(dest);
  n.start(t);
}

function ghost() {
  const a = ac(), t = a.currentTime, dest = out(0.3);
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 1.2);
  o.frequency.exponentialRampToValueAtTime(260, t + 3.2);
  const vib = a.createOscillator(), vg = a.createGain();
  vib.frequency.value = 5.5;
  vg.gain.value = 14;
  vib.connect(vg).connect(o.frequency);
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.6);
  env.gain.setValueAtTime(1, t + 2.4);
  env.gain.linearRampToValueAtTime(0, t + 3.4);
  // a little echo
  const delay = a.createDelay(), fb = a.createGain();
  delay.delayTime.value = 0.32;
  fb.gain.value = 0.35;
  o.connect(env);
  env.connect(dest);
  env.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(dest);
  o.start(t); vib.start(t);
  o.stop(t + 3.5); vib.stop(t + 3.5);
}

function howl() {
  const a = ac(), t = a.currentTime, dest = out(0.3);
  const o = a.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(380, t);
  o.frequency.linearRampToValueAtTime(760, t + 0.9);
  o.frequency.setValueAtTime(760, t + 2.2);
  o.frequency.linearRampToValueAtTime(420, t + 3.6);
  const vib = a.createOscillator(), vg = a.createGain();
  vib.frequency.value = 6;
  vg.gain.value = 8;
  vib.connect(vg).connect(o.frequency);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.5);
  env.gain.setValueAtTime(1, t + 3);
  env.gain.linearRampToValueAtTime(0, t + 3.8);
  o.connect(lp).connect(env).connect(dest);
  o.start(t); vib.start(t);
  o.stop(t + 3.9); vib.stop(t + 3.9);
}

function thunder() {
  const a = ac(), t = a.currentTime, dest = out(0.8);
  const n = noise(5);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 4);
  const env = a.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.05);
  env.gain.exponentialRampToValueAtTime(0.3, t + 0.8);
  env.gain.linearRampToValueAtTime(0.6, t + 1.2);
  env.gain.exponentialRampToValueAtTime(0.001, t + 4.8);
  n.connect(lp).connect(env).connect(dest);
  n.start(t);
}

function heartbeat() {
  const a = ac(), dest = out(0.9);
  for (let i = 0; i < 5; i++) {
    for (const [off, f] of [[0, 1], [0.22, 0.75]]) {
      const t = a.currentTime + i * 0.9 + off;
      const o = a.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const env = a.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(f, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(env).connect(dest);
      o.start(t);
      o.stop(t + 0.3);
    }
  }
}

const SOUNDS = [creak, wind, ghost, howl, thunder, heartbeat];
let last = -1;
export function playRandom() {
  let i;
  do i = Math.floor(Math.random() * SOUNDS.length);
  while (i === last && SOUNDS.length > 1);
  last = i;
  try {
    SOUNDS[i]();
  } catch (err) {
    console.warn('Spooky sound failed:', err.message);
  }
}
