# One service: Node serves the built web app + Socket.IO (TECH-STACK §6).
FROM node:24-slim
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

# Fetch dependencies from the lockfile alone so this layer survives source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline && pnpm build

ENV NODE_ENV=production PORT=3000 LOBBY_TTL_MINUTES=180
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Run tsx directly (same as `pnpm start`) so SIGTERM reaches the server for a clean shutdown.
WORKDIR /app/apps/server
CMD ["node_modules/.bin/tsx", "src/index.ts"]
