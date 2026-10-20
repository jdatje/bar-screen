// Pubquiz question bank: built-in starter set, your own sets (managed on /admin)
// and AI-generated questions (when ANTHROPIC_API_KEY is set).
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
  { id: 'film-tv', label: 'Film & tv' },
  { id: 'muziek', label: 'Muziek' },
  { id: 'eten-drinken', label: 'Eten & drinken' },
];
export const DIFFICULTIES = ['makkelijk', 'gemiddeld', 'moeilijk'];

const STARTER = JSON.parse(fs.readFileSync(new URL('../data-seed/starter-questions.json', import.meta.url), 'utf8'));

let own = load('questionsets', { sets: [] }); // [{ id, name, enabled, questions: [...] }]
let used = load('used-questions', { ids: [] });

const qid = (q) => crypto.createHash('sha1').update(q.q.toLowerCase().trim()).digest('hex').slice(0, 12);
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

// ---------- AI ----------
async function generate({ categories, difficulty, count }) {
  const cats = (categories?.length ? categories : CATEGORIES.map((c) => c.id)).map(catLabel).join(', ');
  const prompt = `Schrijf ${count} meerkeuzevragen voor een pubquiz in een Nederlandse thuisbar.
Categorieën (verdeel ze): ${cats}. Moeilijkheid: ${difficulty || 'gemiddeld'}.
Eisen: feitelijk juist en eenduidig, niet tijdgevoelig (geen "huidige" ministers of recordhouders), 4 antwoorden waarvan precies 1 goed, foute antwoorden geloofwaardig, kort genoeg om op een telefoon te lezen.
Antwoord ALLEEN met een JSON-array, zonder uitleg, in dit formaat:
[{"q":"vraag","options":["goed","fout","fout","fout"],"answer":0,"category":"${(categories && categories[0]) || 'algemeen'}","note":"korte leuke toelichting"}]
Gebruik als category een van: ${CATEGORIES.map((c) => c.id).join(', ')}.`;

  const text = await ask(prompt);
  return extractJson(text).filter(valid).map((q) => ({ ...q, difficulty: difficulty || 'gemiddeld', source: 'ai' }));
}

// ---------- Picking questions for a game ----------
/**
 * source: 'mix' (own + starter, topped up by AI) | 'own' | 'starter' | 'ai'
 */
export async function getQuestions({ source = 'mix', categories = [], difficulty = '', count = 10 }) {
  const catOk = (q) => !categories.length || categories.includes(q.category);
  const diffOk = (q) => !difficulty || q.difficulty === difficulty;

  let candidates = [];
  if (source === 'own' || source === 'mix') {
    candidates.push(...own.sets.filter((s) => s.enabled).flatMap((s) => s.questions));
  }
  if (source === 'starter' || source === 'mix') candidates.push(...STARTER);
  candidates = candidates.filter((q) => catOk(q) && diffOk(q));

  const usedSet = new Set(used.ids);
  let fresh = candidates.filter((q) => !usedSet.has(qid(q)));
  if (fresh.length < count && source !== 'ai') {
    // all used: start over for these questions
    const ids = new Set(candidates.map(qid));
    used.ids = used.ids.filter((id) => !ids.has(id));
    fresh = candidates;
  }

  let chosen = source === 'ai' ? [] : shuffle(fresh).slice(0, count);
  if (chosen.length < count && aiAvailable() && (source === 'ai' || source === 'mix')) {
    try {
      chosen.push(...(await generate({ categories, difficulty, count: count - chosen.length + 2 })).slice(0, count - chosen.length));
    } catch (err) {
      console.warn('AI question generation failed:', err.message);
    }
  }
  if (!chosen.length) throw new Error('Geen vragen gevonden voor deze keuze. Kies meer categorieën of een andere bron.');

  used.ids.push(...chosen.map(qid));
  used.ids = used.ids.slice(-2000);
  save('used-questions', used);
  return chosen.map((q) => ({ ...q, category: catLabel(q.category) }));
}
