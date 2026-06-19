# System Design

## Architecture

```mermaid
flowchart LR
  Browser["Browser: Home/Create/Play"] --> Web["Next.js Web + API Routes"]
  Web --> Postgres["PostgreSQL via Prisma"]
  Web --> Redis["Redis + BullMQ Queue"]
  Web --> MinIO["MinIO S3-compatible Storage"]
  Redis --> Worker["Worker Process"]
  Worker --> Agent["Multi-Agent Orchestrator"]
  Agent --> Postgres
  Agent --> MinIO
  Browser --> Manifest["Remote manifestUrl"]
  Manifest --> Entry["Remote index.html/game.js/style.css"]
  Entry --> Iframe["sandboxed iframe runtime"]
```

## Service Responsibilities

- Web renders App Router pages and owns API boundaries.
- PostgreSQL stores users, sessions, games, versions, assets, jobs, logs, and telemetry.
- Redis/BullMQ decouples the Create request from the generation workflow.
- Worker consumes generation jobs and runs the Agent pipeline.
- MinIO stores uploaded assets and generated game artifacts under S3-compatible keys.
- Play loads database metadata, fetches the remote manifest URL, then runs the remote entry file in an iframe.

## Login Sequence

```mermaid
sequenceDiagram
  participant U as User
  participant W as Next API
  participant DB as PostgreSQL
  U->>W: POST /api/auth/login
  W->>DB: find User by email
  W->>W: bcrypt compare
  W->>DB: create Session tokenHash
  W-->>U: httpOnly cookie + user
```

## Create and Publish Sequence

```mermaid
sequenceDiagram
  participant C as Create Page
  participant API as Next API
  participant S3 as MinIO
  participant DB as PostgreSQL
  participant Q as BullMQ
  participant W as Worker
  C->>API: POST /api/assets/upload
  API->>S3: put uploads/user/asset/file
  API->>DB: create Asset
  C->>API: POST /api/jobs
  API->>DB: create GenerationJob pending
  API->>Q: enqueue jobId
  W->>Q: consume job
  W->>DB: status running + AgentLog rows
  W->>S3: upload manifest/index/js/css/cover
  W->>DB: create Game + GameVersion draft
  C->>API: POST /api/games/:id/publish
  API->>DB: status published + publishedAt
```

## Play Sequence

```mermaid
sequenceDiagram
  participant P as Play Page
  participant API as Next API
  participant DB as PostgreSQL
  participant S3 as MinIO
  participant F as iframe
  P->>API: GET /api/games/:id
  API->>DB: load game meta + currentVersion
  P->>API: GET /api/games/:id/manifest
  API->>DB: load manifestUrl
  P->>S3: fetch manifest.json
  P->>F: iframe src = remote index.html
  F->>P: postMessage play_start/game_over/restart
  P->>API: POST /api/telemetry/play
```
