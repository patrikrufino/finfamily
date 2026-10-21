# syntax=docker/dockerfile:1

# ---- build: install, compile the web app, and extract a minimal copy of the API ----
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=true
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY packages packages
COPY apps apps
RUN pnpm --filter @finfamily/web build \
 && pnpm --filter @finfamily/api deploy --legacy --prod /deploy

# ---- runtime: only the API with its production dependencies and the built web app ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    API_PORT=3132 \
    WEB_PORT=3152 \
    DATABASE_PATH=/data/finfamily.db \
    BACKUP_DIR=/data/backups \
    WEB_DIST=/app/web
WORKDIR /app/api
COPY --from=build /deploy /app/api
COPY --from=build /repo/apps/web/dist /app/web
# The database and its backups live in /data (a volume), never inside the image.
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3132 3152
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3152/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "src/server.ts"]
