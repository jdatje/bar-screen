// What's on the shelf: default bottle list, pantry items, custom bottles,
// and matching TheCocktailDB ingredient names to those.
import crypto from 'node:crypto';
import { load, save } from './store.js';

// match: lower-case ingredient names (exact) or 'contains:' keywords
export const BOTTLE_GROUPS = [
  {
    id: 'basis', label: 'Basis', items: [
      { id: 'vodka', label: 'Vodka', match: ['vodka', 'absolut citron', 'absolut vodka', 'absolut kurant', 'lemon vodka', 'vanilla vodka', 'citrus vodka', 'contains:vodka', 'contains:absolut'] },
      { id: 'gin', label: 'Gin', match: ['gin', 'dry gin', 'london dry gin', 'tanqueray', 'old tom gin'] },
      { id: 'light-rum', label: 'Witte rum', match: ['light rum', 'white rum', 'silver rum', 'bacardi limon', 'bacardi'] },
      { id: 'dark-rum', label: 'Donkere rum', match: ['dark rum', 'gold rum', 'añejo rum', 'anejo rum', 'black rum', 'aged rum', '151 proof rum', 'overproof rum', 'jamaican rum', 'demerara rum'] },
      { id: 'spiced-rum', label: 'Spiced rum', match: ['spiced rum', 'captain morgan'] },
      { id: 'tequila', label: 'Tequila', match: ['tequila', 'blanco tequila', 'silver tequila', 'reposado tequila', 'gold tequila', 'añejo tequila'] },
      { id: 'mezcal', label: 'Mezcal', match: ['mezcal'] },
      { id: 'bourbon', label: 'Bourbon', match: ['bourbon', 'jim beam', 'wild turkey', 'makers mark', 'jack daniels', 'tennessee whiskey'] },
      { id: 'rye', label: 'Rye whiskey', match: ['rye whiskey', 'rye', 'canadian whisky', 'crown royal'] },
      { id: 'scotch', label: 'Scotch', match: ['scotch', 'blended scotch', 'islay single malt scotch', 'johnnie walker', 'single malt scotch'] },
      { id: 'irish', label: 'Irish whiskey', match: ['irish whiskey', 'jameson'] },
    ],
  },
  {
    id: 'overig', label: 'Brandy & overig', items: [
      { id: 'cognac', label: 'Cognac / brandy', match: ['cognac', 'brandy'] },
      { id: 'calvados', label: 'Calvados', match: ['calvados', 'apple brandy', 'applejack'] },
      { id: 'pisco', label: 'Pisco', match: ['pisco'] },
      { id: 'cachaca', label: 'Cachaça', match: ['cachaca', 'cachaça'] },
      { id: 'genever', label: 'Jenever', match: ['genever', 'jenever'] },
      { id: 'absinthe', label: 'Absint / pastis', match: ['absinthe', 'pernod', 'pastis', 'ricard', 'anis', 'anisette'] },
      { id: 'sambuca', label: 'Sambuca', match: ['sambuca'] },
      { id: 'port', label: 'Port', match: ['port', 'ruby port', 'tawny port'] },
      { id: 'sherry', label: 'Sherry', match: ['sherry', 'dry sherry', 'cream sherry'] },
      { id: 'bubbles', label: 'Prosecco / champagne', match: ['champagne', 'prosecco', 'sparkling wine', 'cava'] },
      { id: 'wine', label: 'Wijn', match: ['red wine', 'white wine', 'wine', 'rose wine'] },
      { id: 'beer', label: 'Bier', match: ['beer', 'lager', 'ale', 'guinness stout', 'stout', 'corona'] },
    ],
  },
  {
    id: 'likeur', label: 'Likeuren', items: [
      { id: 'triple-sec', label: 'Triple sec / Cointreau', match: ['triple sec', 'cointreau', 'grand marnier', 'orange curacao', 'curacao', 'orange liqueur'] },
      { id: 'blue-curacao', label: 'Blue curaçao', match: ['blue curacao'] },
      { id: 'maraschino', label: 'Maraschino', match: ['maraschino liqueur', 'maraschino', 'luxardo maraschino'] },
      { id: 'green-chartreuse', label: 'Groene Chartreuse', match: ['green chartreuse', 'chartreuse'] },
      { id: 'yellow-chartreuse', label: 'Gele Chartreuse', match: ['yellow chartreuse'] },
      { id: 'benedictine', label: 'Bénédictine', match: ['benedictine', 'dom benedictine', 'bénédictine'] },
      { id: 'cassis', label: 'Crème de cassis', match: ['creme de cassis', 'crème de cassis'] },
      { id: 'elderflower', label: 'Vlierbloesemlikeur', match: ['elderflower liqueur', 'st. germain', 'st germain'] },
      { id: 'amaretto', label: 'Amaretto', match: ['amaretto', 'disaronno'] },
      { id: 'coffee-liqueur', label: 'Koffielikeur', match: ['kahlua', 'coffee liqueur', 'tia maria'] },
      { id: 'irish-cream', label: 'Irish cream', match: ['baileys irish cream', 'irish cream', 'baileys'] },
      { id: 'cacao', label: 'Crème de cacao', match: ['creme de cacao', 'white creme de cacao', 'dark creme de cacao', 'crème de cacao'] },
      { id: 'coconut-rum', label: 'Kokosrum (Malibu)', match: ['malibu rum', 'coconut rum', 'malibu', 'coconut liqueur'] },
      { id: 'peach-schnapps', label: 'Perziklikeur', match: ['peach schnapps', 'peach liqueur', 'peachtree schnapps'] },
      { id: 'apricot', label: 'Abrikozenlikeur', match: ['apricot brandy', 'apricot liqueur'] },
      { id: 'cherry-liqueur', label: 'Kersenlikeur', match: ['cherry brandy', 'cherry heering', 'cherry liqueur', 'kirschwasser', 'kirsch'] },
      { id: 'melon', label: 'Meloenlikeur (Midori)', match: ['midori melon liqueur', 'midori', 'melon liqueur'] },
      { id: 'galliano', label: 'Galliano', match: ['galliano'] },
      { id: 'limoncello', label: 'Limoncello', match: ['limoncello'] },
      { id: 'drambuie', label: 'Drambuie', match: ['drambuie'] },
      { id: 'frangelico', label: 'Frangelico', match: ['frangelico', 'hazelnut liqueur'] },
      { id: 'southern-comfort', label: 'Southern Comfort', match: ['southern comfort'] },
      { id: 'jagermeister', label: 'Jägermeister', match: ['jägermeister', 'jagermeister'] },
      { id: 'sloe-gin', label: 'Sloe gin', match: ['sloe gin'] },
      { id: 'falernum', label: 'Falernum', match: ['falernum', 'velvet falernum'] },
      { id: 'raspberry', label: 'Frambozenlikeur (Chambord)', match: ['chambord raspberry liqueur', 'chambord', 'raspberry liqueur', 'creme de framboise'] },
      { id: 'menthe', label: 'Crème de menthe', match: ['white creme de menthe', 'green creme de menthe', 'creme de menthe'] },
      { id: 'banana', label: 'Bananenlikeur', match: ['banana liqueur', 'creme de banane', 'pisang ambon'] },
      { id: 'passion', label: 'Passievruchtlikeur (Passoa)', match: ['passoa', 'passion fruit liqueur'] },
    ],
  },
  {
    id: 'vermout', label: 'Vermout & bitters', items: [
      { id: 'sweet-vermouth', label: 'Zoete vermout', match: ['sweet vermouth', 'vermouth', 'red vermouth', 'rosso vermouth', 'martini rosso'] },
      { id: 'dry-vermouth', label: 'Droge vermout', match: ['dry vermouth', 'white vermouth', 'martini extra dry'] },
      { id: 'lillet', label: 'Lillet Blanc', match: ['lillet blanc', 'lillet', 'kina lillet'] },
      { id: 'campari', label: 'Campari', match: ['campari'] },
      { id: 'aperol', label: 'Aperol', match: ['aperol'] },
      { id: 'angostura', label: 'Angostura', match: ['angostura bitters', 'bitters', 'aromatic bitters'] },
      { id: 'orange-bitters', label: 'Orange bitters', match: ['orange bitters'] },
      { id: 'peychauds', label: "Peychaud's", match: ["peychaud bitters", "peychaud's bitters", 'peychauds bitters'] },
      { id: 'fernet', label: 'Fernet-Branca', match: ['fernet branca', 'fernet'] },
      { id: 'amaro', label: 'Amaro', match: ['amaro', 'amaro montenegro', 'averna', 'cynar'] },
    ],
  },
];

