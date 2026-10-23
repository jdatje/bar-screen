// Quiz on the touchscreen: setup (type + options) and the running game.
import { $, esc, call, toast, LETTERS, remaining, confirmBox } from './ui.js';

let ctx;
let opts = null; // options from the server
let type = 'intro';
let draft = {}; // settings per type being edited

const STEPPERS = {
  rounds: { label: 'Rondes', min: 1, max: 6, step: 1 },
  perRound: { label: 'Vragen per ronde', min: 3, max: 20, step: 1 },
  seconds: { label: 'Seconden per vraag', min: 5, max: 60, step: 5 },
  clip: { label: 'Fragment (sec)', min: 3, max: 30, step: 1 },
};
const POP_TYPES = [
  { id: 'year', label: 'Jaartal' },
  { id: 'artist', label: 'Artiest' },
  { id: 'first', label: 'Wat kwam eerst' },
];
// label of a question set in the bar's language
const setLabel = (x) => (opts?.lang === 'en' ? x.en : x.nl);
const setInfo = (x) => (opts?.lang === 'en' ? x.enInfo : x.nlInfo);
function setPicker(title, list, attr, current) {
  const on = list.find((x) => x.id === current) || list[0];
  return `<div class="opt set-pick"><span class="mono accent">${title}</span><div class="chips">
      ${list.map((x) => chip(setLabel(x), `${attr}="${x.id}"`, x.id === on.id)).join('')}
    </div><span class="muted set-info">${esc(setInfo(on))}</span></div>`;
}

export function init(c) {
  ctx = c;
  $('type-cards').addEventListener('click', (e) => {
    const card = e.target.closest('[data-type]');
    if (!card) return;
    type = card.dataset.type;
    renderSetup();
  });
  $('setup-options').addEventListener('click', onOptionClick);
  $('player-chips').addEventListener('click', onPlayerChips);
  $('add-player').addEventListener('submit', onAddPlayer);
  $('start-quiz').addEventListener('click', start);
  $('game-root').addEventListener('click', onGameClick);
  tick();
}

// ================= Setup =================
// pre-select a quiz type (from the Spelletjes hub)
export function setType(t) {
  if (['intro', 'popquiz', 'pubquiz'].includes(t)) type = t;
}

export async function openSetup() {
  $('setup-options').innerHTML = '<p class="muted">Laden…</p>';
  opts = await call(ctx.socket, 'quiz:options');
  draft = structuredClone(opts.defaults);
  renderSetup();
  renderPlayers();
}

const chip = (label, attrs, on, state) =>
  `<button class="chip ${on ? 'on' : ''} ${state === 'out' ? 'out' : ''}" ${attrs}>${esc(label)}</button>`;

function renderSetup() {
  document.querySelectorAll('.type-card').forEach((c) => c.classList.toggle('on', c.dataset.type === type));
  if (!opts) return;
  const s = draft[type];
  const music = type !== 'pubquiz';
  let html = '';

  if (music) {
    if (!opts.spotifyReady) html += `<p class="warn">Spotify is nog niet gekoppeld; muziekspellen werken pas daarna.</p>`;
    html += setPicker('Muziek', opts.musicSets, 'data-mset', s.set || 'hits');
  }
  if (music && s.set === 'spotify') {
    html += `<div class="opt"><span class="mono muted">Genres · tik = mee, nog eens = uitsluiten, niets gekozen = alles</span><div class="chips">
      ${opts.genres.map((g) => chip(g.label, `data-genre="${g.id}"`, s.genres?.[g.id] === 'in', s.genres?.[g.id])).join('')}
    </div></div>`;
    html += `<div class="opt"><span class="mono muted">Decennia · niets gekozen = 70s tot nu</span><div class="chips">
      ${opts.decades.map((d) => chip(d.label, `data-decade="${d.id}"`, s.decades?.includes(d.id))).join('')}
    </div></div>`;
    if (opts.playlists.length) {
      html += `<div class="opt"><span class="mono muted">Eigen playlists</span><div class="chips">
        ${opts.playlists.map((p) => chip(p.name, `data-playlist="${p.id}"`, s.playlists?.includes(p.id))).join('')}
      </div></div>`;
    }
  }
  if (music) {
    if (type === 'popquiz') {
      html += `<div class="opt"><span class="mono muted">Soorten vragen</span><div class="chips">
        ${POP_TYPES.map((t) => chip(t.label, `data-qtype="${t.id}"`, s.types?.includes(t.id))).join('')}
      </div></div>`;
    }
  } else {
    html += setPicker('Vragenset', opts.sets.filter((x) => x.id !== 'own' || opts.bank.own), 'data-source', s.source || 'cafe');
    html += `<div class="opt"><span class="mono muted">Categorieën · niets gekozen = alles</span><div class="chips">
      ${opts.categories.map((c) => chip(c.label, `data-cat="${c.id}"`, s.categories?.includes(c.id))).join('')}
    </div></div>`;
    html += `<div class="opt"><span class="mono muted">Moeilijkheid</span><div class="chips">
      ${chip('Alles', 'data-diff=""', !s.difficulty)}
      ${opts.difficulties.map((d) => chip(d[0].toUpperCase() + d.slice(1), `data-diff="${d}"`, s.difficulty === d)).join('')}
    </div></div>`;
  }

  const steppers = Object.entries(STEPPERS).filter(([k]) => music || k !== 'clip');
  html += `<div class="steppers">${steppers
    .map(
      ([k, cfg]) => `<div class="stepper">
        <span class="mono muted">${cfg.label}</span>
        <div class="stepper-row">
          <button class="btn" data-step="${k}" data-dir="-1" aria-label="${cfg.label} minder">−</button>
          <span class="stepper-val">${s[k]}</span>
          <button class="btn" data-step="${k}" data-dir="1" aria-label="${cfg.label} meer">+</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
  $('setup-options').innerHTML = html;
}

