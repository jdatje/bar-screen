// Shared helpers for the screen and phone pages.

// Looks, grouped as they appear in the settings
export const THEME_GROUPS = [
  { id: 'algemeen', label: 'Algemeen' },
  { id: 'muziek', label: 'Muziek' },
  { id: 'zomer', label: 'Zomer' },
  { id: 'oktoberfest', label: 'Oktoberfest' },
  { id: 'halloween', label: 'Halloween' },
  { id: 'nederland', label: 'Nederland' },
  { id: 'kinderfeest', label: 'Kinderfeest' },
];

export const THEMES = {
  // Algemeen
  industrial: { group: 'algemeen', label: 'Industrieel', bg: '#1B1C1E', fg: '#E8E6E1', ac: '#F2A900', fonts: 'Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@500' },
  maison: { group: 'algemeen', label: 'Maison', bg: '#3A0E17', fg: '#F4EAD8', ac: '#E2BE72', fonts: 'Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500;600' },
  neon: { group: 'algemeen', label: 'Neon', bg: '#0A0A12', fg: '#F2F2F7', ac: '#FF4FB0', fonts: 'Space+Grotesk:wght@400;500;700' },
  bruin: { group: 'algemeen', label: 'Bruin café', bg: '#2B1D14', fg: '#F1E3CC', ac: '#D9A066', fonts: 'Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600' },
  papier: { group: 'algemeen', label: 'Papier', bg: '#F4F1EA', fg: '#1A1A1A', ac: '#B23A48', fonts: 'DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500' },
  riviera: { group: 'algemeen', label: 'Riviera', bg: '#F6EBDD', fg: '#1D3B4A', ac: '#1F6F8B', fonts: 'Playfair+Display:wght@500;700&family=Lato:wght@400;700' },
  chalet: { group: 'algemeen', label: 'Winterchalet', bg: '#1E2A24', fg: '#EDE3CF', ac: '#C8553D', fonts: 'Fraunces:wght@500;700&family=Karla:wght@400;500;600' },
  // Muziek
  disco: { group: 'muziek', label: 'Disco', bg: '#2A1240', fg: '#FBEFFF', ac: '#F6B93B', fonts: 'Monoton&family=Poppins:wght@400;500;600' },
  bluenote: { group: 'muziek', label: 'Blue Note', bg: '#1C2433', fg: '#E9EEF5', ac: '#4F9BE8', fonts: 'Bebas+Neue&family=Work+Sans:wght@400;500;600' },
  rock: { group: 'muziek', label: "Rock 'n' Roll", bg: '#0D0D0D', fg: '#F2F2F2', ac: '#E10600', fonts: 'New+Rocker&family=Barlow:wght@400;500;600' },
  synthwave: { group: 'muziek', label: 'Synthwave', bg: '#14002E', fg: '#F6EAFF', ac: '#FF2E97', fonts: 'Audiowide&family=Rajdhani:wght@500;600;700' },
  // Zomer
  tiki: { group: 'zomer', label: 'Tiki', bg: '#0F3B33', fg: '#F7EBD3', ac: '#F28C38', fonts: 'Lilita+One&family=Nunito:wght@400;600;700' },
  strand: { group: 'zomer', label: 'Strand', bg: '#F5E6C8', fg: '#1E3A4C', ac: '#0E8FB0', fonts: 'Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700' },
  zonsondergang: { group: 'zomer', label: 'Zonsondergang', bg: '#2B1B3D', fg: '#FFF1E0', ac: '#FFB347', fonts: 'Righteous&family=Poppins:wght@400;500;600' },
  // Oktoberfest
  wiesn: { group: 'oktoberfest', label: 'Wiesn', bg: '#E4EFFB', fg: '#1B2A3A', ac: '#1F5FA8', fonts: 'Grenze+Gotisch:wght@500;700&family=Source+Sans+3:wght@400;600;700' },
  bierhal: { group: 'oktoberfest', label: 'Bierhal', bg: '#2A1A0E', fg: '#FBEBD3', ac: '#F2A33A', fonts: 'Alfa+Slab+One&family=Arvo:wght@400;700' },
  // Halloween
  spookhuis: { group: 'halloween', label: '🎃 Spookhuis', bg: '#0E0A14', fg: '#EFE9F7', ac: '#FF7A1A', fonts: 'Creepster&family=Rubik:wght@400;500;600&family=Special+Elite', spooky: true },
  pompoen: { group: 'halloween', label: '🎃 Pompoenveld', bg: '#1C1008', fg: '#FFEBD2', ac: '#FF8F1F', fonts: 'Griffy&family=Quicksand:wght@500;600;700', spooky: true },
  heks: { group: 'halloween', label: '🎃 Heksenketel', bg: '#0A120D', fg: '#E6F5E1', ac: '#8CFF3F', fonts: 'Jolly+Lodger&family=Rubik:wght@400;500;600', spooky: true },
  // Nederland
  oranje: { group: 'nederland', label: '🇳🇱 Oranjegekte', bg: '#FF7A00', fg: '#14204A', ac: '#21468B', fonts: 'Titan+One&family=Nunito:wght@500;600;700;800' },
  delft: { group: 'nederland', label: '🇳🇱 Delfts Blauw', bg: '#F3F6FB', fg: '#12306B', ac: '#1B3F9C', fonts: 'Yeseva+One&family=Mulish:wght@400;500;600;700' },
  modderpret: { group: 'kinderfeest', label: 'Modderpret', bg: '#FFE3EE', fg: '#3A2340', ac: '#F0559A', fonts: 'Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800' },
  oranjeboven: { group: 'nederland', label: '🇳🇱 Oranje Boven', bg: '#0B1630', fg: '#F4F6FF', ac: '#FF7A00', fonts: 'Bungee&family=Rubik:wght@400;500;600' },
};

