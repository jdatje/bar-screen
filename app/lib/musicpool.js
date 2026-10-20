// Builds a pool of songs for the music games from genre/decade searches
// and the user's own playlists, with include/exclude per genre.
import * as spotify from './spotify.js';

export const GENRES = [
  { id: 'pop', label: 'Pop', queries: ['genre:pop'] },
  { id: 'rock', label: 'Rock', queries: ['genre:rock', 'genre:"classic rock"'] },
  { id: 'nl', label: 'Nederlandstalig', queries: ['genre:"dutch pop"', 'genre:nederpop', 'genre:levenslied'] },
  { id: 'dance', label: 'Dance', queries: ['genre:dance', 'genre:edm'] },
  { id: 'hiphop', label: 'Hiphop', queries: ['genre:hip-hop', 'genre:rap'] },
  { id: 'rnb', label: 'R&B / Soul', queries: ['genre:r&b', 'genre:soul'] },
  { id: 'disco', label: 'Disco / Funk', queries: ['genre:disco', 'genre:funk'] },
  { id: 'indie', label: 'Indie', queries: ['genre:indie', 'genre:"indie rock"'] },
  { id: 'metal', label: 'Metal', queries: ['genre:metal', 'genre:"hard rock"'] },
  { id: 'country', label: 'Country', queries: ['genre:country'] },
  { id: 'latin', label: 'Latin', queries: ['genre:latin', 'genre:reggaeton'] },
  { id: 'jazz', label: 'Jazz / Swing', queries: ['genre:jazz', 'genre:swing'] },
];

export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((d) => ({
  id: String(d),
  label: `${String(d).slice(2)}s`,
  range: `year:${d}-${d + 9}`,
}));

const JUNK = /\b(karaoke|instrumental|live|remix|mix|acoustic|cover|tribute|8d|sped up|slowed|demo)\b/i;
const COMPILATION = /\b(greatest|hits|best of|collection|essentials?|anthology|deluxe|compilation|the very best|jaren|top 2000|years)\b/i;

// "Song - Remastered 2011" -> "Song"
export const cleanTitle = (t) =>
  t
    .replace(/\s*[-–]\s*(\d{4}\s*)?(remaster(ed)?|mono|stereo|single version|radio edit|original mix|version)\b.*$/i, '')
    .replace(/\s*\((\d{4}\s*)?(remaster(ed)?|mono|stereo|single version|radio edit|from .*)\)\s*$/i, '')
    .trim();

const key = (t) => `${cleanTitle(t.title).toLowerCase()}|${t.mainArtist.toLowerCase()}`;
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * @param {object} o
 * @param {Record<string,'in'|'out'>} o.genres  chip states; none 'in' = all except 'out'
 * @param {string[]} o.decades                  empty = all decades
 * @param {string[]} o.playlists                own playlist ids
 * @param {number} o.min                        tracks needed
 */
export async function buildPool({ genres = {}, decades = [], playlists = [], min = 40 }) {
  const included = GENRES.filter((g) => genres[g.id] === 'in');
  const usable = (included.length ? included : GENRES).filter((g) => genres[g.id] !== 'out');
  const decs = decades.length ? DECADES.filter((d) => decades.includes(d.id)) : DECADES.filter((d) => d.id >= '1970');

  const tracks = new Map();
  const add = (list) => {
    for (const t of list) {
      if (JUNK.test(t.title) || !t.year) continue;
      const k = key(t);
      if (!tracks.has(k)) tracks.set(k, { ...t, title: cleanTitle(t.title), compilation: COMPILATION.test(t.album || '') });
    }
  };

  for (const id of playlists) add(await spotify.getPlaylistTracks(id).catch(() => []));

  // Only search when genres/decades are wanted on top of (or instead of) playlists
  const wantSearch = !playlists.length || included.length || decades.length;
  if (wantSearch && usable.length) {
    const combos = shuffle(usable.flatMap((g) => g.queries.map((q) => ({ q }))).flatMap(({ q }) => decs.map((d) => `${q} ${d.range}`)));
    const perQuery = Math.max(10, Math.ceil((min * 1.6) / combos.length / 10) * 10);
    for (const q of combos) {
      if (tracks.size >= min * 2) break;
      add(await spotify.searchTracks(q, { count: perQuery, startOffset: Math.floor(Math.random() * 3) * 10 }).catch(() => []));
    }
  }
  return shuffle([...tracks.values()]);
}

export async function getSourceOptions() {
  let playlists = [];
  try {
    playlists = await spotify.getMyPlaylists();
  } catch {
    // not logged in yet
  }
  return {
    genres: GENRES.map(({ id, label }) => ({ id, label })),
    decades: DECADES.map(({ id, label }) => ({ id, label })),
    playlists,
  };
}
