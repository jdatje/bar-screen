// Moving backgrounds for the home buttons. Pure data + markup, so the
// server can import it too (to check settings) and the screen can draw it.

export const SPOOKY_THEMES = ['spookhuis', 'pompoen', 'heks'];
// party looks and which backgrounds "automatic" picks in them
export const PARTY_OF_THEME = {
  spookhuis: 'spooky', pompoen: 'spooky', heks: 'spooky',
  oranje: 'dutch', delft: 'dutch', oranjeboven: 'dutch',
  strand: 'summer', zonsondergang: 'summer',
  wiesn: 'oktoberfest', bierhal: 'oktoberfest',
  rock: 'music', synthwave: 'music',
  champagne: 'newyear', vuurwerk: 'newyear', oliebol: 'newyear',
};
// what "automatic" shows on each button in a party look
const PARTY_TILES = {
  spooky: { quiz: 'ghosts', cocktails: 'cauldron', karaoke: 'bats', photos: 'web', join: 'rings' },
  dutch: { quiz: 'flags', cocktails: 'tulips', karaoke: 'windmill', photos: 'confetti', join: 'rings' },
  summer: { quiz: 'beachball', cocktails: 'waves', karaoke: 'sun', photos: 'sparkle', join: 'rings' },
  oktoberfest: { quiz: 'pretzels', cocktails: 'beer', karaoke: 'lights', photos: 'confetti', join: 'rings' },
  music: { quiz: 'eq', cocktails: 'notes', karaoke: 'vinyl', photos: 'stars', join: 'sparkle' },
  newyear: { quiz: 'confetti', cocktails: 'bubbles', karaoke: 'lights', photos: 'sparkle', join: 'stars' },
};

export const TILE_KEYS = ['quiz', 'cocktails', 'karaoke', 'photos', 'join'];
export const TILE_LABELS = { quiz: 'Spelletjes', cocktails: 'Cocktails', karaoke: 'Karaoke', photos: 'Fotomuur', join: 'Meedoen' };

// All backgrounds; any button can use any of them
const S = {
  marks: 'Vraagtekens', paper: 'Schrijven op papier', bulb: 'Gloeilamp', ghosts: 'Spookjes', flags: 'Vlaggetjes',
  beachball: 'Strandbal', pretzels: 'Brezels', eq: 'Equalizer', pixels: 'Pixelmonsters', bubbles: 'Bubbels',
  ice: 'IJsblokjes', citrus: 'Citroenschijfjes', cauldron: 'Heksenketel', tulips: 'Tulpen', waves: 'Golven',
  beer: 'Bierpul', notes: 'Muzieknoten', vinyl: 'Plaat', sparkle: 'Sterretjes', bats: 'Vleermuizen',
  windmill: 'Molen', sun: 'Zon', lights: 'Kermislampjes', polaroids: "Polaroids", confetti: 'Confetti',
  stars: 'Sterrenveld', web: 'Spinnenweb', dice: 'Dobbelstenen', wheel: 'Draaiend rad', rings: 'Ringen', scan: 'Scanlijn',
};
const pick = (...ids) => ids.map((id) => ({ id, label: S[id] }));
// the first one is the button's normal background; the list is what the settings offer
export const TILE_STYLES = {
  quiz: pick('marks', 'paper', 'bulb', 'pixels', 'dice', 'ghosts', 'flags', 'beachball', 'pretzels', 'eq'),
  cocktails: pick('bubbles', 'ice', 'citrus', 'cauldron', 'tulips', 'waves', 'beer', 'notes'),
  karaoke: pick('eq', 'notes', 'vinyl', 'sparkle', 'bats', 'windmill', 'sun', 'lights', 'wheel'),
  photos: pick('polaroids', 'sparkle', 'confetti', 'stars', 'web', 'flags'),
  join: pick('rings', 'scan', 'sparkle', 'web', 'confetti'),
};

export const DEFAULT_TILES = { quiz: 'auto', cocktails: 'auto', karaoke: 'auto', photos: 'auto', join: 'auto' };

export const validTileChoice = (key, choice) => TILE_KEYS.includes(key) && (choice === 'auto' || choice === 'off' || choice in S);

