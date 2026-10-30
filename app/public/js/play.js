// Guest phone: join with the room code, answer quiz questions, browse recipes.
import { $, esc, call, applyTheme, LETTERS, remaining } from './ui.js';
import { setLang } from './i18n.js';
import { PARTY_OF_THEME } from './tiles.js';

// straight to a websocket: saves a few slow round trips over the public address
const socket = io({ transports: ['websocket', 'polling'], tryAllTransports: true });
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const ERRORS = { wrong_code: 'Die code klopt niet', no_name: 'Vul een naam in' };

let joined = false;
let tab = 'game';
let game = { active: false };
let playerCount = 0;
let recipeOpen = null;
let theme = 'industrial';
let olie = [];
let inQuiz = false; // the quiz is opt-in: tap "Quiz" in the Spel tab
let botc = { phase: 'setup', seated: [] }; // Blood on the Clocktower: is there a game with me in it?

const params = new URLSearchParams(location.search);
$('code').value = (params.get('code') || store.get('code') || '').toUpperCase();
$('name').value = store.get('name') || '';
applyTheme('industrial');

// ---------- Join ----------
async function join(silent) {
  const code = $('code').value.trim().toUpperCase();
  const name = $('name').value.trim();
  const res = await call(socket, 'phone:join', { code, name, playerId: store.get('playerId') });
  if (!res?.ok) {
    if (!silent) $('error').textContent = ERRORS[res?.error] || 'Er ging iets mis';
    setJoined(false);
    return;
  }
  store.set('code', code);
  store.set('name', name);
  store.set('playerId', res.playerId);
  applyTheme(res.settings?.theme);
  theme = res.settings?.theme || theme;
  setLang(res.settings?.language);
  loadNewYear();
  $('me').textContent = name;
  setJoined(true);
  if (res.botc) botc = res.botc;
  inQuiz = Boolean(res.quiz);
  onGame(res.game);
}

function setJoined(on) {
  joined = on;
  $('join').hidden = on;
  $('tabs').hidden = !on;
  showTab(tab);
}

$('join').addEventListener('submit', (e) => {
  e.preventDefault();
  $('error').textContent = '';
  join(false);
});

// ---------- Saving photos from the wall ----------
// Pick photos, then save them: on phones that can share files (iPhone,
// Android) they go to the share sheet ("Bewaar afbeeldingen"); otherwise as
// a zip. Picked photos are fetched right away, so the share sheet can open
// straight from the tap.
let wall = [];
const picked = new Set();
const blobs = new Map();
const pid = () => store.get('playerId') || '';
const canShareFiles = () => {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }));
  } catch {
    return false;
  }
};

