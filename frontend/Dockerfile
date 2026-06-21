# syntax=docker/dockerfile:1
# Build from repo root: docker build -f frontend/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:3001
ARG VITE_SOCKET_URL=http://localhost:3001

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY shared ./shared
COPY frontend ./frontend
RUN npm run build -w @visor-protect/shared \
  && npm run build -w @visor-protect/frontend

FROM nginx:1.27-alpine AS production
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1
