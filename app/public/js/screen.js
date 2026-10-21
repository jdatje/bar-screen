// Touchscreen app: routing between views, clock, now playing, settings.
import { $, THEMES, applyTheme, call, fmtTime, toast, askPin } from './ui.js';
import * as quiz from './quiz.js';
import * as bar from './cocktails.js';
import { TILE_KEYS, TILE_LABELS, TILE_STYLES, resolveTile, tileMarkup } from './tiles.js';
import * as eggs from './eggs.js';

const socket = io();
const state = { settings: { theme: 'industrial' }, themes: [], player: null, room: null, players: [], game: { active: false } };
let view = 'home';
let volumeDragging = false;

// ---------- Code (the settings and stock are locked) ----------
let pinCache = { pin: '', until: 0 };
async function getPin() {
  if (!state.settings.hasPin) return '';
  if (Date.now() < pinCache.until) return pinCache.pin;
  const pin = await askPin('Code');
  if (pin == null) return null;
  const res = await call(socket, 'settings:unlock', { pin });
  if (!res?.ok) {
    toast('Code klopt niet');
    return null;
  }
  pinCache = { pin, until: Date.now() + 10 * 60 * 1000 };
  return pin;
}

const ctx = { socket, state, go, getPin };

// ---------- Views ----------
function go(next) {
  if (next === 'wheel') {
    go('cocktails');
    bar.spinSoon();
    return;
  }
  view = next;
  document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== next));
  $('back').hidden = next === 'home' || next === 'game';
  if (next === 'quiz') quiz.openSetup();
  if (next === 'cocktails') bar.openMenu();
  if (next === 'stock') bar.openStock();
}
ctx.view = () => view;

$('back').addEventListener('click', () => go(view === 'stock' ? 'cocktails' : 'home'));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

// ---------- Clock ----------
// The bar PC runs on UTC; always show Amsterdam time (incl. summer/winter time)
const TIME_ZONE = 'Europe/Amsterdam';
const fmtDate = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TIME_ZONE });
function tickClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
  $('date').textContent = document.documentElement.hasAttribute('data-witching') ? '☾ spookuur' : fmtDate.format(now).replace(',', '').replace('-', '.');
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Now playing ----------
function renderPlayer(p) {
  state.player = p;
  const notice = $('spotify-notice');
  notice.innerHTML = '';
  // the speaker works without a linked account; the link is only for music quizzes
  if (p.error) notice.textContent = 'Speaker niet bereikbaar';

  $('device').textContent = p.context ? `${p.context}${p.shuffle ? ' · shuffle' : ''}` : p.device ? `Spotify · ${p.device}` : 'Spotify';
  const t = p.track;
  $('title').textContent = p.hidden ? 'Quiz bezig' : t ? t.title : 'Niets aan het spelen';
  $('artist').textContent = p.hidden ? 'Geen spoilers' : t ? t.artist : 'Kies "Wexer 2.0" als speaker in Spotify';
  $('art').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('duration').textContent = fmtTime(t?.durationMs);
  const queue = p.upNext || [];
  $('queue').hidden = !t || queue.length === 0;
  $('upnext').replaceChildren(
    ...queue.map((q) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      const title = document.createElement('span');
      const artist = document.createElement('span');
      title.textContent = q.title;
      artist.textContent = q.artist;
      artist.className = 'muted';
      btn.className = 'queue-item';
      btn.disabled = !q.uri;
      btn.setAttribute('aria-label', `Speel ${q.title} van ${q.artist}`);
      btn.addEventListener('click', () => {
        btn.classList.add('picked');
        cmd('jump', q.uri);
      });
      btn.append(title, artist);
      li.append(btn);
      return li;
    })
  );
  fitQueue();
  $('icon-pause').toggleAttribute('hidden', !p.playing);
  $('icon-play').toggleAttribute('hidden', Boolean(p.playing));
  if (!volumeDragging && p.volume != null) $('volume').value = p.volume;
  renderProgress();
}

function renderProgress() {
  const p = state.player;
  const t = p?.track;
  if (!t) {
    $('progress').style.width = '0%';
    $('elapsed').textContent = '0:00';
    return;
  }
  const elapsed = Math.min(t.durationMs, p.progressMs + (p.playing ? Date.now() - p.at : 0));
  $('progress').style.width = `${(elapsed / t.durationMs) * 100}%`;
  $('elapsed').textContent = fmtTime(elapsed);
}
setInterval(renderProgress, 500);

async function cmd(action, value) {
  const res = await call(socket, 'player:cmd', { action, value });
  if (!res?.ok) toast('Spotify reageert niet');
}
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => cmd(b.dataset.cmd)));
$('playpause').addEventListener('click', () => {
  const playing = state.player?.playing;
  cmd(playing ? 'pause' : 'play');
  if (state.player) {
    state.player.playing = !playing;
    renderPlayer(state.player);
  }
});
const vol = $('volume');
vol.addEventListener('pointerdown', () => (volumeDragging = true));
vol.addEventListener('change', () => {
  volumeDragging = false;
  cmd('volume', vol.value);
});

// ---------- Settings ----------
function renderThemes() {
  $('themes').innerHTML = '';
  for (const id of state.themes) {
    const t = THEMES[id] || { label: id, bg: '#222', fg: '#fff', ac: '#fff' };
    const b = document.createElement('button');
    b.className = 'theme-card';
    b.dataset.theme = id;
    b.style.background = t.bg;
    b.style.color = t.fg;
    b.style.borderBottom = `10px solid ${t.ac}`;
    b.innerHTML = `<span>${t.label}</span>`;
    b.addEventListener('click', () => setSetting({ theme: id }));
    $('themes').append(b);
  }
  markTheme();
}
function markTheme() {
  applyTheme(state.settings.theme);
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('on', c.dataset.theme === state.settings.theme));
  renderTiles();
  renderTileChoices();
}

