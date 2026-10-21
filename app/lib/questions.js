// Turns song pools and question banks into quiz questions.
// Every question: { kind, prompt, options[], answer, track?, audio?, reveal{title, sub}, category? }
import { buildPool, hitsPool } from './musicpool.js';
import * as bank from './bank.js';

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const pick = (arr, n, exclude = () => false) => shuffle(arr.filter((x) => !exclude(x))).slice(0, n);

function withOptions(correct, distractors) {
  const options = shuffle([correct, ...distractors]);
  return { options, answer: options.indexOf(correct) };
}

const songLabel = (t) => `${t.title} — ${t.mainArtist}`;
const TEXT = {
  nl: { intro: 'Welk nummer hoor je?', year: 'In welk jaar kwam dit nummer uit?', artist: 'Wie zingt dit?', first: 'Welk nummer kwam als eerste uit?',
    tooFew: 'Te weinig nummers gevonden voor deze keuze. Kies meer genres of decennia.', tooFewHits: 'Te weinig nummers gevonden op Spotify. Is Spotify gekoppeld?' },
  en: { intro: 'Which song is this?', year: 'In which year was this song released?', artist: 'Who sings this?', first: 'Which song came out first?',
    tooFew: 'Not enough songs found for this choice. Pick more genres or decades.', tooFewHits: 'Not enough songs found on Spotify. Is Spotify linked?' },
};
let T = TEXT.nl;
const reveal = (t) => ({ title: t.title, sub: `${t.artist}${t.year ? ` · ${t.year}` : ''}`, art: t.art });

// ---------- Intro raden ----------
function introQuestion(t, pool) {
  // distractors: prefer the same decade, never the same artist
  const decade = Math.floor(t.year / 10);
  let others = pick(pool, 3, (o) => o === t || o.mainArtist === t.mainArtist || Math.floor(o.year / 10) !== decade);
  if (others.length < 3) others = pick(pool, 3, (o) => o === t || o.mainArtist === t.mainArtist);
  return {
    kind: 'intro',
    prompt: T.intro,
    ...withOptions(songLabel(t), others.map(songLabel)),
    track: t,
    audio: 'intro',
    reveal: reveal(t),
  };
}

// ---------- Popquiz (music trivia) ----------
function yearQuestion(t) {
  const offsets = shuffle([-6, -4, -3, -2, 2, 3, 4, 6]).slice(0, 3);
  const thisYear = new Date().getFullYear();
  const years = offsets.map((o) => t.year + o).map((y) => (y > thisYear ? y - 10 : y));
  return {
    kind: 'year',
    prompt: T.year,
    ...withOptions(String(t.year), years.map(String)),
    track: t,
    audio: 'hook',
    reveal: reveal(t),
  };
}

function artistQuestion(t, pool) {
  const artists = [...new Set(pool.map((o) => o.mainArtist))].filter((a) => a !== t.mainArtist);
  return {
    kind: 'artist',
    prompt: T.artist,
    ...withOptions(t.mainArtist, pick(artists, 3)),
    track: t,
    audio: 'hook',
    reveal: reveal(t),
  };
}

function firstQuestion(t, pool) {
  // 3 songs whose years are at least 3 apart; the oldest is correct
  const set = [t];
  for (const o of shuffle(pool)) {
    if (set.length === 3) break;
    if (!o.compilation && set.every((s) => Math.abs(s.year - o.year) >= 3 && s.mainArtist !== o.mainArtist)) set.push(o);
  }
  if (set.length < 3) return null;
  const oldest = set.reduce((a, b) => (a.year <= b.year ? a : b));
  return {
    kind: 'first',
    prompt: T.first,
    ...withOptions(songLabel(oldest), set.filter((s) => s !== oldest).map(songLabel)),
    track: oldest,
    audio: null,
    reveal: { title: oldest.title, sub: set.map((s) => `${s.title} (${s.year})`).join(' · '), art: oldest.art },
  };
}

export async function musicQuestions(type, settings, count) {
  T = TEXT[settings.lang] || TEXT.nl;
  const set = settings.set || 'hits';
  const pool =
    set === 'spotify'
      ? await buildPool({ genres: settings.genres, decades: settings.decades, playlists: settings.playlists, min: Math.max(30, count + 10) })
      : await hitsPool({ dutchOnly: set === 'nlhits', need: count + 4 });
  if (pool.filter((t) => t.uri).length < Math.min(8, count)) throw new Error(set === 'spotify' ? T.tooFew : T.tooFewHits);

  const out = [];
  const types = type === 'popquiz' ? (settings.types?.length ? settings.types : ['year', 'artist', 'first']) : ['intro'];
  for (const t of pool) {
    if (out.length >= count) break;
    if (!t.uri) continue; // answer option only
    const kind = types[out.length % types.length];
    let q = null;
    if (kind === 'intro') q = introQuestion(t, pool);
    else if (kind === 'year' && !t.compilation) q = yearQuestion(t);
    else if (kind === 'artist') q = artistQuestion(t, pool);
    else if (kind === 'first') q = firstQuestion(t, pool);
    if (q) out.push(q);
  }
  return out;
}

// ---------- Pubquiz ----------
export async function triviaQuestions(settings, count) {
  const items = await bank.getQuestions({
    source: settings.source,
    categories: settings.categories,
    difficulty: settings.difficulty,
    lang: settings.lang === 'en' ? 'en' : 'nl',
    count,
  });
  return items.map((it) => {
    const correct = it.options[it.answer];
    const { options, answer } = withOptions(correct, it.options.filter((_, i) => i !== it.answer));
    return {
      kind: 'trivia',
      prompt: it.q,
      category: it.category,
      options,
      answer,
      track: null,
      audio: null,
      reveal: { title: correct, sub: it.category || '', art: null, note: it.note || '' },
    };
  });
}

// exposed for tests
export const _generators = { introQuestion, yearQuestion, artistQuestion, firstQuestion };
