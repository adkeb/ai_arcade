# API

All successful responses use `{ "ok": true, "data": ... }`. Errors use `{ "ok": false, "error": { "code": "...", "message": "..." } }`.

## Auth

- `POST /api/auth/register`
  - Request: `{ email, username, password }`
  - Response: `{ user }` and httpOnly session cookie.
  - Errors: `EMAIL_EXISTS`, `REGISTER_FAILED`.

- `POST /api/auth/login`
  - Request: `{ email, password }`
  - Response: `{ user }` and httpOnly session cookie.
  - Errors: `INVALID_CREDENTIALS`, `LOGIN_FAILED`.

- `POST /api/auth/logout`
  - Clears the server session and cookie.

- `GET /api/auth/session`
  - Response: `{ user: null | { id, email, username, avatarUrl } }`.

- `GET /api/auth/oauth/{github|google}/start`
  - Redirects to the configured provider authorization page.
  - Requires provider client id/secret environment variables.

- `GET /api/auth/oauth/{github|google}/callback`
  - Validates OAuth `state`, exchanges `code`, fetches a verified email profile, upserts `Account`, encrypts access/refresh tokens at rest, and creates the same httpOnly session cookie as credentials auth.

## Assets

- `POST /api/assets/upload`
  - Auth required.
  - Multipart field: `file`.
  - Validates type and `MAX_UPLOAD_MB`.
  - Uploads to `game-assets/uploads/{userId}/{assetId}/{safeFileName}`.
  - Runs asset analysis. If DocMind credentials are configured, the upload is parsed with Aliyun Document Mind first; otherwise the API uses local text/PDF/image/video metadata fallback.
  - Response: `{ assetId, objectKey, url, originalName, mimeType, size, analysis }`.

## Jobs

- `POST /api/jobs`
  - Auth required.
  - Request: `{ prompt: string, assetIds?: string[] }`; `assetIds` is optional and can attach uploaded assets as extra context.
  - Creates a `GenerationJob`, links assets, and enqueues BullMQ.
  - Response: `{ jobId, status, currentStep }`.

- `GET /api/jobs`
  - Auth required.
  - Lists the current user's recent jobs.

- `GET /api/jobs/{jobId}`
  - Auth required and owner-only.
  - Response includes `status`, `progress`, `currentStep`, `gameId`, `manifestUrl`, `artifactBaseUrl`, `costEstimated`, `finishedAt`, and `errorMessage`.

- `GET /api/jobs/{jobId}/logs`
  - Auth required and owner-only.
  - Returns ordered `AgentLog` rows.

## Games

- `GET /api/games`
  - Lists published games from the database.
  - Optional query: `search`, `tag`.

- `GET /api/games/{gameId}`
  - Returns game meta, author, and current version.
  - Drafts are visible only to the author.

- `PATCH /api/games/{gameId}`
  - Auth required and author-only.
  - Updates `title`, `description`, and `tags`.

- `POST /api/games/{gameId}/publish`
  - Auth required and author-only.
  - Marks a draft game as `published` and sets `publishedAt`.

- `GET /api/games/{gameId}/manifest`
  - Returns `{ manifestUrl, artifactBaseUrl, manifestJson }`.
  - Play uses this to fetch the remote object-storage manifest.

- `POST /api/games/{gameId}/versions/{versionId}/rollback`
  - Auth required and author-only.
  - Sets `Game.currentVersionId` to a succeeded historical version.

- `POST /api/games/{gameId}/regenerate`
  - Auth required and author-only.
  - Request: `{ prompt: string }`.
  - Creates a new `GenerationJob` tied to the existing `gameId`, embeds the current title/description/tags/version as generation context, and enqueues the same Agent workflow.
  - The packager writes the next `GameVersion.versionNumber`, and PublishAgent keeps the same `Game` while switching `currentVersionId` to the new version after success.

- `POST /api/games/{gameId}/like`
  - Auth required.
  - Toggles the current user's like and refreshes `Game.likeCount`.
  - Response: `{ liked, likeCount }`.

- `POST /api/games/{gameId}/favorite`
  - Auth required.
  - Toggles the current user's favorite and refreshes `Game.favoriteCount`.
  - Response: `{ favorited, favoriteCount }`.

## Telemetry

- `POST /api/telemetry/play`
  - Request: `{ gameId, eventType, payload }`
  - Events: `game_load_start`, `game_load_success`, `game_load_failed`, `play_start`, `play_exit`, `game_over`, `restart`.
  - `play_start` increments `Game.playCount`.

## OAuth Extension Design

The `Account` table supports `credentials`, `google`, and `github` providers via `(provider, providerAccountId)`. The implemented OAuth callback validates provider `state`, fetches a verified email profile, binds to an existing `User` by email or creates a new user, and creates the same `Session` record used by credentials auth. Provider access/refresh tokens are encrypted with AES-256-GCM using a key derived from `SESSION_SECRET` before they are stored.

## Model Provider

The Agent package can use a deterministic local fallback or an OpenAI-compatible provider. Configure `OPENAI_API_KEY` or `DASHSCOPE_API_KEY`; the default compatible endpoint is the internal DashScope-style base URL with model `qwen3.7-plus`. Keep `USE_LOCAL_AGENT_FALLBACK=true` for offline demos, and do not commit real keys. `pnpm test:external` runs a small provider smoke call when credentials are present and otherwise reports a skip.
