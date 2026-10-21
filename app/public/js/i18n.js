// Language switch (Dutch / English) for every page.
// The pages are written in Dutch; in English mode every text node and
// label that matches the dictionary below is swapped, including content
// that is rendered later (a MutationObserver keeps watching).
// Song titles, names and questions are left alone (questions come from the
// server in the right language).

const EN = {
  // ---------- touchscreen: shell & home ----------
  'Wexer 2.0 — Beheer': 'Wexer 2.0 — Admin',
  'Wexer 2.0 — Meedoen': 'Wexer 2.0 — Join',
  'Wexer 2.0 · Beheer': 'Wexer 2.0 · Admin',
  'Terug naar home': 'Back to home',
  'Instellingen': 'Settings',
  'Instellingen (alleen met code)': 'Settings (code required)',
  '01 — Nu op de plaat': '01 — Now playing',
  'Niets aan het spelen': 'Nothing playing',
  'Kies "Wexer 2.0" als speaker in Spotify': 'Pick "Wexer 2.0" as speaker in Spotify',
  'Speaker niet bereikbaar': 'Speaker not reachable',
  'Quiz bezig': 'Quiz in progress',
  'Geen spoilers': 'No spoilers',
  'Straks': 'Up next',
  'Vorige': 'Previous',
  'Volgende': 'Next',
  'Afspelen of pauzeren': 'Play or pause',
  'Spotify reageert niet': 'Spotify is not responding',
  'Quiz': 'Quiz',
  'Pubquiz · Popquiz · Intro raden': 'Pub quiz · Pop quiz · Name that intro',
  'Start een spel →': 'Start a game →',
  'Menu op basis van wat er staat': 'A menu based on what you have',
  'Open de kaart →': 'Open the menu →',
  'Vink eerst aan wat er staat': 'First tick what you have',
  'Draai het rad': 'Spin the wheel',
  'Laat het lot je cocktail kiezen': 'Let fate pick your cocktail',
  '05 — Meedoen': '05 — Join',
  'Meedoen': 'Join',
  'Scan voor de quiz en recepten': 'Scan for the quiz and recipes',
  'QR-code om mee te doen': 'QR code to join',
  'QR-code naar de beheerpagina': 'QR code to the admin page',
  // ---------- settings ----------
  'Klaar': 'Done',
  'Look': 'Look',
  'Taal': 'Language',
  'Achtergrond van de knoppen': 'Button backgrounds',
  'Automatisch': 'Automatic',
  'Uit': 'Off',
  'Nieuwe kamercode': 'New room code',
  'Voorraad': 'Stock',
  'Code wijzigen': 'Change code',
  'Spotify koppelen': 'Link Spotify',
  'Scan om de instellingen en eigen quizvragen vanaf je telefoon te regelen:': 'Scan to manage the settings and your own quiz questions from your phone:',
  '(met dezelfde code).': '(same code).',
  'Code': 'Code',
  'Code klopt niet': 'Wrong code',
  'Code verlopen — open de instellingen opnieuw': 'Code expired — open the settings again',
  'Lukt niet': 'That did not work',
  'Nieuwe kamercode — iedereen moet opnieuw scannen': 'New room code — everyone needs to scan again',
  'Nieuwe code (minstens 4 cijfers)': 'New code (at least 4 digits)',
  'Nieuwe code ingesteld': 'New code set',
  'Minstens 4 cijfers': 'At least 4 digits',
  'Annuleer': 'Cancel',
  'Nee': 'No',
  'Ja': 'Yes',
  'Pincode': 'PIN',
  // looks
  'Industrieel': 'Industrial',
  'Bruin café': 'Brown café',
  'Papier': 'Paper',
  'Winterchalet': 'Winter chalet',
  '🎃 Spookhuis': '🎃 Haunted house',
  '🎃 Pompoenveld': '🎃 Pumpkin patch',
  '🎃 Heksenketel': "🎃 Witch's brew",
  '🇳🇱 Oranjegekte': '🇳🇱 Orange fever',
  '🇳🇱 Delfts Blauw': '🇳🇱 Delft Blue',
  '🇳🇱 Oranje Boven': '🇳🇱 Orange on top',
  // button backgrounds
  'Vraagtekens': 'Question marks',
  'Schrijven op papier': 'Writing on paper',
  'Gloeilamp': 'Light bulb',
  'Spookjes': 'Ghosts',
  'Bubbels': 'Bubbles',
  'IJsblokjes': 'Ice cubes',
  'Citroenschijfjes': 'Lemon slices',
  'Heksenketel': 'Cauldron',
  'Draaiend rad': 'Spinning wheel',
  'Kermislampjes': 'Fairground lights',
  'Dobbelstenen': 'Dice',
  'Vleermuizen': 'Bats',
  'Ringen': 'Rings',
  'Scanlijn': 'Scan line',
  'Sterretjes': 'Sparkles',
  'Spinnenweb': 'Spider web',
  'Tulpen': 'Tulips',
  'Vlaggetjes': 'Little flags',
  'Molen': 'Windmill',
  'Confetti': 'Confetti',
  'Het is vrijdagmiddagborrel!': "It's Friday drinks o'clock!",
  // ---------- quiz setup ----------
  'Intro raden': 'Name that intro',
  'Herken het nummer aan de eerste seconden': 'Recognise the song from the first seconds',
  'Popquiz': 'Pop quiz',
  'Jaartallen, artiesten en wat kwam eerst': 'Years, artists and what came first',
  'Pubquiz': 'Pub quiz',
  'Algemene kennis in categorieën': 'General knowledge in categories',
  'Start': 'Start',
  'Laden…': 'Loading…',
  'Vragenset': 'Question set',
  'Muziek': 'Music',
  'Spotify is nog niet gekoppeld; muziekspellen werken pas daarna.': 'Spotify is not linked yet; music games only work after that.',
  'Genres · tik = mee, nog eens = uitsluiten, niets gekozen = alles': 'Genres · tap = include, again = exclude, none = all',
  'Decennia · niets gekozen = 70s tot nu': 'Decades · none = 70s until now',
  'Eigen playlists': 'Own playlists',
  'Soorten vragen': 'Question types',
  'Jaartal': 'Year',
  'Artiest': 'Artist',
  'Wat kwam eerst': 'What came first',
  'Categorieën · niets gekozen = alles': 'Categories · none = all',
  'Moeilijkheid': 'Difficulty',
  'Alles': 'All',
  'Makkelijk': 'Easy',
  'Gemiddeld': 'Medium',
  'Moeilijk': 'Hard',
  'makkelijk': 'easy',
  'gemiddeld': 'medium',
  'moeilijk': 'hard',
  'Rondes': 'Rounds',
  'Vragen per ronde': 'Questions per round',
  'Seconden per vraag': 'Seconds per question',
  'Fragment (sec)': 'Clip (sec)',
  'Nog niemand — scan de code': 'Nobody yet — scan the code',
  'Koppel eerst Spotify': 'Link Spotify first',
  'Starten lukte niet': 'Could not start',
  // ---------- quiz running ----------
  'Stoppen': 'Stop',
  'Quiz stoppen?': 'Stop the quiz?',
  'Stand': 'Standings',
  'Nog geen scores': 'No scores yet',
  'Vragen klaarzetten…': 'Getting the questions ready…',
  'Dat ging mis': 'Something went wrong',
  'Terug': 'Back',
  'Nog eens afspelen': 'Play again',
  'Stop de tijd': 'Stop the clock',
  'Volgende vraag komt eraan…': 'Next question coming up…',
  'Antwoorden bekijken': 'See the answers',
  'sec': 'sec',
  '▶ Speel het refrein': '▶ Play the chorus',
  'Wie had het goed': 'Who got it right',
  'Niemand…': 'Nobody…',
  'Verdeling': 'Answers given',
  'Vorig antwoord': 'Previous answer',
  'Volgend antwoord': 'Next answer',
  'Naar de stand': 'To the standings',
  'Eindstand': 'Final standings',
  'Tussenstand': 'Standings',
  'Volgende ronde': 'Next round',
  // ---------- cocktails ----------
  'La carte': 'The menu',
  'Vanavond te maken': 'Ready to make tonight',
  'Met één fles extra': 'With one more bottle',
  'Onbekend terrein': 'Uncharted territory',
  'Laat het lot kiezen': 'Let fate decide',
  'Draai aan het rad': 'Spin the wheel',
  'Cocktailrad': 'Cocktail wheel',
  'Voorraad aanpassen': 'Edit stock',
  'Probeer een ander filter.': 'Try another filter.',
  'Vink bij Voorraad aan welke flessen er staan.': 'Tick the bottles you have under Stock.',
  'Recept niet gevonden': 'Recipe not found',
  'Geen bereiding beschikbaar.': 'No method available.',
  'Het rad heeft gesproken': 'The wheel has spoken',
  'Nog eens draaien': 'Spin again',
  'Niets om uit te kiezen': 'Nothing to choose from',
  'Eén fles erbij': 'One more bottle',
  'Vorige stap': 'Previous step',
  'Volgende stap': 'Next step',
  '← Alle cocktails': '← All cocktails',
  'Zoeken': 'Search',
  'Niets gevonden': 'Nothing found',
  'Niets gevonden.': 'Nothing found.',
  'Wat staat er op de plank?': "What's on the shelf?",
  'Fles die niet in de lijst staat': 'Bottle that is not on the list',
  'Bijv. Plantation Pineapple': 'E.g. Plantation Pineapple',
  'Telt als': 'Counts as',
  'Toevoegen': 'Add',
  'Eigen flessen': 'Own bottles',
  'Eigen categorie': 'Own category',
  'Ook in huis': 'Also in the house',
  'Opslaan lukte niet': 'Saving failed',
  'Sluiten': 'Close',
  'spatie': 'space',
  'Schermtoetsenbord': 'On-screen keyboard',
  // cocktail filters & stock groups
  'Bitter': 'Bitter',
  'Zuur': 'Sour',
  'Sterk': 'Strong',
  'Lang & fris': 'Long & fresh',
  'Romig': 'Creamy',
  'Overig': 'Other',
  'Basis': 'Basics',
  'Brandy & overig': 'Brandy & more',
  'Likeuren': 'Liqueurs',
  'Vermout & bitters': 'Vermouth & bitters',
  'Witte rum': 'White rum',
  'Donkere rum': 'Dark rum',
  'Jenever': 'Genever',
  'Absint / pastis': 'Absinthe / pastis',
  'Wijn': 'Wine',
  'Bier': 'Beer',
  'Groene Chartreuse': 'Green Chartreuse',
  'Gele Chartreuse': 'Yellow Chartreuse',
  'Vlierbloesemlikeur': 'Elderflower liqueur',
  'Koffielikeur': 'Coffee liqueur',
  'Kokosrum (Malibu)': 'Coconut rum (Malibu)',
  'Perziklikeur': 'Peach schnapps',
  'Abrikozenlikeur': 'Apricot brandy',
  'Kersenlikeur': 'Cherry liqueur',
  'Meloenlikeur (Midori)': 'Melon liqueur (Midori)',
  'Frambozenlikeur (Chambord)': 'Raspberry liqueur (Chambord)',
  'Bananenlikeur': 'Banana liqueur',
  'Passievruchtlikeur (Passoa)': 'Passion fruit liqueur (Passoa)',
  'Zoete vermout': 'Sweet vermouth',
  'Droge vermout': 'Dry vermouth',
  'Citroenen': 'Lemons',
  'Limoenen': 'Limes',
  'Suikersiroop': 'Sugar syrup',
  'Sinaasappelsap': 'Orange juice',
  'Cranberrysap': 'Cranberry juice',
  'Ananassap': 'Pineapple juice',
  'Grapefruitsap': 'Grapefruit juice',
  'Tomatensap': 'Tomato juice',
  'Appelsap': 'Apple juice',
  'Spuitwater': 'Soda water',
  'Lemon-lime frisdrank': 'Lemon-lime soda',
  'Orgeat (amandelsiroop)': 'Orgeat (almond syrup)',
  'Honing': 'Honey',
  'Verse munt': 'Fresh mint',
  'Eieren': 'Eggs',
  'Room / melk': 'Cream / milk',
  'Kokosroom': 'Coconut cream',
  'Koffie / espresso': 'Coffee / espresso',
  'Komkommer': 'Cucumber',
  // ---------- phone ----------
  'Doe mee': 'Join in',
  'Kamercode (staat op het scherm)': 'Room code (shown on the screen)',
  'Je naam of teamnaam': 'Your name or team name',
  'Spel': 'Game',
  '🔒 Beheer': '🔒 Admin',
  'Die code klopt niet': "That code isn't right",
  'Vul een naam in': 'Enter a name',
  'Er ging iets mis': 'Something went wrong',
  'Verbonden': 'Connected',
  'Hou dit scherm open. Zodra er een quiz start, verschijnen de vragen hier.': 'Keep this screen open. When a quiz starts, the questions appear here.',
  'Vragen worden klaargezet…': 'Getting the questions ready…',
  'Tik op je antwoord': 'Tap your answer',
  'Doorgegeven · je mag nog wisselen': 'Sent · you can still change it',
  'Tijd is op · volgende vraag komt eraan': "Time's up · next question coming up",
  'Ronde klaar!': 'Round finished!',
  'Kijk naar het scherm voor de antwoorden.': 'Look at the screen for the answers.',
  'Kijk naar het scherm.': 'Look at the screen.',
  'Goed!': 'Correct!',
  'Helaas': 'Wrong',
  'Geen antwoord': 'No answer',
  'Jouw plek': 'Your place',
  'Je deed deze ronde niet mee.': "You didn't play this round.",
  'Er is een nieuwe kamercode — kijk op het scherm': 'There is a new room code — look at the screen',
  // ---------- admin ----------
  'Op slot': 'Locked',
  'Alleen voor de beheerders. Je hebt de code nodig.': 'Admins only. You need the code.',
  'Ontgrendelen': 'Unlock',
  'Vergrendelen': 'Lock',
  'Scherm': 'Screen',
  'Quizvragen': 'Quiz questions',
  'Kamer': 'Room',
  'Kamercode nu:': 'Room code now:',
  'Automatisch = de gewone achtergrond, of de griezelige in een Halloween-look.': 'Automatic = the normal background, or the matching one in a party look.',
  'Automatisch = de gewone achtergrond, of die van een feest-look.': 'Automatic = the normal background, or the matching one in a party look.',
  'Bewerken': 'Edit',
  'Nieuwe set': 'New set',
  'Vragendatabase': 'Question database',
  'Cocktailbibliotheek': 'Cocktail library',
  'Nu verversen': 'Refresh now',
  'Bezig…': 'Working…',
  '← Alle sets': '← All sets',
  'Naam van de set': 'Name of the set',
  'Gebruiken in de pubquiz': 'Use in the pub quiz',
  'Vraag toevoegen': 'Add question',
  'Plakken uit tekst': 'Paste from text',
  'Eén vraag per regel: vraag | goed antwoord | fout | fout | fout | categorie': 'One question per line: question | right answer | wrong | wrong | wrong | category',
  'Set verwijderen': 'Delete set',
  'Opslaan': 'Save',
  'Opgeslagen': 'Saved',
  'Verwijderen': 'Delete',
  'Deze set verwijderen?': 'Delete this set?',
  'Antwoord': 'Answer',
  'Antwoord (leeg = niet gebruikt)': 'Answer (empty = not used)',
  'Categorie': 'Category',
  'Alle Open Trivia DB-vragen zijn vertaald naar het Nederlands.': 'All Open Trivia DB questions have a Dutch translation.',
  // categories
  'Algemeen': 'General', 'Aardrijkskunde': 'Geography', 'Geschiedenis': 'History', 'Nederland': 'The Netherlands', 'Sport': 'Sport',
  'Wetenschap': 'Science', 'Dieren & natuur': 'Animals & nature', 'Techniek': 'Technology', 'Film & tv': 'Film & TV',
  'Kunst & cultuur': 'Art & culture', 'Games': 'Games', 'Eten & drinken': 'Food & drink',
};

