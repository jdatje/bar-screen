// Bar Screen 2.0 — server for the touchscreen (/) and guests' phones (/play)
import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import * as spotify from './lib/spotify.js';
import { load, save } from './lib/store.js';

const PORT = Number(process.env.PORT || 80);
const THEMES = ['industrial', 'maison', 'neon'];
const CALLBACK_PATH = '/auth/spotify/callback';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let settings = load('settings', { theme: 'industrial', language: 'nl' });

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
    room.qr = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#1B1C1E', light: '#E8E6E1' } });
  }
}

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
  upNext,
  configured: spotify.isConfigured(),
  loggedIn: spotify.isLoggedIn(),
  error: spotifyError,
  at: Date.now(),
});

const screenState = () => ({
  settings,
  themes: THEMES,
  room: { code: room.code, joinUrl: room.joinUrl, qr: room.qr },
  players: playerList(),
  player: publicPlayer(),
});

const broadcastPlayers = () => {
  io.to('screen').emit('players', playerList());
  io.to('phones').emit('players', playerList().length);
};

// ---------- HTTP ----------
app.use(express.static('public', { extensions: ['html'] }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Spotify login: open http://127.0.0.1/auth/spotify/login on the bar screen itself
// (Spotify only allows plain-http redirect URIs on the loopback address).
app.get('/auth/spotify/login', (req, res) => {
  if (!spotify.isConfigured()) return res.status(500).send('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  const redirectUri = `${req.protocol}://${req.get('host')}${CALLBACK_PATH}`;
  res.redirect(spotify.authUrl(redirectUri, crypto.randomUUID()));
});

app.get(CALLBACK_PATH, async (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}${CALLBACK_PATH}`;
    await spotify.exchangeCode(req.query.code, redirectUri);
    await pollSpotify();
    res.redirect('/');
  } catch (err) {
    res.status(500).send(`Spotify login failed: ${err.message}`);
  }
});

// ---------- Sockets ----------
io.on('connection', (socket) => {
  socket.on('screen:hello', async () => {
    socket.join('screen');
    await resolveJoinUrl();
    socket.emit('state', screenState());
  });

  socket.on('player:cmd', async ({ action, value } = {}, ack) => {
    try {
      await spotify.command(action, value);
      setTimeout(pollSpotify, 350);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('settings:set', (patch = {}, ack) => {
    if (patch.theme && THEMES.includes(patch.theme)) settings.theme = patch.theme;
    if (patch.language && ['nl', 'en'].includes(patch.language)) settings.language = patch.language;
    save('settings', settings);
    io.emit('settings', settings);
    ack?.({ ok: true, settings });
  });

  socket.on('room:new', async (_p, ack) => {
    room.code = newCode();
    players.clear();
    await resolveJoinUrl();
    io.to('phones').emit('room:closed');
    io.to('screen').emit('state', screenState());
    ack?.({ ok: true });
  });

  // Guest phone joins with the room code
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
    ack?.({ ok: true, playerId: id, settings });
    broadcastPlayers();
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
server.listen(PORT, () => {
  console.log(`Bar screen listening on :${PORT}`);
  resolveJoinUrl().catch(() => {});
});
