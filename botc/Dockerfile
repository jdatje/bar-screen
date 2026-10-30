# Blood on the Clocktower: the jdatje/botc repo (also on botc.maisonbaron.nl).
# Built from the latest main, and start.sh fetches the newest main at every start,
# so a change merged there reaches the bar at its next start without a Wexer update.
FROM node:22-alpine
RUN apk add --no-cache git
RUN mkdir -p /app /data && chown node:node /app /data
USER node
WORKDIR /app
# a fresh copy of the repo for every build
ARG CACHEBUST=1
RUN git clone --depth 1 --branch main https://github.com/jdatje/botc.git . && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node start.sh /start.sh
ENV NODE_ENV=production PORT=8090 DATA_DIR=/data
CMD ["/bin/sh", "/start.sh"]
