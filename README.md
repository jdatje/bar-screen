# Bar Screen 2.0 — Maison Baron

Touchscreen hub for the bar: Spotify with full controls, selectable looks, quizzes guests play on their phones, and a cocktail menu based on what's in stock.

Runs on **balenaOS** on the bar's mini PC. Every push to `main` deploys automatically.

## Services (`docker-compose.yml`)

| Service   | What it does |
|-----------|--------------|
| `app`     | Node server: screen UI (`/`), phone UI (`/play`), Spotify control, game logic. Data in the `app-data` volume. |
| `browser` | balena browser block: Chromium full-screen kiosk opening `http://localhost`. |
| `audio`   | balena audio block (PulseAudio) for the PC's sound output. |
| `spotify` | go-librespot: the bar appears as the **"Maison Baron"** Spotify Connect speaker. |

## First-time setup

1. **balenaCloud:** create a fleet (device type *Generic x86_64 (GPT)*), flash balenaOS to the mini PC, boot it on the bar network.
2. **GitHub → Settings → Secrets and variables → Actions**
   - secret `BALENA_TOKEN`: balenaCloud → Preferences → Access tokens → create API key
   - variable `BALENA_FLEET`: e.g. `jdatje/bar-screen`
3. **Spotify app:** at developer.spotify.com create an app (Web API), add redirect URI
   `http://127.0.0.1/auth/spotify/callback`. Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the fleet variables in balenaCloud.
4. **Spotify login:** on the bar screen open Settings → *Spotify koppelen* (that page runs on 127.0.0.1, which Spotify allows over plain http).
5. **Speaker:** in the Spotify app on a phone on the same wifi, pick *Maison Baron* once. The login is kept in the `spotify-data` volume.

Optional fleet variables: `PUBLIC_URL` (e.g. the balena public device URL, so guests can join without the bar wifi), `LAN_URL` (override the detected address).

## Local development

```bash
cd app
npm install
PORT=8080 npm run dev     # screen: http://localhost:8080  phone: http://localhost:8080/play
```

For Spotify locally, register `http://127.0.0.1:8080/auth/spotify/callback` too and open the app on `127.0.0.1`.

## Looks

Each look is a token set in `app/public/css/themes.css`; layouts are shared. To add one: add a `[data-theme="name"]` block, add the name to `THEMES` in `server.js` and to `THEME_LABELS` in `public/js/screen.js`. Default: **Industrieel**.

## Status

- [x] Homescreen: clock, now playing, controls, volume, join QR + room code, look picker
- [x] Phones join by QR/room code, reconnect automatically
- [ ] Quizzes: intro raden, popquiz, pubquiz (+ answer walkthrough, chorus button via synced lyrics)
- [ ] Cocktail menu, stock list, spin the wheel
- [ ] Remaining looks (target ~10)
