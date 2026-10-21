// Cocktail menu, spin-the-wheel, recipe view and the stock list.
import { getLang } from './i18n.js';
import { $, esc, call, toast } from './ui.js';

let ctx;
let filters = { status: 'now', base: '', tag: '', unknownOnly: false };
let data = null; // last menu response
let wheelItems = [];
let wheelAngle = 0;
let spinning = false;
let pendingSpin = false;
let stockData = null;

export function init(c) {
  ctx = c;
  $('ck-filters').addEventListener('click', onFilter);
  $('ck-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openRecipe(card.dataset.id);
  });
  $('spin').addEventListener('click', spin);
  $('open-stock').addEventListener('click', () => ctx.go('stock'));
  $('recipe').addEventListener('click', onRecipeClick);
  $('stock-cols').addEventListener('click', onStockClick);
  $('stock-add').addEventListener('submit', addCustom);
  $('wheel').addEventListener('transitionend', spinDone);
}

// ================= Menu =================
export async function openMenu() {
  await loadMenu();
  if (pendingSpin) {
    pendingSpin = false;
    setTimeout(spin, 400);
  }
}
export function spinSoon() {
  pendingSpin = true;
}

async function loadMenu() {
  data = await call(ctx.socket, 'cocktails:menu', filters);
  if (!data) return;
  renderFilters();
  renderGrid();
  buildWheel();
  renderShopping();
}

const chip = (label, attrs, on) => `<button class="chip ${on ? 'on' : ''}" ${attrs}>${esc(label)}</button>`;

function renderFilters() {
  const c = data.counts;
  $('ck-title').textContent = filters.status === 'now' ? 'Vanavond te maken' : 'Met één fles extra';
  $('ck-counts').textContent = `${c.now} te maken · ${c.almost} met één fles extra${data.library.seed ? ' · basisset (bibliotheek laadt nog)' : ''}`;
  $('ck-filters').innerHTML = [
    chip(`Kan nu (${c.now})`, 'data-status="now"', filters.status === 'now'),
    chip(`Bijna (${c.almost})`, 'data-status="almost"', filters.status === 'almost'),
    '<span class="chip-sep"></span>',
    ...data.bases.map((b) => chip(b.label, `data-base="${b.id}"`, filters.base === b.id)),
    '<span class="chip-sep"></span>',
    ...data.tags.map((t) => chip(t.label, `data-tag="${t.id}"`, filters.tag === t.id)),
    chip('Onbekend terrein', 'data-unknown="1"', filters.unknownOnly),
  ].join('');
}

function onFilter(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.status) filters.status = d.status;
  if (d.base) filters.base = filters.base === d.base ? '' : d.base;
  if (d.tag) filters.tag = filters.tag === d.tag ? '' : d.tag;
  if (d.unknown) filters.unknownOnly = !filters.unknownOnly;
  loadMenu();
}

function renderGrid() {
  const list = data.list;
  if (!list.length) {
    $('ck-grid').innerHTML = `<div class="empty"><p class="big-text">Niets gevonden.</p>
      <p class="muted">${data.counts.now ? 'Probeer een ander filter.' : 'Vink bij Voorraad aan welke flessen er staan.'}</p></div>`;
    return;
  }
  $('ck-grid').innerHTML = list
    .map(
      (d) => `<button class="ck-card" data-id="${esc(d.id)}">
        ${d.thumb ? `<img src="${esc(d.thumb)}/medium" alt="" loading="lazy">` : ''}
        <div class="ck-card-body">
          <span class="mono accent">${esc(d.baseLabel)}${d.classic ? ' · klassieker' : ''}</span>
          <span class="display ck-name">${esc(d.name)}</span>
          <span class="ck-ing">${esc(d.ingredients.join(', '))}</span>
          ${d.missing.length ? `<span class="mono warn-text">Mist: ${esc(d.missing.join(', '))}</span>` : ''}
        </div>
      </button>`
    )
    .join('');
}

function renderShopping() {
  const s = data.shopping;
  $('shopping').innerHTML = s.length
    ? `<span class="mono muted">Eén fles erbij</span>${s
        .slice(0, 3)
        .map((x) => `<div class="shop-row"><span>${esc(x.label)}</span><span class="accent">+${x.unlocks}</span></div>`)
        .join('')}`
    : '';
}

