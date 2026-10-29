// Maßkrugstemmen (Oktoberfest looks): hold a full stein at arm's length as long
// as you can. The screen is the stopwatch; the server keeps a top 10.
import { $, esc, call, toast, confirmBox } from './ui.js';

let ctx;
let startedAt = 0;
let tick = null;

const fmt = (ms) => {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
};

export function init(c) {
  ctx = c;
  $('mk-close').addEventListener('click', close);
  $('masskrug').addEventListener('click', (e) => e.target.id === 'masskrug' && close());
  $('mk-go').addEventListener('click', toggle);
  $('mk-form').addEventListener('submit', (e) => e.preventDefault());
  $('mk-players').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mk-name]');
    if (b && !startedAt) $('mk-name').value = b.dataset.mkName;
  });
  $('mk-reset').addEventListener('click', reset);
}

export async function open() {
  $('masskrug').classList.add('open');
  stop(false);
  $('mk-time').textContent = fmt(0);
  // quick pick: everyone who joined on a phone
  const names = (ctx.state.players || []).filter((p) => p.online || p.manual).map((p) => p.name);
  $('mk-players').innerHTML = names.map((n) => `<button class="chip" data-mk-name="${esc(n)}">${esc(n)}</button>`).join('');
  render(await call(ctx.socket, 'mk:list'));
}

function close() {
  stop(false);
  $('masskrug').classList.remove('open');
  document.activeElement?.blur?.();
}

function render(list) {
  const top = list?.scores || [];
  $('mk-top').innerHTML = top.length
    ? top.map((s, i) => `<li class="${i === 0 ? 'first' : ''}"><span>${esc(s.name)}</span><b>${fmt(s.ms)}</b></li>`).join('')
    : '<li class="muted">Nog niemand. Wie durft?</li>';
}

async function toggle() {
  if (!startedAt) {
    if (!$('mk-name').value.trim()) {
      toast('Vul eerst een naam in');
      return $('mk-name').focus();
    }
    document.activeElement?.blur?.();
    startedAt = performance.now();
    $('mk-go').textContent = 'Stop';
    $('mk-go').classList.add('running');
    $('masskrug').classList.add('timing');
    tick = setInterval(() => ($('mk-time').textContent = fmt(performance.now() - startedAt)), 100);
    window.dispatchEvent(new Event('wexer:activity')); // keep the screensaver away
    return;
  }
  const ms = Math.round(performance.now() - startedAt);
  stop(true);
  $('mk-time').textContent = fmt(ms);
  const res = await call(ctx.socket, 'mk:add', { name: $('mk-name').value.trim(), ms });
  if (res?.ok) {
    render(res);
    if (res.rank === 1) toast(`Nieuw record: ${$('mk-name').value.trim()}!`);
  }
  $('mk-name').value = '';
}

function stop(keep) {
  clearInterval(tick);
  tick = null;
  startedAt = 0;
  $('mk-go').textContent = 'Start';
  $('mk-go').classList.remove('running');
  $('masskrug').classList.remove('timing');
  if (!keep) $('mk-time').textContent = fmt(0);
}

async function reset() {
  if (!(await confirmBox('Deze lijst leegmaken?', 'Leegmaken'))) return;
  const pin = await ctx.getPin();
  if (pin == null) return;
  const res = await call(ctx.socket, 'mk:clear', { pin });
  if (res?.ok) render(res);
}

// the screensaver must not start while someone is holding
export const isTiming = () => Boolean(startedAt);
