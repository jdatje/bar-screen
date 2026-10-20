// Spotify Web API control (playback state, play/pause/skip, volume, queue).
// Audio itself comes from the go-librespot "Wexer 2.0" Connect speaker.
import { load, save } from './store.js';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
].join(' ');

let tokens = load('spotify', { refresh_token: null, access_token: null, expires_at: 0 });

const clientId = () => process.env.SPOTIFY_CLIENT_ID;
const clientSecret = () => process.env.SPOTIFY_CLIENT_SECRET;

export const isConfigured = () => Boolean(clientId() && clientSecret());
export const isLoggedIn = () => Boolean(tokens.refresh_token);

export function authUrl(redirectUri, state) {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

async function tokenRequest(params) {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Spotify token error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  tokens = {
    refresh_token: data.refresh_token || tokens.refresh_token,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  save('spotify', tokens);
}

export const exchangeCode = (code, redirectUri) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

async function accessToken() {
  if (!tokens.refresh_token) throw new Error('Spotify not logged in');
  if (!tokens.access_token || Date.now() > tokens.expires_at) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  }
  return tokens.access_token;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`Spotify ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Compact now-playing state for the screens
export async function getPlayer() {
  const p = await api('GET', '/me/player');
  if (!p || !p.item) return { active: Boolean(p), playing: false, track: null, device: p?.device?.name ?? null };
  const t = p.item;
  return {
    active: true,
    playing: p.is_playing,
    progressMs: p.progress_ms,
    volume: p.device?.volume_percent ?? null,
    device: p.device?.name ?? null,
    track: {
      id: t.id,
      title: t.name,
      artist: (t.artists || []).map((a) => a.name).join(', '),
      album: t.album?.name,
      art: t.album?.images?.[0]?.url ?? null,
      durationMs: t.duration_ms,
    },
  };
}

export async function getUpNext(limit = 3) {
  const q = await api('GET', '/me/player/queue');
  return (q?.queue || []).slice(0, limit).map((t) => ({
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
  }));
}

export async function command(action, value) {
  switch (action) {
    case 'play': return api('PUT', '/me/player/play');
    case 'pause': return api('PUT', '/me/player/pause');
    case 'next': return api('POST', '/me/player/next');
    case 'previous': return api('POST', '/me/player/previous');
    case 'volume': {
      const v = Math.max(0, Math.min(100, Math.round(Number(value))));
      return api('PUT', `/me/player/volume?volume_percent=${v}`);
    }
    case 'seek': return api('PUT', `/me/player/seek?position_ms=${Math.max(0, Math.round(Number(value)))}`);
    default: throw new Error(`Unknown player action: ${action}`);
  }
}

// ---------- Used by the music games ----------

const DEVICE_NAME = process.env.SPOTIFY_DEVICE_NAME || 'Wexer 2.0';

// The bar's Connect speaker, falling back to whatever device is active
export async function getDeviceId() {
  const res = await api('GET', '/me/player/devices');
  const devices = res?.devices || [];
  const bar = devices.find((d) => d.name === DEVICE_NAME) || devices.find((d) => d.is_active) || devices[0];
  return bar?.id ?? null;
}

const mapTrack = (t) =>
  t && t.id && t.uri
    ? {
        id: t.id,
        uri: t.uri,
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(', '),
        mainArtist: t.artists?.[0]?.name ?? '',
        album: t.album?.name ?? '',
        year: Number(String(t.album?.release_date || '').slice(0, 4)) || null,
        art: t.album?.images?.[0]?.url ?? null,
        durationMs: t.duration_ms,
      }
    : null;

// Search is capped at 10 results per call (dev mode), so we page with offset.
export async function searchTracks(query, { count = 30, startOffset = 0 } = {}) {
  const out = [];
  for (let offset = startOffset; out.length < count && offset < startOffset + count * 2; offset += 10) {
    const q = new URLSearchParams({ q: query, type: 'track', limit: '10', offset: String(offset) });
    const res = await api('GET', `/search?${q}`);
    const items = res?.tracks?.items || [];
    out.push(...items.map(mapTrack).filter(Boolean));
    if (items.length < 10) break;
  }
  return out;
}

// Only works for playlists the logged-in user owns or collaborates on.
export async function getMyPlaylists() {
  const res = await api('GET', '/me/playlists?limit=50');
  return (res?.items || []).map((p) => ({ id: p.id, name: p.name }));
}

export async function getPlaylistTracks(id, max = 200) {
  const out = [];
  for (let offset = 0; out.length < max; offset += 50) {
    const res = await api('GET', `/playlists/${id}/items?limit=50&offset=${offset}`);
    const items = res?.items || [];
    out.push(...items.map((i) => mapTrack(i.item || i.track)).filter(Boolean));
    if (items.length < 50) break;
  }
  return out;
}

export async function playTrack(uri, positionMs = 0) {
  const deviceId = await getDeviceId();
  const qs = deviceId ? `?device_id=${deviceId}` : '';
  return api('PUT', `/me/player/play${qs}`, { uris: [uri], position_ms: Math.max(0, Math.round(positionMs)) });
}

// Remember what was playing before a game, so we can resume it afterwards
export async function snapshot() {
  const p = await api('GET', '/me/player');
  if (!p?.item) return null;
  return { contextUri: p.context?.uri ?? null, uri: p.item.uri, positionMs: p.progress_ms, playing: p.is_playing };
}

export async function restore(snap) {
  if (!snap) return api('PUT', '/me/player/pause').catch(() => {});
  const deviceId = await getDeviceId();
  const qs = deviceId ? `?device_id=${deviceId}` : '';
  const body = snap.contextUri
    ? { context_uri: snap.contextUri, offset: { uri: snap.uri }, position_ms: snap.positionMs }
    : { uris: [snap.uri], position_ms: snap.positionMs };
  await api('PUT', `/me/player/play${qs}`, body).catch(() =>
    api('PUT', `/me/player/play${qs}`, { uris: [snap.uri], position_ms: snap.positionMs })
  );
  if (!snap.playing) await api('PUT', '/me/player/pause').catch(() => {});
}
