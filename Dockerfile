# Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Backend runtime
FROM node:22-alpine
WORKDIR /app

# Luxora booking rules (lead times, auto-assignment window, timeouts) are
# defined in Asia/Colombo wall-clock time. Pin the container timezone so the
# scheduler behaves identically regardless of host default (usually UTC).
RUN apk add --no-cache tzdata
ENV TZ=Asia/Colombo

# Backend deps + Prisma client
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci
COPY backend/prisma ./backend/prisma
RUN npm --prefix backend run prisma:generate

COPY backend/ ./backend/
COPY package.json ./

# Ship the built SPA so the API container can serve it (see src/index.js
# static-serve + SPA fallback). Local dev is unaffected: Vite serves the
# frontend itself and this copy simply never exists outside the image.
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5000
CMD ["npm", "--prefix", "backend", "start"]
