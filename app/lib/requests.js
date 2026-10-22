// Song requests from guests' phones. Depending on the setting they go
// straight into the queue ("auto") or wait for a tap on the screen ("approve").
import crypto from 'node:crypto';

const MAX_PENDING_PER_GUEST = 3;
let list = []; // { id, playerId, by, track: {uri,title,artist,art}, status: 'pending'|'queued'|'rejected', at }

export const pending = () => list.filter((r) => r.status === 'pending');
export const forPlayer = (playerId) => list.filter((r) => r.playerId === playerId).slice(-10).reverse();

export function add({ playerId, by, track }) {
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(track?.uri || '')) return { ok: false, error: 'bad_track' };
  if (list.some((r) => r.status === 'pending' && r.track.uri === track.uri)) return { ok: false, error: 'already' };
  if (list.filter((r) => r.playerId === playerId && r.status === 'pending').length >= MAX_PENDING_PER_GUEST) return { ok: false, error: 'too_many' };
  const r = {
    id: crypto.randomUUID().slice(0, 8),
    playerId,
    by: String(by || '').slice(0, 24),
    track: { uri: track.uri, title: String(track.title || '').slice(0, 120), artist: String(track.artist || '').slice(0, 120), art: track.art || null },
    status: 'pending',
    at: Date.now(),
  };
  list.push(r);
  if (list.length > 200) list = list.slice(-200);
  return { ok: true, request: r };
}

export function decide(id, status) {
  const r = list.find((x) => x.id === id && x.status === 'pending');
  if (!r) return null;
  r.status = status;
  return r;
}

export function clearRoom() {
  list = [];
}