// Theme cards grouped under headings (used by the settings and /admin)
export function themeGroupsHtml(ids, current, cardHtml) {
  return THEME_GROUPS.map((g) => {
    const list = ids.filter((id) => (THEMES[id]?.group || 'algemeen') === g.id);
    if (!list.length) return '';
    return `<div class="theme-group"><span class="mono muted">${esc(g.label)}</span><div class="theme-grid">${list.map((id) => cardHtml(id, id === current)).join('')}</div></div>`;
  }).join('');
}

export function applyTheme(theme) {
  const t = THEMES[theme] ? theme : 'industrial';
  document.documentElement.dataset.theme = t;
  let link = document.getElementById('theme-fonts');
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-fonts';
    link.rel = 'stylesheet';
    document.head.append(link);
  }
  const href = `https://fonts.googleapis.com/css2?family=${THEMES[t].fonts}&display=swap`;
  if (link.href !== href) link.href = href;
}

export const $ = (id) => document.getElementById(id);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function toast(msg) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// Promise-based socket emit with acknowledgement
export const call = (socket, event, payload = {}) =>
  new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res)));

export const LETTERS = ['A', 'B', 'C', 'D'];

// Countdown helper that corrects for clock differences between server and device
export function remaining(game) {
  if (!game?.endsAt) return 0;
  const offset = Date.now() - (game.receivedAt || Date.now()) + (game.serverNow || Date.now());
  return Math.max(0, game.endsAt - offset);
}

// Numeric PIN pad overlay; resolves with the PIN or null
export function askPin(title = 'Pincode') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay open';
    wrap.innerHTML = `
      <div class="panel sheet pin-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="display">${esc(title)}</h2>
        <div class="pin-dots" aria-live="polite"></div>
        <div class="pin-grid">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="btn" data-n="${n}">${n}</button>`).join('')}
          <button class="btn" data-x="cancel">Annuleer</button>
          <button class="btn" data-n="0">0</button>
          <button class="btn primary" data-x="ok">OK</button>
        </div>
      </div>`;
    let pin = '';
    const dots = wrap.querySelector('.pin-dots');
    const render = () => (dots.textContent = pin ? '•'.repeat(pin.length) : '—');
    render();
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.n && pin.length < 8) pin += b.dataset.n;
      if (b.dataset.x === 'cancel') return close(null);
      if (b.dataset.x === 'ok') {
        window.dispatchEvent(new CustomEvent('wexer:pin', { detail: pin }));
        return close(pin);
      }
      render();
    });
    function close(v) {
      wrap.remove();
      resolve(v);
    }
    document.body.append(wrap);
  });
}

export function confirmBox(text, okLabel = 'Ja') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay open';
    wrap.innerHTML = `
      <div class="panel sheet" style="width:min(560px,90vw)" role="dialog" aria-modal="true">
        <h2 class="display" style="font-size:34px">${esc(text)}</h2>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" data-v="0">Nee</button>
          <button class="btn primary" data-v="1">${esc(okLabel)}</button>
        </div>
      </div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      wrap.remove();
      resolve(b.dataset.v === '1');
    });
    document.body.append(wrap);
  });
}
