// Guest phone: join with room code + name, reconnect automatically.
const socket = io();
const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const ERRORS = { wrong_code: 'Die code klopt niet', no_name: 'Vul een naam in' };
const params = new URLSearchParams(location.search);
$('code').value = (params.get('code') || store.get('code') || '').toUpperCase();
$('name').value = store.get('name') || '';

function join(silent) {
  const code = $('code').value.trim().toUpperCase();
  const name = $('name').value.trim();
  socket.emit('phone:join', { code, name, playerId: store.get('playerId') }, (res) => {
    if (!res?.ok) {
      if (!silent) $('error').textContent = ERRORS[res?.error] || 'Er ging iets mis';
      showForm();
      return;
    }
    store.set('code', code);
    store.set('name', name);
    store.set('playerId', res.playerId);
    if (res.settings?.theme) document.documentElement.dataset.theme = res.settings.theme;
    $('hello').textContent = `Hoi ${name}`;
    $('join').hidden = true;
    $('joined').hidden = false;
  });
}
function showForm() {
  $('join').hidden = false;
  $('joined').hidden = true;
}

$('join').addEventListener('submit', (e) => {
  e.preventDefault();
  $('error').textContent = '';
  join(false);
});

socket.on('connect', () => {
  if ($('code').value && $('name').value && store.get('playerId')) join(true);
});
socket.on('players', (n) => ($('count').textContent = `${n} ${n === 1 ? 'speler' : 'spelers'} in de kamer`));
socket.on('settings', (s) => (document.documentElement.dataset.theme = s.theme));
socket.on('room:closed', () => {
  $('error').textContent = 'Er is een nieuwe kamercode — kijk op het scherm';
  $('code').value = '';
  showForm();
});