async function openPicker() {
  const res = await fetch('/api/photos', { headers: { 'x-player-id': pid() } }).catch(() => null);
  if (!res?.ok) return flash('De foto\'s laden lukte niet');
  wall = await res.json();
  picked.clear();
  $('pick-grid').innerHTML = wall.length
    ? wall.map((p) => `<button class="p-pick" data-pick="${esc(p.id)}" type="button"><img src="/photos/${esc(p.id)}.jpg" alt="Foto${p.by ? ` van ${esc(p.by)}` : ''}" loading="lazy" decoding="async"><span class="tick">✓</span></button>`).join('')
    : '<p class="muted">Nog geen foto\'s op de muur.</p>';
  $('picker').hidden = false;
  $('tabs').hidden = true;
  document.body.classList.add('picking');
  updatePicked();
}
function closePicker() {
  $('picker').hidden = true;
  $('tabs').hidden = !joined;
  document.body.classList.remove('picking');
}
function fetchBlob(id) {
  if (!blobs.has(id)) blobs.set(id, fetch(`/photos/${id}.jpg`).then((r) => r.blob()).catch(() => null));
  return blobs.get(id);
}
function updatePicked() {
  const n = picked.size;
  $('pick-count').textContent = `${n} gekozen`;
  $('pick-save').disabled = !n;
  $('pick-save').textContent = n ? `Opslaan (${n})` : 'Opslaan';
  $('pick-all').textContent = n && n === wall.length ? 'Geen' : 'Alles';
  document.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', picked.has(b.dataset.pick)));
}
$('save-open').addEventListener('click', openPicker);
$('pick-close').addEventListener('click', closePicker);
$('pick-all').addEventListener('click', () => {
  if (picked.size === wall.length) picked.clear();
  else wall.forEach((p) => picked.add(p.id));
  if (canShareFiles() && picked.size <= 30) picked.forEach(fetchBlob);
  updatePicked();
});
$('pick-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  const id = b.dataset.pick;
  if (picked.has(id)) picked.delete(id);
  else {
    picked.add(id);
    if (canShareFiles()) fetchBlob(id);
  }
  updatePicked();
});
$('pick-save').addEventListener('click', async () => {
  const ids = wall.map((p) => p.id).filter((id) => picked.has(id));
  if (!ids.length) return;
  if (canShareFiles() && ids.length <= 30) {
    const got = await Promise.all(ids.map(fetchBlob));
    const files = got.map((b, i) => b && new File([b], `wexer-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' })).filter(Boolean);
    try {
      if (files.length && navigator.canShare({ files })) {
        await navigator.share({ files });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // closed the share sheet
    }
  }
  // fallback: one zip file
  const a = document.createElement('a');
  a.href = `/api/photos.zip?p=${encodeURIComponent(pid())}&ids=${ids.join(',')}`;
  a.download = 'wexer-fotos.zip';
  document.body.append(a);
  a.click();
  a.remove();
  flash('Download gestart');
});

// ---------- Oud & Nieuw looks: good resolution + oliebollen top 5 ----------
const isNewYear = () => PARTY_OF_THEME[theme] === 'newyear';
async function loadNewYear() {
  if (!isNewYear() || !joined) return;
  const res = await call(socket, 'ny:get');
  olie = res?.oliebollen || [];
  if (!game.active) renderGame();
}
function newYearCard() {
  if (!isNewYear()) return '';
  return `<form class="panel p-ny" id="ny-form" autocomplete="off">
      <span class="mono accent">Jouw goede voornemen</span>
      <input id="ny-text" maxlength="140" placeholder="Bijv. vaker naar de bar">
      <button class="btn primary" type="submit">Op het scherm</button>
    </form>
    ${olie.length ? `<div class="panel p-ny"><span class="mono accent">Oliebollen-top 5</span><ol class="p-olie">${olie.slice(0, 5).map((o) => `<li><span>${esc(o.name)}</span><b>${o.n} 🍩</b></li>`).join('')}</ol></div>` : ''}`;
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'ny-form') return;
  e.preventDefault();
  const text = $('ny-text').value.trim();
  if (!text) return;
  const res = await call(socket, 'ny:resolution', { text });
  if (res?.ok) {
    $('ny-text').value = '';
    flash('Staat op het scherm!');
    navigator.vibrate?.(40);
  } else flash(res?.error === 'max' ? 'Je hebt er al 5, mooi zo' : 'Iets langer graag');
});
socket.on('ny:olie', (list) => {
  olie = list || [];
  if (isNewYear() && !game.active && tab === 'game') {
    const typing = document.activeElement?.id === 'ny-text';
    if (!typing) renderGame();
  }
});

// ---------- Game picker: the quiz and Blood on the Clocktower are opt-in ----------
function quizCard() {
  if (inQuiz)
    return `<div class="panel p-game on"><span class="mono">🧠 Quiz</span><b class="display">Je doet mee</b>
      <span>${game.active ? 'De quiz loopt, de vraag komt zo.' : 'Wacht tot de quiz start: de vragen verschijnen hier.'}</span>
      <button class="btn small" type="button" data-quiz="off">Niet meer meedoen</button></div>`;
  return `<button class="panel p-game" type="button" data-quiz="on"><span class="mono">🧠 Quiz</span><b class="display">${game.active ? 'Er loopt een quiz' : 'Quiz'}</b>
    <span>${game.active ? 'Tik om mee te doen →' : 'Pubquiz, popquiz of intro raden. Tik om in de wachtkamer te gaan →'}</span></button>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-quiz]');
  if (!b) return;
  const res = await call(socket, 'quiz:join', { on: b.dataset.quiz === 'on' });
  if (!res?.ok) return flash('Lukt niet');
  inQuiz = res.quiz;
  navigator.vibrate?.(30);
  onGame(res.game);
});
socket.on('quiz:out', () => {
  inQuiz = false;
  renderGame();
});

const inBotc = () => botc.seated.includes(store.get('playerId'));
function botcCard() {
  const n = botc.seated.length;
  const line = inBotc()
    ? botc.phase === 'setup' ? 'Je doet mee · wacht op de verteller' : 'Het spel loopt'
    : botc.phase === 'setup' ? `De verteller zet klaar · ${n} ${n === 1 ? 'speler' : 'spelers'}` : botc.phase === 'ended' ? 'Klaar voor een nieuw spel' : 'Er loopt een spel';
  return `<a class="panel p-botc" href="/clocktower"><span class="mono">🩸 Blood on the Clocktower</span>
    <b class="display">${inBotc() ? 'Je doet mee' : 'Clocktower'}</b><span>${line} →</span></a>`;
}
socket.on('botc:status', (b) => {
  const was = botc.phase;
  const wasIn = inBotc();
  botc = b || botc;
  // the storyteller starts the game: straight to your token
  if (inBotc() && was === 'setup' && botc.phase === 'night' && tab === 'game' && !game.active) return location.assign('/clocktower');
  if (wasIn !== inBotc() || was !== botc.phase) if (!game.active) renderGame();
});

// ---------- Tabs ----------
function showTab(t) {
  tab = t;
  $('tab-game').hidden = !joined || t !== 'game';
  $('tab-cocktails').hidden = !joined || t !== 'cocktails';
  $('tab-requests').hidden = !joined || t !== 'requests';
  $('tab-photos').hidden = !joined || t !== 'photos';
  if (t === 'requests' && joined) loadMine();
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'cocktails' && joined) loadCocktails();
}
$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) showTab(b.dataset.tab);
});

