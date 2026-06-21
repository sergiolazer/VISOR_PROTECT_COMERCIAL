# syntax=docker/dockerfile:1

# --- Build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY shared ./shared
COPY backend ./backend
RUN npm run build -w @visor-protect/shared \
  && npm run build -w @visor-protect/backend

# --- Production ---
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup -S visor && adduser -S visor -G visor

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --omit=dev

COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend
USER visor

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/presentation/server.js"]
