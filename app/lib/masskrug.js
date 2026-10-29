// Top lists for the party games:
//  - masskrug (Oktoberfest): longest hold wins
//  - hula (Tiki): longest hula-hoop wins
//  - limbo (Tiki): lowest bar a winner went under wins (stored in cm)
import { load, save } from './store.js';

const KINDS = { masskrug: 'high', hula: 'high', limbo: 'low' };
let data = load('masskrug', { scores: [] }); // old format: masskrug only
if (!data.kinds) data = { kinds: { masskrug: data.scores || [], hula: [], limbo: [] } };

const kindOf = (k) => (KINDS[k] ? k : 'masskrug');
const sorted = (k, list) => [...list].sort((a, b) => (KINDS[k] === 'low' ? a.ms - b.ms : b.ms - a.ms));

export const list = (kind) => {
  const k = kindOf(kind);
  return { kind: k, scores: (data.kinds[k] || []).slice(0, 10) };
};

// value: milliseconds for the timers, centimetres for limbo
export function add(name, value, kind) {
  const k = kindOf(kind);
  const clean = String(name || '').trim().slice(0, 24);
  const v = Math.round(Number(value));
  if (!clean || !(v > 0) || v > 60 * 60 * 1000) return { ok: false };
  const entry = { name: clean, ms: v, at: Date.now() };
  data.kinds[k] = sorted(k, [...(data.kinds[k] || []), entry]).slice(0, 50);
  save('masskrug', data);
  return { ok: true, rank: data.kinds[k].indexOf(entry) + 1, ...list(k) };
}

export function clear(kind) {
  const k = kindOf(kind);
  data.kinds[k] = [];
  save('masskrug', data);
  return { ok: true, ...list(k) };
}
