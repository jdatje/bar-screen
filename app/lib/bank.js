// Pubquiz question bank:
//  - your own sets (managed on /admin)
//  - a built-in Dutch starter set
//  - Open Trivia DB (~5000 verified questions, English, CC BY-SA 4.0),
//    translated into Dutch by AI when ANTHROPIC_API_KEY is set
//  - AI-generated questions (when ANTHROPIC_API_KEY is set)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { load, save } from './store.js';
import { ask, extractJson, aiAvailable } from './ai.js';

// Category labels in English (for the English language setting)
const CATEGORY_EN = {
  algemeen: 'General', aardrijkskunde: 'Geography', geschiedenis: 'History', nederland: 'The Netherlands', sport: 'Sport',
  wetenschap: 'Science', 'dieren-natuur': 'Animals & nature', techniek: 'Technology', 'film-tv': 'Film & TV', muziek: 'Music',
  'kunst-cultuur': 'Art & culture', games: 'Games', 'eten-drinken': 'Food & drink',
};
export const categories = (lang = 'nl') => CATEGORIES.map((c) => ({ id: c.id, label: lang === 'en' ? CATEGORY_EN[c.id] || c.label : c.label }));
export const DIFFICULTY_EN = { makkelijk: 'easy', gemiddeld: 'medium', moeilijk: 'hard' };

// Question sets to pick from before a pubquiz
export const SETS = [
  { id: 'cafe', nl: 'Café-mix', en: 'Pub mix', nlInfo: 'Hollandse vragen + makkelijke internationale', enInfo: 'Dutch questions + easy international ones' },
  { id: 'hollands', nl: 'Hollands', en: 'Dutch', nlInfo: 'Over Nederland, Nederlandse muziek, tv en eten', enInfo: 'About the Netherlands, Dutch music, TV and food' },
  { id: 'opentdb', nl: 'Internationaal', en: 'International', nlInfo: 'Open Trivia DB: ruim 5000 vragen, vaak lastig', enInfo: 'Open Trivia DB: 5000+ questions, often tricky' },
  { id: 'own', nl: 'Eigen sets', en: 'Own sets', nlInfo: 'Jullie eigen vragen (/admin)', enInfo: 'Your own questions (/admin)' },
  { id: 'mix', nl: 'Alles', en: 'Everything', nlInfo: 'Alle bronnen door elkaar', enInfo: 'All sources mixed' },
  // only offered while a look of that party is on (see PARTY_OF_THEME in tiles.js)
  { id: 'griezel', look: 'spooky', nl: '🎃 Griezelquiz', en: '🎃 Spooky quiz', nlInfo: 'Halloween, horrorfilms, monsters en bijgeloof', enInfo: 'Halloween, horror films, monsters and superstition' },
  { id: 'oranje', look: 'dutch', nl: '🧡 Oranjequiz', en: '🧡 Orange quiz', nlInfo: 'Koningsdag, het koningshuis, Oranje in de sport en Hollandse trots', enInfo: 'King\'s Day, the royals, Dutch sport and Dutch pride' },
  { id: 'bier', look: 'oktoberfest', nl: '🍺 Bierquiz', en: '🍺 Beer quiz', nlInfo: 'Oktoberfest, bierstijlen, brouwen en Beierse tradities', enInfo: 'Oktoberfest, beer styles, brewing and Bavarian traditions' },
];

export const CATEGORIES = [
  { id: 'algemeen', label: 'Algemeen' },
  { id: 'aardrijkskunde', label: 'Aardrijkskunde' },
  { id: 'geschiedenis', label: 'Geschiedenis' },
  { id: 'nederland', label: 'Nederland' },
  { id: 'sport', label: 'Sport' },
  { id: 'wetenschap', label: 'Wetenschap' },
  { id: 'dieren-natuur', label: 'Dieren & natuur' },
  { id: 'techniek', label: 'Techniek' },
  { id: 'film-tv', label: 'Film & tv' },
  { id: 'muziek', label: 'Muziek' },
  { id: 'kunst-cultuur', label: 'Kunst & cultuur' },
  { id: 'games', label: 'Games' },
  { id: 'eten-drinken', label: 'Eten & drinken' },
];
export const DIFFICULTIES = ['makkelijk', 'gemiddeld', 'moeilijk'];

