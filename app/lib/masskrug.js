// Maßkrugstemmen top list (Oktoberfest looks): the 10 longest holds.
import { load, save } from './store.js';

let data = load('masskrug', { scores: [] }); // [{ name, ms, at }]

export const list = () => ({ scores: data.scores.slice(0, 10) });

export function add(name, ms) {
  const clean = String(name || '').trim().slice(0, 24);
  const t = Math.round(Number(ms));
  if (!clean || !(t > 0) || t > 60 * 60 * 1000) return { ok: false };
  const entry = { name: clean, ms: t, at: Date.now() };
  data.scores = [...data.scores, entry].sort((a, b) => b.ms - a.ms).slice(0, 50);
  save('masskrug', data);
  return { ok: true, rank: data.scores.indexOf(entry) + 1, ...list() };
}

export function clear() {
  data = { scores: [] };
  save('masskrug', data);
  return { ok: true, ...list() };
}
