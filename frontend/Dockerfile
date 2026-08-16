FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npx", "ts-node-dev", "server/src/server.ts"]
