// /admin: manage your own pubquiz question sets.
import { $, esc, toast, applyTheme } from './ui.js';

applyTheme('industrial');
let pin = sessionStorage.getItem('pin') || '';
let info = null;
let editing = null; // set being edited

async function api(method, path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-pin': pin },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    pin = prompt('Pincode van de bar') || '';
    sessionStorage.setItem('pin', pin);
    return api(method, path, body);
  }
  return res.json();
}

const blankQ = () => ({ q: '', options: ['', '', '', ''], answer: 0, category: 'algemeen', difficulty: 'gemiddeld' });

async function showList() {
  editing = null;
  info = info || (await api('GET', '/info'));
  const sets = await api('GET', '/sets');
  const lib = info.library;
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
  switch (t.id) {
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

showList();
