// Finds the most recognisable part of a song ("the hook") for the
// "Speel het refrein" button. Spotify no longer exposes song structure,
// so we use time-synced lyrics from LRCLIB: the line that repeats most is
// almost always the chorus. Manual corrections are saved and win.
import { load, save } from './store.js';

let hooks = load('hooks', {}); // trackId -> { ms, source: 'manual' | 'lyrics' | 'guess' }

const parseLrc = (lrc) =>
  String(lrc || '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      if (!m) return null;
      const text = m[3].trim();
      return text ? { ms: (Number(m[1]) * 60 + Number(m[2])) * 1000, text } : null;
    })
    .filter(Boolean);

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

export function chorusFromLyrics(lines) {
  if (lines.length < 6) return null;
  const counts = new Map();
  for (const l of lines) {
    const k = norm(l.text);
    if (k.split(' ').length >= 3) counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = null;
  for (const [k, c] of counts) if (c >= 2 && (!best || c > best.c)) best = { k, c };
  if (!best) return null;

  // First occurrence after the very start (skip a cold-open chorus at 0:00)
  let idx = lines.findIndex((l) => norm(l.text) === best.k && l.ms > 15000);
  if (idx < 0) idx = lines.findIndex((l) => norm(l.text) === best.k);

  // Walk back to the start of the chorus block: earlier lines that also repeat
  while (idx > 0) {
    const prev = lines[idx - 1];
    if ((counts.get(norm(prev.text)) || 0) < 2 || lines[idx].ms - prev.ms > 15000) break;
    idx--;
  }
  return Math.max(0, lines[idx].ms - 800);
}

const guess = (durationMs) => Math.round(Math.min(60000, (durationMs || 200000) * 0.3));

export async function getHook(track) {
  const known = hooks[track.id];
  if (known) return known.ms;

  let ms = null;
  try {
    const q = new URLSearchParams({
      artist_name: track.mainArtist || track.artist,
      track_name: track.title,
      duration: String(Math.round((track.durationMs || 0) / 1000)),
    });
    const res = await fetch(`https://lrclib.net/api/get?${q}`, {
      headers: { 'User-Agent': 'MaisonBaron-BarScreen/1.0 (https://github.com/jdatje/bar-screen)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) ms = chorusFromLyrics(parseLrc((await res.json()).syncedLyrics));
  } catch {
    // offline or not found: fall back to a guess
  }
  const entry = ms != null ? { ms, source: 'lyrics' } : { ms: guess(track.durationMs), source: 'guess' };
  hooks[track.id] = entry;
  save('hooks', hooks);
  return entry.ms;
}

export function setHook(trackId, ms) {
  hooks[trackId] = { ms: Math.max(0, Math.round(ms)), source: 'manual' };
  save('hooks', hooks);
}
