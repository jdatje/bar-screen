// Touchscreen app: routing between views, clock, now playing, settings.
import { $, THEMES, applyTheme, call, fmtTime, toast, askPin, esc, themeGroupsHtml, confirmBox } from './ui.js';
import * as quiz from './quiz.js';
import * as bar from './cocktails.js';
import { TILE_KEYS, TILE_LABELS, TILE_STYLES, resolveTile, tileMarkup } from './tiles.js';
import * as eggs from './eggs.js';
import { setLang, getLang } from './i18n.js';
import * as games from './games.js';
import * as saver from './saver.js';
import * as karaoke from './karaoke.js';
import * as wall from './photowall.js';
import * as music from './music.js';
import * as spooky from './spooky.js';
import * as prost from './prost.js';
import * as masskrug from './masskrug.js';
import * as newyear from './newyear.js';
import * as volcano from './volcano.js';
import * as limbo from './limbo.js';
import { PARTY_OF_THEME } from './tiles.js';

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
  if (next === 'wheel' || next === 'bottlewheel') {
    bar.setWheelMode(next === 'bottlewheel' ? 'bottle' : 'cocktail');
    go('cocktails');
    bar.spinSoon();
    return;
  }
  view = next;
  document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== next));
  $('back').hidden = next === 'home' || next === 'game';
  if (next === 'karaoke') karaoke.show();
  else karaoke.hide();
  if (next === 'photos') wall.render();
  if (next === 'quiz') quiz.openSetup();
  if (next === 'cocktails') bar.openMenu();
  if (next === 'stock') bar.openStock();
  if (next === 'games') games.open();
}
ctx.view = () => view;

const PARENT = { stock: 'cocktails', quiz: 'hub', games: 'hub' };
$('back').addEventListener('click', () => go(PARENT[view] || 'home'));

// ---------- Spelletjes hub ----------
document.querySelectorAll('[data-hub]').forEach((b) =>
  b.addEventListener('click', () => {
    const h = b.dataset.hub;
    if (h === 'games' || h === 'wheel' || h === 'bottlewheel') return go(h);
    if (h === 'masskrug') return masskrug.open();
    if (h === 'vuurwerk') return newyear.fireworks();
    if (h === 'oliebollen') return newyear.openOlie();
    if (h === 'limbo') return limbo.open();
    if (h === 'hula') return masskrug.open('hula');
    if (h === 'qwixx') return $('qwixx').classList.add('open');
    if (h === 'botc') return openBotc();
    quiz.setType(h);
    go('quiz');
  })
);
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

// ---------- Qwixx: just a QR code to the game site ----------
$('qwixx-close').addEventListener('click', () => $('qwixx').classList.remove('open'));
$('qwixx').addEventListener('click', (e) => e.target.id === 'qwixx' && $('qwixx').classList.remove('open'));

// ---------- Blood on the Clocktower: the botc container (jdatje/botc) in a frame over the screen ----------
// Opened on the bar's LAN address, so the join QR in the table view works for phones.
const botcOrigin = () => state.botc?.url || `${location.protocol}//${location.hostname}:8090`;
function openBotc() {
  const box = $('botc');
  const src = `${botcOrigin()}/?code=${encodeURIComponent(state.botc?.code || 'WEXER')}&watch=1&embed=1`;
  if (!box.firstChild || box.dataset.src !== src) {
    box.dataset.src = src;
    box.innerHTML = `<iframe src="${src}" title="Blood on the Clocktower" allow="autoplay"></iframe>`;
  }
  box.hidden = false;
}
const botcOpen = () => !$('botc').hidden;
window.addEventListener('message', (e) => {
  if (e.data?.botc === 'close' && (e.origin === botcOrigin() || e.origin.endsWith(':8090'))) {
    $('botc').hidden = true;
    window.dispatchEvent(new Event('wexer:activity'));
  }
});
// the storyteller starts a game: show the table view (day timer) right away
socket.on('botc:started', openBotc);
socket.on('botc:status', (b) => (state.botc = b));

