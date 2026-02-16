FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm -r build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY --from=builder /app /app

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "worker", "start"]
