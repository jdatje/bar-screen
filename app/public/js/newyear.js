// Oud & Nieuw looks (party "newyear"):
//  - countdown to midnight from 23:50 (Amsterdam time), the last 10 s full screen,
//    then "GELUKKIG NIEUWJAAR <year>", fireworks and everybody's good resolutions
//  - good resolutions from phones scroll along the bottom of the home screen
//  - a fireworks show button and the oliebollen counter (hub cards)
// Sounds are made with Web Audio; no sound files.
import { PARTY_OF_THEME } from './tiles.js';
import { $, esc, call, toast, confirmBox } from './ui.js';

let ctx;
let audio = null;
let resolutions = [];
let oliebollen = [];
let tickTimer = null;
let celebratedFor = null; // the date we already celebrated (once per midnight)
let testUntil = 0; // a test countdown ends at this time (ms)

const TZ = 'Europe/Amsterdam';
const on = () => PARTY_OF_THEME[ctx?.state.settings.theme] === 'newyear';

export function init(c) {
  ctx = c;
  $('olie-close').addEventListener('click', () => $('oliebollen').classList.remove('open'));
  $('oliebollen').addEventListener('click', (e) => e.target.id === 'oliebollen' && $('oliebollen').classList.remove('open'));
  $('olie-list').addEventListener('click', onOlie);
  $('olie-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('olie-name').value.trim();
    if (!name) return;
    $('olie-name').value = '';
    count(name, 1);
  });
  $('olie-reset').addEventListener('click', resetOlie);
  ctx.socket.on('ny:resolution', (r) => {
    resolutions.push(r);
    renderTicker();
  });
  ctx.socket.on('ny:removed', (id) => {
    resolutions = resolutions.filter((r) => r.id !== id);
    renderTicker();
  });
  ctx.socket.on('ny:olie', (list) => {
    oliebollen = list || [];
    renderOlie();
  });
  ctx.socket.on('connect', load);
  load();
  tickTimer = setInterval(tick, 250);
}

async function load() {
  const res = await call(ctx.socket, 'ny:get');
  if (!res) return;
  resolutions = res.resolutions || [];
  oliebollen = res.oliebollen || [];
  renderTicker();
  renderOlie();
}

// call when the look changes
export function update() {
  renderTicker();
  if (!on()) hideCountdown();
}

// ---------- Time ----------
function amsterdamNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { y: Number(parts.year), mo: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), m: Number(parts.minute), s: Number(parts.second) };
}

function secondsToMidnight() {
  if (testUntil) return Math.max(0, Math.ceil((testUntil - Date.now()) / 1000));
  const t = amsterdamNow();
  return 24 * 3600 - (t.h * 3600 + t.m * 60 + t.s);
}

function tick() {
  if (!on() && !testUntil) return;
  const left = secondsToMidnight();
  const t = amsterdamNow();
  const stamp = `${t.y}-${t.mo}-${t.d}`;
  if (testUntil && left <= 0) {
    testUntil = 0;
    hideCountdown();
    return celebrate(true);
  }
  // just past midnight: celebrate once for this new date
  if (!testUntil && t.h === 0 && t.m === 0 && t.s < 5 && celebratedFor !== stamp) {
    celebratedFor = stamp;
    hideCountdown();
    return celebrate(false);
  }
  if (left <= 600) showCountdown(left);
  else hideCountdown();
}

// ---------- Countdown ----------
let lastBeep = -1;
function showCountdown(left) {
  const el = $('ny-count');
  el.hidden = false;
  window.dispatchEvent(new Event('wexer:activity')); // keep the screensaver away
  const big = left <= 10;
  el.classList.toggle('final', big);
  el.classList.toggle('minute', left <= 60 && !big);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  $('ny-count-num').textContent = big ? String(left) : `${mm}:${ss}`;
  $('ny-count-label').textContent = big ? '' : 'tot middernacht';
  if (big && left !== lastBeep && left > 0) {
    lastBeep = left;
    beep(left <= 3 ? 1320 : 880);
  }
}
function hideCountdown() {
  const el = $('ny-count');
  if (!el.hidden) {
    el.hidden = true;
    el.classList.remove('final', 'minute');
  }
  lastBeep = -1;
}