function toggle(list = [], id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function onOptionClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const s = draft[type];
  const d = b.dataset;
  if (d.genre) {
    const cur = s.genres?.[d.genre];
    s.genres = { ...(s.genres || {}) };
    if (!cur) s.genres[d.genre] = 'in';
    else if (cur === 'in') s.genres[d.genre] = 'out';
    else delete s.genres[d.genre];
  }
  if (d.decade) s.decades = toggle(s.decades, d.decade);
  if (d.playlist) s.playlists = toggle(s.playlists, d.playlist);
  if (d.qtype) {
    const next = toggle(s.types, d.qtype);
    if (next.length) s.types = next;
  }
  if (d.cat) s.categories = toggle(s.categories, d.cat);
  if ('diff' in d) s.difficulty = d.diff;
  if (d.source) s.source = d.source;
  if (d.mset) s.set = d.mset;
  if (d.lang) s.lang = d.lang;
  if (d.step) {
    const cfg = STEPPERS[d.step];
    s[d.step] = Math.max(cfg.min, Math.min(cfg.max, Number(s[d.step]) + cfg.step * Number(d.dir)));
  }
  renderSetup();
}

// Everyone on a phone plus names added by hand; tap × to take someone out
export function renderPlayers() {
  const el = $('player-chips');
  if (!el) return;
  const list = (ctx?.state.players || []).filter((p) => p.online || p.manual);
  el.innerHTML = list.length
    ? list.map((p) => `<span class="pchip ${p.online ? '' : 'off'}">${esc(p.name)}${p.online ? '' : ' <small>📵</small>'}<button class="pchip-x" data-remove-player="${esc(p.id)}" aria-label="${esc(p.name)} eruit halen">×</button></span>`).join('')
    : '<span class="muted">Nog niemand — scan de code</span>';
}

async function onPlayerChips(e) {
  const b = e.target.closest('[data-remove-player]');
  if (!b) return;
  const p = (ctx.state.players || []).find((x) => x.id === b.dataset.removePlayer);
  if (!p) return;
  b.closest('.pchip').classList.add('going');
  const res = await call(ctx.socket, 'players:remove', { id: p.id });
  if (!res?.ok) toast('Lukt niet');
}

async function onAddPlayer(e) {
  e.preventDefault();
  const input = $('add-player-name');
  const name = input.value.trim();
  if (!name) return;
  const res = await call(ctx.socket, 'players:add', { name });
  if (res?.ok) input.value = '';
  else toast(res?.error === 'exists' ? 'Die naam doet al mee' : 'Lukt niet');
}

async function start() {
  if (type !== 'pubquiz' && !opts?.spotifyReady) return toast('Koppel eerst Spotify');
  const res = await call(ctx.socket, 'quiz:start', { type, settings: draft[type] });
  if (!res?.ok) toast('Starten lukte niet');
}