// Texts with a variable part
const PATTERNS = [
  [/^(\d+) gasten? verbonden$/, (m) => `${m[1]} ${m[1] === '1' ? 'guest' : 'guests'} connected`],
  [/^(\d+) gast verbonden$/, (m) => `${m[1]} guest connected`],
  [/^(\d+) te maken met wat er staat$/, (m) => `${m[1]} you can make with what you have`],
  [/^Speel (.+) van (.+)$/, (m) => `Play ${m[1]} by ${m[2]}`],
  [/^Antwoorden ronde (\d+) · (\d+) van (\d+)$/, (m) => `Answers round ${m[1]} · ${m[2]} of ${m[3]}`],
  [/^(.+) · na ronde (\d+) van (\d+)$/, (m) => `${m[1]} · after round ${m[2]} of ${m[3]}`],
  [/^Ronde (\d+) van (\d+) · (.+) · vraag (\d+) van (\d+)$/, (m) => `Round ${m[1]} of ${m[2]} · ${m[3]} · question ${m[4]} of ${m[5]}`],
  [/^(\d+) van (\d+) hebben geantwoord$/, (m) => `${m[1]} of ${m[2]} have answered`],
  [/^Ronde (\d+) zit erop!$/, (m) => `Round ${m[1]} is done!`],
  [/^Kan nu \((\d+)\)$/, (m) => `Can make now (${m[1]})`],
  [/^Bijna \((\d+)\)$/, (m) => `Almost (${m[1]})`],
  [/^(\d+) flessen aangevinkt$/, (m) => `${m[1]} bottles ticked`],
  [/^Mist: (.+)$/, (m) => `Missing: ${m[1]}`],
  [/^Je mist nog: (.+)$/, (m) => `You still need: ${m[1]}`],
  [/^Stap (\d+) van (\d+)(.*)$/, (m) => `Step ${m[1]} of ${m[2]}${m[3]}`],
  [/^Hoi (.+)$/, (m) => `Hi ${m[1]}`],
  [/^Jij zei: (.+)$/, (m) => `You said: ${m[1]}`],
  [/^Antwoord: (.+)$/, (m) => `Answer: ${m[1]}`],
  [/^([\d.]+) punten · deze ronde \+([\d.]+)$/, (m) => `${m[1]} points · this round +${m[2]}`],
  [/^Nieuwe kamercode: (.+)$/, (m) => `New room code: ${m[1]}`],
  [/^(\d+) recepten geladen$/, (m) => `${m[1]} recipes loaded`],
  [/^(\d+) vragen toegevoegd$/, (m) => `${m[1]} questions added`],
  [/^Opgeslagen · (\d+) onvolledige vragen overgeslagen$/, (m) => `Saved · ${m[1]} incomplete questions skipped`],
  [/^Vraag (\d+)$/, (m) => `Question ${m[1]}`],
  [/^Antwoord (\d+) is goed$/, (m) => `Answer ${m[1]} is right`],
  [/^(\d+) vragen · (in gebruik|uitgeschakeld)$/, (m) => `${m[1]} questions · ${m[2] === 'in gebruik' ? 'in use' : 'disabled'}`],
  [/^Vanavond te maken · basisset \(bibliotheek laadt nog\)$/, () => 'Ready to make tonight · basic set (library still loading)'],
  [/^start (.+)$/, (m) => `start ${m[1]}`],
  [/^(\d+) te maken · (\d+) met één fles extra(.*)$/, (m) => `${m[1]} to make · ${m[2]} with one more bottle${m[3] ? ' · basic set (library still loading)' : ''}`],
  [/^Nog geen eigen sets\. De quiz gebruikt dan de startset( en AI-vragen)?\.$/, () => 'No own sets yet. The quiz then uses the built-in questions.'],
  [/^Hollands: (\d+) · Startset: (\d+) · Open Trivia DB: ([\d.]+) \(([\d.]+) vertaald\) · eigen sets: (\d+)$/, (m) => `Dutch: ${m[1]} · Starter: ${m[2]} · Open Trivia DB: ${m[3]} (${m[4]} translated) · own sets: ${m[5]}`],
  [/^(\d+) recepten · bijgewerkt (.+)$/, (m) => `${m[1]} recipes · updated ${m[2]}`],
  [/^(\d+) recepten · alleen basisset, download nog niet gelukt$/, (m) => `${m[1]} recipes · basic set only, download not done yet`],
  [/^(\d+) spelers? in de kamer$/, (m) => `${m[1]} ${m[1] === '1' ? 'player' : 'players'} in the room`],
  [/^(.+) · ronde (\d+) van (\d+)$/, (m) => `${m[1]} · round ${m[2]} of ${m[3]}`],
  [/^Vraag (\d+) van (\d+)(.*)$/, (m) => `Question ${m[1]} of ${m[2]}${m[3]}`],
  [/^van (\d+)$/, (m) => `of ${m[1]}`],
];

