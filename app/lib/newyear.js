// Oud & Nieuw extras: good resolutions from phones and the oliebollen counter.
import crypto from 'node:crypto';
import { load, save } from './store.js';

let data = load('newyear', { resolutions: [], oliebollen: {} }); // oliebollen: key -> { name, n }

const key = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- Goede voornemens ----------
export const resolutions = () => data.resolutions.slice(-100);

export function addResolution(name, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (t.length < 3) return { ok: false, error: 'short' };
  const mine = data.resolutions.filter((r) => key(r.name) === key(name));
  if (mine.length >= 5) return { ok: false, error: 'max' };
  const r = { id: crypto.randomUUID().slice(0, 8), name: String(name || '').trim().slice(0, 24), text: t, at: Date.now() };
  data.resolutions.push(r);
  save('newyear', data);
  return { ok: true, resolution: r };
}

export function removeResolution(id) {
  data.resolutions = data.resolutions.filter((r) => r.id !== id);
  save('newyear', data);
}

export function clearResolutions() {
  data.resolutions = [];
  save('newyear', data);
}

// ---------- Oliebollenteller ----------
export const oliebollen = () =>
  Object.values(data.oliebollen)
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

export function countOliebol(name, delta) {
  const k = key(name);
  if (!k) return { ok: false };
  const o = data.oliebollen[k] || { name: String(name).trim().slice(0, 24), n: 0 };
  o.n = Math.max(0, Math.min(999, o.n + (delta > 0 ? 1 : -1)));
  data.oliebollen[k] = o;
  save('newyear', data);
  return { ok: true, list: oliebollen() };
}

export function clearOliebollen() {
  data.oliebollen = {};
  save('newyear', data);
}
