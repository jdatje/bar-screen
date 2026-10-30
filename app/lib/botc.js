// Blood on the Clocktower helper: played in person at the bar table, with
// the phones (joined via the Wexer QR) as each player's token, chats, notes and
// town square, and the grimoire on the storyteller's phone and/or the Wexer.
//
// Character data, night order, jinxes and icons are The Pandemonium
// Institute's toolmaker resources (github.com/ThePandemoniumInstitute/
// botc-release, resources/), used under their Community Created Content Policy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { load, save } from './store.js';

const SEED = path.resolve('data-seed/botc');
const ICON_DIR = path.resolve('public/botc/icons');
const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
export const CUSTOM_IMG_DIR = path.join(DATA_DIR, 'botc-img');
fs.mkdirSync(CUSTOM_IMG_DIR, { recursive: true });

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(SEED, f), 'utf8'));
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- Official data ----------
const ICONS = new Set(fs.readdirSync(ICON_DIR));
const NIGHT = readJson('nightsheet.json');
const ROLES = new Map();
for (const r of readJson('roles.json')) ROLES.set(r.id, decorate({ ...r, official: true }));
const JINXES = [];
for (const j of readJson('jinxes.json')) for (const x of j.jinx || []) JINXES.push({ a: j.id, b: x.id, reason: x.reason });

function iconsOf(id) {
  const pick = (f) => (ICONS.has(f) ? `/botc/icons/${f}` : null);
  const plain = pick(`${id}.webp`);
  return { good: pick(`${id}_g.webp`) || plain, evil: pick(`${id}_e.webp`) || plain };
}

function decorate(r) {
  const icons = r.official ? iconsOf(r.id) : { good: r.image || null, evil: r.imageEvil || r.image || null };
  const generic = (side) => (ICONS.has(`${r.team}_${side}.webp`) ? `/botc/icons/${r.team}_${side}.webp` : ICONS.has(`${r.team}.webp`) ? `/botc/icons/${r.team}.webp` : `/botc/icons/custom_${side}.webp`);
  return {
    id: r.id,
    name: r.name,
    team: r.team,
    edition: r.edition || 'custom',
    ability: r.ability || '',
    flavor: r.flavor || '',
    setup: Boolean(r.setup),
    reminders: [...(r.reminders || []), ...(r.remindersGlobal || [])],
    firstNightReminder: r.firstNightReminder || '',
    otherNightReminder: r.otherNightReminder || '',
    firstNight: r.firstNight || 0,
    otherNight: r.otherNight || 0,
    official: Boolean(r.official),
    icon: { good: icons.good || generic('g'), evil: icons.evil || generic('e') },
  };
}

export const EVIL_TEAMS = ['minion', 'demon'];
const defaultAlign = (team) => (EVIL_TEAMS.includes(team) ? 'evil' : 'good');

// ---------- Scripts ----------
const EDITION_NAMES = { tb: 'Trouble Brewing', bmr: 'Bad Moon Rising', snv: 'Sects & Violets' };
const BUILT_IN = Object.entries(EDITION_NAMES).map(([ed, name]) => ({
  id: ed,
  name,
  author: 'The Pandemonium Institute',
  logo: `/botc/img/${ed}.webp`,
  builtIn: true,
  ids: [...ROLES.values()].filter((r) => r.edition === ed && r.team !== 'traveller').map((r) => r.id),
  custom: {},
}));

let imported = load('botc-scripts', { list: [] }).list;
const saveScripts = () => save('botc-scripts', { list: imported });
export const scripts = () => [...BUILT_IN, ...imported].map(({ id, name, author, logo, builtIn, ids }) => ({ id, name, author, logo, builtIn: Boolean(builtIn), count: ids.length }));
const findScript = (id) => [...BUILT_IN, ...imported].find((s) => s.id === id);