export const PANTRY = [
  { id: 'lemon', label: 'Citroenen', match: ['lemon', 'lemon juice', 'fresh lemon juice', 'juice of lemon', 'sweet and sour', 'sour mix'], default: true },
  { id: 'lime', label: 'Limoenen', match: ['lime', 'lime juice', 'fresh lime juice', 'juice of lime'], default: true },
  { id: 'syrup', label: 'Suikersiroop', match: ['sugar syrup', 'simple syrup', 'syrup', 'gomme syrup', 'rich simple syrup'], default: true },
  { id: 'orange-juice', label: 'Sinaasappelsap', match: ['orange juice', 'orange', 'blood orange'] },
  { id: 'cranberry', label: 'Cranberrysap', match: ['cranberry juice', 'cranberries'] },
  { id: 'pineapple', label: 'Ananassap', match: ['pineapple juice', 'pineapple'] },
  { id: 'grapefruit', label: 'Grapefruitsap', match: ['grapefruit juice', 'grapefruit'] },
  { id: 'tomato', label: 'Tomatensap', match: ['tomato juice', 'clamato juice'] },
  { id: 'apple-juice', label: 'Appelsap', match: ['apple juice', 'apple cider', 'cider'] },
  { id: 'tonic', label: 'Tonic', match: ['tonic water', 'tonic'] },
  { id: 'soda', label: 'Spuitwater', match: ['soda water', 'club soda', 'carbonated water', 'sparkling water', 'seltzer water'] },
  { id: 'cola', label: 'Cola', match: ['cola', 'coca-cola', 'coke', 'pepsi cola'] },
  { id: 'ginger-beer', label: 'Gingerbeer / ginger ale', match: ['ginger beer', 'ginger ale'] },
  { id: 'lemonade', label: 'Lemon-lime frisdrank', match: ['7-up', 'sprite', 'lemon-lime soda', 'lemonade', 'bitter lemon'] },
  { id: 'grenadine', label: 'Grenadine', match: ['grenadine'] },
  { id: 'orgeat', label: 'Orgeat (amandelsiroop)', match: ['orgeat syrup', 'orgeat', 'almond syrup'] },
  { id: 'honey', label: 'Honing', match: ['honey', 'honey syrup'] },
  { id: 'mint', label: 'Verse munt', match: ['mint', 'fresh mint', 'mint leaves'] },
  { id: 'egg', label: 'Eieren', match: ['egg white', 'egg', 'egg yolk', 'whole egg'] },
  { id: 'cream', label: 'Room / melk', match: ['cream', 'heavy cream', 'light cream', 'milk', 'half-and-half', 'whipping cream', 'double cream', 'whipped cream', 'condensed milk'] },
  { id: 'coconut-cream', label: 'Kokosroom', match: ['coconut cream', 'cream of coconut', 'coconut milk'] },
  { id: 'coffee', label: 'Koffie / espresso', match: ['coffee', 'espresso', 'cold brew coffee', 'strong coffee'] },
  { id: 'worcestershire', label: 'Worcestershire / tabasco', match: ['worcestershire sauce', 'tabasco sauce', 'hot sauce'] },
  { id: 'cucumber', label: 'Komkommer', match: ['cucumber'] },
];

