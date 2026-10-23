// Credits per name (for something in the bar). Managed on the admin page only:
// add any number to a name, take one off at a time. A name is one person
// (case and spaces ignored). Every change is kept in a short history.
import { load, save } from './store.js';

let data = load('credits', { people: {} }); // key -> { name, credits, log: [{ t, d }] }

const key = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const list = () =>
  Object.entries(data.people)
    .map(([k, p]) => ({ key: k, name: p.name, credits: p.credits, last: p.log[p.log.length - 1] || null, log: p.log.slice(-5).reverse() }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

// amount can be negative; the total never goes below 0
export function change(name, amount) {
  const k = key(name);
  const d = Math.trunc(Number(amount));
  if (!k) return { ok: false, error: 'no_name' };
  if (!d || Math.abs(d) > 1000) return { ok: false, error: 'amount' };
  const p = data.people[k] || { name: String(name).trim().slice(0, 40), credits: 0, log: [] };
  if (p.credits + d < 0) return { ok: false, error: 'empty', credits: p.credits };
  p.credits += d;
  p.log = [...p.log, { t: Date.now(), d }].slice(-50);
  data.people[k] = p;
  save('credits', data);
  return { ok: true, name: p.name, credits: p.credits };
}

export function remove(k) {
  delete data.people[key(k)];
  save('credits', data);
}
