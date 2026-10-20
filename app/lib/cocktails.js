// Cocktail library: imported from TheCocktailDB (cached on disk, refreshed
// every two weeks), filtered by what's on the shelf.
import fs from 'node:fs';
import { load, save } from './store.js';
import * as bar from './bar.js';
import { aiAvailable, ask, extractJson } from './ai.js';

const API = 'https://www.thecocktaildb.com/api/json/v1/1';
const REFRESH_DAYS = 14;
const SEED = JSON.parse(fs.readFileSync(new URL('../data-seed/cocktails-seed.json', import.meta.url), 'utf8'));

let library = load('cocktails', { fetchedAt: 0, drinks: [] });
if (!library.drinks.length) library = { fetchedAt: 0, drinks: SEED };
let translations = load('translations', {}); // drinkId -> { steps: [...] }

// ---------- Import ----------
function normalizeDrink(d) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const name = d[`strIngredient${i}`];
    if (name && name.trim()) ingredients.push({ name: name.trim(), measure: (d[`strMeasure${i}`] || '').trim() });
  }
  return {
    id: d.idDrink,
    name: d.strDrink,
    alcoholic: d.strAlcoholic !== 'Non alcoholic',
    category: d.strCategory || '',
    glass: d.strGlass || '',
    iba: d.strIBA || null,
    thumb: d.strDrinkThumb || null,
    instructions: d.strInstructions || '',
    ingredients,
  };
}

