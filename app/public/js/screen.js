// Touchscreen app: routing between views, clock, now playing, settings.
import { $, THEMES, applyTheme, call, fmtTime, toast, askPin } from './ui.js';
import * as quiz from './quiz.js';
import * as bar from './cocktails.js';

const socket = io();
const state = { settings: { theme: 'industrial' }, themes: [], player: null, room: null, players: [], game: { active: false } };
let view = 'home';
let volumeDragging = false;

// ---------- PIN (only asked when one is set) ----------
let pinCache = { pin: '', until: 0 };
async function getPin() {
  if (!state.settings.hasPin) return '';
  if (Date.now() < pinCache.until) return pinCache.pin;
  const pin = await askPin('Pincode');
  if (pin == null) return null;
  const res = await call(socket, 'settings:unlock', { pin });
  if (!res?.ok) {
    toast('Pincode klopt niet');
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
const fmtDate = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit' });
function tickClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  $('date').textContent = fmtDate.format(now).replace(',', '').replace('-', '.');
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

  $('device').textContent = p.device ? `Spotify · ${p.device}` : 'Spotify';
  const t = p.track;
  $('title').textContent = p.hidden ? 'Quiz bezig' : t ? t.title : 'Niets aan het spelen';
  $('artist').textContent = p.hidden ? 'Geen spoilers' : t ? t.artist : 'Kies "Wexer 2.0" als speaker in Spotify';
  $('art').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('duration').textContent = fmtTime(t?.durationMs);
  $('upnext').textContent = p.upNext?.length ? `Straks — ${p.upNext[0].title} · ${p.upNext[0].artist}` : '';
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
    b.addEventListener('click', () => socket.emit('settings:set', { theme: id }));
    $('themes').append(b);
  }
  markTheme();
}
function markTheme() {
  applyTheme(state.settings.theme);
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('on', c.dataset.theme === state.settings.theme));
}

$('open-settings').addEventListener('click', () => $('settings').classList.add('open'));
$('close-settings').addEventListener('click', () => $('settings').classList.remove('open'));
$('new-room').addEventListener('click', async () => {
  await call(socket, 'room:new');
  toast('Nieuwe kamercode — iedereen moet opnieuw scannen');
});
$('settings-stock').addEventListener('click', () => {
  $('settings').classList.remove('open');
  go('stock');
});
$('set-pin').addEventListener('click', async () => {
  const pin = await getPin();
  if (pin == null) return;
  const next = await askPin('Nieuwe pincode (leeg = geen)');
  if (next == null) return;
  const res = await call(socket, 'settings:set', { pin, newPin: next });
  if (res?.ok) {
    pinCache = { pin: next, until: Date.now() + 10 * 60 * 1000 };
    toast(next ? 'Pincode ingesteld' : 'Pincode verwijderd');
  }
});

// ---------- Room & players ----------
function renderRoom(room) {
  state.room = room;
  document.querySelectorAll('.room-code').forEach((el) => (el.textContent = room.code));
  document.querySelectorAll('img.qr').forEach((el) => room.qr && (el.src = room.qr));
  const base = (room.joinUrl || '').replace(/\/play\?.*$/, '');
  $('admin-url').textContent = `${base}/admin`;
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
socket.on('state', (s) => {
  Object.assign(state, { settings: s.settings, themes: s.themes });
  renderThemes();
  renderRoom(s.room);
  renderPlayers(s.players);
  renderPlayer(s.player);
  renderMakeable(s.makeable);
  onGame(s.game);
});
socket.on('player', renderPlayer);
socket.on('players', renderPlayers);
socket.on('makeable', renderMakeable);
socket.on('game', onGame);
socket.on('settings', (s) => {
  state.settings = s;
  markTheme();
});

quiz.init(ctx);
bar.init(ctx);
