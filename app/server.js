// Wexer 2.0 — server for the touchscreen (/), guests' phones (/play)
// and the admin page (/admin).
import express from 'express';
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
import { TILE_KEYS, DEFAULT_TILES, validTileChoice } from './public/js/tiles.js';

const PORT = Number(process.env.PORT || 80);
export const THEMES = ['industrial', 'maison', 'neon', 'bruin', 'tiki', 'disco', 'bluenote', 'papier', 'riviera', 'chalet', 'spookhuis', 'pompoen', 'heks', 'oranje'];
const CALLBACK_PATH = '/auth/spotify/callback';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// The settings are locked with a code; 252525 unless the admins changed it
const DEFAULT_PIN = '252525';
let settings = load('settings', { theme: 'industrial', language: 'nl', pin: DEFAULT_PIN });
if (!settings.pin) settings.pin = DEFAULT_PIN;
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

const publicSettings = () => ({ theme: settings.theme, language: settings.language, tiles: settings.tiles, hasPin: Boolean(settings.pin) });

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
  if (patch.tiles && typeof patch.tiles === 'object') {
    for (const key of TILE_KEYS) if (validTileChoice(key, patch.tiles[key])) settings.tiles[key] = patch.tiles[key];
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
const room = { code: newCode(), joinUrl: null, qr: null, adminUrl: null, adminQr: null };
const players = new Map(); // playerId -> { name, sockets: Set }

const playerList = () =>
  [...players.entries()].map(([id, p]) => ({ id, name: p.name, online: p.sockets.size > 0 }));

async function resolveJoinUrl() {
  let base = process.env.PUBLIC_URL || process.env.LAN_URL || null;
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
  room: { code: room.code, joinUrl: room.joinUrl, qr: room.qr, adminUrl: room.adminUrl, adminQr: room.adminQr },
  players: playerList(),
  player: publicPlayer(),
  game: game.screenView(),
  makeable: cocktails.menu({ status: 'now' }).counts.now,
});

const broadcastPlayers = () => {
  io.to('screen').emit('players', playerList());
  io.to('phones').emit('players', playerList().length);
};

// ---------- HTTP ----------
app.use(express.json({ limit: '2mb' }));
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
admin.get('/settings', (_req, res) => res.json({ ...publicSettings(), themes: THEMES, room: room.code }));
admin.post('/settings', (req, res) => res.json(applySettings(req.body || {})));
admin.post('/room/new', async (_req, res) => {
  await newRoom();
  res.json({ ok: true, room: room.code });
});
app.use('/api/admin', admin);

// ---------- Sockets ----------
io.on('connection', (socket) => {
  // look and language for every page, right away (also before joining)
  socket.emit('settings', publicSettings());
  const isScreen = () => socket.rooms.has('screen');
  const isPlayer = () => players.has(socket.data.playerId);

  socket.on('screen:hello', async () => {
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

  // ----- Settings (PIN-protected when a PIN is set) -----
  socket.on('settings:unlock', ({ pin } = {}, ack) => ack?.({ ok: pinOk(pin) }));
  socket.on('settings:set', ({ pin, ...patch } = {}, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    // all settings sit behind the code
    if (!pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    ack?.(applySettings(patch));
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
  socket.on('stock:addCustom', stockChange((p) => bar.addCustom(p.name, p.countsAs)));
  socket.on('stock:removeCustom', stockChange((p) => bar.removeCustom(p.id)));

  // ----- Phones -----
  socket.on('phone:join', ({ code, name, playerId } = {}, ack) => {
    if (String(code || '').toUpperCase() !== room.code) return ack?.({ ok: false, error: 'wrong_code' });
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) return ack?.({ ok: false, error: 'no_name' });
    const id = playerId && players.has(playerId) ? playerId : crypto.randomUUID();
    const p = players.get(id) || { name: cleanName, sockets: new Set() };
    p.name = cleanName;
    p.sockets.add(socket.id);
    players.set(id, p);
    socket.data.playerId = id;
    socket.join('phones');
    ack?.({ ok: true, playerId: id, settings: publicSettings(), game: game.phoneView(id) });
    broadcastPlayers();
    if (game.active) game.emit();
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
