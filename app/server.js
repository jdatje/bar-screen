// Wexer 2.0 — server for the touchscreen (/), guests' phones (/play)
// and the admin page (/admin).
import express from 'express';
import compression from 'compression';
import http from 'node:http';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import * as spotify from './lib/spotify.js';
import * as bank from './lib/bank.js';
import * as bar from './lib/bar.js';
import * as cocktails from './lib/cocktails.js';
import { getSourceOptions, MUSIC_SETS } from './lib/musicpool.js';
import { Game } from './lib/game.js';
import { load, save } from './lib/store.js';
import * as diag from './lib/diag.js';
import * as requests from './lib/requests.js';
import * as photos from './lib/photos.js';
import * as guests from './lib/guests.js';
import * as credits from './lib/credits.js';
import { getLyrics } from './lib/hooks.js';
import { TILE_KEYS, DEFAULT_TILES, validTileChoice } from './public/js/tiles.js';

const PORT = Number(process.env.PORT || 80);
// Requests from the bar PC itself (the kiosk browser). With the public
// address switched on, everything else may come from the internet.
const isLocal = (addr) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(addr || ''));
export const THEMES = ['industrial', 'maison', 'neon', 'bruin', 'tiki', 'disco', 'bluenote', 'papier', 'riviera', 'chalet', 'spookhuis', 'pompoen', 'heks', 'oranje', 'delft', 'oranjeboven', 'rock', 'synthwave', 'strand', 'zonsondergang', 'wiesn', 'bierhal', 'modderpret'];
const CALLBACK_PATH = '/auth/spotify/callback';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// The settings are locked with a code; 252525 unless the admins changed it
const DEFAULT_PIN = '252525';
let settings = load('settings', { theme: 'industrial', language: 'nl', pin: DEFAULT_PIN, screensaver: 5 });
if (settings.screensaver == null) settings.screensaver = 5; // minutes, 0 = off
settings.requests ||= 'approve'; // song requests: 'off' | 'approve' | 'auto'
if (settings.saverPhotos == null) settings.saverPhotos = true; // photo wall in the screensaver
if (settings.spookySounds == null) settings.spookySounds = true; // random spooky sounds in Halloween looks
if (settings.prostMoments == null) settings.prostMoments = true; // prost moments in Oktoberfest looks
settings.gameVolume = { music: 75, game: 25, ...(settings.gameVolume || {}) };
if (!settings.pin) settings.pin = DEFAULT_PIN;
// the bar's Wi-Fi, for the Wi-Fi QR code on the screen (never sent to phones)
settings.wifi = { ssid: '', password: '', ...(settings.wifi || {}) };
settings.tiles = { ...DEFAULT_TILES, ...(settings.tiles || {}) };
let quizDefaults = load('quiz-settings', {
  intro: { genres: {}, decades: [], playlists: [], rounds: 2, perRound: 8, seconds: 20, clip: 10 },
  popquiz: { genres: {}, decades: [], playlists: [], types: ['year', 'artist', 'first'], rounds: 2, perRound: 8, seconds: 20, clip: 12 },
  pubquiz: { categories: [], difficulty: '', source: 'cafe', rounds: 3, perRound: 8, seconds: 25 },
});
// New: question sets. Music games default to well-known hits; the pubquiz to the café mix.
for (const t of ['intro', 'popquiz']) quizDefaults[t].set ||= 'hits';
if (!quizDefaults.pubquiz.setChosen) {
  quizDefaults.pubquiz.source = 'cafe';
  quizDefaults.pubquiz.setChosen = true;
}
// All bundled questions have a Dutch version, so Dutch is always the default
quizDefaults.pubquiz.lang = 'nl';

const publicSettings = () => ({
  theme: settings.theme, language: settings.language, tiles: settings.tiles, screensaver: settings.screensaver,
  requests: settings.requests, saverPhotos: settings.saverPhotos, spookySounds: settings.spookySounds, prostMoments: settings.prostMoments, gameVolume: settings.gameVolume, hasPin: Boolean(settings.pin),
});
const SAVER_MINUTES = [0, 1, 2, 5, 10, 15, 30, 60];

// Code check with a brake on guessing: 5 wrong codes = 30 s wait
const guesses = { wrong: 0, until: 0 };
function pinOk(pin) {
  if (!settings.pin) return true;
  if (Date.now() < guesses.until) return false;
  if (String(pin || '') === settings.pin) {
    guesses.wrong = 0;
    return true;
  }
  if (++guesses.wrong >= 5) {
    guesses.wrong = 0;
    guesses.until = Date.now() + 30000;
  }
  return false;
}

