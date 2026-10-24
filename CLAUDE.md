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
- Tiles: Spelletjes (hub: pub/pop/intro quiz, retro games, drankrad (liquor in stock: no wine/beer/bubbles/port/sherry/vermouth/bitters), draai het rad), Cocktails,
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
- Quiz setup: players on a phone join automatically; the screen can add a name by hand
  (no phone) or take someone out (× on the chip; that phone gets the join form again).
- Credits (`lib/credits.js`): /admin tab Tegoed — free name, add any amount, −1 per tap.
- /admin tab Voorraad: the stock from the phone (bottles, ook in huis, own bottles), `/api/admin/stock*`.
- Own bottles have a type (`kind`: Sterke drank, Likeur, Wijn & bubbels, Bier, Vermout & bitters, Fris,
  Sap, Siroop, Overig); the drankrad takes own bottles of type Sterke drank and Likeur.
- Hub card Qwixx: overlay with a QR code to https://games.maisonbaron.nl (`/qr/qwixx.png`; the
  site can't be framed, so phones play it).
- Scrollbars use the look's colours (app.css, end).
- Phones can save photos from the wall (Foto's tab → pick → Opslaan): share sheet with the
  files when the phone supports it, else a zip from `/api/photos.zip` (joined players only).
- Phones don't load the 10 MB emoji font (kiosk only); responses are gzipped.

## For the next update (from Jeroen, not built yet)
- Phones: someone who already joined with their name gets a way into the admin panel from
  the phone page (e.g. a "Beheer" link/button that opens /admin; still behind the code).
