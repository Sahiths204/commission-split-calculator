# syntax=docker/dockerfile:1

# ---- Stage 1: build the frontend (web/dist) ----
FROM node:22-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Stage 2: build the backend (dist/) ----
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Stage 3: production runtime image ----
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /app/dist ./dist
COPY --from=web-build /app/web/dist ./web/dist
COPY db/migrations ./db/migrations

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/api/server.js"]
