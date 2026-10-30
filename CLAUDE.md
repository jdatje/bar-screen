# Wexer 2.0 — working notes

- Every push to `main` deploys to the balena fleet `g_jeroen_dat/wexer2` (the bar PC).
- The bar PC is off by default (only on when someone presses the power button), so "offline"
  in balena is normal; an update installs when it is switched on — then restart all containers.
- **After every update, restart all containers on the bar.** The deploy workflow
  does this itself (step "Restart all containers after the update") once the device
  runs the new release. If the device was off or the step timed out, restart them by
  hand: `balena device restart <uuid>` (all services, not just the changed one).
- Only push when Jeroen says so: a push updates the bar right away.
- Settings, stock, `/admin` and `/diag?pin=...` are behind the code (default 252525,
  changeable in the settings).

## Easter eggs
Jeroen wants surprises: tell him HOW MANY there are, never WHERE.
Policy (from Jeroen): keep it at 10 for now, don't add new ones. When he reports one found,
remove that one in the next build; add a new one later when a good opportunity comes up.
Current total: 10 (all in `app/public/js/eggs.js` + `fx.js`):
1. Tap the "BAR 01" tag 7× within 3 s → "BAR 13" + a ghost floats by
2. Hold the "Wexer 2.0" logo 2 s → lights out, glowing eyes
3. Enter 1031 on any code pad → pumpkin rain (screen and /admin)
4. Spooky song playing (Thriller, Ghostbusters, …) → bats circle the album art
5. Halloween looks: a spider lowers itself every 12–25 min
6. 00:00–00:59 Amsterdam time → "spookuur" instead of the date, glitching clock
7. Enter 2704 on any code pad → orange rain (hearts, crowns, flags)
8. A song by Hazes playing → orange glow and 🍻 rising next to the album art
9. Friday 17:00–17:05 Amsterdam time → a "vrijdagmiddagborrel" banner slides across
10. Konami code (↑↑↓↓←→←→ B A) on a controller or keyboard → scanlines + "+30 LEVENS"

## Language
- The pages are written in Dutch; `app/public/js/i18n.js` translates every text to
  English when the language setting is English. Add new Dutch UI texts to its dictionary.
- Questions come from the server in the chosen language (`data-seed/hollands.json` and
  `starter-questions.json` are bilingual; Open Trivia DB is English with Dutch translations).

## Games
- `games/` container (127.0.0.1:8081, volume games-data) keeps the uploaded game files and
  serves the EmulatorJS player page; EmulatorJS loads from cdn.emulatorjs.org (pinned 4.2.3).
- The app proxies `/games/*` (GET) for the screen and `/api/admin/games` (PUT/DELETE, code).
- Browser runs with ENABLE_GPU=1 for N64 speed and UDEV=1 for (hot-plugged) controllers.
  Only the user's own game files; no downloads.
- Sound: everything plays through the USB card. spotify/start.sh writes an ALSA dmix config to
  the shared `audio-config` volume; the browser image (browser/) links it as /etc/asound.conf.
  Both containers run with `ipc: host` so the mixer is shared. Game volume default 25%, music 75%.

## Home screen
- Tiles: Spelletjes (hub: pub/pop/intro quiz, Clocktower, retro games, drankrad (liquor in stock: no wine/beer/bubbles/port/sherry/vermouth/bitters), draai het rad), Cocktails,
  Karaoke (LRCLIB synced lyrics), Fotomuur (photos from phones), Meedoen.
- Music search (🔍 in the music controls, `public/js/music.js`): songs → speaker queue (play before
  the rest of the playlist); playlists (search + the linked account's own) → play now via go-librespot.
  Spotify's own editorial playlists can't be read by the Web API (no preview) but do play.
- Phones: tabs Spel, Verzoekjes (song requests: off / approve on screen / straight to queue),
  Foto's, Cocktails.

## Public address and guests
- The join page can be public (balena public device URL, PUBLIC_URL device variable for the
  QR code). Screen control (socket `screen:hello`), `/games/*` and the photo list only work
  from 127.0.0.1 (the kiosk); admin is behind the code; wrong room codes are rate-limited.
- Guest check-ins (`lib/guests.js`): days per name, shown only on /admin tab Gasten.
- Room code and players are saved (`data/room.json`), so phones stay joined after a restart;
  only "new room code" changes it. One name = one player (case/spaces ignored).
- Phone Spel tab = game picker: separate waiting rooms 🧠 Pubquiz, 🎤 Popquiz, 🎧 Intro raden (opt-in: `quiz:join
  {type}`, player field `quiz` = room in room.json; only that room plays when that quiz type starts; counts via
  `quizRooms`), 🩸 Clocktower (link to /clocktower, "Join this game") and 🎲 Qwixx (opens boardpass.maisonbaron.nl).
- Quiz setup: shows only phones in that quiz's room; the screen can add a name by hand (no phone, joins that
  room) or take someone out (× on the chip, `quiz:out`; the phone goes back to the picker).
