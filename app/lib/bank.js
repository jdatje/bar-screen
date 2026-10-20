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

const STARTER = readSeed('starter-questions.json', []).map((q) => ({ ...q, lang: 'nl', source: 'starter' }));
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
  };
});

let own = load('questionsets', { sets: [] }); // [{ id, name, enabled, questions: [...] }]
let used = load('used-questions', { ids: [] });
// qid -> { q, options } Dutch translation, options in original order.
// Bundled translations first; ones made on the device (AI) are added on top.
const SEED_NL = readSeed('opentdb-nl.json', {});
let nl = { ...SEED_NL, ...load('quiz-nl', {}) };

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id || '';
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
  for (const q of [...STARTER, ...OPENTDB]) perCat[q.category] = (perCat[q.category] || 0) + 1;
  return {
    own: own_,
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

const display = (q) => (q.lang === 'en' && nl[q.id] ? { ...q, ...nl[q.id], lang: 'nl' } : q);

// ---------- Picking questions for a game ----------
/**
 * source: 'mix' (everything) | 'own' | 'starter' | 'opentdb' | 'ai'
 * lang:   'nl' (Dutch only; English questions are translated on the fly with AI) | 'all'
 */
export async function getQuestions({ source = 'mix', categories = [], difficulty = '', count = 10, lang = 'nl' }) {
  const catOk = (q) => !categories.length || categories.includes(q.category);
  const diffOk = (q) => !difficulty || q.difficulty === difficulty;
  const canTranslate = aiAvailable();
  const langOk = (q) => lang === 'all' || q.lang !== 'en' || nl[q.id] || canTranslate;

  let candidates = [];
  if (source === 'own' || source === 'mix') {
    candidates.push(...own.sets.filter((s) => s.enabled).flatMap((s) => s.questions.map((q) => ({ ...q, lang: 'nl', source: 'own' }))));
  }
  if (source === 'starter' || source === 'mix') candidates.push(...STARTER);
  if (source === 'opentdb' || source === 'mix') candidates.push(...OPENTDB);
  candidates = candidates.filter((q) => catOk(q) && diffOk(q) && langOk(q));

  const usedSet = new Set(used.ids);
  let fresh = candidates.filter((q) => !usedSet.has(qid(q)));
  if (fresh.length < count && source !== 'ai') {
    // all used: start over for these questions
    const ids = new Set(candidates.map(qid));
    used.ids = used.ids.filter((id) => !ids.has(id));
    fresh = candidates;
  }

  // prefer Dutch questions; with lang 'all' mix freely
  let chosen = [];
  if (source !== 'ai') {
    const pool = shuffle(fresh);
    chosen = lang === 'nl'
      ? [...pool.filter((q) => q.lang !== 'en' || nl[q.id]), ...pool.filter((q) => q.lang === 'en' && !nl[q.id])].slice(0, count)
      : pool.slice(0, count);
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

  if (chosen.length < count && aiAvailable() && (source === 'ai' || source === 'mix')) {
    try {
      chosen.push(...(await generate({ categories, difficulty, count: count - chosen.length + 2 })).slice(0, count - chosen.length));
    } catch (err) {
      console.warn('AI question generation failed:', err.message);
    }
  }
  if (!chosen.length) {
    throw new Error(
      lang === 'nl' && !canTranslate
        ? 'Te weinig Nederlandse vragen voor deze keuze. Zet "Ook Engelstalige vragen" aan of kies meer categorieën.'
        : 'Geen vragen gevonden voor deze keuze. Kies meer categorieën of een andere bron.'
    );
  }

  used.ids.push(...chosen.map(qid));
  used.ids = used.ids.slice(-8000);
  save('used-questions', used);
  return chosen.map((q) => {
    const d = display(q);
    return { ...d, category: catLabel(q.category), lang: d.lang || 'nl' };
  });
}