// One place that changes settings, for the screen and the phone admin page
function applySettings(patch = {}) {
  if (patch.theme && THEMES.includes(patch.theme)) settings.theme = patch.theme;
  if (patch.language && ['nl', 'en'].includes(patch.language)) settings.language = patch.language;
  if (SAVER_MINUTES.includes(Number(patch.screensaver))) settings.screensaver = Number(patch.screensaver);
  if (['off', 'approve', 'auto'].includes(patch.requests)) settings.requests = patch.requests;
  if (typeof patch.saverPhotos === 'boolean') settings.saverPhotos = patch.saverPhotos;
  if (typeof patch.spookySounds === 'boolean') settings.spookySounds = patch.spookySounds;
  if (typeof patch.prostMoments === 'boolean') settings.prostMoments = patch.prostMoments;
  if (patch.tiles && typeof patch.tiles === 'object') {
    for (const key of TILE_KEYS) if (validTileChoice(key, patch.tiles[key])) settings.tiles[key] = patch.tiles[key];
  }
  if (patch.wifi && typeof patch.wifi === 'object') {
    settings.wifi = {
      ssid: String(patch.wifi.ssid ?? settings.wifi.ssid).trim().slice(0, 32),
      password: String(patch.wifi.password ?? settings.wifi.password).slice(0, 63),
    };
    makeWifiQr().then(() => io.to('screen').emit('state', screenState()));
  }
  if ('newPin' in patch) {
    const pin = String(patch.newPin || '').replace(/\D/g, '').slice(0, 8);
    if (pin.length < 4) return { ok: false, error: 'pin_too_short' };
    settings.pin = pin;
  }
  save('settings', settings);
  io.emit('settings', publicSettings());
  return { ok: true, settings: publicSettings() };
}

// ---------- Room & players ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
// The room code and who joined survive a restart (update, PC reboot), so
// phones don't have to join again every time.
const savedRoom = load('room', { code: null, players: {} });
const room = { code: savedRoom.code || newCode(), joinUrl: null, qr: null, adminUrl: null, adminQr: null, wifiSsid: '', wifiQr: null };
const players = new Map( // playerId -> { name, sockets: Set, manual }
  Object.entries(savedRoom.players || {}).map(([id, p]) => [id, { name: p.name, manual: Boolean(p.manual), sockets: new Set() }])
);
function saveRoom() {
  save('room', {
    code: room.code,
    players: Object.fromEntries([...players].map(([id, p]) => [id, { name: p.name, manual: p.manual || false }])),
  });
}
saveRoom();
// one name = one player (case and spaces ignored), so a guest who joins again
// from another browser or after losing her phone's storage isn't counted twice
const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const findByName = (n) => [...players].find(([, p]) => nameKey(p.name) === nameKey(n))?.[0] || null;

const playerList = () =>
  [...players.entries()].map(([id, p]) => ({ id, name: p.name, online: p.sockets.size > 0, manual: Boolean(p.manual) }));

