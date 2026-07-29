# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Backend runtime
FROM node:20-alpine
WORKDIR /app

# Backend deps + Prisma client
COPY backend/package*.json ./backend/
RUN npm --prefix backend install
RUN npx --prefix backend prisma generate

COPY backend/ ./backend/
COPY package.json ./

EXPOSE 5000
CMD ["npm", "--prefix", "backend", "start"]
