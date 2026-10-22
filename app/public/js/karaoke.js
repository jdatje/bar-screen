// Karaoke: the lyrics of the song that's playing, in time, full screen.
// Album art big and very blurred behind; title and artist at the bottom.
import { $, esc, call } from './ui.js';

let ctx;
let open = false;
let lyrics = { trackId: null, synced: [], plain: null };
let loadingFor = null;
let lastIndex = -2;

export const isOpen = () => open;

export function init(c) {
  ctx = c;
  $('kar-close').addEventListener('click', () => ctx.go('home'));
  setInterval(tick, 150);
}

export function show() {
  open = true;
  $('karaoke').hidden = false;
  lastIndex = -2;
  update(ctx.state.player);
}

export function hide() {
  open = false;
  $('karaoke').hidden = true;
}

// new player state (song change, pause, progress)
export function update(p) {
  if (!open) return;
  const t = p?.track;
  $('kar-bg').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('kar-title').textContent = t ? t.title : 'Niets aan het spelen';
  $('kar-artist').textContent = t ? t.artist : 'Kies "Wexer 2.0" als speaker in Spotify';
  if (!t) {
    lyrics = { trackId: null, synced: [], plain: null };
    $('kar-lines').innerHTML = '<p class="kar-msg">Zet een nummer aan om mee te zingen</p>';
    return;
  }
  if (lyrics.trackId !== t.id && loadingFor !== t.id) load(t.id);
}

async function load(trackId) {
  loadingFor = trackId;
  $('kar-lines').innerHTML = '<p class="kar-msg">Songtekst zoeken…</p>';
  const res = await call(ctx.socket, 'lyrics:get');
  loadingFor = null;
  if (!res || res.trackId !== ctx.state.player?.track?.id) return; // song changed meanwhile
  lyrics = res;
  lastIndex = -2;
  if (res.synced.length) {
    $('kar-lines').innerHTML = res.synced.map((l, i) => `<p class="kar-line" data-i="${i}">${esc(l.text)}</p>`).join('');
  } else if (res.plain) {
    $('kar-lines').innerHTML = `<div class="kar-plain">${esc(res.plain).replace(/\n/g, '<br>')}</div>`;
  } else {
    $('kar-lines').innerHTML = `<p class="kar-msg">${res.instrumental ? 'Dit nummer is instrumentaal' : 'Geen songtekst gevonden voor dit nummer'}</p>`;
  }
}

// where we are in the song right now
function position() {
  const p = ctx.state.player;
  if (!p?.track) return 0;
  return (p.progressMs || 0) + (p.playing ? Date.now() - (p.at || Date.now()) : 0);
}

function tick() {
  if (!open || !lyrics.synced.length) return;
  const ms = position() + 250; // light a line just before it is sung
  let i = -1;
  for (let k = 0; k < lyrics.synced.length; k++) {
    if (lyrics.synced[k].ms <= ms) i = k;
    else break;
  }
  if (i === lastIndex) return;
  lastIndex = i;
  const lines = $('kar-lines').children;
  for (let k = 0; k < lines.length; k++) {
    const d = k - i;
    lines[k].className = `kar-line${d === 0 ? ' now' : d < 0 ? ' past' : ''}${Math.abs(d) > 3 ? ' far' : ''}`;
  }
  // keep the current line in the middle of the screen
  const cur = lines[Math.max(0, i)];
  if (cur) $('kar-lines').style.transform = `translateY(${window.innerHeight * 0.42 - cur.offsetTop - cur.offsetHeight / 2}px)`;
}
