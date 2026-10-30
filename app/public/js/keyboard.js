// Minimal on-screen keyboard for the kiosk (no physical keyboard at the bar).
// Opens for every <input data-osk> on focus.
const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '-', '⌫'],
];

let target = null;
let shift = true;
const kb = document.createElement('div');
kb.className = 'osk';
kb.hidden = true;
kb.setAttribute('role', 'group');
kb.setAttribute('aria-label', 'Schermtoetsenbord');
document.body.append(kb);

function render() {
  const label = target?.labels?.[0]?.textContent || '';
  kb.innerHTML =
    `<div class="osk-preview"><small>${label.replace(/[<>&]/g, '')}</small>${(target?.value || '').replace(/[<>&]/g, '') || '&nbsp;'}<span class="accent">|</span></div>` +
    ROWS.map((r) => `<div class="osk-row">${r.map((k) => `<button type="button" data-k="${k}">${shift && k.length === 1 ? k.toUpperCase() : k}</button>`).join('')}</div>`).join('') +
    `<div class="osk-row"><button type="button" data-k="close" class="wide">Sluiten</button><button type="button" data-k=" " class="space">spatie</button><button type="button" data-k="enter" class="wide primary">Klaar</button></div>`;
}

kb.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
kb.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !target) return;
  const k = b.dataset.k;
  if (k === '⇧') shift = !shift;
  else if (k === '⌫') target.value = target.value.slice(0, -1);
  else if (k === 'close') return hide();
  else if (k === 'enter') {
    const form = target.form;
    hide();
    form?.requestSubmit();
    return;
  } else {
    target.value += shift ? k.toUpperCase() : k;
    shift = false;
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
  render();
});

function hide() {
  kb.hidden = true;
  target?.blur();
  target = null;
}

document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el.matches?.('input[data-osk], textarea[data-osk]')) {
    target = el;
    shift = el.value.length === 0;
    render();
    kb.hidden = false;
  }
});
