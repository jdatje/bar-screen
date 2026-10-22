FROM node:22-alpine
WORKDIR /usr/src/games
COPY package.json server.js ./
ENV NODE_ENV=production DATA_DIR=/data GAMES_PORT=8081
CMD ["node", "server.js"]
