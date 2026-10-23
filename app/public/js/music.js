// Music search on the screen: find a song and put it in the queue (it plays
// before the rest of the playlist), or find a playlist and play it.
import { $, esc, call, toast } from './ui.js';

let ctx;
let tab = 'tracks';
let results = { tracks: [], playlists: [] };
let mine = null;
let lastQuery = '';
let openPl = null; // playlist shown in detail

export function init(c) {
  ctx = c;
  $('music-open').addEventListener('click', open);
  $('music-close').addEventListener('click', close);
  $('music').addEventListener('click', (e) => e.target.id === 'music' && close());
  $('music-form').addEventListener('submit', search);
  $('music-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mtab]');
    if (!b) return;
    tab = b.dataset.mtab;
    openPl = null;
    if (tab === 'mine' && !mine) loadMine();
    render();
  });
  $('music-results').addEventListener('click', onResult);
}

function open() {
  $('music').classList.add('open');
  openPl = null;
  render();
  if (!lastQuery) setTimeout(() => $('music-q').focus(), 50);
}
function close() {
  $('music').classList.remove('open');
  document.activeElement?.blur?.();
}

async function search(e) {
  e?.preventDefault();
  const q = $('music-q').value.trim();
  if (!q) return;
  lastQuery = q;
  openPl = null;
  if (tab === 'mine') tab = 'tracks';
  $('music-results').innerHTML = '<p class="muted">Zoeken…</p>';
  const res = await call(ctx.socket, 'music:search', { q });
  if (!res?.ok) {
    $('music-results').innerHTML = `<p class="muted">${res?.error === 'login' ? 'Koppel eerst Spotify (instellingen).' : 'Zoeken lukte niet.'}</p>`;
    return;
  }
  results = res;
  render();
}

async function loadMine() {
  $('music-results').innerHTML = '<p class="muted">Laden…</p>';
  const res = await call(ctx.socket, 'music:mine');
  mine = res?.ok ? res.playlists : [];
  if (tab === 'mine') render();
}

const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
const cover = (url) => (url ? `<img src="${esc(url)}" alt="" loading="lazy">` : '<span class="m-noart">♪</span>');

function render() {
  document.querySelectorAll('[data-mtab]').forEach((b) => b.classList.toggle('on', b.dataset.mtab === tab));
  const el = $('music-results');
  if (openPl) return renderPlaylist();
  if (tab === 'tracks') {
    el.innerHTML = results.tracks.length
      ? `<div class="m-tracks">${results.tracks.map((t) => `<div class="m-track">
          ${cover(t.art)}
          <div class="m-meta"><strong>${esc(t.title)}</strong><span>${esc(t.artist)} · ${fmt(t.durationMs || 0)}</span></div>
          <button class="btn primary" data-queue="${esc(t.uri)}" data-title="${esc(t.title)}">+ Wachtrij</button>
        </div>`).join('')}</div>`
      : `<p class="muted">${lastQuery ? 'Geen nummers gevonden.' : 'Zoek een nummer of artiest. Het komt in de wachtrij, vóór de rest van de playlist.'}</p>`;
    return;
  }
  const list = tab === 'mine' ? mine || [] : results.playlists;
  el.innerHTML = list.length
    ? `<div class="m-lists">${list.map((p) => `<button class="m-list" data-pl="${esc(p.id)}">
        ${cover(p.art)}
        <strong>${esc(p.name)}</strong>
        <span>${esc(p.owner)}${p.total != null ? ` · ${p.total} nummers` : ''}</span>
      </button>`).join('')}</div>`
    : `<p class="muted">${tab === 'mine' ? (mine ? 'Geen playlists in dit account.' : 'Laden…') : lastQuery ? 'Geen playlists gevonden.' : 'Zoek een playlist, bijvoorbeeld "borrel" of "90s".'}</p>`;
}

async function renderPlaylist() {
  const p = openPl;
  const el = $('music-results');
  el.innerHTML = `<div class="m-pl">
      <div class="m-pl-head">
        ${cover(p.art)}
        <div class="m-meta"><span class="mono accent">Playlist</span><strong class="display">${esc(p.name)}</strong><span>${esc(p.owner)}${p.total != null ? ` · ${p.total} nummers` : ''}</span></div>
        <div class="m-pl-actions">
          <button class="btn primary big" data-play="${esc(p.id)}">Nu afspelen</button>
          <button class="btn" data-back="1">Terug</button>
        </div>
      </div>
      <ol class="m-preview" id="m-preview"><li class="muted">Laden…</li></ol>
    </div>`;
  const res = await call(ctx.socket, 'music:playlist', { id: p.id });
  if (openPl !== p) return;
  const tracks = res?.tracks;
  $('m-preview').innerHTML = tracks?.length
    ? tracks.map((t) => `<li><span>${esc(t.title)}</span> <em>— ${esc(t.artist)}</em></li>`).join('')
    : '<li class="muted">Voorbeeld niet beschikbaar (lijst van Spotify zelf) — afspelen kan wel.</li>';
}

async function onResult(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.queue) {
    b.disabled = true;
    const res = await call(ctx.socket, 'player:cmd', { action: 'queue', value: b.dataset.queue });
    if (res?.ok) {
      b.textContent = '✓ In de wachtrij';
      toast(`${b.dataset.title} staat in de wachtrij`);
    } else {
      b.disabled = false;
      toast('Lukt niet — speelt de bar-speaker?');
    }
    return;
  }
  if (b.dataset.pl) {
    const list = tab === 'mine' ? mine : results.playlists;
    openPl = list.find((p) => p.id === b.dataset.pl) || null;
    return render();
  }
  if (b.dataset.back) {
    openPl = null;
    return render();
  }
  if (b.dataset.play) {
    b.disabled = true;
    const res = await call(ctx.socket, 'music:playPlaylist', { id: b.dataset.play });
    if (res?.ok) {
      toast(`${openPl?.name || 'Playlist'} speelt nu`);
      close();
    } else {
      b.disabled = false;
      toast('Afspelen lukte niet');
    }
  }
}