// Wi-Fi QR code: phones that scan it join the bar's network (password included)
async function makeWifiQr() {
  const { ssid, password } = settings.wifi;
  room.wifiSsid = ssid;
  if (!ssid) return (room.wifiQr = null);
  const esc = (v) => String(v).replace(/([\\;,:"])/g, '\\$1');
  const text = password ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;` : `WIFI:T:nopass;S:${esc(ssid)};;`;
  room.wifiQr = await QRCode.toDataURL(text, { margin: 1, width: 320, color: { dark: '#111111', light: '#FFFFFF' } });
}
makeWifiQr();

// Phones join over the bar's own Wi-Fi only: the QR code points at the
// PC's address on the local network (not the public internet address).
async function resolveJoinUrl() {
  let base = process.env.LAN_URL || null;
  // On balena: ask the supervisor for the device's LAN address
  if (!base && process.env.BALENA_SUPERVISOR_ADDRESS && process.env.BALENA_SUPERVISOR_API_KEY) {
    try {
      const res = await fetch(
        `${process.env.BALENA_SUPERVISOR_ADDRESS}/v1/device?apikey=${process.env.BALENA_SUPERVISOR_API_KEY}`
      );
      const dev = await res.json();
      const ip = String(dev.ip_address || '').split(' ').find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
      if (ip) base = `http://${ip}`;
    } catch (err) {
      console.warn('Could not read device IP from supervisor:', err.message);
    }
  }
  base = (base || `http://localhost:${PORT}`).replace(/\/$/, '');
  const url = `${base}/play?code=${room.code}`;
  if (url !== room.joinUrl) {
    room.joinUrl = url;
    room.qr = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#111111', light: '#FFFFFF' } });
  }
  if (`${base}/admin` !== room.adminUrl) {
    room.adminUrl = `${base}/admin`;
    room.adminQr = await QRCode.toDataURL(room.adminUrl, { margin: 1, width: 240, color: { dark: '#111111', light: '#FFFFFF' } });
  }
}

async function newRoom() {
  room.code = newCode();
  players.clear();
  saveRoom();
  await resolveJoinUrl();
  io.to('phones').emit('room:closed');
  io.to('screen').emit('state', screenState());
}

// ---------- Game ----------
const game = new Game({
  players: () => players,
  emit: (screenView, phoneView) => {
    io.to('screen').emit('game', screenView);
    for (const [id, p] of players) for (const sid of p.sockets) io.to(sid).emit('game', phoneView(id));
  },
});

// ---------- Spotify polling ----------
let player = { active: false, playing: false, track: null };
let upNext = [];
let spotifyError = null;
let holdSince = 0;

// Polls the bar speaker itself (works for any account playing on it).
// One poll at a time; a request during a poll runs right after it.
let polling = false;
let pollAgain = false;
let fastTimer = null;
async function pollSpotify() {
  if (polling) {
    pollAgain = true;
    return;
  }
  polling = true;
  try {
    await pollOnce();
  } finally {
    polling = false;
    if (pollAgain) {
      pollAgain = false;
      setTimeout(pollSpotify, 0);
    } else if (!fastTimer && spotify.upNextLoading()) {
      // playlist details still loading: check again soon
      fastTimer = setTimeout(() => {
        fastTimer = null;
        pollSpotify();
      }, 1000);
    }
  }
}

// Speaker events (song change, play, pause...) update the screen right away
let eventTimer = null;
function onSpeakerEvent() {
  clearTimeout(eventTimer);
  eventTimer = setTimeout(pollSpotify, 200);
}

async function pollOnce() {
  try {
    const next = await spotify.getPlayer();
    // During a track change the speaker briefly has no track (buffering):
    // keep showing the last one instead of flashing "nothing playing".
    if (!next.track && player.track && next.active && !next.stopped) {
      if (!holdSince) holdSince = Date.now();
      if (Date.now() - holdSince < 15000) {
        io.to('screen').emit('player', publicPlayer());
        return;
      }
    } else {
      holdSince = 0;
    }
    player = next;
    upNext = await spotify.getUpNext().catch(() => upNext);
    spotifyError = null;
  } catch (err) {
    if (err.message !== spotifyError) console.warn('Spotify:', err.message);
    spotifyError = err.message;
  }
  io.to('screen').emit('player', publicPlayer());
}

const publicPlayer = () => ({
  ...player,
  // during a music quiz the screen must not give the song away
  track: game.active && game.isMusic ? null : player.track,
  hidden: Boolean(game.active && game.isMusic),
  upNext: game.active && game.isMusic ? [] : upNext,
  configured: spotify.isConfigured(),
  loggedIn: spotify.isLoggedIn(),
  error: spotifyError,
  at: Date.now(),
});

// Changes on every start of the app (so on every update): the screen
// reloads itself when it sees a different build than it loaded with.
const BUILD = String(Date.now());

const screenState = () => ({
  build: BUILD,
  settings: publicSettings(),
  themes: THEMES,
  room: { code: room.code, joinUrl: room.joinUrl, qr: room.qr, adminUrl: room.adminUrl, adminQr: room.adminQr, wifiSsid: room.wifiSsid, wifiQr: room.wifiQr },
  players: playerList(),
  player: publicPlayer(),
  game: game.screenView(),
  makeable: cocktails.menu({ status: 'now' }).counts.now,
  requests: requests.pending(),
  photos: photos.list(),
});
const broadcastRequests = () => io.to('screen').emit('requests', requests.pending());
const broadcastPhotos = () => io.to('screen').emit('photos', photos.list());

const broadcastPlayers = () => {
  io.to('screen').emit('players', playerList());
  io.to('phones').emit('players', playerList().length);
};

// ---------- HTTP ----------
app.use(express.json({ limit: '2mb' }));
// gzip text responses: much faster for phones, certainly over the public address
app.use(compression());
// The big emoji font (kiosk only) never changes: let browsers keep it
app.use('/fonts', express.static('public/fonts', { maxAge: '30d', immutable: true }));
// Always check for newer files, so an update shows up without a stale cache
app.use(express.static('public', {
  extensions: ['html'],
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));


app.get('/health', (_req, res) => res.json({ ok: true }));
// look and language, for pages that aren't unlocked yet
app.get('/api/look', (_req, res) => res.json({ theme: settings.theme, language: settings.language }));

// Diagnostics (PIN-protected when a PIN is set): /diag?pin=1234&lines=300&grep=spotify
app.get('/diag', async (req, res) => {
  if (!pinOk(req.query.pin)) return res.status(401).send('PIN required: /diag?pin=...');
  const r = await diag.report({ lines: req.query.lines, grep: req.query.grep });
  if (req.query.format === 'json') return res.json(r);
  res.type('text/plain').send(
    `Wexer 2.0 diagnostics — ${r.time}\n\n== Speaker status ==\n${JSON.stringify(r.speaker, null, 2)}\n\n` +
      `== Speaker events (latest last) ==\n${r.events.map((e) => `${e.at} ${e.type} ${JSON.stringify(e.data ?? '')}`).join('\n')}\n\n` +
      `== Device logs ==\n${r.logs}\n`
  );
});

// Spotify login runs on the bar screen itself, on http://127.0.0.1:AUTH_PORT:
// Spotify only allows plain-http redirect URIs on a loopback IP, and its
// dashboard requires a port. Register exactly REDIRECT_URI in the Spotify app.
const AUTH_PORT = Number(process.env.AUTH_PORT || 8888);
const AUTH_ORIGIN = `http://127.0.0.1:${AUTH_PORT}`;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `${AUTH_ORIGIN}${CALLBACK_PATH}`;
const SCREEN_URL = process.env.SCREEN_URL || `http://localhost${PORT === 80 ? '' : `:${PORT}`}/`;

app.get('/auth/spotify/login', (req, res) => {
  if (!spotify.isConfigured()) return res.status(500).send('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  // start the login on the loopback origin, so the callback lands on the same origin
  if (req.get('host') !== new URL(AUTH_ORIGIN).host) return res.redirect(`${AUTH_ORIGIN}/auth/spotify/login`);
  res.redirect(spotify.authUrl(REDIRECT_URI, crypto.randomUUID()));
});

app.get(CALLBACK_PATH, async (req, res) => {
  try {
    await spotify.exchangeCode(req.query.code, REDIRECT_URI);
    await pollSpotify();
    res.redirect(SCREEN_URL);
  } catch (err) {
    res.status(500).send(`Spotify login failed: ${err.message}`);
  }
});

// ----- Qwixx (own site): a QR code on the screen -----
const QWIXX_URL = 'https://games.maisonbaron.nl';
const qwixxQr = QRCode.toBuffer(QWIXX_URL, { margin: 1, width: 600, color: { dark: '#111111', light: '#FFFFFF' } });
app.get('/qr/qwixx.png', async (_req, res) => {
  res.set({ 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' });
  res.send(await qwixxQr);
});

// ----- Photo wall -----
// guests (joined on their phone) send a resized JPEG as the raw body
app.post('/api/photos', async (req, res) => {
  const p = players.get(String(req.get('x-player-id') || ''));
  if (!p) return res.status(401).json({ error: 'join_first' });
  try {
    const out = await photos.addFromRequest(req, p.name);
    broadcastPhotos();
    io.to('screen').emit('photo:new', { id: out.id, by: p.name });
    res.json({ ok: true, ...out });
  } catch (err) {
    res.status(err.message === 'too_big' ? 413 : 400).json({ ok: false, error: err.message });
  }
});
// the photo list: the kiosk, and guests who joined on their phone
const mayListPhotos = (req) => isLocal(req.socket.remoteAddress) || players.has(String(req.get('x-player-id') || req.query.p || ''));
app.get('/api/photos', (req, res) => (mayListPhotos(req) ? res.json(photos.list()) : res.status(403).end()));
// selected photos as one zip file (for phones that can't share several files)
app.get('/api/photos.zip', (req, res) => {
  if (!mayListPhotos(req)) return res.status(403).end();
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 200);
  const buf = photos.zip(ids);
  if (!buf) return res.status(404).end();
  res.set({ 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="wexer-fotos.zip"' });
  res.send(buf);
});
app.get('/photos/:id.jpg', (req, res) => {
  const f = photos.file(req.params.id);
  if (!f) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(f, (err) => err && !res.headersSent && res.status(404).end());
});

// ----- Restart / shut down the bar PC (balena supervisor) -----
async function power(action) {
  const addr = process.env.BALENA_SUPERVISOR_ADDRESS;
  const key = process.env.BALENA_SUPERVISOR_API_KEY;
  if (!addr || !key) throw new Error('Not running on balena');
  // "Herstarten" restarts all containers (the PC itself stays on);
  // "Uitzetten" shuts the PC down
  const shutdown = action === 'shutdown';
  const res = await fetch(`${addr}/v1/${shutdown ? 'shutdown' : 'restart'}?apikey=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(shutdown ? { force: true } : { appId: Number(process.env.BALENA_APP_ID), force: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Supervisor ${res.status}`);
}

// ----- Games (the games container, on 127.0.0.1) -----
const GAMES_URL = process.env.GAMES_URL || 'http://127.0.0.1:8081';
function forwardToGames(req, res, upstreamPath) {
  const headers = {};
  for (const h of ['content-type', 'content-length', 'range']) if (req.headers[h]) headers[h] = req.headers[h];
  const up = http.request(new URL(upstreamPath, GAMES_URL), { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'games_offline' });
  });
  req.pipe(up);
}
// library, player page and game files: readable for the screen
// (the touchscreen only; the game list also for the admin page with the code)
app.use('/games', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const adminList = req.path === '/api/games' && req.get('x-admin-pin') && pinOk(req.get('x-admin-pin'));
  if (!isLocal(req.socket.remoteAddress) && !adminList) return res.status(403).json({ error: 'screen_only' });
  forwardToGames(req, res, req.url);
});

// ----- Admin API (question sets, cocktail import) -----
const admin = express.Router();
admin.use((req, res, next) => (pinOk(req.get('x-admin-pin')) ? next() : res.status(401).json({ error: 'pin' })));
admin.get('/info', (_req, res) =>
  res.json({ categories: bank.CATEGORIES, difficulties: bank.DIFFICULTIES, ai: bank.aiAvailable(), bank: bank.stats(), library: cocktails.libraryInfo() })
);
admin.get('/sets', (_req, res) => res.json(bank.listSets()));
admin.get('/sets/:id', (req, res) => {
  const set = bank.getSet(req.params.id);
  return set ? res.json(set) : res.status(404).json({ error: 'not_found' });
});
admin.post('/sets', (req, res) => res.json(bank.saveSet(req.body || {})));
admin.delete('/sets/:id', (req, res) => {
  bank.deleteSet(req.params.id);
  res.json({ ok: true });
});
admin.post('/cocktails/refresh', async (_req, res) => {
  try {
    res.json({ ok: true, count: await cocktails.refresh() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});
admin.post('/power', async (req, res) => {
  try {
    res.json({ ok: true });
    setTimeout(() => power(req.body?.action).catch((err) => console.warn('Power action failed:', err.message)), 800);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
// game uploads arrive as a raw body: PUT /api/admin/games?file=&name=&system=
admin.put('/games', (req, res) => forwardToGames(req, res, `/api/games${req.url.slice(req.url.indexOf('?')) .replace(/^[^?]*$/, '')}`));
admin.delete('/games/:id', (req, res) => forwardToGames(req, res, `/api/games/${encodeURIComponent(req.params.id)}`));
admin.delete('/photos/:id', (req, res) => {
  photos.remove(req.params.id);
  broadcastPhotos();
  res.json({ ok: true });
});
admin.get('/guests', (_req, res) => res.json(guests.list()));
// stock (Voorraad) from the phone
const stockChanged = () => io.to('screen').emit('makeable', cocktails.menu({ status: 'now' }).counts.now);
admin.get('/stock', (_req, res) => res.json({ ...bar.catalogue(), stock: bar.getStock() }));
admin.post('/stock/toggle', (req, res) => {
  const { kind, id, on } = req.body || {};
  const key = kind === 'pantry' ? 'pantry' : 'have';
  const list = new Set(bar.getStock()[key]);
  if (on) list.add(String(id));
  else list.delete(String(id));
  const stock = bar.setStock({ [key]: [...list] });
  stockChanged();
  res.json({ ok: true, stock });
});
admin.post('/stock/custom', (req, res) => {
  const stock = bar.addCustom(req.body?.name, req.body?.countsAs, req.body?.kind);
  stockChanged();
  res.json({ ok: true, stock });
});
admin.delete('/stock/custom/:id', (req, res) => {
  const stock = bar.removeCustom(req.params.id);
  stockChanged();
  res.json({ ok: true, stock });
});
admin.get('/credits', (_req, res) => res.json({ people: credits.list(), names: guests.list().map((g) => g.name) }));
admin.post('/credits', (req, res) => res.json(credits.change(req.body?.name, req.body?.amount)));
admin.delete('/credits/:key', (req, res) => {
  credits.remove(req.params.key);
  res.json({ ok: true });
});
admin.delete('/guests/:key', (req, res) => {
  guests.remove(req.params.key);
  res.json({ ok: true });
});
admin.get('/settings', (_req, res) => res.json({ ...publicSettings(), themes: THEMES, room: room.code, wifi: settings.wifi }));
admin.post('/settings', (req, res) => res.json(applySettings(req.body || {})));
admin.post('/room/new', async (_req, res) => {
  await newRoom();
  res.json({ ok: true, room: room.code });
});
app.use('/api/admin', admin);

// ---------- Sockets ----------
let wrongCodes = []; // times of wrong room codes in the last minute
io.on('connection', (socket) => {
  // look and language for every page, right away (also before joining)
  socket.emit('settings', publicSettings());
  const isScreen = () => socket.rooms.has('screen');
  const isPlayer = () => players.has(socket.data.playerId);

  socket.on('screen:hello', async () => {
    // only the touchscreen itself may act as the screen (controls, settings)
    if (!isLocal(socket.handshake.address)) return socket.emit('not-screen');
    socket.join('screen');
    await resolveJoinUrl();
    socket.emit('state', screenState());
  });

  // ----- Music -----
  socket.on('player:cmd', async ({ action, value } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    try {
      await spotify.command(action, value);
      setTimeout(pollSpotify, 350);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ----- Music search on the screen: songs (to the queue) and playlists -----
  socket.on('music:search', async ({ q } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    const query = String(q || '').trim().slice(0, 80);
    if (!query) return ack?.({ ok: true, tracks: [], playlists: [] });
    try {
      const [tracks, playlists] = await Promise.all([
        spotify.searchTracks(query, { count: 20 }),
        spotify.searchPlaylists(query, 20).catch(() => []),
      ]);
      ack?.({ ok: true, tracks, playlists });
    } catch (err) {
      ack?.({ ok: false, error: spotify.isLoggedIn() ? 'search' : 'login' });
    }
  });
  socket.on('music:mine', async (_p, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    try {
      ack?.({ ok: true, playlists: await spotify.myPlaylistsFull() });
    } catch {
      ack?.({ ok: false, error: spotify.isLoggedIn() ? 'search' : 'login' });
    }
  });
  socket.on('music:playlist', async ({ id } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    ack?.({ ok: true, tracks: await spotify.playlistPreview(String(id || '')) });
  });
  socket.on('music:playPlaylist', async ({ id } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    try {
      await spotify.playPlaylist(String(id || ''));
      setTimeout(pollSpotify, 600);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ----- Settings (PIN-protected when a PIN is set) -----
  socket.on('settings:unlock', ({ pin } = {}, ack) => ack?.({ ok: pinOk(pin) }));
  socket.on('settings:set', ({ pin, ...patch } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    // all settings sit behind the code
    if (!pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    ack?.(applySettings(patch));
  });

  socket.on('device:power', async ({ pin, action } = {}, ack) => {
    if (!isScreen() || !pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    try {
      ack?.({ ok: true });
      setTimeout(() => power(action).catch((err) => console.warn('Power action failed:', err.message)), 800);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ----- Karaoke: lyrics of the song that's playing -----
  socket.on('lyrics:get', async (_p, ack) => {
    if (!isScreen()) return ack?.(null);
    const t = player.track;
    if (!t) return ack?.({ trackId: null, synced: [], plain: null });
    ack?.({ trackId: t.id, ...(await getLyrics(t)) });
  });

  // ----- Song requests -----
  socket.on('request:search', async ({ q } = {}, ack) => {
    if (!isPlayer()) return ack?.({ ok: false, error: 'join_first' });
    if (settings.requests === 'off') return ack?.({ ok: false, error: 'off' });
    const query = String(q || '').trim().slice(0, 80);
    if (query.length < 2) return ack?.({ ok: true, results: [] });
    try {
      const found = await spotify.searchTracks(query, { count: 10 });
      ack?.({ ok: true, results: found.slice(0, 10).map(({ uri, title, artist, art }) => ({ uri, title, artist, art })) });
    } catch (err) {
      ack?.({ ok: false, error: 'search' });
    }
  });
  socket.on('request:add', async ({ track } = {}, ack) => {
    if (!isPlayer()) return ack?.({ ok: false, error: 'join_first' });
    if (settings.requests === 'off') return ack?.({ ok: false, error: 'off' });
    const id = socket.data.playerId;
    const res = requests.add({ playerId: id, by: players.get(id)?.name, track });
    if (!res.ok) return ack?.(res);
    if (settings.requests === 'auto') {
      try {
        await spotify.command('queue', res.request.track.uri);
        requests.decide(res.request.id, 'queued');
      } catch {
        // stays pending: the screen can still approve it
      }
    }
    broadcastRequests();
    if (res.request.status === 'pending') io.to('screen').emit('request:new', res.request);
    ack?.({ ok: true, request: res.request, mine: requests.forPlayer(id) });
  });
  socket.on('request:mine', (_p, ack) => ack?.(isPlayer() ? requests.forPlayer(socket.data.playerId) : []));
  socket.on('request:decide', async ({ id, ok } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    const r = requests.pending().find((x) => x.id === id);
    if (!r) return ack?.({ ok: false });
    if (ok) {
      try {
        await spotify.command('queue', r.track.uri);
      } catch {
        return ack?.({ ok: false, error: 'spotify' });
      }
    }
    requests.decide(id, ok ? 'queued' : 'rejected');
    broadcastRequests();
    const p = players.get(r.playerId);
    if (p) for (const sid of p.sockets) io.to(sid).emit('request:update', requests.forPlayer(r.playerId));
    setTimeout(pollSpotify, 500);
    ack?.({ ok: true });
  });

  // ----- Games: music and game volume -----
  socket.on('gamevol:set', ({ music, game } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    const clamp100 = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : d);
    settings.gameVolume = { music: clamp100(music, settings.gameVolume.music), game: clamp100(game, settings.gameVolume.game) };
    save('settings', settings);
    ack?.({ ok: true, gameVolume: settings.gameVolume });
  });

  // ----- Photo wall (screen) -----
  socket.on('photo:delete', ({ id, pin } = {}, ack) => {
    if (!isScreen() || !pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    photos.remove(String(id || ''));
    broadcastPhotos();
    ack?.({ ok: true });
  });

  socket.on('room:new', async ({ pin } = {}, ack) => {
    if (!isScreen() || !pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    await newRoom();
    ack?.({ ok: true });
  });

  // ----- Quiz -----
  socket.on('quiz:options', async (_p, ack) => {
    ack?.({
      ...(await getSourceOptions()),
      categories: bank.categories(settings.language),
      difficulties: bank.DIFFICULTIES,
      difficultyLabels: settings.language === 'en' ? bank.DIFFICULTY_EN : null,
      sets: bank.SETS,
      musicSets: MUSIC_SETS,
      lang: settings.language,
      ai: bank.aiAvailable(),
      bank: bank.stats(),
      spotifyReady: spotify.isConfigured() && spotify.isLoggedIn(),
      defaults: quizDefaults,
    });
  });

  socket.on('quiz:start', ({ type, settings: s } = {}, ack) => {
    if (!isScreen() || !['intro', 'popquiz', 'pubquiz'].includes(type)) return ack?.({ ok: false });
    quizDefaults[type] = { ...quizDefaults[type], ...s };
    save('quiz-settings', quizDefaults);
    game.start(type, { ...quizDefaults[type], lang: settings.language });
    setTimeout(pollSpotify, 500);
    ack?.({ ok: true });
  });

  socket.on('quiz:cmd', async ({ action, value } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    try {
      switch (action) {
        case 'stop': game.stopTime(); break;
        case 'replay': game.replay(); break;
        case 'reveal': game.startReveal(); break;
        case 'next': game.revealStep(1); break;
        case 'prev': game.revealStep(-1); break;
        case 'playHook': await game.playHook(); break;
        case 'hookAdjust': await game.adjustHook(Number(value) || 0); break;
        case 'nextRound': game.nextRound(); break;
        case 'end': await game.end(); setTimeout(pollSpotify, 800); break;
        default: return ack?.({ ok: false, error: 'unknown' });
      }
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ----- Cocktails (screen and joined phones) -----
  socket.on('cocktails:menu', (filters = {}, ack) => {
    if (!isScreen() && !isPlayer()) return ack?.(null);
    ack?.(cocktails.menu(filters));
  });
  socket.on('cocktails:recipe', async ({ id } = {}, ack) => {
    if (!isScreen() && !isPlayer()) return ack?.(null);
    ack?.(await cocktails.recipe(String(id || ''), settings.language));
  });

  // ----- Stock (screen only, PIN when set) -----
  socket.on('stock:get', (_p, ack) => ack?.({ ...bar.catalogue(), stock: bar.getStock() }));
  const stockChange = (fn) => ({ pin, ...rest } = {}, ack) => {
    if (!isScreen() || !pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    const stock = fn(rest);
    io.to('screen').emit('makeable', cocktails.menu({ status: 'now' }).counts.now);
    ack?.({ ok: true, stock });
  };
  socket.on('stock:set', stockChange((p) => bar.setStock(p)));
  socket.on('stock:addCustom', stockChange((p) => bar.addCustom(p.name, p.countsAs, p.kind)));
  socket.on('stock:removeCustom', stockChange((p) => bar.removeCustom(p.id)));

  // ----- Phones -----
  socket.on('phone:join', ({ code, name, playerId } = {}, ack) => {
    // brake on guessing room codes (the join page can be public)
    const now = Date.now();
    wrongCodes = wrongCodes.filter((t) => now - t < 60000);
    if (wrongCodes.length >= 30) return ack?.({ ok: false, error: 'wrong_code' });
    if (String(code || '').toUpperCase() !== room.code) {
      wrongCodes.push(now);
      return ack?.({ ok: false, error: 'wrong_code' });
    }
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) return ack?.({ ok: false, error: 'no_name' });
    // same name as someone already in the room: that's her (or him) again
    const id = findByName(cleanName) || (playerId && players.has(playerId) ? playerId : crypto.randomUUID());
    const prevId = socket.data.playerId;
    if (prevId && prevId !== id) players.get(prevId)?.sockets.delete(socket.id);
    // this phone used another entry before (renamed itself): drop it if nobody uses it
    for (const oldId of new Set([prevId, playerId])) {
      const old = oldId && oldId !== id ? players.get(oldId) : null;
      if (old && !old.manual && ![...old.sockets].some((sid) => sid !== socket.id && io.sockets.sockets.has(sid))) {
        players.delete(oldId);
        game.removePlayer(oldId);
      }
    }
    const p = players.get(id) || { name: cleanName, sockets: new Set() };
    p.name = cleanName;
    p.sockets.add(socket.id);
    players.set(id, p);
    socket.data.playerId = id;
    game.addPlayer(id);
    saveRoom();
    socket.join('phones');
    guests.checkIn(cleanName);
    ack?.({ ok: true, playerId: id, name: cleanName, settings: publicSettings(), game: game.phoneView(id), spotify: spotify.isLoggedIn() });
    broadcastPlayers();
    if (game.active) game.emit();
  });

  // ----- Players (setup screen): add someone by name, or take someone out -----
  socket.on('players:add', ({ name } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    const clean = String(name || '').trim().slice(0, 24);
    if (!clean) return ack?.({ ok: false, error: 'no_name' });
    if (findByName(clean)) return ack?.({ ok: false, error: 'exists' });
    const id = crypto.randomUUID();
    players.set(id, { name: clean, manual: true, sockets: new Set() });
    game.addPlayer(id);
    saveRoom();
    broadcastPlayers();
    ack?.({ ok: true, id });
  });
  socket.on('players:remove', ({ id } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    const p = players.get(id);
    if (!p) return ack?.({ ok: false });
    players.delete(id);
    game.removePlayer(id);
    for (const sid of p.sockets) {
      const s = io.sockets.sockets.get(sid);
      if (s) s.data.playerId = null;
      io.to(sid).emit('player:removed');
    }
    saveRoom();
    broadcastPlayers();
    ack?.({ ok: true });
  });

  socket.on('phone:answer', ({ choice } = {}, ack) => {
    if (!isPlayer()) return ack?.({ ok: false });
    ack?.(game.answer(socket.data.playerId, Number(choice)));
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.data.playerId);
    if (p) {
      p.sockets.delete(socket.id);
      broadcastPlayers();
    }
  });
});

setInterval(pollSpotify, 3000);
diag.watchSpeaker(onSpeakerEvent);
cocktails.scheduleRefresh();
bank.startTranslator();
server.listen(PORT, () => {
  console.log(`Wexer 2.0 listening on :${PORT}`);
  resolveJoinUrl().catch(() => {});
});
// second port only for the Spotify login (see AUTH_PORT above)
if (AUTH_PORT !== PORT) {
  http.createServer(app).listen(AUTH_PORT, () => console.log(`Spotify login on ${AUTH_ORIGIN}`));
}