// ---------- Game ----------
function onGame(g) {
  if (!g) return;
  const wasActive = game.active;
  game = { ...g, receivedAt: Date.now() };
  // jump to the game tab when a quiz starts or a question appears
  if (inQuiz && ((g.active && !wasActive) || g.phase === 'question')) showTab('game');
  renderGame();
}

function renderGame() {
  const el = $('tab-game');
  const g = game;
  if (!g.active || !inQuiz) {
    el.innerHTML = `<span class="mono accent">Verbonden · ${playerCount} ${playerCount === 1 ? 'speler' : 'spelers'} in de kamer</span>
      <h1 class="display p-title">Hoi ${esc(store.get('name') || '')}</h1>
      <p class="big-text" style="margin:0;color:var(--text-2)">Kies waar je aan meedoet.</p>
      <div class="p-games">${quizCard()}${botcCard()}</div>${newYearCard()}`;
    return;
  }
  const head = `<span class="mono accent">${esc(g.typeLabel)} · ronde ${g.round} van ${g.rounds}</span>`;
  switch (g.phase) {
    case 'loading':
      el.innerHTML = `${head}<h1 class="display p-title">Vragen worden klaargezet…</h1>`;
      break;
    case 'error':
      el.innerHTML = `${head}<h1 class="display p-title">Er ging iets mis</h1><p>Kijk naar het scherm.</p>`;
      break;
    case 'question':
    case 'between': {
      const q = g.question;
      const open = g.phase === 'question';
      el.innerHTML = `${head}
        <span class="mono muted">Vraag ${g.qInRound} van ${g.perRound}${q.category ? ` · ${esc(q.category)}` : ''}</span>
        <h1 class="display p-q">${esc(q.prompt)}</h1>
        <div class="timer-line"><span id="p-timer" style="width:${open ? 100 : 0}%"></span></div>
        <div class="p-options">${q.options
          .map((o, i) => `<button class="p-option ${g.myChoice === i ? 'on' : ''}" data-choice="${i}" ${open ? '' : 'disabled'}>
            <span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`)
          .join('')}</div>
        <p class="muted" style="text-align:center;margin:0">${
          open ? (g.myChoice == null ? 'Tik op je antwoord' : 'Doorgegeven · je mag nog wisselen') : 'Tijd is op · volgende vraag komt eraan'
        }</p>`;
      tick();
      break;
    }
    case 'roundEnd':
      el.innerHTML = `${head}<h1 class="display p-title">Ronde klaar!</h1><p class="big-text" style="margin:0">Kijk naar het scherm voor de antwoorden.</p>`;
      break;
    case 'reveal': {
      const r = g.reveal;
      el.innerHTML = `${head}<span class="mono muted">${esc(r.prompt)}</span>
        <div class="p-result ${r.correct ? 'good' : ''}">
          <span class="mono">${r.correct ? 'Goed!' : r.mine ? 'Helaas' : 'Geen antwoord'}</span>
          <span class="p-big">${r.correct ? `+${r.points}` : '0'}</span>
          <span>Antwoord: ${esc(r.answer)}</span>
          ${!r.correct && r.mine ? `<span>Jij zei: ${esc(r.mine)}</span>` : ''}
        </div>`;
      break;
    }
    case 'scoreboard':
    case 'final': {
      const me = g.me;
      el.innerHTML = `${head}<h1 class="display p-title">${g.phase === 'final' ? 'Eindstand' : 'Tussenstand'}</h1>
        ${
          me
            ? `<div class="p-result ${me.rank === 1 ? 'good' : ''}">
                <span class="mono">Jouw plek</span>
                <span class="p-big">#${me.rank} <small style="font-size:24px">van ${me.of}</small></span>
                <span>${me.score.toLocaleString('nl-NL')} punten · deze ronde +${me.delta.toLocaleString('nl-NL')}</span>
              </div>`
            : '<p>Je deed deze ronde niet mee.</p>'
        }`;
      break;
    }
  }
}

