// Screensaver: after a few minutes without a tap, the song that's playing
// fills the screen (album art in the middle, darkened art behind it).
// A tap wakes the screen; that tap does nothing else.
import { $, esc } from './ui.js';
import { getLang } from './i18n.js';

let ctx;
let lastTouch = Date.now();
let on = false;
let canSleep = () => true;

export function init(c, { allowed } = {}) {
  ctx = c;
  if (allowed) canSleep = allowed;
  const wake = (e) => {
    lastTouch = Date.now();
    if (!on) return;
    e.preventDefault();
    e.stopPropagation();
    hide();
  };
  // capture phase: the waking tap never reaches a button
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, wake, true);
  window.addEventListener('click', (e) => {
    if (Date.now() - wokeAt < 600) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  window.addEventListener('wexer:activity', poke);
  setInterval(check, 5000);
  setInterval(tick, 1000);
}

let wokeAt = 0;
function check() {
  const minutes = Number(ctx.state.settings.screensaver || 0);
  if (on || !minutes) return;
  if (Date.now() - lastTouch >= minutes * 60000 && canSleep()) show();
}

function show() {
  on = true;
  update(ctx.state.player);
  $('saver').hidden = false;
  requestAnimationFrame(() => $('saver').classList.add('on'));
}

function hide() {
  on = false;
  wokeAt = Date.now();
  $('saver').classList.remove('on');
  $('saver').hidden = true;
}

// keep the screensaver away (e.g. a game is running)
export function poke() {
  lastTouch = Date.now();
  if (on) hide();
}

export function update(p) {
  if (!on) return;
  const t = p && !p.hidden ? p.track : null;
  $('saver').classList.toggle('idle', !t);
  $('saver-bg').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('saver-art').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('saver-title').textContent = t ? t.title : '';
  $('saver-artist').textContent = t ? t.artist : '';
  const next = (p?.upNext || []).slice(0, 3);
  $('saver-next').innerHTML = t && next.length
    ? `<span class="mono">Straks</span>${next.map((n) => `<span>${esc(n.title)} <em>— ${esc(n.artist)}</em></span>`).join('<i>·</i>')}`
    : '';
}

function tick() {
  if (!on) return;
  $('saver-clock').textContent = new Date().toLocaleTimeString(getLang() === 'en' ? 'en-GB' : 'nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}
