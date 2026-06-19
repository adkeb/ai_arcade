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
- Home/API showcase now deduplicates to the newest available representative for `avoid-collect`, `memory-match`, `runner`, and `garden-sequence`; search and tag filtering apply within those representatives.
- Like/favorite toggles with per-user state and aggregate counts.
- Create job history with Remix, retry, Agent logs, and cost estimates.
- Play runtime fetching remote manifest and iframe remote entry URL.
- Play telemetry persisted to PostgreSQL.
- Docker Compose with PostgreSQL, Redis, MinIO, web, worker, and bucket init.
- Seed data with three manual games and one Agent-generated published game.
- Playwright e2e coverage with screenshot artifacts.

## Post-Review Fixes

- Local Agent fallback now selects separate avoid-and-collect, memory matching, runner, and garden sequence gameplay loops from prompt intent.
- API validation failures return stable user-facing error codes/messages instead of raw Zod issue JSON.
- SafetyReview logs are marked failed when generated code is blocked.
- Job creation supports prompt-only generation; uploaded assets are optional context for multimodal runs.
- `.env.example` now uses the host-accessible MinIO public endpoint exposed by Docker Compose.
- Uploaded assets are analyzed with Aliyun DocMind when credentials are configured, with local text/JSON/PDF/image/video fallback.
- Asset analysis is persisted on `Asset.analysis` and passed into generation jobs and Agent context.
- CodeGenAgent now requires the OpenAI-compatible provider by default, passes asset and regeneration context to the model, enforces playable-source quality gates, and performs up to two model repair attempts.
- OAuth access/refresh tokens are encrypted at rest on Account records.
- Generated-game sandboxing was hardened with stricter CSP, broader SafetyReview checks, no-referrer iframe loading, and denied browser feature policy capabilities.
- Authors can edit game metadata and restore a succeeded historical version from the game detail page.
- Authors can regenerate a new version from an existing game; the job carries current game/version context and publishes the next `GameVersion`.
- Game details now show per-version file-hash comparisons against the previous version.
- Local image/video fallback analysis now extracts richer PNG palette/orientation data and MP4 brand/duration metadata.
- SafetyReview now includes a TypeScript AST pass for unbounded loops, string timer execution, high-frequency timers, and constructor/property access patterns.
- Unit, integration, and optional external smoke scripts cover LLM provider calls, asset analysis, OAuth token encryption, SafetyReview, and real-service credential checks.

## Mock or Fallback

- OpenAI/DashScope-compatible provider is the default path for Create/Regenerate and requires `OPENAI_API_KEY` or `DASHSCOPE_API_KEY`.
- Local deterministic Agent fallback is only enabled when `USE_LOCAL_AGENT_FALLBACK=true`, mainly for offline demo seeds and automated tests.
- OAuth requires provider client id/secret configuration before external login can be exercised.
- DocMind and LLM smoke tests run real external calls only when credentials are available; this local environment has no committed secrets.

## Known Gaps

- OAuth provider credentials are not included in the repo and must be supplied per environment.
- Cost tracking is estimated from prompt/assets/generated output rather than provider billing export.
- Generated games run in an iframe sandbox with static and AST scanning; production should still isolate them on a dedicated sandbox origin with HTTP-level CSP headers, CPU/memory quotas, and abuse monitoring.

## One-Week Iteration Plan

- Add provider-specific OAuth refresh-token rotation, revocation, and audit logging.
- Add richer visual version diffs and branch/fork authoring workflows.
- Add model schema validation, provider billing reconciliation, and moderation.
- Add Play performance metrics and sessionized telemetry.
- Move games to a dedicated sandbox origin with hash-based CSP.