$('tab-game').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-choice]');
  if (!b || game.phase !== 'question') return;
  const choice = Number(b.dataset.choice);
  game.myChoice = choice;
  renderGame();
  navigator.vibrate?.(30);
  await call(socket, 'phone:answer', { choice });
});

function tick() {
  cancelAnimationFrame(tick.raf);
  const bar = $('p-timer');
  if (!bar || game.phase !== 'question') return;
  bar.style.width = `${(remaining(game) / ((game.seconds || 20) * 1000)) * 100}%`;
  tick.raf = requestAnimationFrame(tick);
}

// ---------- Cocktails ----------
async function loadCocktails() {
  const el = $('tab-cocktails');
  if (recipeOpen) return renderRecipe(recipeOpen);
  el.innerHTML = '<p class="muted">Laden…</p>';
  const menu = await call(socket, 'cocktails:menu', { status: 'now' });
  if (!menu) return;
  el.innerHTML = `<span class="mono accent">La carte</span>
    <h1 class="display p-title">Vanavond te maken</h1>
    <div class="field"><label for="ck-search">Zoeken</label><input id="ck-search" autocomplete="off"></div>
    <div class="p-list" id="ck-list"></div>`;
  const list = (q = '') =>
    ($('ck-list').innerHTML =
      menu.list
        .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
        .map(
          (d) => `<button class="p-card" data-id="${esc(d.id)}">
            ${d.thumb ? `<img src="${esc(d.thumb)}/small" alt="" loading="lazy">` : ''}
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
              <span class="display">${esc(d.name)}</span>
              <span class="muted" style="font-size:15px">${esc(d.ingredients.join(', '))}</span>
            </div></button>`
        )
        .join('') || '<p class="muted">Niets gevonden</p>');
  list();
  $('ck-search').addEventListener('input', (e) => list(e.target.value));
}

$('tab-cocktails').addEventListener('click', async (e) => {
  if (e.target.closest('[data-back]')) {
    recipeOpen = null;
    return loadCocktails();
  }
  const card = e.target.closest('[data-id]');
  if (!card) return;
  recipeOpen = await call(socket, 'cocktails:recipe', { id: card.dataset.id });
  renderRecipe(recipeOpen);
});

