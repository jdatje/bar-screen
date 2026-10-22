// Spotify for Wexer:
//  - the bar speaker (go-librespot) for now-playing, controls and quiz playback
//  - the Spotify Web API (the account linked on the screen) only for searching
//    songs and reading playlists for the music quizzes
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

// ---------- The bar speaker (go-librespot local API) ----------
// Now-playing, the screen's buttons and quiz playback talk to the speaker
// itself, so they work for whichever Spotify account is playing on it.
const SPEAKER = process.env.LIBRESPOT_URL || 'http://127.0.0.1:3678';

async function speaker(method, path, body) {
  const res = await fetch(`${SPEAKER}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`Speaker ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const trackFromSpeaker = (t) =>
  t
    ? {
        id: String(t.uri || '').split(':').pop(),
        uri: t.uri,
        title: t.name,
        artist: (t.artist_names || []).join(', '),
        album: t.album_name,
        art: t.album_cover_url ?? null,
        durationMs: t.duration,
      }
    : null;

let lastStatus = null;

// Compact now-playing state for the screens
export async function getPlayer() {
  const s = await speaker('GET', '/status');
  lastStatus = s;
  if (!s || !s.track)
    return { active: Boolean(s), playing: false, stopped: !s || Boolean(s.stopped), buffering: Boolean(s?.buffering), track: null, device: s?.device_name ?? null };
  return {
    active: true,
    playing: !s.paused && !s.stopped,
    progressMs: s.track.position ?? 0,
    volume: s.volume_steps ? Math.round((s.volume / s.volume_steps) * 100) : null,
    device: s.device_name ?? null,
    context: s.context_name ?? null,
    shuffle: Boolean(s.shuffle_context),
    track: trackFromSpeaker(s.track),
  };
}

// Next songs of the playing playlist/album, in order. With shuffle on the
// order is unknown, so only the speaker's own next_track is shown.
const ctxCache = { uri: null, tracks: [], complete: false, at: 0 };
const brief = (t, uri) => ({ title: t.name, artist: (t.artist_names || []).join(', '), uri: uri || t.uri || null });

// True while the speaker is still loading the playlist's song details,
// so the server polls faster until the "Straks" list is filled.
export const upNextLoading = () => Boolean(lastStatus?.context_uri && !lastStatus.shuffle_context && !(ctxCache.uri === lastStatus.context_uri && ctxCache.complete));

export async function getUpNext(limit = 15) {
  const s = lastStatus;
  const fallback = s?.next_track ? [brief(s.next_track)] : [];
  if (!s?.track || !s.context_uri || s.shuffle_context) return fallback;
  try {
    const age = Date.now() - ctxCache.at;
    const missing = !ctxCache.tracks.some((e) => e.uri === s.track.uri);
    const stale = ctxCache.uri !== s.context_uri || ((!ctxCache.complete || missing) && age > 1000);
    if (stale) {
      const c = await speaker('GET', `/context/tracks?uri=${encodeURIComponent(s.context_uri)}`);
      ctxCache.uri = s.context_uri;
      ctxCache.tracks = c?.tracks || [];
      ctxCache.complete = Boolean(c?.ready && c.cached >= c.length);
      ctxCache.at = Date.now();
    }
    const i = ctxCache.tracks.findIndex((e) => e.uri === s.track.uri);
    if (i < 0) return fallback;
    const next = ctxCache.tracks.slice(i + 1, i + 1 + limit).filter((e) => e.track).map((e) => brief(e.track, e.uri));
    return next.length ? next : fallback;
  } catch {
    return fallback;
  }
}

export async function command(action, value) {
  switch (action) {
    case 'play': return speaker('POST', '/player/resume');
    case 'pause': return speaker('POST', '/player/pause');
    case 'next': return speaker('POST', '/player/next', {});
    case 'previous': return speaker('POST', '/player/prev');
    case 'volume': {
      const v = Math.max(0, Math.min(100, Math.round(Number(value))));
      const vol = await speaker('GET', '/player/volume');
      return speaker('POST', '/player/volume', { volume: Math.round((v / 100) * (vol?.max || 100)) });
    }
    case 'seek': return speaker('POST', '/player/seek', { position: Math.max(0, Math.round(Number(value))) });
    case 'queue': {
      // a song request: add it after the current song
      const uri = String(value || '');
      if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) throw new Error('Invalid track');
      return speaker('POST', '/player/add_to_queue', { uri });
    }
    case 'setVolume': {
      // absolute volume 0-100 (used when a game starts)
      const v = Math.max(0, Math.min(100, Math.round(Number(value))));
      const vol = await speaker('GET', '/player/volume');
      return speaker('POST', '/player/volume', { volume: Math.round((v / 100) * (vol?.max || 100)) });
    }
    case 'jump': {
      // play a song from the "Straks" list, staying in the same playlist/album
      const uri = String(value || '');
      if (!/^spotify:(track|episode):[A-Za-z0-9]+$/.test(uri)) throw new Error('Invalid track');
      const s = await speaker('GET', '/status');
      return s?.context_uri
        ? speaker('POST', '/player/play', { uri: s.context_uri, skip_to_uri: uri })
        : speaker('POST', '/player/play', { uri });
    }
    default: throw new Error(`Unknown player action: ${action}`);
  }
}

// ---------- Used by the music games ----------

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
  return speaker('POST', '/player/play', { uri, position: Math.max(0, Math.round(positionMs)) });
}

// Remember what was playing before a game, so we can resume it afterwards
export async function snapshot() {
  const s = await speaker('GET', '/status');
  if (!s?.track) return null;
  return { contextUri: s.context_uri ?? null, uri: s.track.uri, positionMs: s.track.position ?? 0, playing: !s.paused && !s.stopped };
}

export async function restore(snap) {
  if (!snap) return speaker('POST', '/player/pause').catch(() => {});
  const body = snap.contextUri
    ? { uri: snap.contextUri, skip_to_uri: snap.uri, position: snap.positionMs, paused: !snap.playing }
    : { uri: snap.uri, position: snap.positionMs, paused: !snap.playing };
  await speaker('POST', '/player/play', body).catch(() =>
    speaker('POST', '/player/play', { uri: snap.uri, position: snap.positionMs, paused: !snap.playing })
  );
}
