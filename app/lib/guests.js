// Guest check-ins: on how many different days a name joined on a phone.
// Only shown on the admin page. A name is one guest (case and spaces ignored).
import { load, save } from './store.js';

let data = load('guests', { guests: {} }); // key -> { name, days: ['2026-10-22', ...], first, last }

const key = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
// the date in Amsterdam, so a night out counts as one day until midnight
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());

export function checkIn(name) {
  const k = key(name);
  if (!k) return;
  const day = today();
  const g = data.guests[k] || { name: String(name).trim(), days: [], first: Date.now(), last: 0 };
  g.last = Date.now();
  if (!g.days.includes(day)) g.days.push(day);
  data.guests[k] = g;
  save('guests', data);
}

export const list = () =>
  Object.entries(data.guests)
    .map(([k, g]) => ({ key: k, name: g.name, days: g.days.length, first: g.first, last: g.last, lastDay: g.days[g.days.length - 1] }))
    .sort((a, b) => b.days - a.days || b.last - a.last);

export function remove(k) {
  delete data.guests[key(k)];
  save('guests', data);
}
