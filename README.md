# AI Arcade

AI Arcade is an AI Native interactive game Web platform MVP. It covers the full loop from email auth, creative prompt plus uploaded asset, async Multi-Agent generation, MinIO artifact storage, publishing, searchable Home discovery, game details/version history, social actions, and Play runtime loading from a remote manifest.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, lightweight custom UI, iframe sandbox.
- Backend: Next.js API routes, Prisma ORM, PostgreSQL, Redis + BullMQ, bcryptjs, httpOnly cookie session.
- Storage: MinIO with S3-compatible client and public object URLs.
- Agent: lightweight TypeScript state-machine orchestrator with OpenAI-compatible provider entry and deterministic local fallback.
- Deployment: Docker Compose for web, worker, PostgreSQL, Redis, MinIO, and bucket init.

## Quick Start

Docker path:

```bash
docker compose up --build
```

Local path:

```bash
pnpm install
cp .env.example .env
# If using Docker Compose infra from the host shell, set:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_arcade
# REDIS_URL=redis://localhost:6380
# S3_ENDPOINT=http://localhost:9002
# S3_PUBLIC_ENDPOINT=http://localhost:9002
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:all
```

Services:

- Web: http://localhost:3000
- MinIO API: http://localhost:9002
- MinIO Console: http://localhost:9003
- MinIO credentials: `minioadmin` / `minioadmin`
- Docker-exposed PostgreSQL: `localhost:5433`
- Docker-exposed Redis: `localhost:6380`

## Test Account

- Email: `creator@example.com`
- Password: `password123`

## Demo Path

1. Open http://localhost:3000.
2. Register or log in with `creator@example.com` / `password123`.
3. Go to `/create`.
4. Enter a game idea.
5. Upload at least one image, file, or video.
6. Create the generation task.
7. Watch pending/running/succeeded/failed state, Agent logs, cost estimate, and job history.
8. After success, click Preview.
9. Confirm Play shows `manifestUrl`, `entryUrl`, and `artifactBaseUrl`.
10. Return to Create and click Publish.
11. Return Home, search/filter by tag, and open the game Details page.
12. Like/favorite the game and verify version/artifact metadata.
13. Use Remix from Create history to reload the previous prompt/assets.
14. Click Play and verify it loads from the MinIO manifest again.

## Environment

See `.env.example`. Important variables:

- `DATABASE_URL`: PostgreSQL connection.
- `REDIS_URL`: BullMQ Redis connection.
- `SESSION_SECRET`: session-token hashing secret.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional OAuth login providers.
- `S3_ENDPOINT`: server-side S3/MinIO endpoint.
- `S3_PUBLIC_ENDPOINT`: browser-visible object-storage endpoint.
- `OPENAI_API_KEY` or `DASHSCOPE_API_KEY`: optional OpenAI-compatible provider key. Do not commit a real key.
- `OPENAI_BASE_URL`, `OPENAI_MODEL`: defaults are set for the internal DashScope-compatible endpoint and `qwen3.7-plus`.
- `USE_LOCAL_AGENT_FALLBACK`: default `true`; keeps the demo deterministic without an API key.

To use the internal OpenAI-compatible model in Docker Compose, export `DASHSCOPE_API_KEY` or `OPENAI_API_KEY` and set `USE_LOCAL_AGENT_FALLBACK=false` before starting `web` and `worker`.

## Commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm worker
pnpm dev:all
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
pnpm test:e2e:install-deps
pnpm test:e2e
```

Playwright screenshots are written to `test-results/screenshots/auth-oauth.png`, `home.png`, `details.png`, `play.png`, `create-published.png`, and `social-details.png`.

## Commit Split Suggestion

1. `chore: initialize monorepo, db, docker compose`
2. `feat: implement auth, home, create job pipeline`
3. `feat: implement agent generation, object storage, play runtime`
4. `docs: add system design and delivery notes`

## Known Limits

- OAuth is documented but not wired in this MVP.
- The default Agent generator is deterministic local fallback; real LLM use is routed through the provider entry but should be hardened before production.
- Generated games run in iframe `sandbox="allow-scripts"` with no `allow-same-origin`; production should use a dedicated sandbox domain and hash-based CSP.
- The worker is required for Create jobs outside seed. Use `pnpm dev:all` or Docker Compose.