// ================= Wheel =================
function buildWheel() {
  const pool = [...data.list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  wheelItems = pool.slice(0, 10);
  const svg = $('wheel');
  const n = wheelItems.length;
  if (!n) {
    svg.innerHTML = `<circle cx="150" cy="150" r="140" fill="var(--panel-2)" stroke="var(--line-strong)" stroke-width="3"/>
      <text x="150" y="156" text-anchor="middle" fill="var(--text-3)" font-size="16">Niets om uit te kiezen</text>`;
    return;
  }
  const r = 140;
  const seg = (Math.PI * 2) / n;
  let out = '';
  wheelItems.forEach((d, i) => {
    const a0 = -Math.PI / 2 + i * seg;
    const a1 = a0 + seg;
    const p = (a) => `${150 + r * Math.cos(a)} ${150 + r * Math.sin(a)}`;
    const large = seg > Math.PI ? 1 : 0;
    const fill = i % 2 ? 'var(--panel-2)' : 'var(--line)';
    out += n === 1
      ? `<circle cx="150" cy="150" r="${r}" fill="${fill}"/>`
      : `<path d="M150 150 L${p(a0)} A${r} ${r} 0 ${large} 1 ${p(a1)} Z" fill="${fill}"/>`;
    const mid = ((a0 + seg / 2) * 180) / Math.PI;
    const label = d.name.length > 15 ? `${d.name.slice(0, 14)}…` : d.name;
    out += `<text transform="rotate(${mid} 150 150) translate(${150 + r - 12} 150)" text-anchor="end" dominant-baseline="middle"
      fill="var(--text)" font-size="13" font-family="var(--font-body)">${esc(label)}</text>`;
  });
  out += `<circle cx="150" cy="150" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3"/>
    <circle cx="150" cy="150" r="20" fill="var(--accent)"/>`;
  svg.innerHTML = out;
}

function spin() {
  if (spinning || !wheelItems.length) return;
  spinning = true;
  const n = wheelItems.length;
  const winner = Math.floor(Math.random() * n);
  const seg = 360 / n;
  // pointer sits at the top: rotate so the winner's middle ends there
  const target = 360 - (winner * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
  const current = ((wheelAngle % 360) + 360) % 360;
  wheelAngle += 360 * 5 + ((target - current + 360) % 360);
  spin.winner = wheelItems[winner];
  const svg = $('wheel');
  svg.style.transition = 'transform 4.2s cubic-bezier(.15,.85,.2,1)';
  svg.style.transform = `rotate(${wheelAngle}deg)`;
}

function spinDone() {
  if (!spinning) return;
  spinning = false;
  if (spin.winner) openRecipe(spin.winner.id, true);
}

// ================= Recipe =================
let recipe = null;
let step = 0;

async function openRecipe(id, fromWheel = false) {
  recipe = await call(ctx.socket, 'cocktails:recipe', { id });
  if (!recipe) return toast('Recept niet gevonden');
  step = 0;
  recipe.fromWheel = fromWheel;
  renderRecipe();
  $('recipe').classList.add('open');
}

function renderRecipe() {
  const r = recipe;
  const steps = r.steps.length ? r.steps : ['Geen bereiding beschikbaar.'];
  $('recipe-body').innerHTML = `
    <div class="sheet-head">
      <div>
        <span class="mono accent">${r.fromWheel ? 'Het rad heeft gesproken' : esc(r.glass)}</span>
        <h2 class="display" id="recipe-title">${esc(r.name)}</h2>
      </div>
      <div class="row">
        ${r.fromWheel ? '<button class="btn" data-r="again">Nog eens draaien</button>' : ''}
        <button class="btn" data-r="close">Sluiten</button>
      </div>
    </div>
    ${r.missing.length ? `<p class="warn">Je mist nog: ${esc(r.missing.join(', '))}</p>` : ''}
    <div class="recipe-cols">
      <div class="recipe-ing">
        ${r.thumb ? `<img src="${esc(r.thumb)}/medium" alt="">` : ''}
        <ul>${r.ingredients
          .map((i) => `<li class="${i.optional ? 'muted' : ''}"><span class="accent">${esc(i.measure || '')}</span> ${esc(i.name)}${i.optional ? ' (garnering)' : ''}</li>`)
          .join('')}</ul>
      </div>
      <div class="recipe-steps">
        <span class="mono muted">Stap ${step + 1} van ${steps.length}${r.lang === 'en' && getLang() === 'nl' ? ' · Engelstalig' : ''}</span>
        <p class="step-text">${esc(steps[step])}</p>
        <div class="step-dots">${steps.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
        <div class="row">
          <button class="btn" data-r="prev" ${step === 0 ? 'disabled' : ''}>Vorige stap</button>
          <button class="btn primary" data-r="next" ${step >= steps.length - 1 ? 'disabled' : ''}>Volgende stap</button>
        </div>
      </div>
    </div>`;
}

function onRecipeClick(e) {
  if (e.target.id === 'recipe') return close();
  const b = e.target.closest('[data-r]');
  if (!b) return;
  const a = b.dataset.r;
  if (a === 'close') close();
  if (a === 'again') {
    close();
    setTimeout(spin, 250);
  }
  if (a === 'next') step = Math.min(recipe.steps.length - 1, step + 1);
  if (a === 'prev') step = Math.max(0, step - 1);
  if (a === 'next' || a === 'prev') renderRecipe();
  function close() {
    $('recipe').classList.remove('open');
  }
}

// ================= Stock =================
export async function openStock() {
  const pin = await ctx.getPin();
  if (pin == null) return ctx.go('cocktails');
  stockData = await call(ctx.socket, 'stock:get');
  renderStock();
}

function renderStock() {
  const { groups, pantry, stock } = stockData;
  const have = new Set(stock.have);
  const pan = new Set(stock.pantry);
  const item = (id, label, on, kind) =>
    `<button class="check ${on ? 'on' : ''}" data-kind="${kind}" data-id="${id}"><span class="box">${on ? '✓' : ''}</span>${esc(label)}</button>`;
  $('stock-cols').innerHTML =
    groups
      .map((g) => `<div class="stock-col"><span class="mono accent">${esc(g.label)}</span>${g.items.map((i) => item(i.id, i.label, have.has(i.id), 'have')).join('')}</div>`)
      .join('') +
    `<div class="stock-col"><span class="mono accent">Ook in huis</span>${pantry.map((p) => item(p.id, p.label, pan.has(p.id), 'pantry')).join('')}
      ${stock.custom.length ? `<span class="mono accent" style="margin-top:16px">Eigen flessen</span>${stock.custom
        .map((c) => `<div class="custom-row"><span>${esc(c.name)}</span><button class="btn small" data-remove="${c.id}" aria-label="${esc(c.name)} verwijderen">×</button></div>`)
        .join('')}` : ''}
    </div>`;
  $('stock-count').textContent = `${stock.have.length + stock.custom.length} flessen aangevinkt`;
  const sel = $('custom-cat');
  if (!sel.options.length) {
    sel.innerHTML = '<option value="">Eigen categorie</option>' +
      groups.map((g) => `<optgroup label="${esc(g.label)}">${g.items.map((i) => `<option value="${i.id}">${esc(i.label)}</option>`).join('')}</optgroup>`).join('');
  }
}

async function onStockClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const pin = await ctx.getPin();
  if (pin == null) return;
  let res;
  if (b.dataset.remove) {
    res = await call(ctx.socket, 'stock:removeCustom', { pin, id: b.dataset.remove });
  } else if (b.dataset.kind) {
    const key = b.dataset.kind;
    const list = new Set(stockData.stock[key]);
    if (list.has(b.dataset.id)) list.delete(b.dataset.id);
    else list.add(b.dataset.id);
    res = await call(ctx.socket, 'stock:set', { pin, [key]: [...list] });
  }
  if (res?.ok) {
    stockData.stock = res.stock;
    renderStock();
  } else if (res) toast('Opslaan lukte niet');
}

async function addCustom(e) {
  e.preventDefault();
  const name = $('custom-name').value.trim();
  if (!name) return;
  const pin = await ctx.getPin();
  if (pin == null) return;
  const res = await call(ctx.socket, 'stock:addCustom', { pin, name, countsAs: $('custom-cat').value });
  if (res?.ok) {
    stockData.stock = res.stock;
    $('custom-name').value = '';
    renderStock();
    toast(`${name} toegevoegd`);
  }
}
