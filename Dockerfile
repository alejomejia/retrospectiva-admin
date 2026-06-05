# Multi-stage build. Both the Next.js app and the BullMQ worker run from
# the same image — Compose just picks a different command.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` collects page data by importing route modules, which pull in
# the env-validating `config` (zod). We pass no-op URLs so the schema parses
# and the build completes; runtime gets the real values from the environment
# (compose `environment:` for the containers).
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV REDIS_URL=redis://127.0.0.1:6379
RUN pnpm build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
EXPOSE 3000
CMD ["pnpm", "start"]