function renderRecipe(r) {
  const el = $('tab-cocktails');
  if (!r) return loadCocktails();
  el.innerHTML = `<button class="btn small" data-back style="align-self:flex-start">← Alle cocktails</button>
    ${r.thumb ? `<img src="${esc(r.thumb)}/medium" alt="" style="width:100%;border-radius:var(--radius)">` : ''}
    <span class="mono accent">${esc(r.glass)}</span>
    <h1 class="display p-title">${esc(r.name)}</h1>
    <ul class="p-ing">${r.ingredients
      .map((i) => `<li class="${i.optional ? 'muted' : ''}"><span class="accent">${esc(i.measure)}</span> ${esc(i.name)}${i.optional ? ' (garnering)' : ''}</li>`)
      .join('')}</ul>
    <ol class="p-steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  window.scrollTo(0, 0);
}

// ---------- Song requests ----------
const REQ_ERRORS = {
  off: 'Verzoekjes staan nu uit',
  already: 'Dat nummer is al aangevraagd',
  too_many: 'Je hebt al 3 verzoekjes open staan',
  search: 'Zoeken lukt nu niet (is Spotify gekoppeld?)',
  join_first: 'Doe eerst mee',
};
const STATUS = { pending: 'Wacht op goedkeuring', queued: 'In de wachtrij 🎉', rejected: 'Niet deze keer' };
let results = [];
let searchTimer = null;

$('req-q').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 400);
});
$('req-form').addEventListener('submit', (e) => {
  e.preventDefault();
  search();
});
async function search() {
  const q = $('req-q').value.trim();
  if (q.length < 2) return ($('req-results').innerHTML = '');
  $('req-results').innerHTML = '<p class="muted">Zoeken…</p>';
  const res = await call(socket, 'request:search', { q });
  if (!res?.ok) return ($('req-results').innerHTML = `<p class="muted">${esc(REQ_ERRORS[res?.error] || 'Er ging iets mis')}</p>`);
  results = res.results;
  $('req-results').innerHTML = results.length
    ? results
        .map(
          (t, i) => `<div class="p-card">
            ${t.art ? `<img src="${esc(t.art)}" alt="" loading="lazy">` : ''}
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1">
              <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</strong>
              <span class="muted" style="font-size:15px">${esc(t.artist)}</span>
            </div>
            <button class="btn small primary" data-req="${i}">Aanvragen</button></div>`
        )
        .join('')
    : '<p class="muted">Niets gevonden</p>';
}
$('req-results').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-req]');
  if (!b) return;
  b.disabled = true;
  const res = await call(socket, 'request:add', { track: results[Number(b.dataset.req)] });
  if (!res?.ok) {
    b.disabled = false;
    return flash(REQ_ERRORS[res?.error] || 'Er ging iets mis');
  }
  b.textContent = '✓';
  navigator.vibrate?.(30);
  renderMine(res.mine);
});
async function loadMine() {
  renderMine(await call(socket, 'request:mine'));
}
function renderMine(list = []) {
  $('req-mine-head').hidden = !list.length;
  $('req-mine').innerHTML = list
    .map((r) => `<div class="p-card"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">
        <strong>${esc(r.track.title)}</strong><span class="muted" style="font-size:15px">${esc(r.track.artist)} · ${esc(STATUS[r.status] || r.status)}</span>
      </div></div>`)
    .join('');
}
function flash(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => t.classList.remove('show'), 2600);
}
socket.on('request:update', renderMine);

// ---------- Photo wall ----------
// Photos are made smaller on the phone (max 1600 px, JPEG) before sending.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('shrink'))), 'image/jpeg', 0.85);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
$('photo-file').addEventListener('change', async () => {
  const files = [...$('photo-file').files].slice(0, 10);
  $('photo-file').value = '';
  let sent = 0;
  for (const f of files) {
    $('photo-status').textContent = `Versturen… (${sent + 1} van ${files.length})`;
    try {
      const blob = await shrink(f);
      const res = await fetch('/api/photos', { method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-player-id': store.get('playerId') || '' }, body: blob });
      if (!res.ok) throw new Error(res.status);
      const { id } = await res.json();
      sent++;
      $('my-photos').insertAdjacentHTML('afterbegin', `<img src="/photos/${esc(id)}.jpg" alt="">`);
    } catch {
      flash('Een foto versturen lukte niet');
    }
  }
  $('photo-status').textContent = sent ? `${sent} ${sent === 1 ? 'foto staat' : "foto's staan"} op de muur 🎉` : '';
  if (sent) navigator.vibrate?.(40);
});

// ---------- Socket ----------
socket.on('connect', () => {
  if ($('code').value && $('name').value && store.get('playerId')) join(true);
});
socket.on('game', onGame);
socket.on('players', (n) => {
  playerCount = n;
  if (!game.active) renderGame();
});
socket.on('settings', (s) => {
  applyTheme(s.theme);
  const was = theme;
  theme = s.theme || theme;
  if (was !== theme) {
    loadNewYear();
    if (!game.active) renderGame();
  }
  setLang(s.language);
});
socket.on('player:removed', () => {
  store.set('playerId', '');
  $('error').textContent = 'Je bent uit het spel gehaald. Doe opnieuw mee als dat een vergissing was.';
  setJoined(false);
});
socket.on('room:closed', () => {
  $('error').textContent = 'Er is een nieuwe kamercode — kijk op het scherm';
  $('code').value = '';
  setJoined(false);
});
