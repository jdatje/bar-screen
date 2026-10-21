// /admin (phone or laptop, behind the code): the screen's settings and
// your own pubquiz question sets.
import { $, esc, toast, applyTheme, askPin, THEMES } from './ui.js';
import { TILE_KEYS, TILE_LABELS, TILE_STYLES } from './tiles.js';
import * as fx from './fx.js';

applyTheme('industrial');
const store = {
  get: () => { try { return sessionStorage.getItem('pin') || ''; } catch { return ''; } },
  set: (v) => { try { v ? sessionStorage.setItem('pin', v) : sessionStorage.removeItem('pin'); } catch { /* private mode */ } },
};
let pin = store.get();
let info = null;
let editing = null; // set being edited
let tab = 'screen';
window.addEventListener('wexer:pin', (e) => e.detail === '1031' && fx.pumpkinRain());

class Locked extends Error {}

async function api(method, path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-pin': pin },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    if (pin) toast('Code klopt niet');
    const next = await askPin('Code');
    if (next == null) {
      showLocked();
      throw new Locked();
    }
    pin = next;
    store.set(pin);
    return api(method, path, body);
  }
  return res.json();
}

function showLocked() {
  pin = '';
  store.set('');
  $('admin-tabs').hidden = true;
  $('lock').hidden = true;
  $('admin-title').textContent = 'Op slot';
  $('root').innerHTML = `<div class="panel a-sec"><p style="margin:0">Alleen voor de beheerders. Je hebt de code nodig.</p>
    <button class="btn primary" id="unlock">Ontgrendelen</button></div>`;
}

// ---------- Screen settings ----------
async function showScreen() {
  const s = await api('GET', '/settings');
  applyTheme(s.theme);
  $('admin-title').textContent = 'Scherm';
  $('root').innerHTML = `
    <section class="panel a-sec">
      <span class="mono accent">Look</span>
      <div class="a-themes">${s.themes.map((id) => {
        const t = THEMES[id] || { label: id, bg: '#222', fg: '#fff', ac: '#fff' };
        return `<button class="theme-card${id === s.theme ? ' on' : ''}" data-theme-id="${id}" style="background:${t.bg};color:${t.fg};border-bottom:10px solid ${t.ac}"><span>${esc(t.label)}</span></button>`;
      }).join('')}</div>
    </section>
    <section class="panel a-sec">
      <span class="mono accent">Achtergrond van de knoppen</span>
      ${TILE_KEYS.map((key) => {
        const opts = [{ id: 'auto', label: 'Automatisch' }, ...TILE_STYLES[key], { id: 'off', label: 'Uit' }];
        return `<div class="a-tile"><strong>${TILE_LABELS[key]}</strong><div class="chips">${opts
          .map((o) => `<button class="chip${(s.tiles[key] || 'auto') === o.id ? ' on' : ''}" data-key="${key}" data-style="${o.id}">${o.label}</button>`)
          .join('')}</div></div>`;
      }).join('')}
      <p class="muted" style="margin:0">Automatisch = de gewone achtergrond, of de griezelige in een Halloween-look.</p>
    </section>
    <section class="panel a-sec">
      <span class="mono accent">Kamer</span>
      <span>Kamercode nu: <strong class="code" style="font-size:26px">${esc(s.room)}</strong></span>
      <button class="btn" id="new-room">Nieuwe kamercode</button>
      <span class="mono accent">Code</span>
      <button class="btn" id="change-pin">Code wijzigen</button>
    </section>`;
}

async function saveSettings(patch) {
  const r = await api('POST', '/settings', patch);
  if (!r.ok) toast(r.error === 'pin_too_short' ? 'Minstens 4 cijfers' : 'Lukt niet');
  return r;
}

