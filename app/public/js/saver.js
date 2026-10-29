// Screensaver: after a few minutes without a tap, the song that's playing
// fills the screen (album art in the middle, darkened art behind it).
// A tap wakes the screen; that tap does nothing else.
import { $, esc } from './ui.js';
import { getLang } from './i18n.js';
import { GHOST } from './fx.js';
import { SPOOKY_THEMES, PARTY_OF_THEME } from './tiles.js';

let ctx;
let lastTouch = Date.now();
let on = false;
let canSleep = () => true;
let photos = [];
let photoTimer = null;
let photoTurn = false;
// photos come in random order: every photo once, then a new shuffle
let bag = [];
let lastId = null;
function nextPhoto() {
  if (!bag.length) {
    bag = photos.map((p) => p.id);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // never the same photo twice in a row across shuffles
    if (bag.length > 1 && bag[bag.length - 1] === lastId) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  }
  const id = bag.pop();
  lastId = id;
  return photos.find((p) => p.id === id) || photos[0];
}

export function setPhotos(list) {
  photos = list || [];
  bag = bag.filter((id) => photos.some((p) => p.id === id));
}

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
  photoTurn = false;
  update(ctx.state.player);
  $('saver').hidden = false;
  ghosts(SPOOKY_THEMES.includes(ctx.state.settings.theme));
  pretzels(PARTY_OF_THEME[ctx.state.settings.theme] === 'oktoberfest');
  requestAnimationFrame(() => $('saver').classList.add('on'));
  // with photos on the wall: switch between the song and a photo every 12 s
  clearInterval(photoTimer);
  photoTimer = setInterval(cycle, 12000);
}

function cycle() {
  const usePhotos = ctx.state.settings.saverPhotos !== false && photos.length;
  const playing = Boolean(ctx.state.player?.track && !ctx.state.player.hidden);
  photoTurn = usePhotos ? (playing ? !photoTurn : true) : false;
  if (photoTurn) {
    const p = nextPhoto();
    $('saver-photo-img').src = `/photos/${p.id}.jpg`;
    $('saver-photo-bg').style.backgroundImage = `url("/photos/${p.id}.jpg")`;
    $('saver-photo-by').textContent = p.by ? `📸 ${p.by}` : '';
  }
  $('saver').classList.toggle('photo-mode', photoTurn);
}

// Halloween looks: friendly ghosts drift through the screensaver
function ghosts(show) {
  const el = $('saver-ghosts');
  if (!show) return (el.innerHTML = '');
  el.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const top = 6 + Math.random() * 70;
    const size = 70 + Math.random() * 120;
    const dur = 18 + Math.random() * 22;
    const delay = -Math.random() * dur;
    const back = i % 3 === 2 ? ' back' : '';
    const bob = (1.4 + Math.random() * 1.4).toFixed(1);
    return `<i class="${back.trim()}" style="top:${top.toFixed(0)}%;width:${size.toFixed(0)}px;animation-duration:${dur.toFixed(0)}s;animation-delay:${delay.toFixed(1)}s;opacity:${(0.35 + Math.random() * 0.45).toFixed(2)}"><b style="animation-duration:${bob}s">${GHOST}</b></i>`;
  }).join('');
}

// Oktoberfest looks: pretzels drifting by and beer foam rising
const PRETZEL = `<svg viewBox="0 0 100 90"><path d="M50 82C22 82 8 62 12 42 16 20 36 10 50 30 64 10 84 20 88 42 92 62 78 82 50 82Z M50 30C42 46 34 58 22 66 M50 30C58 46 66 58 78 66 M30 44C40 52 60 52 70 44" fill="none" stroke="#B5682A" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 82C22 82 8 62 12 42 16 20 36 10 50 30 64 10 84 20 88 42 92 62 78 82 50 82Z M50 30C42 46 34 58 22 66 M50 30C58 46 66 58 78 66 M30 44C40 52 60 52 70 44" fill="none" stroke="#D88A42" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/><g fill="#FFF8E6"><circle cx="20" cy="40" r="2"/><circle cx="36" cy="22" r="2"/><circle cx="64" cy="22" r="2"/><circle cx="82" cy="44" r="2"/><circle cx="50" cy="78" r="2"/><circle cx="68" cy="72" r="2"/><circle cx="30" cy="70" r="2"/></g></svg>`;
function pretzels(show) {
  const el = $('saver-ghosts');
  if (!show) return;
  const items = Array.from({ length: 6 }, (_, i) => {
    const top = 8 + Math.random() * 64;
    const size = 70 + Math.random() * 90;
    const dur = 20 + Math.random() * 22;
    const delay = -Math.random() * dur;
    return `<i class="pretzel${i % 2 ? ' back' : ''}" style="top:${top.toFixed(0)}%;width:${size.toFixed(0)}px;animation-duration:${dur.toFixed(0)}s;animation-delay:${delay.toFixed(1)}s;opacity:${(0.5 + Math.random() * 0.4).toFixed(2)}"><b style="animation-duration:${(1.6 + Math.random()).toFixed(1)}s">${PRETZEL}</b></i>`;
  });
  const foam = Array.from({ length: 26 }, () => {
    const left = Math.random() * 100;
    const size = 8 + Math.random() * 26;
    const dur = 9 + Math.random() * 10;
    return `<s class="foam" style="left:${left.toFixed(1)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:-${(Math.random() * dur).toFixed(1)}s"></s>`;
  });
  el.innerHTML = items.join('') + foam.join('');
}

function hide() {
  on = false;
  ghosts(false);
  clearInterval(photoTimer);
  $('saver').classList.remove('photo-mode');
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