// ================= Game =================
const quizCmd = (action, value) => call(ctx.socket, 'quiz:cmd', { action, value });

function header(g) {
  const where =
    g.phase === 'reveal'
      ? `Antwoorden ronde ${g.round} · ${g.reveal.index} van ${g.perRound}`
      : ['scoreboard', 'final'].includes(g.phase)
        ? `${g.typeLabel} · na ronde ${g.round} van ${g.rounds}`
        : `Ronde ${g.round} van ${g.rounds} · ${g.typeLabel} · vraag ${g.qInRound} van ${g.perRound}`;
  return `<div class="g-head"><span class="mono accent">${esc(where)}</span>
    <button class="btn small" data-q="end">Stoppen</button></div>`;
}

function standingsList(list, max = 6) {
  if (!list?.length) return '<p class="muted">Nog geen scores</p>';
  return `<ol class="standings">${list
    .slice(0, max)
    .map((s) => `<li><span>${s.rank}. ${esc(s.name)}</span><span class="accent">${s.score.toLocaleString('nl-NL')}</span></li>`)
    .join('')}</ol>`;
}

function sidePanel(g) {
  return `<aside class="panel g-side">
    <span class="mono accent">Stand</span>
    ${standingsList(g.standings)}
    <div class="g-join">
      <img class="qr" src="${ctx.state.room?.qr || ''}" alt="QR-code om mee te doen">
      <span class="code">${esc(ctx.state.room?.code || '')}</span>
    </div>
  </aside>`;
}

export function renderGame() {
  const g = ctx.state.game;
  const root = $('game-root');
  if (!g?.active) {
    root.innerHTML = '';
    return;
  }
  let html = '';
  switch (g.phase) {
    case 'loading':
      html = `<div class="g-center"><h2 class="display huge">Vragen klaarzetten…</h2><p class="muted">${esc(g.typeLabel)}</p></div>`;
      break;
    case 'error':
      html = `<div class="g-center"><h2 class="display">Dat ging mis</h2><p>${esc(g.error)}</p>
        <button class="btn primary" data-q="end">Terug</button></div>`;
      break;
    case 'question':
    case 'between':
    case 'roundEnd':
      html = questionView(g);
      break;
    case 'reveal':
      html = revealView(g);
      break;
    case 'scoreboard':
    case 'final':
      html = scoreView(g);
      break;
  }
  root.innerHTML = html;
  tick();
}

function questionView(g) {
  const q = g.question;
  const closed = g.phase !== 'question';
  let footer = '';
  if (g.phase === 'question') {
    footer = `<span class="muted big-text">${g.answered} van ${g.online} hebben geantwoord</span>
      <div class="row">
        ${q.audio ? '<button class="btn" data-q="replay">Nog eens afspelen</button>' : ''}
        <button class="btn primary" data-q="stop">Stop de tijd</button>
      </div>`;
  } else if (g.phase === 'between') {
    footer = `<span class="muted big-text">Volgende vraag komt eraan…</span>`;
  } else {
    footer = `<span class="big-text">Ronde ${g.round} zit erop!</span>
      <button class="btn primary big" data-q="reveal">Antwoorden bekijken</button>`;
  }
  return `<div class="g-layout">
    <div class="g-main">
      ${header(g)}
      <div class="g-question">
        <div class="timer ${closed ? 'done' : ''}" id="timer"><span id="timer-val"></span><small>sec</small></div>
        <div>
          ${q.category ? `<span class="mono muted">${esc(q.category)}</span>` : ''}
          <h2 class="display q-text">${esc(q.prompt)}</h2>
          ${q.audio && g.phase === 'question' ? '<div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' : ''}
        </div>
      </div>
      <div class="options ${closed ? 'closed' : ''}">
        ${q.options.map((o, i) => `<div class="option"><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></div>`).join('')}
      </div>
      <div class="g-foot">${footer}</div>
    </div>
    ${sidePanel(g)}
  </div>`;
}

