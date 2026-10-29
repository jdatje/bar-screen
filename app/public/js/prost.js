// Prost moments for the Oktoberfest looks: now and then the screen counts
// "OANS! ZWOA! DREI! G'SUFFA!" with brass hits (made with Web Audio, no sound
// files) and everyone drinks. Switch off in the settings ("Prost-momenten").
import { PARTY_OF_THEME } from './tiles.js';
import { $ } from './ui.js';

let ctx;
let audio = null;
let timer = null;
let busy = () => false;

const MIN_GAP = 30 * 60 * 1000; // 30–50 minutes between two prost moments
const MAX_GAP = 50 * 60 * 1000;
const WORDS = ['OANS!', 'ZWOA!', 'DREI!', "G'SUFFA!"];

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

const enabled = () => PARTY_OF_THEME[ctx?.state.settings.theme] === 'oktoberfest' && ctx.state.settings.prostMoments !== false;

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (!enabled()) return;
  timer = setTimeout(() => {
    timer = null;
    if (enabled() && !busy()) prost();
    schedule();
  }, MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP));
}

function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

// a short brass chord with a bass drum, like an oompah band hit
function brass(t, root, big = false) {
  const a = ac();
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(big ? 0.32 : 0.24, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 1.4 : 0.55));
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = big ? 2600 : 1800;
  lp.connect(g).connect(a.destination);
  for (const ratio of [1, 1.26, 1.5, 2]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = root * ratio;
    o.connect(lp);
    o.start(t);
    o.stop(t + (big ? 1.5 : 0.6));
  }
  // bass drum
  const k = a.createOscillator(), kg = a.createGain();
  k.frequency.setValueAtTime(120, t);
  k.frequency.exponentialRampToValueAtTime(45, t + 0.2);
  kg.gain.setValueAtTime(0.9, t);
  kg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  k.connect(kg).connect(a.destination);
  k.start(t);
  k.stop(t + 0.32);
}

// glasses clinking and a happy crowd
function clink(t) {
  const a = ac();
  for (let i = 0; i < 6; i++) {
    const at = t + i * 0.07 + Math.random() * 0.05;
    for (const f of [2600, 3900, 5200]) {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f * (0.95 + Math.random() * 0.1);
      g.gain.setValueAtTime(0.06, at);
      g.gain.exponentialRampToValueAtTime(0.0005, at + 0.5);
      o.connect(g).connect(a.destination);
      o.start(at);
      o.stop(at + 0.55);
    }
  }
  const len = 2.2;
  const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = a.createBufferSource();
  n.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100;
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(bp).connect(g).connect(a.destination);
  n.start(t);
}

let running = false;
export function prost() {
  if (running) return;
  running = true;
  const el = $('prost');
  el.hidden = false;
  el.classList.add('on');
  const word = $('prost-word');
  const start = ac().currentTime + 0.15;
  WORDS.forEach((w, i) => {
    const last = i === WORDS.length - 1;
    try {
      brass(start + i, last ? 233 : 175 + i * 22, last);
      if (last) clink(start + i + 0.1);
    } catch (err) {
      console.warn('Prost sound failed:', err.message);
    }
    setTimeout(() => {
      word.textContent = w;
      word.classList.toggle('last', last);
      word.classList.remove('pop');
      void word.offsetWidth; // restart the pop animation
      word.classList.add('pop');
    }, 150 + i * 1000);
  });
  setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => {
      el.hidden = true;
      word.textContent = '';
      running = false;
    }, 600);
  }, 150 + WORDS.length * 1000 + 2200);
}
