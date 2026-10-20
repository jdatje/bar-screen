// Touchscreen homescreen: clock, now playing, controls, join code, settings.
const socket = io();
const $ = (id) => document.getElementById(id);

const THEME_LABELS = {
  industrial: ['Industrieel', '#1B1C1E', '#F2A900'],
  maison: ['Maison', '#3A0E17', '#E2BE72'],
  neon: ['Neon', '#0A0A12', '#FF4FB0'],
};

let state = { settings: { theme: 'industrial' }, themes: [], player: null };
let volumeDragging = false;

// ---------- Clock ----------
const fmtDate = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: '2-digit', month: '2-digit' });
function tickClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  $('date').textContent = fmtDate.format(now).replace(',', '').replace('-', '.');
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Helpers ----------
const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('on', c.dataset.theme === theme));
}

// ---------- Now playing ----------
function renderPlayer(p) {
  state.player = p;
  const notice = $('spotify-notice');
  notice.innerHTML = '';
  if (!p.configured) notice.textContent = 'Spotify nog niet ingesteld (client ID/secret)';
  else if (!p.loggedIn) notice.innerHTML = 'Spotify nog niet gekoppeld — <a href="/auth/spotify/login">koppel nu</a>';
  else if (p.error) notice.textContent = 'Spotify niet bereikbaar';

  $('device').textContent = p.device ? `Spotify · ${p.device}` : 'Spotify';
  const t = p.track;
  $('title').textContent = t ? t.title : 'Niets aan het spelen';
  $('artist').textContent = t ? t.artist : 'Kies "Maison Baron" als speaker in Spotify';
  $('art').style.backgroundImage = t?.art ? `url("${t.art}")` : 'none';
  $('duration').textContent = fmtTime(t?.durationMs);
  $('upnext').textContent = p.upNext?.length ? `Straks — ${p.upNext[0].title} · ${p.upNext[0].artist}` : '';
  $('icon-pause').hidden = !p.playing;
  $('icon-play').hidden = p.playing;
  if (!volumeDragging && p.volume != null) $('volume').value = p.volume;
  renderProgress();
}

function renderProgress() {
  const p = state.player;
  const t = p?.track;
  if (!t) {
    $('progress').style.width = '0%';
    $('elapsed').textContent = '0:00';
    return;
  }
  const elapsed = Math.min(t.durationMs, p.progressMs + (p.playing ? Date.now() - p.at : 0));
  $('progress').style.width = `${(elapsed / t.durationMs) * 100}%`;
  $('elapsed').textContent = fmtTime(elapsed);
}
setInterval(renderProgress, 500);

function cmd(action, value) {
  socket.emit('player:cmd', { action, value }, (res) => {
    if (!res?.ok) toast('Spotify reageert niet');
  });
}
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => cmd(b.dataset.cmd)));
$('playpause').addEventListener('click', () => {
  const playing = state.player?.playing;
  cmd(playing ? 'pause' : 'play');
  if (state.player) {
    state.player.playing = !playing;
    renderPlayer(state.player);
  }
});
const vol = $('volume');
vol.addEventListener('pointerdown', () => (volumeDragging = true));
vol.addEventListener('change', () => {
  volumeDragging = false;
  cmd('volume', vol.value);
});

// ---------- Tiles (coming soon) ----------
document.querySelectorAll('[data-soon]').forEach((b) =>
  b.addEventListener('click', () => toast(`${b.dataset.soon} komt eraan`))
);

// ---------- Settings ----------
function renderThemes() {
  $('themes').innerHTML = '';
  for (const id of state.themes) {
    const [label, bg, ac] = THEME_LABELS[id] || [id, '#222', '#fff'];
    const b = document.createElement('button');
    b.className = 'theme-card';
    b.dataset.theme = id;
    b.style.background = bg;
    b.style.borderBottom = `8px solid ${ac}`;
    b.style.color = '#fff';
    b.innerHTML = `<span>${label}</span>`;
    b.addEventListener('click', () => socket.emit('settings:set', { theme: id }));
    $('themes').append(b);
  }
  applyTheme(state.settings.theme);
}
$('open-settings').addEventListener('click', () => $('settings').classList.add('open'));
$('close-settings').addEventListener('click', () => $('settings').classList.remove('open'));
$('new-room').addEventListener('click', () => socket.emit('room:new', {}, () => toast('Nieuwe kamercode')));

// ---------- Socket ----------
function renderRoom(room) {
  $('code').textContent = room.code;
  if (room.qr) $('qr').src = room.qr;
}
function renderPlayers(list) {
  const n = list.filter((p) => p.online).length;
  $('guests').textContent = `${n} ${n === 1 ? 'gast' : 'gasten'} verbonden`;
}

socket.on('connect', () => socket.emit('screen:hello'));
socket.on('state', (s) => {
  state = { ...state, ...s };
  renderThemes();
  renderRoom(s.room);
  renderPlayers(s.players);
  renderPlayer(s.player);
});
socket.on('player', renderPlayer);
socket.on('players', renderPlayers);
socket.on('settings', (s) => {
  state.settings = s;
  applyTheme(s.theme);
});
