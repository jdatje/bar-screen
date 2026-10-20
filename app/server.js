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
import { getSourceOptions } from './lib/musicpool.js';
import { Game } from './lib/game.js';
import { load, save } from './lib/store.js';

const PORT = Number(process.env.PORT || 80);
export const THEMES = ['industrial', 'maison', 'neon', 'bruin', 'tiki', 'disco', 'bluenote', 'papier', 'riviera', 'chalet'];
const CALLBACK_PATH = '/auth/spotify/callback';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let settings = load('settings', { theme: 'industrial', language: 'nl', pin: '' });
let quizDefaults = load('quiz-settings', {
  intro: { genres: {}, decades: [], playlists: [], rounds: 2, perRound: 8, seconds: 20, clip: 10 },
  popquiz: { genres: {}, decades: [], playlists: [], types: ['year', 'artist', 'first'], rounds: 2, perRound: 8, seconds: 20, clip: 12 },
  pubquiz: { categories: [], difficulty: '', source: 'mix', rounds: 3, perRound: 8, seconds: 25 },
});
// All bundled questions have a Dutch version, so Dutch is always the default
quizDefaults.pubquiz.lang = 'nl';

const publicSettings = () => ({ theme: settings.theme, language: settings.language, hasPin: Boolean(settings.pin) });
const pinOk = (pin) => !settings.pin || String(pin || '') === settings.pin;

// ---------- Room & players ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
const room = { code: newCode(), joinUrl: null, qr: null };
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

async function pollSpotify() {
  if (!spotify.isConfigured() || !spotify.isLoggedIn()) return;
  try {
    const next = await spotify.getPlayer();
    const trackChanged = next.track?.id !== player.track?.id;
    player = next;
    if (trackChanged) upNext = await spotify.getUpNext().catch(() => upNext);
    spotifyError = null;
  } catch (err) {
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

const screenState = () => ({
  settings: publicSettings(),
  themes: THEMES,
  room: { code: room.code, joinUrl: room.joinUrl, qr: room.qr },
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
app.use(express.static('public', { extensions: ['html'] }));

app.get('/health', (_req, res) => res.json({ ok: true }));

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
app.use('/api/admin', admin);

// ---------- Sockets ----------
io.on('connection', (socket) => {
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
    // switching looks is open to everyone; the rest needs the PIN
    const protectedChange = 'language' in patch || 'newPin' in patch;
    if (protectedChange && !pinOk(pin)) return ack?.({ ok: false, error: 'pin' });
    if (patch.theme && THEMES.includes(patch.theme)) settings.theme = patch.theme;
    if (patch.language && ['nl', 'en'].includes(patch.language)) settings.language = patch.language;
    if ('newPin' in patch) settings.pin = String(patch.newPin || '').replace(/\D/g, '').slice(0, 8);
    save('settings', settings);
    io.emit('settings', publicSettings());
    ack?.({ ok: true, settings: publicSettings() });
  });

  socket.on('room:new', async (_p, ack) => {
    if (!isScreen()) return ack?.({ ok: false });
    room.code = newCode();
    players.clear();
    await resolveJoinUrl();
    io.to('phones').emit('room:closed');
    io.to('screen').emit('state', screenState());
    ack?.({ ok: true });
  });

  // ----- Quiz -----
  socket.on('quiz:options', async (_p, ack) => {
    ack?.({
      ...(await getSourceOptions()),
      categories: bank.CATEGORIES,
      difficulties: bank.DIFFICULTIES,
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
    game.start(type, quizDefaults[type]);
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
    ack?.(await cocktails.recipe(String(id || '')));
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
