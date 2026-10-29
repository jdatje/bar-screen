// Vulkaanmoment (Tiki looks): now and then a volcano on the screen rumbles and
// erupts — the cue for a round. Sounds made with Web Audio (no files).
// Switch off in the settings ("Vulkaanmomenten") or the admin page.
import { PARTY_OF_THEME } from './tiles.js';
import { $ } from './ui.js';

let ctx;
let audio = null;
let timer = null;
let busy = () => false;
let running = false;

const MIN_GAP = 30 * 60 * 1000; // 30–50 minutes between two eruptions
const MAX_GAP = 50 * 60 * 1000;

export function init(c, { quiet } = {}) {
  ctx = c;
  if (quiet) busy = quiet;
  schedule();
}

export function update() {
  if (!enabled()) {
    clearTimeout(timer);
    timer = null;
  } else if (!timer) schedule();
}

const enabled = () => PARTY_OF_THEME[ctx?.state.settings.theme] === 'tiki' && ctx.state.settings.volcanoMoments !== false;

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (!enabled()) return;
  timer = setTimeout(() => {
    timer = null;
    if (enabled() && !busy()) erupt();
    schedule();
  }, MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP));
}

function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

function rumble(t, len, vol) {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = a.createBufferSource();
  n.buffer = buf;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 160;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + len * 0.6);
  g.gain.linearRampToValueAtTime(0, t + len);
  n.connect(lp).connect(g).connect(a.destination);
  n.start(t);
  const o = a.createOscillator(), og = a.createGain();
  o.frequency.setValueAtTime(38, t);
  o.frequency.linearRampToValueAtTime(55, t + len);
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(vol * 0.8, t + len * 0.7);
  og.gain.linearRampToValueAtTime(0, t + len);
  o.connect(og).connect(a.destination);
  o.start(t);
  o.stop(t + len);
}

function boom(t) {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * 3, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = a.createBufferSource();
  n.buffer = buf;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(80, t + 2.5);
  const g = a.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3);
  n.connect(lp).connect(g).connect(a.destination);
  n.start(t);
}

export function erupt() {
  if (running) return;
  running = true;
  const el = $('volcano');
  el.hidden = false;
  window.dispatchEvent(new Event('wexer:activity'));
  requestAnimationFrame(() => el.classList.add('on', 'shake'));
  try {
    const t = ac().currentTime + 0.1;
    rumble(t, 2.8, 0.7);
    boom(t + 2.8);
  } catch (err) {
    console.warn('Volcano sound failed:', err.message);
  }
  setTimeout(() => el.classList.add('erupt'), 2800);
  setTimeout(() => el.classList.remove('shake'), 4200);
  setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => {
      el.classList.remove('erupt');
      el.hidden = true;
      running = false;
    }, 700);
  }, 9500);
}