function revealView(g) {
  const r = g.reveal;
  const max = Math.max(1, ...r.distribution);
  const hook = r.hookMs != null ? `${Math.floor(r.hookMs / 60000)}:${String(Math.floor((r.hookMs % 60000) / 1000)).padStart(2, '0')}` : '…';
  return `<div class="g-full">
    ${header(g)}
    <div class="reveal ${r.info.art ? '' : 'no-art'}">
      ${r.info.art ? `<div class="art big" style="background-image:url('${esc(r.info.art)}')"></div>` : ''}
      <div class="reveal-main">
        <span class="mono muted">${esc(r.prompt)}</span>
        <h2 class="display reveal-title">${esc(r.info.title)}</h2>
        <span class="artist">${esc(r.info.sub)}</span>
        ${r.info.note ? `<p class="note">${esc(r.info.note)}</p>` : ''}
        ${
          r.hasAudio
            ? `<div class="row">
                <button class="btn primary big" data-q="playHook">▶ Speel het refrein</button>
                <button class="btn" data-q="hookAdjust" data-v="-5" aria-label="5 seconden eerder">−5 s</button>
                <span class="mono muted">start ${hook}</span>
                <button class="btn" data-q="hookAdjust" data-v="5" aria-label="5 seconden later">+5 s</button>
              </div>`
            : ''
        }
      </div>
      <div class="reveal-side">
        <span class="mono accent">Wie had het goed</span>
        ${
          r.correct.length
            ? `<ol class="standings">${r.correct
                .map((c) => `<li><span>${esc(c.name)}</span><span class="accent">+${c.points} · ${c.secs.replace('.', ',')} s</span></li>`)
                .join('')}</ol>`
            : '<p class="muted">Niemand…</p>'
        }
        <span class="mono accent">Verdeling</span>
        <div class="dist">
          ${r.options
            .map(
              (o, i) => `<div class="dist-row ${i === r.answer ? 'right' : ''}">
                <span class="letter">${LETTERS[i]}</span>
                <span class="dist-label">${esc(o)}</span>
                <div class="dist-bar"><span style="width:${(r.distribution[i] / max) * 100}%"></span></div>
                <span>${r.distribution[i]}</span>
              </div>`
            )
            .join('')}
        </div>
      </div>
    </div>
    <div class="g-foot">
      <button class="btn" data-q="prev">Vorig antwoord</button>
      <button class="btn primary big" data-q="next">${r.index >= g.perRound ? 'Naar de stand' : 'Volgend antwoord'}</button>
    </div>
  </div>`;
}

function scoreView(g) {
  const final = g.phase === 'final';
  const list = g.standings || [];
  const podium = final
    ? `<div class="podium">${[1, 0, 2]
        .map((i) => list[i])
        .filter(Boolean)
        .map((s) => `<div class="podium-step p${s.rank}"><span class="display">${esc(s.name)}</span><span class="mono">${s.score.toLocaleString('nl-NL')}</span><div class="block">${s.rank}</div></div>`)
        .join('')}</div>`
    : '';
  return `<div class="g-full">
    ${header(g)}
    <h2 class="display huge">${final ? 'Eindstand' : 'Tussenstand'}</h2>
    ${podium}
    <ol class="scoreboard">${list
      .slice(final ? 3 : 0, 12)
      .map(
        (s) => `<li><span class="rank">${s.rank}</span><span class="name">${esc(s.name)}</span>
          <span class="delta">+${s.delta.toLocaleString('nl-NL')}</span><span class="score">${s.score.toLocaleString('nl-NL')}</span></li>`
      )
      .join('')}</ol>
    <div class="g-foot">
      <span></span>
      ${final ? '<button class="btn primary big" data-q="end">Terug naar home</button>' : '<button class="btn primary big" data-q="nextRound">Volgende ronde</button>'}
    </div>
  </div>`;
}

async function onGameClick(e) {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const action = b.dataset.q;
  const g = ctx.state.game;
  if (action === 'end' && g.phase !== 'final' && g.phase !== 'error') {
    if (!(await confirmBox('Quiz stoppen?', 'Stoppen'))) return;
  }
  const res = await quizCmd(action, b.dataset.v);
  if (!res?.ok && res?.error) toast(res.error);
}

// Countdown ring
function tick() {
  cancelAnimationFrame(tick.raf);
  const el = $('timer-val');
  const g = ctx?.state.game;
  if (!el || !g) return;
  const left = g.phase === 'question' ? remaining(g) : 0;
  el.textContent = Math.ceil(left / 1000);
  const ring = $('timer');
  const total = (g.seconds || 20) * 1000;
  if (ring) ring.style.setProperty('--p', g.phase === 'question' ? Math.min(1, left / total) : 0);
  if (g.phase === 'question') tick.raf = requestAnimationFrame(tick);
}
