# Wexer 2.0 — working notes

- Every push to `main` deploys to the balena fleet `g_jeroen_dat/wexer2` (the bar PC).
- **After every update, restart all containers on the bar.** The deploy workflow
  does this itself (step "Restart all containers after the update") once the device
  runs the new release. If the device was off or the step timed out, restart them by
  hand: `balena device restart <uuid>` (all services, not just the changed one).
- Only push when Jeroen says so: a push updates the bar right away.