// Open Trivia DB category id -> our category
const OTDB_CATS = {
  9: 'algemeen', 10: 'kunst-cultuur', 11: 'film-tv', 12: 'muziek', 13: 'kunst-cultuur', 14: 'film-tv',
  15: 'games', 16: 'games', 17: 'wetenschap', 18: 'techniek', 19: 'wetenschap', 20: 'geschiedenis',
  21: 'sport', 22: 'aardrijkskunde', 23: 'geschiedenis', 24: 'geschiedenis', 25: 'kunst-cultuur',
  26: 'film-tv', 27: 'dieren-natuur', 28: 'techniek', 29: 'kunst-cultuur', 30: 'techniek', 31: 'film-tv', 32: 'film-tv',
};
const OTDB_DIFF = { easy: 'makkelijk', medium: 'gemiddeld', hard: 'moeilijk' };

const hash = (s) => crypto.createHash('sha1').update(s.toLowerCase().trim()).digest('hex').slice(0, 12);
const qid = (q) => q.id || hash(q.q);
const readSeed = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(new URL(`../data-seed/${name}`, import.meta.url), 'utf8'));
  } catch {
    return fallback;
  }
};

// Bilingual local questions: { q, options } in Dutch plus an `en` version
const STARTER = readSeed('starter-questions.json', []).map((q) => ({ ...q, lang: 'nl', source: 'starter' }));
const HOLLANDS = readSeed('hollands.json', []).map((q) => ({
  id: q.id, q: q.nl.q, options: q.nl.options, en: q.en, answer: q.answer, category: q.category, difficulty: q.difficulty, lang: 'nl', source: 'hollands',
}));
// question sets for party looks (only offered while that look is on)
const themed = (file, source) => readSeed(file, []).map((q) => ({
  id: q.id, q: q.nl.q, options: q.nl.options, en: q.en, answer: q.answer, category: q.category, difficulty: q.difficulty, lang: 'nl', source,
}));
const THEMED = { griezel: themed('griezel.json', 'griezel'), oranje: themed('oranje.json', 'oranje'), bier: themed('bier.json', 'bier') };
// Open Trivia DB categories most people at a Dutch bar will know something about
const FAMILIAR = new Set([9, 11, 12, 17, 20, 21, 22, 23, 27]);
const OPENTDB = readSeed('opentdb.json', []).map((r) => {
  const isBool = r.type === 'boolean';
  const options = isBool ? ['True', 'False'] : [r.correct, ...r.wrong];
  return {
    id: `otdb:${hash(r.q)}`,
    q: r.q,
    options,
    answer: isBool ? (r.correct === 'True' ? 0 : 1) : 0,
    category: OTDB_CATS[r.cat] || 'algemeen',
    difficulty: OTDB_DIFF[r.difficulty] || 'gemiddeld',
    lang: 'en',
    source: 'opentdb',
    familiar: FAMILIAR.has(r.cat) && r.difficulty === 'easy',
  };
});

let own = load('questionsets', { sets: [] }); // [{ id, name, enabled, questions: [...] }]
let used = load('used-questions', { ids: [] });
// qid -> { q, options } Dutch translation, options in original order.
// Bundled translations first; ones made on the device (AI) are added on top.
const SEED_NL = readSeed('opentdb-nl.json', {});
let nl = { ...SEED_NL, ...load('quiz-nl', {}) };

const catLabel = (id, lang = 'nl') => (lang === 'en' ? CATEGORY_EN[id] : CATEGORIES.find((c) => c.id === id)?.label) || id || '';
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export { aiAvailable };

export function stats() {
  const own_ = own.sets.filter((s) => s.enabled).reduce((n, s) => n + s.questions.length, 0);
  const perCat = {};
  for (const q of [...HOLLANDS, ...STARTER, ...OPENTDB]) perCat[q.category] = (perCat[q.category] || 0) + 1;
  return {
    own: own_,
    hollands: HOLLANDS.length,
    griezel: THEMED.griezel.length,
    oranje: THEMED.oranje.length,
    bier: THEMED.bier.length,
    starter: STARTER.length,
    opentdb: OPENTDB.length,
    translated: OPENTDB.filter((q) => nl[q.id]).length,
    perCategory: perCat,
  };
}

// ---------- Own sets ----------
export const listSets = () => own.sets.map(({ id, name, enabled, questions }) => ({ id, name, enabled, count: questions.length }));
export const getSet = (id) => own.sets.find((s) => s.id === id) || null;