- Credits (`lib/credits.js`): /admin tab Tegoed — free name, add any amount, −1 per tap.
- /admin tab Voorraad: the stock from the phone (bottles, ook in huis, own bottles), `/api/admin/stock*`.
- Own bottles have a type (`kind`: Sterke drank, Likeur, Wijn & bubbels, Bier, Vermout & bitters, Fris,
  Sap, Siroop, Overig); the drankrad takes own bottles of type Sterke drank and Likeur.
- Hub card Qwixx: overlay with a QR code to https://boardpass.maisonbaron.nl (`/qr/qwixx.png`; the
  site can't be framed, so phones play it).
- Scrollbars use the look's colours (app.css, end).
- Halloween looks (SPOOKY_THEMES): the screensaver gets 7 drifting ghosts (`#saver-ghosts`, saver.js).
- Party extras are tied to the look (PARTY_OF_THEME in tiles.js), not to dates. Themed quiz sets
  (`look` in bank.js SETS) and cocktail tags (`look` in cocktails.js tags) only show in that look.
- Halloween extras: Griezelquiz (data-seed/griezel.json, 42 bilingual questions), cocktail tag
  "Griezelig" (spooky names), spooky sounds every 6–15 min (public/js/spooky.js, Web Audio, not during
  a quiz question/game/karaoke); switch: settings "Griezelgeluiden" + /admin Scherm (`spookySounds`).