// ---------- Clock ----------
// The bar PC runs on UTC; always show Amsterdam time (incl. summer/winter time)
const TIME_ZONE = 'Europe/Amsterdam';
const fmtDates = {
  nl: new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TIME_ZONE }),
};
function tickClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
  $('date').textContent = document.documentElement.hasAttribute('data-witching') ? (getLang() === 'en' ? '☾ witching hour' : '☾ spookuur') : fmtDates[getLang()].format(now).replace(',', '').replace('-', '.').replace('/', '.');
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
  $('themes').innerHTML = themeGroupsHtml(state.themes, state.settings.theme, (id) => {
    const t = THEMES[id] || { label: id, bg: '#222', fg: '#fff', ac: '#fff' };
    return `<button class="theme-card" data-theme="${id}" style="background:${t.bg};color:${t.fg};border-bottom:10px solid ${t.ac}"><span>${esc(t.label)}</span></button>`;
  });
  markTheme();
}
$('themes').addEventListener('click', (e) => {
  const b = e.target.closest('.theme-card');
  if (b) setSetting({ theme: b.dataset.theme });
});
function markTheme() {
  applyTheme(state.settings.theme);
  setLang(state.settings.language);
  renderSaverChoices();
  document.querySelectorAll('#req-choices .chip').forEach((c) => c.classList.toggle('on', c.dataset.req === (state.settings.requests || 'approve')));
  document.querySelectorAll('#saverphoto-choices .chip').forEach((c) => c.classList.toggle('on', (c.dataset.sp === '1') === (state.settings.saverPhotos !== false)));
  document.querySelectorAll('#spooky-choices [data-ss="1"], #spooky-choices [data-ss="0"]').forEach((c) => c.classList.toggle('on', (c.dataset.ss === '1') === (state.settings.spookySounds !== false)));
  document.querySelectorAll('#prost-choices [data-pm="1"], #prost-choices [data-pm="0"]').forEach((c) => c.classList.toggle('on', (c.dataset.pm === '1') === (state.settings.prostMoments !== false)));
  spooky.update();
  prost.update();
  newyear.update();
  volcano.update();
  document.querySelectorAll('#volcano-choices [data-vm="1"], #volcano-choices [data-vm="0"]').forEach((c) => c.classList.toggle('on', (c.dataset.vm === '1') === (state.settings.volcanoMoments !== false)));
  // buttons that only exist in a party look (e.g. the Bierrad in Oktoberfest)
  document.documentElement.dataset.party = PARTY_OF_THEME[state.settings.theme] || '';
  document.querySelectorAll('#lang-choices .chip').forEach((c) => c.classList.toggle('on', c.dataset.lang === getLang()));
  tickClock();
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
// ---------- Song requests ----------
function renderRequests(list = []) {
  state.requests = list;
  const n = list.length;
  $('req-pill').hidden = !n;
  $('req-pill').textContent = `🎵 ${n} ${n === 1 ? 'verzoekje' : 'verzoekjes'}`;
  $('req-list').innerHTML = n
    ? list
        .map(
          (r) => `<div class="req-row">
            <div class="req-art" style="background-image:url('${esc(r.track.art || '')}')"></div>
            <div class="req-text"><strong>${esc(r.track.title)}</strong><span class="muted">${esc(r.track.artist)}</span><span class="mono accent">${esc(r.by)}</span></div>
            <button class="btn" data-req-id="${esc(r.id)}" data-ok="0" aria-label="Afwijzen">✕</button>
            <button class="btn primary" data-req-id="${esc(r.id)}" data-ok="1">In de wachtrij</button>
          </div>`
        )
        .join('')
    : '<p class="muted">Geen verzoekjes meer</p>';
}
$('req-pill').addEventListener('click', () => $('req-box').classList.add('open'));
$('req-close').addEventListener('click', () => $('req-box').classList.remove('open'));
$('req-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-req-id]');
  if (!b) return;
  b.disabled = true;
  const res = await call(socket, 'request:decide', { id: b.dataset.reqId, ok: b.dataset.ok === '1' });
  if (!res?.ok) toast('Spotify reageert niet');
  if (!state.requests.length) $('req-box').classList.remove('open');
});
$('req-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-req]');
  if (b) setSetting({ requests: b.dataset.req });
});
$('volcano-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vm]');
  if (!b) return;
  if (b.dataset.vm === 'now') {
    closeSettings();
    return volcano.erupt();
  }
  setSetting({ volcanoMoments: b.dataset.vm === '1' });
});
$('ny-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ny]');
  if (!b) return;
  closeSettings();
  if (b.dataset.ny === 'count') newyear.testCountdown();
  else newyear.fireworks();
});
$('prost-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pm]');
  if (!b) return;
  if (b.dataset.pm === 'now') {
    closeSettings();
    return prost.prost();
  }
  setSetting({ prostMoments: b.dataset.pm === '1' });
});
$('spooky-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ss]');
  if (!b) return;
  if (b.dataset.ss === 'test') return spooky.playRandom();
  setSetting({ spookySounds: b.dataset.ss === '1' });
});
$('saverphoto-choices').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sp]');
  if (b) setSetting({ saverPhotos: b.dataset.sp === '1' });
});