export function valid(q) {
  return (
    q && typeof q.q === 'string' && q.q.trim() &&
    Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4 &&
    q.options.every((o) => typeof o === 'string' && o.trim()) &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length
  );
}

export function saveSet({ id, name, enabled = true, questions = [] }) {
  const clean = questions.filter(valid).map((q) => ({
    q: q.q.trim(),
    options: q.options.map((o) => o.trim()),
    answer: q.answer,
    category: q.category || 'algemeen',
    difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : 'gemiddeld',
    note: q.note || '',
  }));
  const set = { id: id || crypto.randomUUID(), name: String(name || 'Eigen set').slice(0, 60), enabled: Boolean(enabled), questions: clean };
  const i = own.sets.findIndex((s) => s.id === set.id);
  if (i >= 0) own.sets[i] = set;
  else own.sets.push(set);
  save('questionsets', own);
  return set;
}

export function deleteSet(id) {
  own.sets = own.sets.filter((s) => s.id !== id);
  save('questionsets', own);
}

// ---------- AI: new questions ----------
async function generate({ categories, difficulty, count }) {
  const cats = (categories?.length ? categories : CATEGORIES.map((c) => c.id)).map(catLabel).join(', ');
  const prompt = `Schrijf ${count} meerkeuzevragen voor een pubquiz in een Nederlandse thuisbar.
Categorieën (verdeel ze): ${cats}. Moeilijkheid: ${difficulty || 'gemiddeld'}.
Eisen: feitelijk juist en eenduidig, niet tijdgevoelig (geen "huidige" ministers of recordhouders), 4 antwoorden waarvan precies 1 goed, foute antwoorden geloofwaardig, kort genoeg om op een telefoon te lezen.
Antwoord ALLEEN met een JSON-array, zonder uitleg, in dit formaat:
[{"q":"vraag","options":["goed","fout","fout","fout"],"answer":0,"category":"${(categories && categories[0]) || 'algemeen'}","note":"korte leuke toelichting"}]
Gebruik als category een van: ${CATEGORIES.map((c) => c.id).join(', ')}.`;
  const text = await ask(prompt);
  return extractJson(text).filter(valid).map((q) => ({ ...q, difficulty: difficulty || 'gemiddeld', lang: 'nl', source: 'ai' }));
}

// ---------- AI: translating Open Trivia DB into Dutch ----------
async function translate(batch) {
  if (!batch.length) return;
  const input = batch.map((q) => ({ id: q.id, q: q.q, options: q.options }));
  const text = await ask(
    `Vertaal deze quizvragen van het Engels naar natuurlijk Nederlands voor een pubquiz.
Regels: behoud de betekenis exact; vertaal eigennamen, titels van films, boeken, games en nummers NIET tenzij er een gangbare Nederlandse naam is (landen en steden wel: "Germany" -> "Duitsland"); "True"/"False" wordt "Waar"/"Niet waar"; zelfde aantal antwoorden in dezelfde volgorde.
Antwoord ALLEEN met een JSON-array: [{"id":"...","q":"...","options":["..."]}]

${JSON.stringify(input)}`,
    { maxTokens: 8000 }
  );
  const out = extractJson(text);
  let n = 0;
  for (const t of out) {
    const src = batch.find((q) => q.id === t.id);
    if (src && typeof t.q === 'string' && Array.isArray(t.options) && t.options.length === src.options.length) {
      nl[t.id] = { q: t.q, options: t.options.map(String) };
      n++;
    }
  }
  if (n) save('quiz-nl', Object.fromEntries(Object.entries(nl).filter(([id]) => !SEED_NL[id])));
}

// Slowly translate the whole Open Trivia DB set in the background
export function startTranslator() {
  if (!aiAvailable() || !OPENTDB.length) return;
  const run = async () => {
    const todo = OPENTDB.filter((q) => !nl[q.id]).slice(0, 40);
    if (!todo.length) return console.log('Quiz translation complete');
    try {
      await translate(todo);
    } catch (err) {
      console.warn('Quiz translation batch failed:', err.message);
    }
    setTimeout(run, 20000);
  };
  setTimeout(run, 10000);
}