let lang = 'nl';
const TITLE = document.title;
const original = new WeakMap(); // node -> Dutch text, to switch back
const ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];

export const getLang = () => lang;

// Translate one Dutch string (returns it unchanged when unknown or in Dutch mode)
export function t(s) {
  if (lang !== 'en' || !s) return s;
  const key = s.trim();
  if (EN[key] != null) return s.replace(key, EN[key]);
  for (const [re, fn] of PATTERNS) {
    const m = key.match(re);
    if (m) return s.replace(key, fn(m));
  }
  return s;
}

function fixText(node) {
  const text = node.nodeValue;
  if (!text || !/[A-Za-zÀ-ÿ]/.test(text)) return;
  if (lang === 'en') {
    const out = t(text);
    if (out !== text) {
      original.set(node, text);
      node.nodeValue = out;
    }
  } else if (original.has(node)) {
    node.nodeValue = original.get(node);
    original.delete(node);
  }
}

function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v) continue;
    const key = `data-nl-${a}`;
    if (lang === 'en') {
      const out = t(v);
      if (out !== v) {
        if (!el.hasAttribute(key)) el.setAttribute(key, v);
        el.setAttribute(a, out);
      }
    } else if (el.hasAttribute(key)) {
      el.setAttribute(a, el.getAttribute(key));
      el.removeAttribute(key);
    }
  }
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return fixText(root);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.closest?.('[data-no-i18n]')) return;
    fixAttrs(root);
  }
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = tw.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.parentElement?.closest('[data-no-i18n], script, style')) fixText(n);
    } else fixAttrs(n);
  }
}

const observer = new MutationObserver((list) => {
  for (const m of list) {
    if (m.type === 'characterData') fixText(m.target);
    else if (m.type === 'attributes') fixAttrs(m.target);
    else m.addedNodes.forEach(walk);
  }
});

export function setLang(next) {
  next = next === 'en' ? 'en' : 'nl';
  if (next === lang && observer.started) return;
  lang = next;
  document.documentElement.lang = lang;
  walk(document.documentElement);
  document.title = lang === 'en' ? t(TITLE) : TITLE;
  if (!observer.started) {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    observer.started = true;
  }
}
