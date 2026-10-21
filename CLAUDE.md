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
Current total: 6 (all in `app/public/js/eggs.js` + `fx.js`):
1. Tap the "BAR 01" tag 7× within 3 s → "BAR 13" + a ghost floats by
2. Hold the "Wexer 2.0" logo 2 s → lights out, glowing eyes
3. Enter 1031 on any code pad → pumpkin rain (screen and /admin)
4. Spooky song playing (Thriller, Ghostbusters, …) → bats circle the album art
5. Halloween looks: a spider lowers itself every 12–25 min
6. 00:00–00:59 Amsterdam time → "spookuur" instead of the date, glitching clock
