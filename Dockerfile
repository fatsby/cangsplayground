# One service: Node serves the built web app + Socket.IO (TECH-STACK §6).
FROM node:24-slim
WORKDIR /app
RUN corepack enable pnpm
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production PORT=3000 LOBBY_TTL_MINUTES=180
EXPOSE 3000
CMD ["pnpm", "start"]