- Nederland looks: only the 🧡 Oranjequiz (data-seed/oranje.json). Jeroen wants no other Dutch extras.
- Oktoberfest looks: 🍺 Bierquiz (data-seed/bier.json); Prost-moment every 30–50 min (public/js/prost.js:
  "OANS! ZWOA! DREI! G'SUFFA!" with synthesized brass + clinking glasses — no recording of the song;
  switch "Prost-momenten" in settings + /admin, `prostMoments`; "▶ Nu proosten" button);
  Maßkrugstemmen (hub card, stopwatch + top 10 in lib/masskrug.js / public/js/masskrug.js; clearing the
  list needs the code; `.party-only` + :root[data-party]); screensaver pretzels + rising foam.
  (The Bierrad was removed again on Jeroen's request.)
- Oud & Nieuw looks (group "Oud & Nieuw", party `newyear`): 🥂 Champagne (black/gold), 🎆 Vuurwerk (night sky),
  🍩 Oliebollenkraam (cream, red-white stripe). 🎆 Oudejaarsquiz (data-seed/oudnieuw.json, 32 questions);
  screensaver fireworks bursts + champagne bubbles.
  Extras (public/js/newyear.js, lib/newyear.js): countdown from 23:50 Amsterdam every night in these looks
  (last 10 s full screen, 00:00 "Gelukkig nieuwjaar <year>" + fireworks + resolutions roll); good resolutions
  from phones (Spel tab, max 5 per name, ticker at the bottom of the screen, remove in /admin Gasten);
  Oliebollenteller (hub card, +1/−1 per name, phones see top 5; reset needs the code); "🥂 Bubbels"
  cocktail filter; Vuurwerk! hub card (canvas show + synthesized bangs). Test buttons in the settings.
- Tiki group: 🌺 Tiki Bar look (party `tiki`): dark wood, bamboo frames, swaying palm leaves, flickering
  torches. The older "Tiki" look in Zomer is unchanged. Extras: 🌴 Tikiquiz (data-seed/tiki.json, 29 questions);
  "🍹 Tiki" cocktail filter (tiki names, orgeat/falernum, rum + pineapple/coconut/passion); Vulkaanmoment every
  30–50 min (public/js/volcano.js, switch "Vulkaanmomenten" `volcanoMoments`, "▶ Nu uitbarsten"); Limbo (hub
  card, public/js/limbo.js: bar drops 5/10 cm per round, tap names out, winner's height in a top 10, lowest
  wins); Hula-hoop (hub card, same stopwatch as Maßkrugstemmen, kind `hula`); screensaver moon, waves, fish.
  Top lists for masskrug/hula/limbo live in lib/masskrug.js (`kind`).
- Screensaver shows the photos in random order (shuffle bag in saver.js, no repeats in a row).
- Look "Modderpret" (group Kinderfeest): pink, sky, green hills with mud puddles, clouds. Original design —
  no Peppa Pig (protected character; asked for, made this instead).
  Own animal crew (public/img/critters): buttons owl=previous, crocodile=play, penguin=next,
  honey badger=search; tiles mole rat (Spelletjes), manatee (Cocktails), cat & dog (Karaoke),
  honey badger (Fotomuur), crocodile (Meedoen).
- Phones can save photos from the wall (Foto's tab → pick → Opslaan): share sheet with the
  files when the phone supports it, else a zip from `/api/photos.zip` (joined players only).
- Phones don't load the 10 MB emoji font (kiosk only); responses are gzipped.

## Built, waiting for the next push
- Settings on the screen close (and lock) when you tap next to the panel.
- Wi-Fi only (Jeroen): the join QR uses the PC's LAN address (PUBLIC_URL is ignored now).
  When pushing: also switch OFF the balena public device URL (and remove the PUBLIC_URL
  device variable), so there's no internet access anymore.
- Wi-Fi QR on the Meedoen tile (step 1 Wi-Fi, step 2 Meedoen), set in /admin → Scherm → "Wifi van
  de bar"; the password lives only in settings and the screen state, never sent to phones.

## Blood on the Clocktower (live since 30 Oct 2026)
Played in person at the big table; phones joined via the Wexer QR. All in English.
- Data: TPI toolmaker resources (github ThePandemoniumInstitute/botc-release `resources/`, commit f10cd02, Aug 2026):
  `data-seed/botc/{roles,nightsheet,jinxes}.json`, icons in `public/botc/icons` (_g/_e), edition logos +
  CCC logo in `public/botc/img` (the CCC logo must stay visible). Built-in scripts TB/BMR/S&V; import any
  script JSON (official ids resolve locally, homebrew images downloaded once to DATA_DIR/botc-img, served at
  /botc/custom). Travellers & Fabled are in the data (storyteller can pick them) but not used yet.
- Server: `lib/botc.js` (state in data/botc.json, imported scripts botc-scripts.json, storyteller tokens
  botc-st.json); socket events `botc:*`; rooms botc-st / botc-pub / botc-p:<playerId>.
- Page `/clocktower` (`public/clocktower.html`, `public/botc/app.js`, `botc.css`, `rules.js` = own rules text).
  Player tabs Token (hold to see, hides on app switch), Town (oval, private guesses + notes), Chats (truly
  private, storyteller pinned on top, unread badge, vibrate; player chats locked at night, option to lock
  the storyteller chat too), Notes, Script (+ jinxes), Rules.
  Storyteller (admin code; token per device, ⏏/Log out): Setup (script, players + seat order, random or
  chosen characters with counts table, Baron-style setup notes, Drunk/Lunatic auto "sees", bluffs, start),
  Grimoire (oval, DEMON/MINION markers, seat sheet: die/ghost vote/change character/what they see/alignment/
  reminders/show "You are"), Night order (only characters in play, tap to tick), Chats, Notes + game log.
  "🃏 Show" = full-screen info cards (+ bluffs). Day/night switch; day timer (auto at dawn, length in ⚙).
- Wexer: hub card "Clocktower" opens the page in a full-screen frame (`?mode=screen`): table view with
  town square + big day timer (bell at 0), night scene; "Storyteller" button (code) for the grimoire on the
  screen, ⏏ back to table view; opens by itself when a game starts. Grimoire revealed at game end.
- Styles: 6 (Gothic, Parchment, Blood Moon, Ravenswood, Midnight, Candlelight), chosen per device and per
  role (player / storyteller / screen) in ⚙.
- Phones: players join themselves (Spel tab → Clocktower → Join; Leave while setting up); the storyteller can
  still tick/untick in Setup. Seated phones jump to /clocktower when the game starts.
- Nominations, voting and first-night info happen in real life on purpose.

## For the next update (from Jeroen, not built yet)
- Phones: someone who already joined with their name gets a way into the admin panel from
  the phone page (e.g. a "Beheer" link/button that opens /admin; still behind the code).