function setTab(next) {
  tab = next;
  document.querySelectorAll('#admin-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  return (tab === 'screen' ? showScreen() : showList()).catch((e) => {
    if (!(e instanceof Locked)) throw e;
  });
}
document.querySelectorAll('#admin-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('lock').addEventListener('click', showLocked);

async function start() {
  try {
    await api('GET', '/settings');
  } catch (e) {
    if (e instanceof Locked) return;
    throw e;
  }
  $('admin-tabs').hidden = false;
  $('lock').hidden = false;
  setTab(tab);
}

const blankQ = () => ({ q: '', options: ['', '', '', ''], answer: 0, category: 'algemeen', difficulty: 'gemiddeld' });

async function showList() {
  editing = null;
  info = info || (await api('GET', '/info'));
  const sets = await api('GET', '/sets');
  const lib = info.library;
  $('admin-title').textContent = 'Quizvragen';
  $('root').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${sets.length ? sets.map((s) => `<div class="panel set-row">
          <div><span class="display" style="font-size:26px">${esc(s.name)}</span>
          <div class="muted">${s.count} vragen · ${s.enabled ? 'in gebruik' : 'uitgeschakeld'}</div></div>
          <button class="btn" data-edit="${s.id}">Bewerken</button>
        </div>`).join('') : '<p class="muted">Nog geen eigen sets. De quiz gebruikt dan de startset' + (info.ai ? ' en AI-vragen' : '') + '.</p>'}
    </div>
    <button class="btn primary" id="new-set">Nieuwe set</button>
    <div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:6px">
      <span class="mono accent">Vragendatabase</span>
      <span>Startset: ${info.bank.starter} · Open Trivia DB: ${info.bank.opentdb.toLocaleString('nl-NL')} (${info.bank.translated.toLocaleString('nl-NL')} vertaald) · eigen sets: ${info.bank.own}</span>
      <span class="muted">${info.bank.translated >= info.bank.opentdb ? 'Alle Open Trivia DB-vragen zijn vertaald naar het Nederlands.' : info.ai ? 'De rest van de Open Trivia DB-vragen wordt op de achtergrond vertaald.' : 'Een deel van de Open Trivia DB-vragen is nog Engelstalig.'}</span>
    </div>
    <div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:10px">
      <span class="mono accent">Cocktailbibliotheek</span>
      <span>${lib.count} recepten${lib.fetchedAt ? ` · bijgewerkt ${new Date(lib.fetchedAt).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}` : ' · alleen basisset, download nog niet gelukt'}</span>
      <button class="btn" id="refresh-lib" style="align-self:flex-start">Nu verversen</button>
    </div>`;
}

async function showEditor(id) {
  editing = id ? await api('GET', `/sets/${id}`) : { name: 'Nieuwe set', enabled: true, questions: [blankQ()] };
  renderEditor();
}

function renderEditor() {
  const s = editing;
  const cats = info.categories.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
  const diffs = info.difficulties.map((d) => `<option value="${d}">${d}</option>`).join('');
  $('root').innerHTML = `
    <button class="btn small" id="back" style="align-self:flex-start">← Alle sets</button>
    <div class="field"><label for="set-name">Naam van de set</label><input id="set-name" value="${esc(s.name)}" maxlength="60"></div>
    <label class="row" style="font-size:18px"><input type="checkbox" id="set-enabled" ${s.enabled ? 'checked' : ''} style="width:24px;height:24px;accent-color:var(--accent)"> Gebruiken in de pubquiz</label>
    <div id="questions" style="display:flex;flex-direction:column;gap:12px">
      ${s.questions.map((q, i) => `<div class="panel q-row" data-i="${i}">
        <div class="field"><label for="q-${i}">Vraag ${i + 1}</label><input id="q-${i}" data-f="q" value="${esc(q.q)}"></div>
        <div class="q-opts">${q.options.concat(['', '', '', '']).slice(0, 4).map((o, j) => `
          <label class="q-opt"><input type="radio" name="ans-${i}" data-f="answer" value="${j}" ${q.answer === j ? 'checked' : ''} aria-label="Antwoord ${j + 1} is goed">
          <input type="text" class="field-input" data-f="opt" data-j="${j}" value="${esc(o)}" placeholder="${j === 0 ? 'Antwoord' : 'Antwoord (leeg = niet gebruikt)'}"
            style="padding:0 12px;background:var(--panel);border:1px solid var(--line-strong);border-radius:var(--radius);color:var(--text)"></label>`).join('')}
        </div>
        <div class="q-meta">
          <select data-f="category" aria-label="Categorie">${cats}</select>
          <select data-f="difficulty" aria-label="Moeilijkheid">${diffs}</select>
          <button class="btn small" data-del="${i}">Verwijderen</button>
        </div>
      </div>`).join('')}
    </div>
    <div class="row">
      <button class="btn" id="add-q">Vraag toevoegen</button>
      <button class="btn" id="paste">Plakken uit tekst</button>
    </div>
    <div class="field" id="paste-box" hidden>
      <label for="paste-text">Eén vraag per regel: vraag | goed antwoord | fout | fout | fout | categorie</label>
      <textarea id="paste-text" placeholder="Wat is de hoofdstad van Peru? | Lima | Quito | Bogotá | Santiago | aardrijkskunde"></textarea>
      <button class="btn" id="paste-add" style="align-self:flex-start">Toevoegen</button>
    </div>
    <div class="row" style="justify-content:space-between">
      ${s.id ? '<button class="btn" id="delete-set">Set verwijderen</button>' : '<span></span>'}
      <button class="btn primary big" id="save">Opslaan</button>
    </div>`;
  document.querySelectorAll('.q-row').forEach((row) => {
    const q = s.questions[row.dataset.i];
    row.querySelector('[data-f=category]').value = q.category || 'algemeen';
    row.querySelector('[data-f=difficulty]').value = q.difficulty || 'gemiddeld';
  });
}

// read the form back into `editing`
function collect() {
  editing.name = $('set-name').value;
  editing.enabled = $('set-enabled').checked;
  editing.questions = [...document.querySelectorAll('.q-row')].map((row) => {
    const opts = [...row.querySelectorAll('[data-f=opt]')].map((i) => i.value.trim());
    let answer = Number(row.querySelector('[data-f=answer]:checked')?.value || 0);
    // drop empty options, keep the right answer pointing at the same text
    const right = opts[answer];
    const options = opts.filter(Boolean);
    answer = Math.max(0, options.indexOf(right));
    return {
      q: row.querySelector('[data-f=q]').value.trim(),
      options,
      answer,
      category: row.querySelector('[data-f=category]').value,
      difficulty: row.querySelector('[data-f=difficulty]').value,
    };
  });
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.edit) return showEditor(t.dataset.edit);
  if (t.dataset.themeId) {
    const r = await saveSettings({ theme: t.dataset.themeId });
    if (r.ok) showScreen();
    return;
  }
  if (t.dataset.style && t.dataset.key) {
    const r = await saveSettings({ tiles: { [t.dataset.key]: t.dataset.style } });
    if (r.ok) showScreen();
    return;
  }
  switch (t.id) {
    case 'unlock': return start();
    case 'new-room': {
      const r = await api('POST', '/room/new');
      toast(r.ok ? `Nieuwe kamercode: ${r.room}` : 'Lukt niet');
      return showScreen();
    }
    case 'change-pin': {
      const next = await askPin('Nieuwe code (minstens 4 cijfers)');
      if (next == null) return;
      const r = await saveSettings({ newPin: next });
      if (r.ok) {
        pin = next;
        store.set(pin);
        toast('Nieuwe code ingesteld');
      }
      return;
    }
    case 'new-set': return showEditor(null);
    case 'back': return showList();
    case 'refresh-lib': {
      t.disabled = true;
      t.textContent = 'Bezig…';
      const r = await api('POST', '/cocktails/refresh');
      toast(r.ok ? `${r.count} recepten geladen` : `Mislukt: ${r.error}`);
      info = null;
      return showList();
    }
    case 'add-q':
      collect();
      editing.questions.push(blankQ());
      return renderEditor();
    case 'paste':
      $('paste-box').hidden = !$('paste-box').hidden;
      return;
    case 'paste-add': {
      collect();
      const lines = $('paste-text').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[0]);
      for (const p of lines) {
        const cat = info.categories.find((c) => c.id === (p[5] || '').toLowerCase() || c.label.toLowerCase() === (p[5] || '').toLowerCase());
        editing.questions.push({ q: p[0], options: p.slice(1, 5).filter(Boolean), answer: 0, category: cat?.id || 'algemeen', difficulty: 'gemiddeld' });
      }
      editing.questions = editing.questions.filter((q) => q.q || q.options.some(Boolean));
      toast(`${lines.length} vragen toegevoegd`);
      return renderEditor();
    }
    case 'save': {
      collect();
      const bad = editing.questions.filter((q) => !q.q || q.options.length < 2).length;
      const saved = await api('POST', '/sets', editing);
      toast(bad ? `Opgeslagen · ${bad} onvolledige vragen overgeslagen` : 'Opgeslagen');
      return showEditor(saved.id);
    }
    case 'delete-set':
      if (!confirm('Deze set verwijderen?')) return;
      await api('DELETE', `/sets/${editing.id}`);
      return showList();
  }
  if (t.dataset.del != null) {
    collect();
    editing.questions.splice(Number(t.dataset.del), 1);
    renderEditor();
  }
});

start();
