// Games: the library on the touchscreen and the full-screen player.
import { $, esc, toast } from './ui.js';

const SYSTEM_LABELS = { n64: 'N64', snes: 'SNES', nes: 'NES', gba: 'GBA', gb: 'Game Boy', segaMD: 'Mega Drive' };
let ctx;
let playing = false;
let musicBefore = null; // Spotify volume before the game, restored afterwards

export const isPlaying = () => playing;

export function init(c) {
  ctx = c;
  $('games-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-game]');
    if (card) launch(card.dataset.game);
  });
  $('game-exit').addEventListener('click', stop);
  // volume overlay: music (Spotify) and game sound
  $('game-vol-btn').addEventListener('click', () => ($('game-vol').hidden = !$('game-vol').hidden));
  for (const id of ['vol-music', 'vol-game']) {
    $(id).addEventListener('input', () => {
      $(`${id}-val`).textContent = `${$(id).value}%`;
      if (id === 'vol-game') sendGameVolume(Number($(id).value));
    });
    $(id).addEventListener('change', () => {
      const music = Number($('vol-music').value);
      const game = Number($('vol-game').value);
      if (id === 'vol-music') ctx.socket.emit('player:cmd', { action: 'setVolume', value: music }, () => {});
      ctx.socket.emit('gamevol:set', { music, game }, (r) => r?.ok && (ctx.state.settings.gameVolume = r.gameVolume));
    });
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'wexer:exit-game') stop();
    if (e.data?.type === 'wexer:game-started') sendGameVolume(Number($('vol-game').value));
  });
}

// Which controllers the browser sees (it only shows them after a button press)
let padTimer = null;
function watchPads() {
  clearInterval(padTimer);
  padTimer = setInterval(() => {
    if (ctx.view() !== 'games') return clearInterval(padTimer);
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pressed = pads.map((p) => p.buttons.some((b) => b.pressed));
    $('pads').textContent = pads.length
      ? `🎮 ${pads.length} ${pads.length === 1 ? 'controller' : 'controllers'} klaar · ${pads.map((p, i) => `speler ${i + 1}${pressed[i] ? ' ●' : ''}`).join(' · ')}`
      : '🎮 Druk op een knop van je controller om hem te testen';
    $('pads').classList.toggle('ok', pads.length > 0);
    navigate(pads);
  }, 100);
}

// choose a game with the D-pad, start it with A or START
let focus = 0;
let held = new Set();
function navigate(pads) {
  if (playing) return;
  const now = new Set();
  for (const p of pads) p.buttons.forEach((b, i) => b.pressed && now.add(i));
  const fresh = [...now].filter((i) => !held.has(i));
  held = now;
  const cards = [...document.querySelectorAll('#games-grid .game-card')];
  if (!cards.length || !fresh.length) return;
  const cols = Math.max(1, Math.round($('games-grid').clientWidth / cards[0].offsetWidth));
  for (const i of fresh) {
    if (i === 14) focus -= 1;
    if (i === 15) focus += 1;
    if (i === 12) focus -= cols;
    if (i === 13) focus += cols;
    if (i === 0 || i === 9) return launch(cards[Math.min(Math.max(focus, 0), cards.length - 1)].dataset.game);
  }
  focus = Math.min(Math.max(focus, 0), cards.length - 1);
  cards.forEach((c, k) => c.classList.toggle('focus', k === focus));
  cards[focus].scrollIntoView({ block: 'nearest' });
}

export async function open() {
  watchPads();
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

function sendGameVolume(v) {
  $('game-iframe').contentWindow?.postMessage({ type: 'wexer:volume', value: v / 100 }, location.origin);
}

function launch(id) {
  playing = true;
  // music keeps playing, quieter; the game starts at its own volume
  const vol = { music: 75, game: 25, ...(ctx.state.settings.gameVolume || {}) };
  $('vol-music').value = vol.music;
  $('vol-game').value = vol.game;
  $('vol-music-val').textContent = `${vol.music}%`;
  $('vol-game-val').textContent = `${vol.game}%`;
  $('game-vol').hidden = true;
  musicBefore = ctx.state.player?.volume ?? null;
  if (ctx.state.player?.playing) ctx.socket.emit('player:cmd', { action: 'setVolume', value: vol.music }, () => {});
  $('game-iframe').src = `/games/play/${encodeURIComponent(id)}?vol=${vol.game}`;
  $('game-frame').hidden = false;
  setTimeout(() => $('game-iframe').focus(), 300);
}

export function stop() {
  if (!playing) return;
  playing = false;
  // buttons still held from SELECT + START must not start a game again
  held = new Set(Array.from({ length: 32 }, (_, i) => i));
  $('game-iframe').src = 'about:blank';
  $('game-frame').hidden = true;
  if (musicBefore != null) ctx.socket.emit('player:cmd', { action: 'setVolume', value: musicBefore }, () => {});
  musicBefore = null;
  toast('Spel gestopt');
  window.dispatchEvent(new Event('wexer:activity'));
}
