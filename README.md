# Wexer 2.0

Touchscreen hub for the bar: Spotify with full controls, three quiz games guests play on their phones, a cocktail menu based on what's in stock, and ten looks.

Runs on **balenaOS** on the bar's mini PC. Every push to `main` deploys automatically.

## What's in it

**Homescreen** — now playing with controls and volume, tiles for Quiz / Cocktails / Draai het rad, join QR + room code, guest count, clock.

**Quizzes** (guests join by scanning the QR code; answers on their phones)
- *Intro raden* — the song plays from the start; pick the right title.
- *Popquiz* — year of release, who sings it, which came out first.
- *Pubquiz* — general knowledge in 13 categories, 3 difficulty levels. Doesn't need Spotify. Questions from:
  - your own sets (`/admin`)
  - a built-in Dutch starter set (50)
  - [Open Trivia DB](https://opentdb.com) — ~5,000 verified questions, bundled in `app/data-seed/opentdb.json` (CC BY-SA 4.0). All 5,176 questions are translated into Dutch and bundled in `app/data-seed/opentdb-nl.json` (same licence), so no AI key is needed. If new questions are ever added and an AI key is set, those get translated in the background.
  - AI-generated questions (optional)
  - Questions aren't repeated until a category runs out.
- Options per game: genres to include/exclude, decades, your own Spotify playlists, question types, categories, rounds, questions per round, seconds per question, clip length.
- Answers stay hidden until the round ends. Then the screen walks through them one by one: right answer, who got it (with points and speed), the answer distribution, and **Speel het refrein**. The chorus start comes from time-synced lyrics (LRCLIB) and can be nudged ±5 s; corrections are remembered.
- Scoring: 500–1000 points for a correct answer, more for answering faster. Scoreboard after each round, podium at the end. The music that was playing before the quiz resumes afterwards.

**Cocktails**
- Recipe library from TheCocktailDB (~440 cocktails, refreshed every two weeks; a small offline set until the first download).
- *Voorraad*: tick the bottles on the shelf (default list of ~60) and what else is in the house (citrus, syrup, mixers…). Bottles not on the list can be added with a "counts as" category, e.g. Plantation Pineapple → dark rum.
- Menu: *Kan nu* and *Bijna* (one bottle short, plus which bottle would unlock the most), filters by base spirit and taste, *Onbekend terrein* for non-classics.
- Spin the wheel, step-by-step recipe view, measures converted to cl. Guests can browse recipes on their phones too.
- With an AI key, recipes are translated into Dutch steps (cached); otherwise they show in English.

**Looks** — Industrieel (default), Maison, Neon, Bruin café, Tiki, Disco, Blue Note, Papier, Riviera, Winterchalet. Phones follow the look.

**Settings** — look, new room code, optional PIN (protects stock and settings; changing the look stays open to all), Spotify login.

## Services (`docker-compose.yml`)

| Service   | What it does |
|-----------|--------------|
| `app`     | Node server: screen (`/`), phones (`/play`), admin (`/admin`), Spotify control, games, cocktails. Data in the `app-data` volume. |
| `browser` | balena browser block: Chromium full-screen kiosk opening `http://localhost`. |
| `audio`   | balena audio block (PulseAudio) for the PC's sound output. |
| `spotify` | go-librespot: the bar appears as the **"Wexer 2.0"** Spotify Connect speaker. |

## First-time setup

1. **balenaCloud:** create a fleet named `wexer` (device type *Generic x86_64 (GPT)*), flash balenaOS to the mini PC, boot it on the bar network.
2. **GitHub → Settings → Secrets and variables → Actions**
   - secret `BALENA_TOKEN`: balenaCloud → Preferences → Access tokens → create API key
   - variable `BALENA_FLEET`: your fleet as balenaCloud names it, e.g. `jdatje/wexer`
3. **Spotify app:** at developer.spotify.com create an app (Web API), add redirect URI
   `http://127.0.0.1/auth/spotify/callback`. Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the fleet variables in balenaCloud.
4. **Spotify login:** on the bar screen open Settings → *Spotify koppelen* (that page runs on 127.0.0.1, which Spotify allows over plain http).
5. **Speaker:** in the Spotify app on a phone on the same wifi, pick *Wexer 2.0* once. The login is kept in the `spotify-data` volume.

### Fleet variables

| Variable | Needed | What for |
|---|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | yes | music + music games |
| `ANTHROPIC_API_KEY` | optional | extra AI-generated pubquiz questions, Dutch recipe steps |
| `ANTHROPIC_MODEL` | optional | defaults to `claude-haiku-5-5` |
| `PUBLIC_URL` | optional | e.g. the balena public device URL, so guests can join without the bar wifi |
| `LAN_URL` | optional | override the detected address in the QR code |
| `SPOTIFY_DEVICE_NAME` | optional | defaults to `Wexer 2.0` |

## Spotify limits to know

Spotify's hobby-app mode (2026) means: search returns max 10 songs per request (the app pages through), playlists only work if **you own or collaborate on them**, and song structure/previews aren't available — hence the lyrics-based chorus finder.

## Local development

```bash
cd app
npm install
PORT=8080 npm run dev     # screen: http://localhost:8080  phone: /play  admin: /admin
```

For Spotify locally, register `http://127.0.0.1:8080/auth/spotify/callback` too and open the app on `127.0.0.1`.

## Adding a look

Each look is a token set in `app/public/css/themes.css`; layouts are shared. Add a `[data-theme="name"]` block, add the name to `THEMES` in `server.js` and an entry (label, swatch colours, Google Fonts) in `THEMES` in `public/js/ui.js`.

## Credits

Pubquiz questions from [Open Trivia DB](https://opentdb.com), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the Dutch translations in `opentdb-nl.json` are shared under the same licence. Refresh them with `node tools/fetch-opentdb.mjs`. Cocktail recipes from [TheCocktailDB](https://www.thecocktaildb.com). Synced lyrics from [LRCLIB](https://lrclib.net).
