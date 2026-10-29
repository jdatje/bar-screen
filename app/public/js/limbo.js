// Limbo (Tiki looks): the bar on the screen goes lower every round. Tap a
// name when someone touches the bar or falls. The last one in wins, and the
// lowest height a winner made it under goes into the top 10.
import { $, esc, call, toast, confirmBox } from './ui.js';

let ctx;
let players = []; // { name, out }
let height = 120; // cm
let step = 10;
let round = 1;

const START = 120;
const MIN = 20;

export function init(c) {
  ctx = c;
  $('limbo-close').addEventListener('click', close);
  $('limbo').addEventListener('click', (e) => e.target.id === 'limbo' && close());
  $('limbo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('limbo-name').value.trim();
    if (!n || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
    players.push({ name: n, out: false });
    $('limbo-name').value = '';
    render();
  });
  $('limbo-players').addEventListener('click', (e) => {
    const b = e.target.closest('[data-limbo]');
    if (!b) return;
    const p = players.find((x) => x.name === b.dataset.limbo);
    if (p) p.out = !p.out;
    render();
    checkWinner();
  });
  $('limbo-step').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) {
      step = Number(b.dataset.step);
      render();
    }
  });
  $('limbo-lower').addEventListener('click', lower);
  $('limbo-new').addEventListener('click', () => newGame(true));
  $('limbo-reset').addEventListener('click', reset);
}

export async function open() {
  $('limbo').classList.add('open');
  if (!players.length) newGame(false);
  render();
  renderTop(await call(ctx.socket, 'mk:list', { kind: 'limbo' }));
}

function close() {
  $('limbo').classList.remove('open');
  document.activeElement?.blur?.();
}

function newGame(keepNames) {
  const names = keepNames ? players.map((p) => p.name) : (ctx.state.players || []).filter((p) => p.online || p.manual).map((p) => p.name);
  players = names.map((name) => ({ name, out: false }));
  height = START;
  round = 1;
  $('limbo').classList.remove('won');
  render();
}

function lower() {
  if (players.filter((p) => !p.out).length < 2) return toast('Minstens twee spelers nodig');
  height = Math.max(MIN, height - step);
  round++;
  render();
  const bar = $('limbo-bar');
  bar.classList.remove('drop');
  void bar.offsetWidth;
  bar.classList.add('drop');
}

async function checkWinner() {
  const left = players.filter((p) => !p.out);
  if (players.length < 2 || left.length !== 1 || round < 2) return;
  const w = left[0];
  $('limbo-winner').textContent = `${w.name} wint onder ${height} cm!`;
  $('limbo').classList.add('won');
  const res = await call(ctx.socket, 'mk:add', { name: w.name, ms: height, kind: 'limbo' });
  if (res?.ok) renderTop(res);
}

function render() {
  $('limbo-height').textContent = `${height} cm`;
  $('limbo-round').textContent = `Ronde ${round}`;
  // the bar sits at the height on a 0–140 cm scale
  $('limbo-bar').style.bottom = `${(height / 140) * 100}%`;
  document.querySelectorAll('#limbo-step [data-step]').forEach((b) => b.classList.toggle('on', Number(b.dataset.step) === step));
  $('limbo-players').innerHTML = players.length
    ? players.map((p) => `<button class="chip limbo-p${p.out ? ' out' : ''}" data-limbo="${esc(p.name)}">${p.out ? '✕ ' : ''}${esc(p.name)}</button>`).join('')
    : '<span class="muted">Voeg spelers toe, of laat ze eerst meedoen via de QR-code.</span>';
}

function renderTop(list) {
  const top = list?.scores || [];
  $('limbo-top').innerHTML = top.length
    ? top.map((s, i) => `<li class="${i === 0 ? 'first' : ''}"><span>${esc(s.name)}</span><b>${s.ms} cm</b></li>`).join('')
    : '<li class="muted">Nog geen winnaars.</li>';
}

async function reset() {
  if (!(await confirmBox('Deze lijst leegmaken?', 'Leegmaken'))) return;
  const pin = await ctx.getPin();
  if (pin == null) return;
  const res = await call(ctx.socket, 'mk:clear', { pin, kind: 'limbo' });
  if (res?.ok) renderTop(res);
}
