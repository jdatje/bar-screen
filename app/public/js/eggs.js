// Little surprises on the touchscreen. Shh.
import { $ } from './ui.js';
import { SPOOKY_THEMES } from './tiles.js';
import * as fx from './fx.js';

let ctx;
const spookyLook = () => SPOOKY_THEMES.includes(ctx.state.settings.theme);

export function init(c) {
  ctx = c;

  // the bar number isn't always what it seems
  const tag = document.querySelector('.brand .tag');
  let taps = [];
  tag?.addEventListener('pointerdown', () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 3000).concat(now);
    if (taps.length < 7) return;
    taps = [];
    tag.textContent = 'BAR 13';
    tag.classList.add('cursed');
    fx.ghostFly();
    setTimeout(() => {
      tag.textContent = 'BAR 01';
      tag.classList.remove('cursed');
    }, 60000);
  });

  // hold on to the name a little too long...
  const logo = document.querySelector('.brand h1');
  let hold = null;
  logo?.addEventListener('pointerdown', () => {
    clearTimeout(hold);
    hold = setTimeout(fx.eyes, 2000);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) logo?.addEventListener(ev, () => clearTimeout(hold));

  // a certain date as a code
  window.addEventListener('wexer:pin', (e) => {
    if (e.detail === '1031') fx.pumpkinRain();
    if (e.detail === '2704') fx.oranjeRain();
  });

  // eight-legged visitors, now and then, in the Halloween looks
  const visit = () => {
    if (spookyLook() && !document.hidden) fx.spider();
    setTimeout(visit, (12 + Math.random() * 13) * 60 * 1000);
  };
  setTimeout(visit, (3 + Math.random() * 5) * 60 * 1000);

  // the most Dutch moment of the week
  let toasted = '';
  setInterval(() => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' })
        .formatToParts(new Date()).map((p) => [p.type, p.value])
    );
    const day = new Date().toDateString();
    if (parts.weekday === 'Fri' && Number(parts.hour) === 17 && Number(parts.minute) < 5 && toasted !== day) {
      toasted = day;
      fx.banner('Het is vrijdagmiddagborrel!');
    }
  }, 30000);

  // the witching hour
  const witching = () => {
    const h = Number(new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(new Date()));
    document.documentElement.toggleAttribute('data-witching', h === 0);
  };
  setInterval(witching, 20000);
  witching();
}

const SPOOKY_SONGS = /thriller|ghostbusters|monster mash|spooky|somebody'?s watching me|this is halloween|time warp|disturbia|zombie|werewolves of london|witch ?doctor|dead man'?s party|bad moon rising|i put a spell on you|superstition|halloween/i;

export function onPlayer(p) {
  const t = p?.track;
  const haunted = Boolean(t && !p.hidden && SPOOKY_SONGS.test(`${t.title} ${t.album || ''}`));
  $('art')?.classList.toggle('haunted', haunted);
  // a toast to the king of the levenslied
  $('art')?.classList.toggle('proost', Boolean(t && !p.hidden && /\bhazes\b/i.test(t.artist || '')));
}
