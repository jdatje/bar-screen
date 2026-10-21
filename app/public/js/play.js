// Guest phone: join with the room code, answer quiz questions, browse recipes.
import { $, esc, call, applyTheme, LETTERS, remaining } from './ui.js';
import { setLang } from './i18n.js';

const socket = io();
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
  setLang(res.settings?.language);
  $('me').textContent = name;
  setJoined(true);
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

// ---------- Tabs ----------
function showTab(t) {
  tab = t;
  $('tab-game').hidden = !joined || t !== 'game';
  $('tab-cocktails').hidden = !joined || t !== 'cocktails';
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
  if ((g.active && !wasActive) || g.phase === 'question') showTab('game');
  renderGame();
}

function renderGame() {
  const el = $('tab-game');
  const g = game;
  if (!g.active) {
    el.innerHTML = `<span class="mono accent">Verbonden</span>
      <h1 class="display p-title">Hoi ${esc(store.get('name') || '')}</h1>
      <p class="big-text" style="margin:0;color:var(--text-2)">Hou dit scherm open. Zodra er een quiz start, verschijnen de vragen hier.</p>
      <p class="mono muted">${playerCount} ${playerCount === 1 ? 'speler' : 'spelers'} in de kamer</p>`;
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
  setLang(s.language);
});
socket.on('room:closed', () => {
  $('error').textContent = 'Er is een nieuwe kamercode — kijk op het scherm';
  $('code').value = '';
  setJoined(false);
});