// Garnish: nice to have, never blocks a cocktail
const GARNISH = new Set([
  'cherry', 'maraschino cherry', 'cocktail cherry', 'olive', 'olives', 'orange peel', 'lemon peel', 'lime peel',
  'orange spiral', 'lemon twist', 'twist of lemon peel', 'twist of orange peel', 'orange slice', 'lime wedge',
  'lemon wedge', 'celery', 'cocktail onion', 'mint sprig', 'rosemary', 'thyme', 'lavender',
]);
// Always assumed to be in the house
const IGNORE = new Set([...GARNISH,
  'ice', 'crushed ice', 'ice cubes', 'water', 'hot water', 'cold water', 'salt', 'sugar', 'brown sugar', 'powdered sugar',
  'sugar cubes', 'sugar cube', 'caster sugar', 'nutmeg', 'cinnamon', 'pepper', 'black pepper', 'celery salt',
  'cherry', 'maraschino cherry', 'cocktail cherry', 'olive', 'olives', 'orange peel', 'lemon peel', 'lime peel',
  'orange spiral', 'lemon twist', 'twist of lemon peel', 'twist of orange peel', 'orange slice', 'lime wedge',
  'lemon wedge', 'celery', 'cloves', 'star anise', 'vanilla extract', 'cocktail onion', 'olive brine', 'demerara sugar',
  'vanilla', 'cardamom', 'rosemary', 'thyme', 'lavender', 'mint sprig', 'whole cloves',
]);

const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

let stock = load('stock', {
  have: [],
  custom: [], // [{ id, name, countsAs }]
  pantry: PANTRY.filter((p) => p.default).map((p) => p.id),
});

