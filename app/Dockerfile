FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
ENV NODE_ENV=production PORT=80 DATA_DIR=/data
EXPOSE 80
CMD ["node", "server.js"]
