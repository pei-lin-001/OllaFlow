FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN mkdir -p /app/dist/frontend && npx vite build --outDir /app/dist/frontend

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

ARG PRISMA_VERSION=5.22.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npm install prisma@${PRISMA_VERSION} @prisma/client@${PRISMA_VERSION}

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist/frontend ./dist/frontend

RUN mkdir -p /app/prisma/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/prisma/data/app.db"

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]