// "auto" = the normal style, or the matching one in a party look
export function resolveTile(key, choice, theme) {
  if (choice && choice !== 'auto') return choice;
  const party = PARTY_TILES[PARTY_OF_THEME[theme]];
  return party?.[key] || TILE_STYLES[key][0].id;
}

const rep = (n, html) => Array.from({ length: n }, () => html).join('');

const GHOST = `<svg viewBox="0 0 48 56"><path d="M6 52V24a18 18 0 0 1 36 0v28l-6-5-6 5-6-5-6 5-6-5z" fill="currentColor"/><circle cx="18" cy="24" r="3.4" class="eye"/><circle cx="30" cy="24" r="3.4" class="eye"/><ellipse cx="24" cy="34" rx="3" ry="4" class="eye"/></svg>`;
const BAT = `<svg viewBox="0 0 64 32"><path class="wing l" d="M32 14C26 6 14 4 2 8c6 2 8 6 8 10 4-3 8-2 10 2 2-4 8-5 12-6z" fill="currentColor"/><path class="wing r" d="M32 14c6-8 18-10 30-6-6 2-8 6-8 10-4-3-8-2-10 2-2-4-8-5-12-6z" fill="currentColor"/><path d="M28 12l1-5 3 3 3-3 1 5c0 4-2 7-4 7s-4-3-4-7z" fill="currentColor"/></svg>`;

const FLAG = '<svg viewBox="0 0 40 46"><path d="M3 2v44" stroke="currentColor" stroke-width="2.5"/><g class="cloth"><path d="M4 3h33v8H4z" fill="#AE1C28"/><path d="M4 11h33v8H4z" fill="#FFFFFF"/><path d="M4 19h33v8H4z" fill="#21468B"/></g></svg>';
const TULIP = (c) => `<svg viewBox="0 0 30 90"><path d="M15 34v56" stroke="#3E8E41" stroke-width="3"/><path d="M15 66c-8-2-12-10-12-16 6 2 11 7 12 16z" fill="#3E8E41"/><path d="M5 12c0 14 4 22 10 22s10-8 10-22l-5 6-5-10-5 10z" fill="${c}"/></svg>`;

const PIXEL = (rows) => {
  // tiny pixel-art monster from a few rows of 1s and 0s
  const cells = rows.flatMap((r, y) => [...r].map((c, x) => (c === '1' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" fill="currentColor">${cells}</svg>`;
};
const INVADER = PIXEL(['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000']);
const GHOSTY = PIXEL(['0011100', '0111110', '1101011', '1111111', '1111111', '1010101']);

const MARKUP = {
  polaroids: rep(4, '<i><b></b></i>'),
  beachball: '<i><b></b></i>',
  waves: '<i></i><i></i><i></i>',
  sun: '<i><b></b></i>',
  pretzels: rep(5, '<i>🥨</i>'),
  beer: '<i><b></b><s></s><s></s><s></s><s></s></i>',
  eq: rep(9, '<i></i>'),
  notes: ['♪', '♫', '♪', '♬', '♩', '♫'].map((n) => `<i>${n}</i>`).join(''),
  vinyl: '<i></i>',
  pixels: [INVADER, GHOSTY, INVADER, GHOSTY, INVADER].map((svg) => `<i>${svg}</i>`).join(''),
  stars: rep(16, '<i></i>'),
  flags: Array.from({ length: 5 }, () => `<i>${FLAG}</i>`).join(''),
  tulips: ['#E8412C', '#FF8F1F', '#F7C948', '#D6336C', '#E8412C', '#FF8F1F'].map((c) => `<i>${TULIP(c)}</i>`).join(''),
  windmill: `<svg class="mill" viewBox="0 0 160 200">
      <path class="body" d="M62 200l8-110h20l8 110z"/>
      <path class="body" d="M58 92l22-22 22 22z"/>
      <g class="sails"><path d="M80 76V6h12v58z"/><path d="M80 76h70v12H92z"/><path d="M80 76v70H68V88z"/><path d="M80 76H10V64h58z"/></g>
      <circle cx="80" cy="76" r="5" class="hub"/>
    </svg>`,
  confetti: rep(14, '<i></i>'),
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
