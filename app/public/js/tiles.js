// Moving backgrounds for the home buttons. Pure data + markup, so the
// server can import it too (to check settings) and the screen can draw it.

export const SPOOKY_THEMES = ['spookhuis', 'pompoen', 'heks'];

export const TILE_KEYS = ['quiz', 'cocktails', 'wheel', 'join'];
export const TILE_LABELS = { quiz: 'Quiz', cocktails: 'Cocktails', wheel: 'Draai het rad', join: 'Meedoen' };

// The first style of each button is its normal one; the "spooky" one is
// picked automatically in the Halloween looks.
export const TILE_STYLES = {
  quiz: [
    { id: 'marks', label: 'Vraagtekens' },
    { id: 'paper', label: 'Schrijven op papier' },
    { id: 'bulb', label: 'Gloeilamp' },
    { id: 'ghosts', label: 'Spookjes', spooky: true },
  ],
  cocktails: [
    { id: 'bubbles', label: 'Bubbels' },
    { id: 'ice', label: 'IJsblokjes' },
    { id: 'citrus', label: 'Citroenschijfjes' },
    { id: 'cauldron', label: 'Heksenketel', spooky: true },
  ],
  wheel: [
    { id: 'wheel', label: 'Draaiend rad' },
    { id: 'lights', label: 'Kermislampjes' },
    { id: 'dice', label: 'Dobbelstenen' },
    { id: 'bats', label: 'Vleermuizen', spooky: true },
  ],
  join: [
    { id: 'rings', label: 'Ringen' },
    { id: 'scan', label: 'Scanlijn' },
    { id: 'sparkle', label: 'Sterretjes' },
    { id: 'web', label: 'Spinnenweb', spooky: true },
  ],
};

export const DEFAULT_TILES = { quiz: 'auto', cocktails: 'auto', wheel: 'auto', join: 'auto' };

export const validTileChoice = (key, choice) =>
  choice === 'auto' || choice === 'off' || Boolean(TILE_STYLES[key]?.some((s) => s.id === choice));

// "auto" = the normal style, or the spooky one in a Halloween look
export function resolveTile(key, choice, theme) {
  if (choice && choice !== 'auto') return choice;
  const list = TILE_STYLES[key];
  return (SPOOKY_THEMES.includes(theme) ? list.find((s) => s.spooky) : list[0]).id;
}

const rep = (n, html) => Array.from({ length: n }, () => html).join('');

const GHOST = `<svg viewBox="0 0 48 56"><path d="M6 52V24a18 18 0 0 1 36 0v28l-6-5-6 5-6-5-6 5-6-5z" fill="currentColor"/><circle cx="18" cy="24" r="3.4" class="eye"/><circle cx="30" cy="24" r="3.4" class="eye"/><ellipse cx="24" cy="34" rx="3" ry="4" class="eye"/></svg>`;
const BAT = `<svg viewBox="0 0 64 32"><path class="wing l" d="M32 14C26 6 14 4 2 8c6 2 8 6 8 10 4-3 8-2 10 2 2-4 8-5 12-6z" fill="currentColor"/><path class="wing r" d="M32 14c6-8 18-10 30-6-6 2-8 6-8 10-4-3-8-2-10 2-2-4-8-5-12-6z" fill="currentColor"/><path d="M28 12l1-5 3 3 3-3 1 5c0 4-2 7-4 7s-4-3-4-7z" fill="currentColor"/></svg>`;

const MARKUP = {
  marks: rep(5, '<i>?</i>'),
  paper: `<svg class="paper" viewBox="0 0 200 170">
      <rect x="20" y="8" width="160" height="160" rx="3" class="pp-sheet"/>
      <path class="pp-margin" d="M44 8V168"/>
      ${[40, 62, 84, 106, 128, 150].map((y) => `<path class="pp-line" d="M24 ${y}H176"/>`).join('')}
      <path class="pp-ink i1" pathLength="1" d="M50 36c4-9 8 7 12-1s7-8 10 0 6 6 10-2 7-5 10 2 5 4 9-3 6-4 10 2 6 5 10-2 6-3 9 2"/>
      <path class="pp-ink i2" pathLength="1" d="M50 58c3-8 7 6 11-1s6-7 9 1 7 4 10-3 6-3 9 3 6 3 10-3 5-2 8 2 6 4 9-1"/>
      <path class="pp-ink i3" pathLength="1" d="M50 80c4-8 7 6 11-1s7-7 10 0 6 5 9-2 7-4 10 2"/>
      <path class="pp-ink i4" pathLength="1" d="M132 100l8 10 18-24"/>
    </svg>`,
  bulb: `<svg class="bulb" viewBox="0 0 120 150">
      <g class="rays">${[-60, -30, 0, 30, 60].map((a) => `<path d="M60 8V-6" transform="rotate(${a} 60 52)"/>`).join('')}</g>
      <path class="glass" d="M60 18a34 34 0 0 0-20 61c5 4 7 9 7 15h26c0-6 2-11 7-15a34 34 0 0 0-20-61z"/>
      <path class="filament" d="M50 92V74l5-8 5 8 5-8 5 8v18"/>
      <path class="base" d="M47 102h26M49 110h22M53 118h14"/>
    </svg>`,
  ghosts: rep(4, `<i>${GHOST}</i>`),
  bubbles: rep(7, '<i></i>'),
  ice: rep(3, '<i></i>'),
  citrus: rep(3, '<i></i>'),
  cauldron: rep(6, '<i class="b"></i>') + rep(3, '<i class="w"></i>'),
  wheel: '<i></i>',
  lights: '<i></i><i></i>',
  dice: '<i class="d5"></i><i class="d3"></i>',
  bats: rep(4, `<i>${BAT}</i>`),
  rings: rep(3, '<i></i>'),
  scan: '<i></i>',
  sparkle: rep(8, '<i>✦</i>'),
  web: `<svg class="web" viewBox="0 0 160 160">
      ${[0, 18, 36, 54, 72, 90].map((a) => `<path d="M160 0L${160 - 160 * Math.cos((a * Math.PI) / 180)} ${160 * Math.sin((a * Math.PI) / 180)}" transform="translate(0 0)"/>`).join('')}
      ${[30, 60, 92, 126].map((r) => `<path d="M${160 - r} 0 ${[18, 36, 54, 72].map((a) => `Q ${160 - r * 0.9 * Math.cos(((a - 9) * Math.PI) / 180)} ${r * 0.9 * Math.sin(((a - 9) * Math.PI) / 180)} ${160 - r * Math.cos((a * Math.PI) / 180)} ${r * Math.sin((a * Math.PI) / 180)}`).join(' ')} Q ${160 - r * 0.1} ${r * 0.9} 160 ${r}"/>`).join('')}
    </svg><i class="spider"><b></b></i>`,
};

export const tileMarkup = (style) => MARKUP[style] || '';
