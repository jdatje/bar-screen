// Full-screen effects (used by the surprises). Each one cleans itself up
// and never blocks a tap.

export const GHOST = `<svg viewBox="0 0 48 56"><path d="M6 52V24a18 18 0 0 1 36 0v28l-6-5-6 5-6-5-6 5-6-5z" fill="currentColor"/><circle cx="18" cy="24" r="3.4" fill="#111"/><circle cx="30" cy="24" r="3.4" fill="#111"/><ellipse cx="24" cy="34" rx="3" ry="4.4" fill="#111"/></svg>`;

function layer(cls, ms) {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

let busy = false;
const once = (fn, ms) => (...args) => {
  if (busy) return;
  busy = true;
  setTimeout(() => (busy = false), ms);
  fn(...args);
};

// A big friendly ghost floats across the whole screen
export const ghostFly = once(() => {
  const el = layer('fx-ghost', 7000);
  el.innerHTML = `<i>${GHOST}</i>`;
}, 7000);

// Pumpkins raining down
export const pumpkinRain = once(() => {
  const el = layer('fx-rain', 6500);
  el.innerHTML = Array.from({ length: 28 }, () => {
    const left = Math.random() * 100;
    const size = 28 + Math.random() * 46;
    const delay = Math.random() * 2.2;
    const dur = 2.6 + Math.random() * 1.8;
    const spin = (Math.random() * 2 - 1) * 400;
    return `<i style="left:${left}%;font-size:${size}px;animation-delay:${delay}s;animation-duration:${dur}s;--spin:${spin}deg">🎃</i>`;
  }).join('');
}, 6500);

// Orange fever: hearts, crowns and flags
export const oranjeRain = once(() => {
  const el = layer('fx-rain', 6500);
  const bits = ['🧡', '👑', '🇳🇱', '🧡', '🍊'];
  el.innerHTML = Array.from({ length: 30 }, (_, i) => {
    const left = Math.random() * 100;
    const size = 26 + Math.random() * 40;
    const delay = Math.random() * 2.2;
    const dur = 2.6 + Math.random() * 1.8;
    const spin = (Math.random() * 2 - 1) * 300;
    return `<i style="left:${left}%;font-size:${size}px;animation-delay:${delay}s;animation-duration:${dur}s;--spin:${spin}deg">${bits[i % bits.length]}</i>`;
  }).join('');
}, 6500);

// A banner sliding across with something to celebrate
export const banner = once((text) => {
  const el = layer('fx-banner', 9000);
  el.innerHTML = `<div><span>🍻</span><b></b><span>🍻</span></div>`;
  el.querySelector('b').textContent = text;
}, 9000);

// Old-school: scanlines and a pixel message
export const retro = once(() => {
  const el = layer('fx-retro', 5000);
  el.innerHTML = '<b>+30 LEVENS</b>';
}, 5000);

// Lights out... and something is watching
export const eyes = once(() => {
  const el = layer('fx-eyes', 6000);
  el.innerHTML = Array.from({ length: 9 }, (_, i) => {
    const x = 6 + Math.random() * 86;
    const y = 8 + Math.random() * 80;
    const s = 0.6 + Math.random() * 1.1;
    return `<i style="left:${x}%;top:${y}%;--s:${s};animation-delay:${0.6 + i * 0.35}s"><b></b><b></b></i>`;
  }).join('');
}, 6000);

// A spider lowers itself on a thread, looks around, climbs back up
export const spider = once(() => {
  const el = layer('fx-spider', 9000);
  el.style.left = `${8 + Math.random() * 84}%`;
  el.innerHTML = '<i></i><b></b>';
}, 9000);