// Download a homebrew character's image once, so it works without internet later
async function fetchImage(url, id) {
  if (!/^https?:\/\//i.test(url || '')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('svg') ? 'svg' : type.includes('gif') ? 'gif' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return null;
    const file = `${norm(id).slice(0, 40) || 'x'}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(CUSTOM_IMG_DIR, file), buf);
    return `/botc/custom/${file}`;
  } catch {
    return null;
  }
}

// Import a script JSON (official script tool format, also community scripts)
export async function importScript(text) {
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return { ok: false, error: 'That is not valid JSON' };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'A script is a JSON list of characters' };
  const meta = data.find((x) => x && typeof x === 'object' && x.id === '_meta') || {};
  const ids = [];
  const custom = {};
  const unknown = [];
  for (const item of data) {
    const raw = typeof item === 'string' ? item : item?.id;
    if (!raw || raw === '_meta') continue;
    const id = norm(raw);
    if (ROLES.has(id) && (typeof item === 'string' || !item.ability)) {
      if (!ids.includes(id)) ids.push(id);
      continue;
    }
    if (typeof item === 'object' && item.name && item.team) {
      const imgs = Array.isArray(item.image) ? item.image : [item.image];
      const good = await fetchImage(imgs[0], id);
      const evil = imgs[1] ? await fetchImage(imgs[1], `${id}e`) : good;
      custom[id] = decorate({ ...item, id, image: good, imageEvil: evil });
      ids.push(id);
    } else unknown.push(raw);
  }
  if (!ids.length) return { ok: false, error: 'No characters found in this script' };
  const script = {
    id: `s-${crypto.randomBytes(4).toString('hex')}`,
    name: String(meta.name || 'Imported script').slice(0, 60),
    author: String(meta.author || '').slice(0, 60),
    logo: (await fetchImage(meta.logo, 'logo')) || '/botc/img/custom.webp',
    ids,
    custom,
  };
  imported.push(script);
  saveScripts();
  return { ok: true, script: { id: script.id, name: script.name, count: ids.length }, unknown };
}

export function deleteScript(id) {
  imported = imported.filter((s) => s.id !== id);
  saveScripts();
  return { ok: true };
}

// ---------- Game state ----------
const blank = () => ({
  scriptId: 'tb',
  phase: 'setup', // setup | night | day | ended
  night: 0,
  day: 0,
  seats: [], // { id, playerId, name, role, shown, align, dead, ghost, reminders: [{ role, label }] }
  bluffs: [],
  timer: { minutes: 8, endsAt: 0, left: 8 * 60000, running: false },
  rules: { lockStChat: false, autoTimer: true },
  log: [],
  stNotes: '',
  winner: null,
  reveal: false,
  chats: {}, // 'a|b' -> [{ from, text, t }]
  notes: {}, // playerId -> text
  guesses: {}, // playerId -> { seatId: { role, note } }
});
let g = { ...blank(), ...load('botc', blank()) };
let tokens = new Set(load('botc-st', { tokens: [] }).tokens);
let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save('botc', g), 400);
};
const saveTokens = () => save('botc-st', { tokens: [...tokens].slice(-20) });

const script = () => findScript(g.scriptId) || BUILT_IN[0];
export function role(id) {
  if (!id) return null;
  return script().custom?.[id] || ROLES.get(id) || null;
}
const scriptRoles = () => script().ids.map(role).filter(Boolean);
const travellersAndFabled = () => [...ROLES.values()].filter((r) => r.team === 'traveller' || r.team === 'fabled');

function addLog(text) {
  g.log.push({ t: Date.now(), phase: g.phase === 'day' ? `Day ${g.day}` : g.phase === 'night' ? `Night ${g.night}` : g.phase, text });
  if (g.log.length > 400) g.log.shift();
}

// player counts per team (official table), with setup changes like the Baron
const COUNTS = { 5: [3, 0, 1, 1], 6: [3, 1, 1, 1], 7: [5, 0, 1, 1], 8: [5, 1, 1, 1], 9: [5, 2, 1, 1], 10: [7, 0, 2, 1], 11: [7, 1, 2, 1], 12: [7, 2, 2, 1], 13: [9, 0, 3, 1], 14: [9, 1, 3, 1], 15: [9, 2, 3, 1] };
export function counts(n) {
  const c = COUNTS[Math.min(15, Math.max(5, n))];
  return { townsfolk: c[0], outsider: c[1], minion: c[2], demon: c[3] };
}
function outsiderShift(r) {
  const m = /\[([^\]]*)\]/.exec(r?.ability || '');
  if (!m) return 0;
  const o = /([+\-−–])\s?(\d)[^\]]*?Outsider/i.exec(m[1]);
  return o ? (o[1] === '+' ? 1 : -1) * Number(o[2]) : 0;
}
const setupNote = (r) => (/\[([^\]]*)\]/.exec(r?.ability || '') || [])[1] || '';

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pickN = (list, n) => shuffle([...list]).slice(0, Math.max(0, n));

// random bag for the seated players, following the counts table
function randomBag() {
  const n = g.seats.length;
  const c = counts(n);
  const by = (t) => scriptRoles().filter((r) => r.team === t);
  const demons = pickN(by('demon'), c.demon);
  const minions = pickN(by('minion'), c.minion);
  let shift = 0;
  for (const r of [...demons, ...minions]) shift += outsiderShift(r);
  const outsiders = pickN(by('outsider'), Math.max(0, c.outsider + shift));
  const townsfolk = pickN(by('townsfolk'), n - demons.length - minions.length - outsiders.length);
  return [...townsfolk, ...outsiders, ...minions, ...demons].map((r) => r.id);
}

// characters who don't know their real character: what does their phone show?
const THINKS = { drunk: 'townsfolk', lunatic: 'demon', marionette: null };
function autoShown(seat, used) {
  const want = THINKS[seat.role];
  if (!want) return null;
  const options = scriptRoles().filter((r) => r.team === want && !used.has(r.id));
  return options.length ? options[crypto.randomInt(options.length)].id : null;
}
const inPlay = () => new Set(g.seats.flatMap((s) => [s.role, s.shown]).filter(Boolean));

function dealRoles(list) {
  const bag = shuffle([...list]);
  g.seats.forEach((s, i) => {
    s.role = bag[i] || null;
    s.shown = null;
    s.align = defaultAlign(role(s.role)?.team);
    s.reminders = [];
  });
  const used = inPlay();
  for (const s of g.seats) {
    s.shown = autoShown(s, used);
    if (s.shown) used.add(s.shown);
  }
}

// ---------- Views ----------
const pub = (r) => r && { id: r.id, name: r.name, team: r.team, ability: r.ability, icon: r.icon, reminders: r.reminders, setup: r.setup, setupNote: setupNote(r) };
function timerView() {
  const t = g.timer;
  return { minutes: t.minutes, running: t.running, endsAt: t.endsAt, left: t.running ? Math.max(0, t.endsAt - Date.now()) : t.left, now: Date.now() };
}
function jinxesFor(ids) {
  const set = new Set(ids);
  return JINXES.filter((j) => set.has(j.a) && set.has(j.b)).map((j) => ({ a: pub(role(j.a) || ROLES.get(j.a)), b: pub(role(j.b) || ROLES.get(j.b)), reason: j.reason }));
}
function scriptView() {
  const s = script();
  return { id: s.id, name: s.name, author: s.author, logo: s.logo, roles: scriptRoles().map(pub), jinxes: jinxesFor(s.ids) };
}
const chatLocked = () => g.phase === 'night';
const base = () => ({
  phase: g.phase,
  night: g.night,
  day: g.day,
  timer: timerView(),
  winner: g.winner,
  chatLocked: chatLocked(),
  stChatLocked: chatLocked() && g.rules.lockStChat,
  alive: g.seats.filter((s) => !s.dead).length,
  total: g.seats.length,
});
const publicSeat = (s) => ({ id: s.id, name: s.name, playerId: s.playerId, dead: s.dead, ghost: s.ghost });
const fullSeat = (s) => ({ ...publicSeat(s), role: pub(role(s.role)), shown: pub(role(s.shown)), align: s.align, reminders: s.reminders });

export function publicView() {
  return {
    ...base(),
    script: { name: script().name, logo: script().logo },
    seats: g.reveal ? g.seats.map(fullSeat) : g.seats.map(publicSeat),
    reveal: g.reveal,
  };
}

export function playerView(pid) {
  const seat = g.seats.find((s) => s.playerId === pid);
  const started = g.phase !== 'setup';
  const shownId = seat && started ? seat.shown || seat.role : null;
  return {
    ...base(),
    script: scriptView(),
    seats: g.reveal ? g.seats.map(fullSeat) : g.seats.map(publicSeat),
    reveal: g.reveal,
    me: seat
      ? { seatId: seat.id, name: seat.name, dead: seat.dead, ghost: seat.ghost, role: pub(role(shownId)), align: started ? (seat.shown && THINKS[seat.role] === 'townsfolk' ? 'good' : seat.align) : null }
      : null,
    notes: g.notes[pid] || '',
    guesses: g.guesses[pid] || {},
  };
}

// the night order for tonight: only characters in play (also what a Drunk thinks)
function nightOrder() {
  const first = g.night <= 1;
  const key = first ? 'firstNight' : 'otherNight';
  const order = [...NIGHT[key]];
  // homebrew characters with their own night number
  for (const r of scriptRoles()) if (!r.official && r[key] > 0 && !order.includes(r.id)) order.splice(Math.min(order.length - 1, Math.round(r[key])), 0, r.id);
  const SPECIAL = {
    dusk: { name: 'Dusk', text: 'Check that all eyes are closed. Some Travellers & Fabled act now.' },
    minioninfo: { name: 'Minion info', text: 'If there are 7 or more players, wake all Minions: show the "This is the Demon" card and point to the Demon. Then put them to sleep.' },
    demoninfo: { name: 'Demon info', text: 'If there are 7 or more players, wake the Demon: show "These are your minions" and point to each Minion. Then show "These characters are not in play" with the 3 bluffs.' },
    dawn: { name: 'Dawn', text: 'Wait a few seconds. Call for eyes open.' },
  };
  const out = [];
  for (const id of order) {
    if (SPECIAL[id]) {
      if ((id === 'minioninfo' || id === 'demoninfo') && g.seats.length < 7) continue;
      out.push({ id, special: true, name: SPECIAL[id].name, text: SPECIAL[id].text, seats: [] });
      continue;
    }
    const seats = g.seats.filter((s) => s.role === id || s.shown === id);
    if (!seats.length) continue;
    const r = role(id) || ROLES.get(id);
    const text = (first ? r?.firstNightReminder : r?.otherNightReminder) || '';
    if (!text) continue;
    out.push({
      id,
      name: r.name,
      icon: r.icon,
      team: r.team,
      text,
      seats: seats.map((s) => ({ name: s.name, dead: s.dead, really: s.role !== id ? role(s.role)?.name : null })),
    });
  }
  return { first, list: out };
}

export function stView() {
  const used = inPlay();
  return {
    ...base(),
    scripts: scripts(),
    scriptId: g.scriptId,
    script: scriptView(),
    extras: travellersAndFabled().map(pub),
    seats: g.seats.map(fullSeat),
    bluffs: g.bluffs.map((id) => pub(role(id))).filter(Boolean),
    bluffOptions: scriptRoles().filter((r) => ['townsfolk', 'outsider'].includes(r.team) && !used.has(r.id) && !(r.id in THINKS)).map((r) => r.id),
    counts: counts(g.seats.length),
    rules: g.rules,
    night: g.night,
    nightOrder: g.phase === 'night' ? nightOrder() : null,
    log: g.log.slice(-200),
    stNotes: g.stNotes,
    reveal: g.reveal,
  };
}

// ---------- Sockets ----------
let io = null;
let helpers = {};

export function broadcast() {
  if (!io) return;
  io.to('botc-st').emit('botc:st', stView());
  io.to('botc-pub').emit('botc:pub', publicView());
  // every phone in the room: seated players get their token, the others the join button
  for (const p of helpers.roomPlayers?.() || []) io.to(`botc-p:${p.id}`).emit('botc:me', playerView(p.id));
  // phones that aren't seated still see the public state (and the join banner)
  io.to('phones').emit('botc:status', { phase: g.phase, seated: g.seats.map((s) => s.playerId).filter(Boolean) });
  persist();
}

const chatKey = (a, b) => [a, b].sort().join('|');
function chatsFor(me) {
  const out = {};
  for (const [key, list] of Object.entries(g.chats)) {
    const [a, b] = key.split('|');
    if (a === me || b === me) out[a === me ? b : a] = list;
  }
  return out;
}

export function status() {
  return { phase: g.phase, seated: g.seats.map((s) => s.playerId).filter(Boolean) };
}

export function attach(server, h) {
  io = server;
  helpers = h;
}

export function register(socket) {
  const pid = () => socket.data.playerId;
  const isST = () => Boolean(socket.data.botcST);
  const seatOf = (id) => g.seats.find((s) => s.id === id);
  const st = (fn) => (p = {}, ack) => {
    if (!isST()) return ack?.({ ok: false, error: 'not_storyteller' });
    const res = fn(p || {});
    broadcast();
    ack?.(res || { ok: true });
  };

  socket.on('botc:hello', ({ token } = {}, ack) => {
    socket.join('botc-pub');
    if (pid()) socket.join(`botc-p:${pid()}`);
    if (token && tokens.has(token)) {
      socket.data.botcST = true;
      socket.join('botc-st');
    }
    ack?.({ ok: true, st: isST() ? stView() : null, me: pid() ? playerView(pid()) : null, pub: publicView(), chats: pid() ? chatsFor(pid()) : isST() ? chatsFor('st') : {} });
  });

  socket.on('botc:login', ({ pin } = {}, ack) => {
    if (!helpers.pinOk(pin)) return ack?.({ ok: false, error: 'Wrong code' });
    const token = crypto.randomBytes(16).toString('hex');
    tokens.add(token);
    saveTokens();
    socket.data.botcST = true;
    socket.join('botc-st');
    ack?.({ ok: true, token, st: stView(), chats: chatsFor('st') });
  });
  socket.on('botc:logout', ({ token } = {}, ack) => {
    tokens.delete(token);
    saveTokens();
    socket.data.botcST = false;
    socket.leave('botc-st');
    ack?.({ ok: true });
  });

  // ----- Player data (private) -----
  socket.on('botc:notes', ({ text } = {}, ack) => {
    if (!pid()) return ack?.({ ok: false });
    g.notes[pid()] = String(text || '').slice(0, 20000);
    persist();
    ack?.({ ok: true });
  });
  socket.on('botc:guess', ({ seatId, role: r, note } = {}, ack) => {
    if (!pid()) return ack?.({ ok: false });
    const mine = (g.guesses[pid()] ||= {});
    if (!r && !note) delete mine[seatId];
    else mine[seatId] = { role: r ? norm(r) : null, note: String(note || '').slice(0, 200) };
    persist();
    ack?.({ ok: true, guesses: mine });
  });

  // ----- Chats: truly private between two players; the storyteller is 'st' -----
  socket.on('botc:send', ({ to, text } = {}, ack) => {
    const me = isST() ? 'st' : pid();
    if (!me) return ack?.({ ok: false });
    const clean = String(text || '').trim().slice(0, 1000);
    if (!clean) return ack?.({ ok: false });
    const seated = (id) => g.seats.some((s) => s.playerId === id);
    if (me !== 'st') {
      if (!seated(me)) return ack?.({ ok: false, error: 'You are not in this game' });
      if (to !== 'st' && !seated(to)) return ack?.({ ok: false });
      if (to === me) return ack?.({ ok: false });
      if (chatLocked() && (to !== 'st' || g.rules.lockStChat)) return ack?.({ ok: false, error: 'Chats are locked at night' });
    } else if (!seated(to)) return ack?.({ ok: false });
    const key = chatKey(me, to);
    const msg = { from: me, to, text: clean, t: Date.now() };
    (g.chats[key] ||= []).push(msg);
    if (g.chats[key].length > 300) g.chats[key].shift();
    persist();
    const target = (id) => (id === 'st' ? 'botc-st' : `botc-p:${id}`);
    io.to(target(me)).to(target(to)).emit('botc:msg', msg);
    ack?.({ ok: true });
  });

  // ----- Storyteller -----
  socket.on('botc:script', st(({ id }) => {
    if (g.phase !== 'setup' || !findScript(id)) return { ok: false };
    g.scriptId = id;
    g.bluffs = [];
    for (const s of g.seats) Object.assign(s, { role: null, shown: null, align: 'good', reminders: [] });
  }));
  socket.on('botc:import', async ({ text } = {}, ack) => {
    if (!isST()) return ack?.({ ok: false });
    const res = await importScript(text);
    broadcast();
    ack?.(res);
  });
  socket.on('botc:deleteScript', st(({ id }) => {
    if (g.scriptId === id) g.scriptId = 'tb';
    return deleteScript(id);
  }));

  // seats: the room's players (joined phones and names added by hand)
  socket.on('botc:roomPlayers', (_p, ack) => ack?.(isST() ? helpers.roomPlayers() : []));
  socket.on('botc:seats', st(({ ids }) => {
    if (g.phase !== 'setup' || !Array.isArray(ids)) return { ok: false };
    const room = new Map(helpers.roomPlayers().map((p) => [p.id, p]));
    g.seats = ids.filter((id) => room.has(id)).slice(0, 20).map((id) => {
      const old = g.seats.find((s) => s.playerId === id);
      return old || { id: crypto.randomBytes(4).toString('hex'), playerId: id, name: room.get(id).name, role: null, shown: null, align: 'good', dead: false, ghost: true, reminders: [] };
    });
    for (const s of g.seats) s.name = room.get(s.playerId)?.name || s.name;
  }));
  // players join (or leave) the game themselves while the storyteller sets up
  socket.on('botc:join', ({ on } = {}, ack) => {
    const id = pid();
    if (!id) return ack?.({ ok: false });
    if (g.phase !== 'setup') return ack?.({ ok: false, error: 'The game has already started' });
    const room = helpers.roomPlayers().find((p) => p.id === id);
    if (!room) return ack?.({ ok: false });
    const seated = g.seats.some((s) => s.playerId === id);
    if (on !== false && !seated) {
      if (g.seats.length >= 20) return ack?.({ ok: false, error: 'The table is full' });
      g.seats.push({ id: crypto.randomBytes(4).toString('hex'), playerId: id, name: room.name, role: null, shown: null, align: 'good', dead: false, ghost: true, reminders: [] });
    }
    if (on === false) g.seats = g.seats.filter((s) => s.playerId !== id);
    broadcast();
    ack?.({ ok: true });
  });
  socket.on('botc:addName', (p = {}, ack) => {
    if (!isST()) return ack?.({ ok: false });
    ack?.(helpers.addManual(String(p.name || '')));
  });
  socket.on('botc:move', st(({ seatId, dir }) => {
    const i = g.seats.findIndex((s) => s.id === seatId);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= g.seats.length) return { ok: false };
    [g.seats[i], g.seats[j]] = [g.seats[j], g.seats[i]];
  }));
  socket.on('botc:shuffleSeats', st(() => {
    if (g.phase !== 'setup') return { ok: false };
    shuffle(g.seats);
  }));
  socket.on('botc:randomRoles', st(() => {
    if (g.seats.length < 5) return { ok: false, error: 'At least 5 players' };
    dealRoles(randomBag());
    g.bluffs = [];
  }));
  socket.on('botc:dealRoles', st(({ ids }) => {
    if (!Array.isArray(ids) || ids.length !== g.seats.length) return { ok: false, error: `Pick exactly ${g.seats.length} characters` };
    const list = ids.map(norm).filter((id) => role(id) || ROLES.get(id));
    if (list.length !== g.seats.length) return { ok: false, error: 'Unknown character in the list' };
    dealRoles(list);
    g.bluffs = [];
  }));
  socket.on('botc:seat', st(({ seatId, patch = {} }) => {
    const s = seatOf(seatId);
    if (!s) return { ok: false };
    if ('role' in patch) {
      const r = role(patch.role) || ROLES.get(patch.role);
      const before = role(s.role)?.name;
      s.role = r ? r.id : null;
      s.align = defaultAlign(r?.team);
      if (!THINKS[s.role]) s.shown = null;
      else if (!s.shown) s.shown = autoShown(s, inPlay());
      if (g.phase !== 'setup') addLog(`${s.name}: ${before || '—'} → ${r?.name || '—'}`);
    }
    if ('shown' in patch) {
      const r = role(patch.shown);
      s.shown = r ? r.id : null;
      if (g.phase !== 'setup') addLog(`${s.name} now sees: ${r?.name || 'their real character'}`);
    }
    if ('align' in patch && ['good', 'evil'].includes(patch.align)) {
      s.align = patch.align;
      if (g.phase !== 'setup') addLog(`${s.name} is now ${patch.align}`);
    }
    if ('dead' in patch) {
      s.dead = Boolean(patch.dead);
      if (!s.dead) s.ghost = true;
      addLog(`${s.name} ${s.dead ? 'died' : 'is alive again'}`);
    }
    if ('ghost' in patch) {
      s.ghost = Boolean(patch.ghost);
      if (!s.ghost) addLog(`${s.name} used their ghost vote`);
    }
  }));
  socket.on('botc:reminder', st(({ seatId, add, remove }) => {
    const s = seatOf(seatId);
    if (!s) return { ok: false };
    if (add && s.reminders.length < 12) s.reminders.push({ role: norm(add.role) || null, label: String(add.label || '').slice(0, 30) });
    if (Number.isInteger(remove)) s.reminders.splice(remove, 1);
  }));
  socket.on('botc:bluffs', st(({ ids }) => {
    g.bluffs = (Array.isArray(ids) ? ids : []).map(norm).filter((id) => role(id)).slice(0, 3);
  }));
  socket.on('botc:rules', st((p) => {
    if (typeof p.lockStChat === 'boolean') g.rules.lockStChat = p.lockStChat;
    if (typeof p.autoTimer === 'boolean') g.rules.autoTimer = p.autoTimer;
  }));
  socket.on('botc:notesST', (p = {}, ack) => {
    if (!isST()) return ack?.({ ok: false });
    g.stNotes = String(p.text || '').slice(0, 50000);
    persist();
    socket.to('botc-st').emit('botc:stNotes', g.stNotes);
    ack?.({ ok: true });
  });
  socket.on('botc:log', st(({ text }) => {
    if (String(text || '').trim()) addLog(String(text).trim().slice(0, 300));
  }));

  // ----- Phases and the day timer -----
  socket.on('botc:start', st(() => {
    if (g.seats.length < 5) return { ok: false, error: 'At least 5 players' };
    if (g.seats.some((s) => !s.role)) return { ok: false, error: 'Give everyone a character first' };
    const drunk = g.seats.find((s) => THINKS[s.role] && !s.shown && s.role !== 'marionette');
    if (drunk) return { ok: false, error: `Choose what ${drunk.name} (${role(drunk.role).name}) sees first` };
    Object.assign(g, { phase: 'night', night: 1, day: 0, winner: null, reveal: false, chats: {}, notes: {}, guesses: {}, log: [] });
    for (const s of g.seats) Object.assign(s, { dead: false, ghost: true });
    g.timer = { ...g.timer, running: false, endsAt: 0, left: g.timer.minutes * 60000 };
    addLog(`Game started: ${script().name}, ${g.seats.length} players`);
    io.to('screen').emit('botc:started');
  }));
  socket.on('botc:phase', st(({ to }) => {
    if (g.phase === 'setup' || g.phase === 'ended') return { ok: false };
    if (to === 'day' && g.phase === 'night') {
      g.phase = 'day';
      g.day = g.night;
      addLog('Dawn');
      if (g.rules.autoTimer) startTimer();
    } else if (to === 'night' && g.phase === 'day') {
      g.phase = 'night';
      g.night = g.day + 1;
      pauseTimer();
      addLog('Dusk');
    }
  }));
  const startTimer = () => {
    const t = g.timer;
    t.endsAt = Date.now() + (t.left > 0 ? t.left : t.minutes * 60000);
    t.running = true;
  };
  const pauseTimer = () => {
    const t = g.timer;
    if (t.running) t.left = Math.max(0, t.endsAt - Date.now());
    t.running = false;
  };
  socket.on('botc:timer', st(({ action, minutes }) => {
    const t = g.timer;
    if (action === 'start') startTimer();
    if (action === 'pause') pauseTimer();
    if (action === 'reset') {
      t.running = false;
      t.left = t.minutes * 60000;
    }
    if (action === 'add') {
      if (t.running) t.endsAt += 60000;
      else t.left += 60000;
    }
    if (action === 'minutes' && minutes >= 1 && minutes <= 60) {
      t.minutes = Math.round(minutes);
      if (!t.running) t.left = t.minutes * 60000;
    }
  }));
  socket.on('botc:end', st(({ winner }) => {
    if (g.phase === 'setup') return { ok: false };
    g.winner = ['good', 'evil'].includes(winner) ? winner : null;
    g.phase = 'ended';
    pauseTimer();
    g.reveal = true;
    addLog(g.winner ? `${g.winner === 'good' ? 'Good' : 'Evil'} wins` : 'Game ended');
  }));
  socket.on('botc:reveal', st(({ on }) => {
    g.reveal = Boolean(on);
  }));
  socket.on('botc:newGame', st(() => {
    const keep = { scriptId: g.scriptId, timer: { ...g.timer, running: false, left: g.timer.minutes * 60000 }, rules: g.rules, stNotes: g.stNotes };
    const seats = g.seats.map((s) => ({ ...s, role: null, shown: null, align: 'good', dead: false, ghost: true, reminders: [] }));
    g = { ...blank(), ...keep, seats };
  }));
}

// a player was taken out of the room: drop their seat while setting up
export function playerRemoved(pid) {
  if (g.phase === 'setup') g.seats = g.seats.filter((s) => s.playerId !== pid);
  broadcast();
}
export function playerRenamed(pid, name) {
  const s = g.seats.find((x) => x.playerId === pid);
  if (s && s.name !== name) {
    s.name = name;
    broadcast();
  }
}