// ---------- Screensaver delay ----------
const SAVER_MINUTES = [0, 1, 2, 5, 10, 15, 30, 60];
function renderSaverChoices() {
  const cur = Number(state.settings.screensaver ?? 5);
  $('saver-choices').innerHTML = SAVER_MINUTES.map(
    (m) => `<button class="chip${m === cur ? ' on' : ''}" data-saver="${m}">${m ? `${m} min` : 'Uit'}</button>`
  ).join('');
}
$('saver-choices').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-saver]');
  if (b) setSetting({ screensaver: Number(b.dataset.saver) });
});

// ---------- Restart / shut down the bar PC ----------
async function powerAction(action) {
  const shutdown = action === 'shutdown';
  const ok = await confirmBox(shutdown ? 'De bar-pc uitzetten?' : 'Alles herstarten? De pc blijft aan.', shutdown ? 'Uitzetten' : 'Herstarten');
  if (!ok) return;
  const res = await call(socket, 'device:power', { pin: pinCache.pin, action });
  if (!res?.ok) return toast(res?.error === 'pin' ? 'Code verlopen — open de instellingen opnieuw' : 'Lukt niet');
  closeSettings();
  toast(shutdown ? 'De pc gaat uit…' : 'Alles herstart… het scherm is zo terug');
}
$('pc-restart').addEventListener('click', () => powerAction('reboot'));
$('pc-shutdown').addEventListener('click', () => powerAction('shutdown'));

$('lang-choices').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-lang]');
  if (b) setSetting({ language: b.dataset.lang });
});
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
// a tap next to the settings panel closes (and locks) them too
$('settings').addEventListener('click', (e) => e.target.id === 'settings' && closeSettings());
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
  // Wi-Fi first (when set in the admin), then the join code
  $('wifi-qr').hidden = !room.wifiQr;
  document.querySelectorAll('.join .step2').forEach((el) => (el.hidden = !room.wifiQr));
  if (room.wifiQr) {
    $('wifi-qr-img').src = room.wifiQr;
    $('wifi-ssid').textContent = room.wifiSsid ? ` · ${room.wifiSsid}` : '';
  }
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
  if (g.active) window.dispatchEvent(new Event('wexer:activity'));
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
  Object.assign(state, { settings: s.settings, themes: s.themes, botc: s.botc });
  renderThemes();
  renderRoom(s.room);
  renderPlayers(s.players);
  renderPlayer(s.player);
  eggs.onPlayer(s.player);
  renderMakeable(s.makeable);
  renderRequests(s.requests);
  wall.setList(s.photos);
  saver.setPhotos(s.photos);
  onGame(s.game);
});
socket.on('requests', renderRequests);
socket.on('request:new', (r) => toast(`🎵 ${r.by} vraagt: ${r.track.title}`));
socket.on('photos', (list) => {
  wall.setList(list);
  saver.setPhotos(list);
});
socket.on('photo:new', (p) => wall.announce(p));
socket.on('player', (p) => {
  renderPlayer(p);
  eggs.onPlayer(p);
  saver.update(p);
  karaoke.update(p);
});
socket.on('players', renderPlayers);
socket.on('makeable', renderMakeable);
socket.on('game', onGame);
socket.on('settings', (s) => {
  state.settings = s;
  markTheme();
});

quiz.init(ctx);
karaoke.init(ctx);
wall.init(ctx);
games.init(ctx);
saver.init(ctx, { allowed: () => !games.isPlaying() && view !== 'game' && !karaoke.isOpen() && !wall.slideshowOn() && !document.querySelector('.overlay.open') && !botcOpen() });
eggs.init(ctx);
bar.init(ctx);
music.init(ctx);
// not during a quiz question, a retro game or karaoke
const quietNow = () => botcOpen() || games.isPlaying() || karaoke.isOpen() || (state.game?.active && ['question', 'between'].includes(state.game.phase));
spooky.init(ctx, { quiet: quietNow });
prost.init(ctx, { quiet: quietNow });
masskrug.init(ctx);
newyear.init(ctx);
volcano.init(ctx, { quiet: quietNow });
limbo.init(ctx);

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
