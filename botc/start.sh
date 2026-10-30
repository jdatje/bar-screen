#!/bin/sh
# Start Blood on the Clocktower on the newest main of jdatje/botc.
# No internet or a broken update: run the version that's already here.
cd /app
old=$(git rev-parse HEAD)
if timeout 40 git fetch -q --depth 1 origin main; then
  new=$(git rev-parse FETCH_HEAD)
  if [ "$new" != "$old" ]; then
    lock_old=$(git rev-parse "$old:package-lock.json" 2>/dev/null)
    git reset -q --hard "$new"
    if [ "$lock_old" != "$(git rev-parse "$new:package-lock.json" 2>/dev/null)" ]; then
      if ! npm ci --omit=dev --no-audit --no-fund; then
        echo "Update failed; going back to $old"
        git reset -q --hard "$old"
        npm ci --omit=dev --no-audit --no-fund --prefer-offline
      fi
    fi
    echo "Updated botc $old -> $(git rev-parse HEAD)"
  fi
else
  echo "Could not reach GitHub; running botc $(git rev-parse --short HEAD)"
fi
export GIT_SHA="$(git rev-parse --short HEAD)"
exec node server.js
