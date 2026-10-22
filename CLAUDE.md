# Wexer 2.0 — working notes

- Every push to `main` deploys to the balena fleet `g_jeroen_dat/wexer2` (the bar PC).
- **After every update, restart all containers on the bar.** The deploy workflow
  does this itself (step "Restart all containers after the update") once the device
  runs the new release. If the device was off or the step timed out, restart them by
  hand: `balena device restart <uuid>` (all services, not just the changed one).
- Only push when Jeroen says so: a push updates the bar right away.
- Settings, stock, `/admin` and `/diag?pin=...` are behind the code (default 252525,
  changeable in the settings).

## Easter eggs
Jeroen wants surprises added now and then: tell him HOW MANY there are, never WHERE.
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
- Browser runs with ENABLE_GPU=1 for N64 speed. Only the user's own game files; no downloads.
