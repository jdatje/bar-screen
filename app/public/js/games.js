// Games: the library on the touchscreen and the full-screen player.
import { $, esc, toast } from './ui.js';

const SYSTEM_LABELS = { n64: 'N64', snes: 'SNES', nes: 'NES', gba: 'GBA', gb: 'Game Boy', segaMD: 'Mega Drive' };
let ctx;
let playing = false;

export const isPlaying = () => playing;

export function init(c) {
  ctx = c;
  $('games-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-game]');
    if (card) launch(card.dataset.game);
  });
  $('game-exit').addEventListener('click', stop);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'wexer:exit-game') stop();
  });
}

export async function open() {
  const grid = $('games-grid');
  grid.innerHTML = '<p class="muted">Laden…</p>';
  let list;
  try {
    const res = await fetch('/games/api/games');
    if (!res.ok) throw new Error(res.status);
    list = await res.json();
  } catch {
    grid.innerHTML = '<p class="warn">De games-container is (nog) niet bereikbaar.</p>';
    return;
  }
  $('games-count').textContent = list.length ? `${list.length} ${list.length === 1 ? 'spel' : 'spellen'}` : '';
  if (!list.length) {
    const url = ctx.state.room?.adminUrl || '/admin';
    grid.innerHTML = `<div class="panel games-empty">
      <h3 class="display">Nog geen spellen</h3>
      <p>Zet je eigen spelbestanden erop via de beheerpagina, tab Games: ${esc(url)}</p>
      ${ctx.state.room?.adminQr ? `<img class="qr" src="${ctx.state.room.adminQr}" alt="QR-code naar de beheerpagina">` : ''}
    </div>`;
    return;
  }
  grid.innerHTML = list
    .map(
      (g) => `<button class="game-card" data-game="${esc(g.id)}">
        <span class="mono accent">${esc(SYSTEM_LABELS[g.system] || g.system)}</span>
        <span class="display">${esc(g.name)}</span>
        <span class="mono muted go">Spelen →</span>
      </button>`
    )
    .join('');
}

function launch(id) {
  playing = true;
  // the music would play over the game: pause it
  if (ctx.state.player?.playing) ctx.socket.emit('player:cmd', { action: 'pause' }, () => {});
  $('game-iframe').src = `/games/play/${encodeURIComponent(id)}`;
  $('game-frame').hidden = false;
  setTimeout(() => $('game-iframe').focus(), 300);
}

export function stop() {
  if (!playing) return;
  playing = false;
  $('game-iframe').src = 'about:blank';
  $('game-frame').hidden = true;
  toast('Spel gestopt');
  window.dispatchEvent(new Event('wexer:activity'));
}
