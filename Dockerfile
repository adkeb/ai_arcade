FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/agent/package.json packages/agent/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/worker/package.json packages/worker/package.json

RUN pnpm install --frozen-lockfile=false

COPY . .

RUN pnpm db:generate

EXPOSE 3000

CMD ["pnpm", "dev"]