// a 15-second test from the settings
export function testCountdown() {
  testUntil = Date.now() + 15000;
}

// ---------- Midnight ----------
function celebrate(test) {
  const year = test ? new Date().getFullYear() + 1 : amsterdamNow().y;
  const el = $('ny-show');
  $('ny-show-year').textContent = String(year);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('on'));
  fireworks(18000, true);
  cheer();
  // then everybody's good resolutions, "for the record"
  setTimeout(() => {
    if (resolutions.length) {
      $('ny-show-res').innerHTML = `<span class="mono">Voor de goede orde — jullie voornemens:</span>${resolutions
        .slice(-30)
        .map((r) => `<p><b>${esc(r.name)}</b> ${esc(r.text)}</p>`)
        .join('')}`;
      el.classList.add('res');
    }
  }, 9000);
  setTimeout(() => {
    el.classList.remove('on', 'res');
    setTimeout(() => {
      el.hidden = true;
      $('ny-show-res').innerHTML = '';
    }, 800);
  }, resolutions.length ? 45000 : 20000);
}

// ---------- Good resolutions ticker (home screen) ----------
function renderTicker() {
  const el = $('ny-ticker');
  const show = on() && resolutions.length > 0;
  el.hidden = !show;
  document.body.classList.toggle('has-ticker', show);
  if (!show) return;
  const items = resolutions.slice(-20).map((r) => `<span><b>${esc(r.name)}:</b> ${esc(r.text)}</span>`).join('<i>✦</i>');
  // twice, so the loop is seamless
  $('ny-ticker-run').innerHTML = `${items}<i>✦</i>${items}<i>✦</i>`;
  $('ny-ticker-run').style.animationDuration = `${Math.max(25, resolutions.slice(-20).length * 9)}s`;
}

// ---------- Fireworks show ----------
let fwRunning = false;
export function fireworks(ms = 12000, quiet = false) {
  if (fwRunning) return;
  fwRunning = true;
  const canvas = $('ny-fw');
  canvas.hidden = false;
  const c2 = canvas.getContext('2d');
  const W = (canvas.width = window.innerWidth);
  const H = (canvas.height = window.innerHeight);
  const colors = ['#FFC93C', '#FF4FB0', '#40D2FF', '#7CFF78', '#FFFFFF', '#FF7A3C', '#B57CFF'];
  const parts = [];
  const rockets = [];
  const end = performance.now() + ms;
  let nextLaunch = 0;
  if (!quiet) window.dispatchEvent(new Event('wexer:activity'));
  function launch(now) {
    rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H, vy: -(H * 0.012 + Math.random() * H * 0.006), target: H * (0.15 + Math.random() * 0.35), color: colors[Math.floor(Math.random() * colors.length)] });
    nextLaunch = now + 250 + Math.random() * 650;
  }
  function explode(r) {
    const n = 70 + Math.floor(Math.random() * 50);
    const speed = 2 + Math.random() * 3.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = speed * (0.6 + Math.random() * 0.6);
      parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: Math.random() < 0.15 ? '#FFFFFF' : r.color });
    }
    bang();
  }
  function frame(now) {
    c2.globalCompositeOperation = 'destination-out';
    c2.fillStyle = 'rgba(0,0,0,0.18)';
    c2.fillRect(0, 0, W, H);
    c2.globalCompositeOperation = 'lighter';
    if (now < end && now > nextLaunch) launch(now);
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy;
      c2.fillStyle = r.color;
      c2.fillRect(r.x - 1.5, r.y, 3, 10);
      if (r.y <= r.target) {
        explode(r);
        rockets.splice(i, 1);
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= 0.012;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      c2.globalAlpha = p.life;
      c2.fillStyle = p.color;
      c2.beginPath();
      c2.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      c2.fill();
    }
    c2.globalAlpha = 1;
    if (now < end || parts.length || rockets.length) requestAnimationFrame(frame);
    else {
      c2.clearRect(0, 0, W, H);
      canvas.hidden = true;
      fwRunning = false;
    }
  }
  requestAnimationFrame((now) => {
    nextLaunch = now;
    frame(now);
  });
}

