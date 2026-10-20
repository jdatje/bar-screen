// Spotify Web API control (playback state, play/pause/skip, volume, queue).
// Audio itself comes from the go-librespot "Maison Baron" Connect speaker.
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