// The question in the language of the game
function display(q, lang) {
  if (lang === 'en') {
    if (q.en) return { ...q, ...q.en, lang: 'en' };
    return q; // English original, or an own (Dutch) question
  }
  return q.lang === 'en' && nl[q.id] ? { ...q, ...nl[q.id], lang: 'nl' } : q;
}

// ---------- Picking questions for a game ----------
/**
 * source: a SETS id ('cafe' | 'hollands' | 'opentdb' | 'own' | 'mix') or 'starter' | 'ai'
 * lang:   'nl' (Dutch; English questions translated, by AI on the fly if needed) | 'en' | 'all'
 */
export async function getQuestions({ source = 'cafe', categories = [], difficulty = '', count = 10, lang = 'nl' }) {
  const catOk = (q) => !categories.length || categories.includes(q.category);
  const diffOk = (q) => !difficulty || q.difficulty === difficulty;
  const canTranslate = aiAvailable();
  const ownQs = () => own.sets.filter((s) => s.enabled).flatMap((s) => s.questions.map((q) => ({ ...q, lang: 'nl', source: 'own' })));
  // English game: questions need an English version (own sets are shown as written)
  const langOk = (q) =>
    lang === 'all' || (lang === 'en' ? q.lang === 'en' || q.en || q.source === 'own' : q.lang !== 'en' || nl[q.id] || canTranslate);

  let candidates = [];
  if (source === 'own' || source === 'mix') candidates.push(...ownQs());
  if (source === 'hollands' || source === 'cafe' || source === 'mix') candidates.push(...HOLLANDS);
  if (source === 'starter' || source === 'cafe' || source === 'mix') candidates.push(...STARTER);
  if (source === 'opentdb' || source === 'mix') candidates.push(...OPENTDB);
  if (THEMED[source]) candidates.push(...THEMED[source]);
  if (source === 'cafe') candidates.push(...OPENTDB.filter((q) => q.familiar));
  candidates = candidates.filter((q) => catOk(q) && diffOk(q) && langOk(q));

  const usedSet = new Set(used.ids);
  let fresh = candidates.filter((q) => !usedSet.has(qid(q)));
  if (fresh.length < count && source !== 'ai') {
    // all used: start over for these questions
    const ids = new Set(candidates.map(qid));
    used.ids = used.ids.filter((id) => !ids.has(id));
    fresh = candidates;
  }

  let chosen = [];
  if (source !== 'ai') {
    const pool = shuffle(fresh);
    if (source === 'cafe') {
      // about two thirds Dutch-themed, the rest easy international
      const local = pool.filter((q) => q.source !== 'opentdb');
      const intl = pool.filter((q) => q.source === 'opentdb' && (lang !== 'nl' || nl[q.id]));
      const nIntl = Math.min(intl.length, Math.round(count / 3));
      chosen = [...intl.slice(0, nIntl), ...local.slice(0, count - nIntl)];
    } else {
      chosen = lang === 'nl'
        ? [...pool.filter((q) => q.lang !== 'en' || nl[q.id]), ...pool.filter((q) => q.lang === 'en' && !nl[q.id])].slice(0, count)
        : pool.slice(0, count);
    }
    chosen = shuffle(chosen);
  }

  // Dutch only: translate the English ones we picked right now
  if (lang === 'nl' && canTranslate) {
    const need = chosen.filter((q) => q.lang === 'en' && !nl[q.id]);
    if (need.length) {
      try {
        await translate(need);
      } catch (err) {
        console.warn('Translating chosen questions failed:', err.message);
      }
      chosen = chosen.filter((q) => q.lang !== 'en' || nl[q.id]);
    }
  }

  if (chosen.length < count && aiAvailable() && lang !== 'en' && (source === 'ai' || source === 'mix')) {
    try {
      chosen.push(...(await generate({ categories, difficulty, count: count - chosen.length + 2 })).slice(0, count - chosen.length));
    } catch (err) {
      console.warn('AI question generation failed:', err.message);
    }
  }
  if (!chosen.length) {
    throw new Error(
      lang === 'en'
        ? 'No questions found for this choice. Pick more categories or another set.'
        : 'Geen vragen gevonden voor deze keuze. Kies meer categorieën of een andere set.'
    );
  }

  used.ids.push(...chosen.map(qid));
  used.ids = used.ids.slice(-8000);
  save('used-questions', used);
  return chosen.map((q) => {
    const d = display(q, lang);
    return { ...d, category: catLabel(q.category, lang) };
  });
}