// ---------- Sounds ----------
function ac() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}
function noiseBuf(seconds) {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function beep(f) {
  try {
    const a = ac(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.3);
  } catch {}
}
function bang() {
  try {
    const a = ac(), t = a.currentTime;
    // the boom
    const n = a.createBufferSource();
    n.buffer = noiseBuf(1.5);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 1.2);
    const g = a.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    n.connect(lp).connect(g).connect(a.destination);
    n.start(t);
    // the crackle afterwards
    for (let i = 0; i < 14; i++) {
      const at = t + 0.25 + Math.random() * 1.2;
      const c = a.createBufferSource();
      c.buffer = noiseBuf(0.03);
      const hp = a.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const cg = a.createGain();
      cg.gain.value = 0.12 + Math.random() * 0.12;
      c.connect(hp).connect(cg).connect(a.destination);
      c.start(at);
    }
  } catch {}
}
function cheer() {
  try {
    const a = ac(), t = a.currentTime;
    const n = a.createBufferSource();
    n.buffer = noiseBuf(4);
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1000;
    bp.Q.value = 0.7;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 4);
    n.connect(bp).connect(g).connect(a.destination);
    n.start(t);
  } catch {}
}

// ---------- Oliebollenteller ----------
export function openOlie() {
  $('oliebollen').classList.add('open');
  const names = (ctx.state.players || []).filter((p) => p.online || p.manual).map((p) => p.name);
  const known = new Set(oliebollen.map((o) => o.name.toLowerCase()));
  $('olie-players').innerHTML = names
    .filter((n) => !known.has(n.toLowerCase()))
    .map((n) => `<button class="chip" data-olie-add="${esc(n)}">+ ${esc(n)}</button>`)
    .join('');
  renderOlie();
}
function renderOlie() {
  const total = oliebollen.reduce((s, o) => s + o.n, 0);
  if ($('olie-total')) $('olie-total').textContent = String(total);
  $('olie-list').innerHTML = oliebollen.length
    ? oliebollen.map((o, i) => `<div class="olie-row${i === 0 ? ' first' : ''}"><span class="olie-name">${i === 0 ? '👑 ' : ''}${esc(o.name)}</span>
        <button class="btn" data-olie="${esc(o.name)}" data-d="-1" aria-label="Eén minder voor ${esc(o.name)}">−</button>
        <b class="olie-n">${o.n}</b>
        <button class="btn primary" data-olie="${esc(o.name)}" data-d="1" aria-label="Eén erbij voor ${esc(o.name)}">+1 🍩</button></div>`).join('')
    : '<p class="muted">Nog geen oliebollen geteld. Tik op een naam of typ er een.</p>';
}
async function count(name, d) {
  const res = await call(ctx.socket, 'ny:olie', { name, delta: d });
  if (!res?.ok) toast('Lukt niet');
}
function onOlie(e) {
  const b = e.target.closest('[data-olie]');
  if (b) count(b.dataset.olie, Number(b.dataset.d));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-olie-add]');
  if (!b) return;
  b.remove();
  count(b.dataset.olieAdd, 1);
});
async function resetOlie() {
  if (!(await confirmBox('De oliebollenteller op nul zetten?', 'Op nul'))) return;
  const pin = await ctx.getPin();
  if (pin == null) return;
  await call(ctx.socket, 'ny:clear', { pin, what: 'oliebollen' });
}