export async function refresh() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const drinks = new Map();
  for (const c of chars) {
    const res = await fetch(`${API}/search.php?f=${c}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`TheCocktailDB ${res.status}`);
    const data = await res.json();
    for (const d of data.drinks || []) drinks.set(d.idDrink, normalizeDrink(d));
    await new Promise((r) => setTimeout(r, 250));
  }
  if (drinks.size < 100) throw new Error(`Only ${drinks.size} drinks received`);
  library = { fetchedAt: Date.now(), drinks: [...drinks.values()] };
  save('cocktails', library);
  console.log(`Cocktail library refreshed: ${drinks.size} drinks`);
  return drinks.size;
}

export function scheduleRefresh() {
  const run = () =>
    refresh().catch((err) => {
      console.warn('Cocktail import failed, retrying in an hour:', err.message);
      setTimeout(run, 60 * 60 * 1000);
    });
  if (Date.now() - library.fetchedAt > REFRESH_DAYS * 864e5) run();
  setInterval(() => {
    if (Date.now() - library.fetchedAt > REFRESH_DAYS * 864e5) run();
  }, 864e5);
}

export const libraryInfo = () => ({ count: library.drinks.length, fetchedAt: library.fetchedAt, seed: !library.fetchedAt });

// ---------- Matching ----------
const BASES = [
  { id: 'gin', label: 'Gin', bottles: ['gin', 'genever', 'sloe-gin'] },
  { id: 'rum', label: 'Rum', bottles: ['light-rum', 'dark-rum', 'spiced-rum', 'rum-any', 'cachaca', 'coconut-rum'] },
  { id: 'whiskey', label: 'Whisk(e)y', bottles: ['bourbon', 'rye', 'scotch', 'irish', 'whiskey-any'] },
  { id: 'vodka', label: 'Vodka', bottles: ['vodka'] },
  { id: 'tequila', label: 'Tequila / mezcal', bottles: ['tequila', 'mezcal'] },
  { id: 'brandy', label: 'Brandy', bottles: ['cognac', 'calvados', 'pisco'] },
];
const baseOf = (bottleIds) => BASES.find((b) => bottleIds.some((id) => b.bottles.includes(id)))?.id || 'overig';

function tags(d, kinds) {
  const ids = kinds.map((k) => k.id);
  const t = [];
  if (ids.some((id) => ['campari', 'aperol', 'amaro', 'fernet'].includes(id))) t.push('bitter');
  if (ids.some((id) => ['lemon', 'lime', 'grapefruit'].includes(id))) t.push('zuur');
  if (ids.some((id) => ['cream', 'irish-cream', 'egg', 'coconut-cream'].includes(id))) t.push('romig');
  if (ids.some((id) => ['soda', 'tonic', 'cola', 'ginger-beer', 'lemonade', 'bubbles'].includes(id))) t.push('lang');
  if (kinds.every((k) => k.kind === 'bottle' || k.id === 'syrup')) t.push('sterk');
  return t;
}

function evaluate(d, haveBottles, havePantry) {
  const kinds = d.ingredients.map((i) => bar.classify(i.name)).filter((k) => k.kind !== 'ignore');
  const missingBottles = [];
  const missingOther = [];
  for (const k of kinds) {
    if (k.kind === 'bottle' && !haveBottles.has(k.id)) missingBottles.push(k.id);
    else if (k.kind === 'pantry' && !havePantry.has(k.id)) missingOther.push(k.label);
    else if (k.kind === 'unknown') missingOther.push(k.label);
  }
  const uniqMissing = [...new Set(missingBottles)];
  const status =
    !uniqMissing.length && !missingOther.length ? 'now' : uniqMissing.length === 1 && !missingOther.length ? 'almost' : 'no';
  const bottles = kinds.filter((k) => k.kind === 'bottle').map((k) => k.id);
  return { status, missingBottles: uniqMissing, missingOther, base: baseOf(bottles), tags: tags(d, kinds) };
}

const summary = (d, e) => ({
  id: d.id,
  name: d.name,
  thumb: d.thumb,
  classic: Boolean(d.iba),
  base: e.base,
  baseLabel: BASES.find((b) => b.id === e.base)?.label || 'Overig',
  tags: e.tags,
  status: e.status,
  missing: e.missingBottles.map(bar.bottleLabel),
  ingredients: [...new Set(d.ingredients.filter((i) => bar.classify(i.name).kind !== 'ignore').map((i) => i.name.trim()))],
});

/**
 * filters: { status: 'now'|'almost', base: id|'', tag: id|'', unknownOnly: bool, query: '' }
 */
export function menu(filters = {}) {
  const haveBottles = bar.availableBottles();
  const havePantry = bar.availablePantry();
  const all = library.drinks
    .filter((d) => d.alcoholic)
    .map((d) => ({ d, e: evaluate(d, haveBottles, havePantry) }));

  const counts = {
    now: all.filter((x) => x.e.status === 'now').length,
    almost: all.filter((x) => x.e.status === 'almost').length,
  };

  // "one bottle away": which bottle would unlock the most drinks
  const unlock = new Map();
  for (const x of all) if (x.e.status === 'almost') unlock.set(x.e.missingBottles[0], (unlock.get(x.e.missingBottles[0]) || 0) + 1);
  const shopping = [...unlock.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, label: bar.bottleLabel(id), unlocks: n }));

  const q = String(filters.query || '').toLowerCase();
  const list = all
    .filter((x) => x.e.status === (filters.status || 'now'))
    .filter((x) => !filters.base || x.e.base === filters.base)
    .filter((x) => !filters.tag || x.e.tags.includes(filters.tag))
    .filter((x) => !filters.unknownOnly || !x.d.iba)
    .filter((x) => !q || x.d.name.toLowerCase().includes(q))
    .map((x) => summary(x.d, x.e))
    .sort((a, b) => Number(b.classic) - Number(a.classic) || a.name.localeCompare(b.name));

  return {
    list,
    counts,
    shopping,
    bases: BASES.map(({ id, label }) => ({ id, label })),
    tags: [
      { id: 'bitter', label: 'Bitter' },
      { id: 'zuur', label: 'Zuur' },
      { id: 'sterk', label: 'Sterk' },
      { id: 'lang', label: 'Lang & fris' },
      { id: 'romig', label: 'Romig' },
    ],
    library: libraryInfo(),
  };
}

// ---------- Recipe ----------
// "1 1/2 oz" -> "4,5 cl"
export function toMetric(measure) {
  const m = String(measure || '').trim();
  const range = m.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*oz\b(.*)$/i);
  if (range) return `${fmtCl(Number(range[1]) * 3)}-${fmtCl(Number(range[2]) * 3)} cl${range[3] || ''}`.trim();
  const oz = m.match(/^((?:\d+\s+)?\d+(?:[./]\d+)?)\s*oz\b(.*)$/i);
  if (!oz) return m.replace(/\bshots?\b/i, (s) => (s.toLowerCase().startsWith('shot') ? 'shot (4 cl)' : s));
  const amount = oz[1]
    .trim()
    .split(/\s+/)
    .reduce((sum, part) => {
      if (part.includes('/')) {
        const [a, b] = part.split('/').map(Number);
        return sum + a / b;
      }
      return sum + Number(part);
    }, 0);
  return `${fmtCl(amount * 3)} cl${oz[2] || ''}`.trim();
}
const fmtCl = (cl) => String(Math.round(cl * 2) / 2).replace('.', ',');

const splitSteps = (text) =>
  String(text || '')
    .replace(/\r/g, '')
    .split(/(?<=[.!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

export async function recipe(id) {
  const d = library.drinks.find((x) => x.id === id);
  if (!d) return null;
  const e = evaluate(d, bar.availableBottles(), bar.availablePantry());
  let steps = translations[id]?.steps;
  let lang = 'nl';
  if (!steps && aiAvailable()) {
    try {
      const text = await ask(
        `Vertaal deze cocktailbereiding naar natuurlijk Nederlands en splits haar in korte, genummerde stappen voor een bar zonder garnituur-voorraad (garnering mag als optioneel). Antwoord alleen met een JSON-array van strings.\n\nCocktail: ${d.name}\nIngrediënten: ${d.ingredients.map((i) => `${i.measure} ${i.name}`).join(', ')}\nBereiding: ${d.instructions}`,
        { maxTokens: 800 }
      );
      steps = extractJson(text).filter((s) => typeof s === 'string');
      translations[id] = { steps };
      save('translations', translations);
    } catch (err) {
      console.warn('Recipe translation failed:', err.message);
    }
  }
  if (!steps) {
    steps = splitSteps(d.instructions);
    lang = 'en';
  }
  return {
    id: d.id,
    name: d.name,
    thumb: d.thumb,
    glass: d.glass,
    classic: Boolean(d.iba),
    status: e.status,
    missing: e.missingBottles.map(bar.bottleLabel).concat(e.missingOther),
    ingredients: d.ingredients.map((i) => ({
      name: i.name,
      measure: toMetric(i.measure),
      optional: bar.classify(i.name).garnish === true,
    })),
    steps,
    lang,
  };
}