// ---------- Button backgrounds ----------
function renderTiles() {
  const chosen = state.settings.tiles || {};
  document.querySelectorAll('.tile-bg[data-tile]').forEach((el) => {
    const style = chosen[el.dataset.tile] === 'off' ? '' : resolveTile(el.dataset.tile, chosen[el.dataset.tile], state.settings.theme);
    if (el.dataset.style === style) return;
    el.dataset.style = style;
    el.className = `tile-bg tbg-${style}`;
    el.innerHTML = tileMarkup(style);
  });
}
function renderTileChoices() {
  const chosen = state.settings.tiles || {};
  $('tile-choices').replaceChildren(
    ...TILE_KEYS.map((key) => {
      const row = document.createElement('div');
      row.className = 'tile-choice';
      const opts = [{ id: 'auto', label: 'Automatisch' }, ...TILE_STYLES[key], { id: 'off', label: 'Uit' }];
      row.innerHTML = `<span>${TILE_LABELS[key]}</span><div class="chips">${opts
        .map((o) => `<button class="chip${(chosen[key] || 'auto') === o.id ? ' on' : ''}" data-key="${key}" data-style="${o.id}">${o.label}</button>`)
        .join('')}</div>`;
      return row;
    })
  );
}
$('tile-choices').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-style]');
  if (b) setSetting({ tiles: { [b.dataset.key]: b.dataset.style } });
});

// The settings ask for the code every time they're opened
$('open-settings').addEventListener('click', async () => {
  pinCache.until = 0;
  const pin = await getPin();
  if (pin == null) return;
  renderTileChoices();
  $('settings').classList.add('open');
});
function closeSettings() {
  $('settings').classList.remove('open');
  pinCache = { pin: '', until: 0 }; // locked again
}
$('close-settings').addEventListener('click', closeSettings);
async function setSetting(patch) {
  const res = await call(socket, 'settings:set', { pin: pinCache.pin, ...patch });
  if (!res?.ok) toast(res?.error === 'pin' ? 'Code verlopen — open de instellingen opnieuw' : 'Lukt niet');
  return res;
}
$('new-room').addEventListener('click', async () => {
  const res = await call(socket, 'room:new', { pin: pinCache.pin });
  toast(res?.ok ? 'Nieuwe kamercode — iedereen moet opnieuw scannen' : 'Lukt niet');
});
$('settings-stock').addEventListener('click', () => {
  $('settings').classList.remove('open');
  go('stock');
});
$('set-pin').addEventListener('click', async () => {
  const pin = await getPin();
  if (pin == null) return;
  const next = await askPin('Nieuwe code (minstens 4 cijfers)');
  if (next == null) return;
  const res = await call(socket, 'settings:set', { pin, newPin: next });
  if (res?.ok) {
    pinCache = { pin: next, until: Date.now() + 10 * 60 * 1000 };
    toast('Nieuwe code ingesteld');
  } else toast(res?.error === 'pin_too_short' ? 'Minstens 4 cijfers' : 'Lukt niet');
});

// ---------- Room & players ----------
function renderRoom(room) {
  state.room = room;
  document.querySelectorAll('.room-code').forEach((el) => (el.textContent = room.code));
  document.querySelectorAll('img.qr').forEach((el) => room.qr && (el.src = room.qr));
  const base = (room.joinUrl || '').replace(/\/play\?.*$/, '');
  $('admin-url').textContent = room.adminUrl || `${base}/admin`;
  if (room.adminQr) $('admin-qr').src = room.adminQr;
}
function renderPlayers(list) {
  state.players = list;
  const n = list.filter((p) => p.online).length;
  $('guests').textContent = `${n} ${n === 1 ? 'gast' : 'gasten'} verbonden`;
  quiz.renderPlayers();
}
function renderMakeable(n) {
  $('makeable-line').textContent = n ? `${n} te maken met wat er staat` : 'Vink eerst aan wat er staat';
}

// ---------- Game routing ----------
function onGame(g) {
  state.game = { ...g, receivedAt: Date.now() };
  if (g.active && view !== 'game') go('game');
  if (!g.active && view === 'game') go('home');
  quiz.renderGame();
}

// ---------- Socket ----------
socket.on('connect', () => socket.emit('screen:hello'));
let loadedBuild = null;
socket.on('state', (s) => {
  // the app was updated or restarted: load the new screen code
  if (loadedBuild && s.build && s.build !== loadedBuild) return location.reload();
  loadedBuild = s.build;
  Object.assign(state, { settings: s.settings, themes: s.themes });
  renderThemes();
  renderRoom(s.room);
  renderPlayers(s.players);
  renderPlayer(s.player);
  eggs.onPlayer(s.player);
  renderMakeable(s.makeable);
  onGame(s.game);
});
socket.on('player', (p) => {
  renderPlayer(p);
  eggs.onPlayer(p);
});
socket.on('players', renderPlayers);
socket.on('makeable', renderMakeable);
socket.on('game', onGame);
socket.on('settings', (s) => {
  state.settings = s;
  markTheme();
});

quiz.init(ctx);
eggs.init(ctx);
bar.init(ctx);

// Show as many upcoming songs as fit in the panel, without a half row
function fitQueue() {
  const ol = $('upnext');
  if (!ol || $('queue').hidden) return;
  const items = [...ol.children];
  items.forEach((li) => (li.hidden = false));
  const bottom = ol.getBoundingClientRect().bottom;
  for (const li of items) if (li.getBoundingClientRect().bottom > bottom + 1) li.hidden = true;
}
window.addEventListener('resize', fitQueue);
