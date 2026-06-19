# Delivery Notes

## Completed

- Monorepo with Next.js Web, Prisma DB, Agent, Storage, Shared, and Worker packages.
- Email register/login/logout with bcrypt and httpOnly cookie session.
- GitHub/Google OAuth start/callback routes with Account binding and shared sessions.
- Protected Create page.
- Asset upload to MinIO.
- BullMQ-backed async generation jobs.
- Six-role Agent workflow with visible logs.
- HTML5 Canvas game generation with safety review.
- Artifact upload to MinIO and Game/GameVersion persistence.
- Publish flow and Home listing from database.
- Home search, tag filtering, game detail pages, and visible version history.
- Like/favorite toggles with per-user state and aggregate counts.
- Create job history with Remix, retry, Agent logs, and cost estimates.
- Play runtime fetching remote manifest and iframe remote entry URL.
- Play telemetry persisted to PostgreSQL.
- Docker Compose with PostgreSQL, Redis, MinIO, web, worker, and bucket init.
- Seed data with two manual games and one Agent-generated published game.
- Playwright e2e coverage with screenshot artifacts.

## Post-Review Fixes

- Local Agent fallback now selects separate avoid-and-collect, memory matching, runner, and garden sequence gameplay loops from prompt intent.
- API validation failures return stable user-facing error codes/messages instead of raw Zod issue JSON.
- SafetyReview logs are marked failed when generated code is blocked.
- Job creation supports prompt-only generation; uploaded assets are optional context for multimodal runs.
- `.env.example` now uses the host-accessible MinIO public endpoint exposed by Docker Compose.

## Mock or Fallback

- Local deterministic Agent fallback is the default.
- OpenAI/DashScope-compatible provider is present but not required for the demo.
- OAuth requires provider client id/secret configuration before external login can be exercised.

## Known Gaps

- OAuth provider credentials are not included in the repo and must be supplied per environment.
- Cost tracking is estimated from prompt/assets/generated output rather than provider billing export.
- Generated games run in an iframe sandbox; production should isolate them on a dedicated origin with stricter CSP.

## One-Week Iteration Plan

- Add provider-specific OAuth production hardening and token encryption if refresh-token access is needed.
- Add author-side game detail editing and version rollback.
- Add model schema validation, provider billing reconciliation, and moderation.
- Add Play performance metrics and sessionized telemetry.
- Move games to a dedicated sandbox origin with hash-based CSP.