const allBottles = () => BOTTLE_GROUPS.flatMap((g) => g.items);

// ingredient name -> { kind: 'bottle'|'pantry'|'ignore'|'unknown', id, label }
const cache = new Map();
export function classify(name) {
  const n = norm(name);
  if (cache.has(n)) return cache.get(n);
  let out = null;
  if (IGNORE.has(n)) out = { kind: 'ignore', garnish: GARNISH.has(n) };
  // exact matches first
  for (const b of allBottles()) if (!out && b.match.includes(n)) out = { kind: 'bottle', id: b.id, label: b.label };
  for (const p of PANTRY) if (!out && p.match.includes(n)) out = { kind: 'pantry', id: p.id, label: p.label };
  // then keyword matches, e.g. "absolut peppar" -> vodka
  for (const b of allBottles()) {
    if (out) break;
    if (b.match.some((m) => m.startsWith('contains:') && n.includes(m.slice(9)))) out = { kind: 'bottle', id: b.id, label: b.label };
  }
  // custom bottles typed by name
  for (const c of stock.custom) if (!out && norm(c.name) === n) out = { kind: 'bottle', id: c.countsAs || `custom:${c.id}`, label: c.name };
  if (!out) {
    if (/whisk(e)?y/.test(n)) out = { kind: 'bottle', id: 'whiskey-any', label: 'Whisk(e)y' };
    else if (/\brum\b/.test(n)) out = { kind: 'bottle', id: 'rum-any', label: 'Rum' };
    else if (/juice|syrup|soda|garnish|peel|zest/.test(n)) out = { kind: 'pantry', id: `x:${n}`, label: name };
    else out = { kind: 'unknown', id: `x:${n}`, label: name };
  }
  cache.set(n, out);
  return out;
}

// Which bottle ids count as "available" (custom bottles add their category)
export function availableBottles() {
  const have = new Set(stock.have);
  for (const c of stock.custom) {
    have.add(`custom:${c.id}`);
    if (c.countsAs) have.add(c.countsAs);
  }
  // generic requirements
  if (['bourbon', 'rye', 'scotch', 'irish'].some((id) => have.has(id))) have.add('whiskey-any');
  if (['light-rum', 'dark-rum', 'spiced-rum'].some((id) => have.has(id))) have.add('rum-any');
  return have;
}
export const availablePantry = () => new Set(stock.pantry);

export const getStock = () => stock;

export function setStock(patch) {
  if (Array.isArray(patch.have)) stock.have = patch.have.filter((id) => allBottles().some((b) => b.id === id));
  if (Array.isArray(patch.pantry)) stock.pantry = patch.pantry.filter((id) => PANTRY.some((p) => p.id === id));
  save('stock', stock);
  cache.clear();
  return stock;
}

// what kind of drink an own bottle is (the "Soort" choice when adding one)
export const KINDS = [
  { id: 'liquor', label: 'Sterke drank' },
  { id: 'liqueur', label: 'Likeur' },
  { id: 'wine', label: 'Wijn & bubbels' },
  { id: 'beer', label: 'Bier' },
  { id: 'aperitif', label: 'Vermout & bitters' },
  { id: 'soda', label: 'Fris' },
  { id: 'juice', label: 'Sap' },
  { id: 'syrup', label: 'Siroop' },
  { id: 'other', label: 'Overig' },
];

export function addCustom(name, countsAs, kind) {
  const clean = String(name || '').trim().slice(0, 50);
  if (!clean) return stock;
  stock.custom.push({
    id: crypto.randomUUID().slice(0, 8),
    name: clean,
    countsAs: allBottles().some((b) => b.id === countsAs) ? countsAs : null,
    kind: KINDS.some((k) => k.id === kind) ? kind : 'other',
  });
  save('stock', stock);
  cache.clear();
  return stock;
}

export function removeCustom(id) {
  stock.custom = stock.custom.filter((c) => c.id !== id);
  save('stock', stock);
  cache.clear();
  return stock;
}

export function catalogue() {
  return {
    groups: BOTTLE_GROUPS.map((g) => ({ id: g.id, label: g.label, items: g.items.map(({ id, label }) => ({ id, label })) })),
    pantry: PANTRY.map(({ id, label }) => ({ id, label })),
    kinds: KINDS,
  };
}

export const bottleLabel = (id) =>
  allBottles().find((b) => b.id === id)?.label ||
  { 'whiskey-any': 'Whisk(e)y', 'rum-any': 'Rum' }[id] ||
  stock.custom.find((c) => `custom:${c.id}` === id)?.name ||
  id;
