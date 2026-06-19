# AI Arcade 交付报告

AI Arcade 是一个 AI Native 互动游戏 Web 平台 MVP，用于验证「登录/注册 -> 创意生成 -> 游戏发布 -> 浏览游玩」的完整业务闭环。项目支持创作者通过自然语言 prompt 和多模态素材触发 Multi-Agent 生成任务，系统将生成的 HTML5 游戏产物上传到 MinIO 对象存储，保存游戏 meta 与版本记录，并在 Play 页面通过远端 manifest 动态加载运行。

## 1. 提交信息

- 源码仓库：`git@github.com:adkeb/ai_arcade.git`
- GitHub HTTPS：`https://github.com/adkeb/ai_arcade`
- 默认分支：`main`
- 提交记录：已按阶段拆分为多次清晰提交，满足 PDF「不接受少于 3 次提交」要求。
- Demo 地址：本地 Docker Compose Demo，启动后访问 `http://localhost:3000`

远端检查命令：

```bash
git remote -v
git log --oneline --decorate --max-count=8
git status --short --branch
```

当前主要提交历史：

```bash
ccc31b2 fix: address post-review QA findings
ea69af5 docs: rewrite README as Chinese delivery report
380a441 test: add verification suite and delivery documentation
d49b2c0 feat: build web flows for discovery creation and play
55b9b56 feat: implement backend APIs and agent pipeline
db3a7cb chore: scaffold AI Arcade platform foundation
```

分段说明：

- `db3a7cb`：项目基础脚手架、workspace、Docker/Prisma 基础。
- `55b9b56`：后端 API、数据库模型、存储和 Agent pipeline。
- `d49b2c0`：前端 Home/Create/Play/详情页业务闭环。
- `380a441`：Playwright、验证文档和交付资料。
- `ea69af5`：中文 README 交付报告。
- `ccc31b2`：根据 `测评结果.md` 做测评后修复。

## 2. 启动命令与 Demo 地址

推荐使用 Docker Compose，一次启动 Web、Worker、PostgreSQL、Redis、MinIO 和 bucket 初始化任务：

```bash
docker compose up --build
```

启动后服务地址：

- Web 应用：`http://localhost:3000`
- MinIO API：`http://localhost:9002`
- MinIO Console：`http://localhost:9003`
- MinIO 账号：`minioadmin` / `minioadmin`
- PostgreSQL：`localhost:5433`
- Redis：`localhost:6380`

本地非 Docker 开发方式：

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:all
```

如果本地 Web/Worker 连接 Docker Compose 中的基础设施，`.env` 需要使用宿主机端口：

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_arcade
REDIS_URL=redis://localhost:6380
S3_ENDPOINT=http://localhost:9002
S3_PUBLIC_ENDPOINT=http://localhost:9002
```

## 3. 测试账号与演示路径

测试账号由 seed 自动创建：

- Email：`creator@example.com`
- Password：`password123`

建议验收路径：

1. 打开 `http://localhost:3000`，确认 Home 展示至少 3 个已发布游戏。
2. 进入 `/login`，使用测试账号登录。
3. 进入 `/create`，输入创意 prompt，并上传一个图片、文本、PDF 或 JSON 文件。
4. 点击 Generate，观察任务状态、进度条、Agent logs、成本估算和任务历史。
5. 生成成功后点击 Preview，确认 Play 页面展示 `manifestUrl`、`entryUrl`、`artifactBaseUrl`。
6. 返回 Create 点击 Publish，将草稿发布为平台游戏。
7. 回到 Home，使用搜索框和标签筛选找到新游戏。
8. 进入详情页，确认版本历史、当前 artifact 信息、点赞/收藏入口。
9. 点击 Like/Favorite，确认计数变化。
10. 点击 Play，确认 iframe 运行的是 MinIO 远端对象存储中的 `index.html`。
11. 回到 Create，使用 Remix 将历史任务 prompt 和素材带回输入区。

## 4. 测试数据

`pnpm db:seed` 或 `docker compose up --build` 会自动写入测试数据：

- `Pixel Runner`：手工 seed 的示例游戏。
- `Memory Garden`：手工 seed 的示例游戏。
- `Orbit Spark Dash`：模拟 Agent 生成并发布的示例游戏。
- `creator@example.com`：测试创作者账号。

这满足 PDF 要求：系统内至少 3 个示例游戏，且至少 1 个来自 Create/Agent 生成流程并发布。

## 5. 环境变量说明

项目包含 `.env.example`，只提交变量名和安全默认值，不提交真实密钥。

核心变量：

- `DATABASE_URL`：PostgreSQL 连接串。
- `REDIS_URL`：BullMQ 使用的 Redis 连接串。
- `SESSION_SECRET`：httpOnly session token hash secret。
- `APP_URL`：Web 应用外部访问地址，用于 OAuth callback URL。
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`：GitHub OAuth，可选。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：Google OAuth，可选。
- `S3_ENDPOINT`：服务端访问 MinIO/S3 的 endpoint。
- `S3_PUBLIC_ENDPOINT`：浏览器可访问的对象存储公开 endpoint。
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`：S3 兼容访问凭据，Demo 默认 MinIO 凭据。
- `S3_ASSETS_BUCKET`：上传素材 bucket，默认 `game-assets`。
- `S3_ARTIFACTS_BUCKET`：游戏产物 bucket，默认 `game-artifacts`。
- `MAX_UPLOAD_MB`：上传文件大小限制。
- `JOB_TIMEOUT_SECONDS`：生成任务超时时间。
- `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`：可选 OpenAI-compatible 模型 key。
- `OPENAI_BASE_URL` / `DASHSCOPE_BASE_URL`：OpenAI-compatible endpoint。
- `OPENAI_MODEL` / `DASHSCOPE_MODEL`：模型名，默认 `qwen3.7-plus`。
- `OPENAI_ENABLE_THINKING` / `DASHSCOPE_ENABLE_THINKING`：是否启用 thinking 参数。
- `OPENAI_JSON_RESPONSE_FORMAT`：是否要求 JSON response format。
- `USE_LOCAL_AGENT_FALLBACK`：默认 `true`，无真实 key 时使用确定性本地 Agent fallback。

启用内部 OpenAI-compatible 模型示例：

```bash
export DASHSCOPE_API_KEY=your_key_here
export USE_LOCAL_AGENT_FALLBACK=false
docker compose up --build web worker
```

## 6. 技术栈

- 前端：Next.js App Router、React、TypeScript、Tailwind CSS、Lucide Icons。
- 后端：Next.js API Routes、Prisma ORM、bcryptjs、httpOnly cookie session。
- 数据库：PostgreSQL 16。
- 异步任务：Redis + BullMQ。
- 对象存储：MinIO，S3-compatible SDK，可迁移到云厂商 OSS/S3。
- Agent：TypeScript state-machine orchestrator，包含 Intent Planner、Game Design、Code Gen、Safety Review、Build Packager、Publish Agent。
- 模型服务：OpenAI-compatible provider，可接 DashScope 内部 endpoint；默认本地 deterministic fallback 便于离线验收。
- Local fallback：根据 prompt 分流到躲避收集、记忆配对、横版跑酷、花园序列等不同玩法模板。
- 安全隔离：Play iframe sandbox，生成代码安全扫描，禁止外部脚本、fetch、WebSocket、cookie/storage、`eval` 等能力。
- 部署方式：Docker Compose 启动 web、worker、postgres、redis、minio、minio-init。
- 测试：TypeScript、ESLint、Next production build、Playwright E2E。

## 7. 系统架构

```mermaid
flowchart LR
  User["玩家 / 创作者"] --> Web["Next.js Web"]
  Web --> Api["Next.js API Routes"]
  Api --> Postgres["PostgreSQL / Prisma"]
  Api --> Redis["Redis / BullMQ"]
  Api --> MinIO["MinIO / S3 Buckets"]
  Redis --> Worker["Generation Worker"]
  Worker --> Agent["Multi-Agent Orchestrator"]
  Agent --> Safety["Safety Review"]
  Agent --> MinIO
  Agent --> Postgres
  Web --> Play["Play iframe sandbox"]
  Play --> MinIO
```

核心数据流：

1. 创作者在 Create 输入 prompt 并上传素材。
2. `/api/assets/upload` 将素材写入 `game-assets` bucket。
3. `/api/jobs` 创建 `GenerationJob`，写入 PostgreSQL，并投递 BullMQ。
4. Worker 消费任务，按 Agent 工作流生成游戏代码、审查、打包并上传到 `game-artifacts`。
5. Publish Agent 创建 `Game` 与 `GameVersion`，保存 manifest、entry、bucket/prefix、版本号等元数据。
6. Play 页面通过 `/api/games/{gameId}/manifest` 获取远端 manifest，再将 `entryUrl` 注入 sandbox iframe。
7. 前端和后端记录 play telemetry，`play_start` 会增加 `Game.playCount`。

更详细设计见：

- `docs/SYSTEM_DESIGN.md`：架构与模块说明。
- `docs/API.md`：核心接口。
- `docs/DATA_MODEL.md`：数据模型。
- `docs/AGENT_WORKFLOW.md`：Agent 工作流。
- `docs/ARTIFACT_PROTOCOL.md`：远端产物协议。
- `docs/SECURITY.md`：安全方案。

## 8. 功能完成度对照

### 登录注册

已完成：

- 邮箱注册、邮箱登录、退出。
- httpOnly cookie session。
- `/create` 受保护，未登录会跳转 `/login`。
- `GET /api/auth/session` 可查看当前登录态。
- `Account` 表支持 `credentials`、`github`、`google` provider。
- GitHub/Google OAuth start/callback 路由已实现；未配置 provider secret 时展示明确错误。

说明：

- 仓库不提交第三方 OAuth client secret。
- 如果配置 GitHub/Google OAuth 凭据，可走授权 callback 并绑定到同一 `User`/`Session`。

### Home

已完成：

- 展示所有已发布游戏。
- 每个卡片包含封面、标题、作者、简介、标签、发布时间、游玩次数。
- 支持搜索、标签筛选。
- 支持进入详情页或直接 Play。
- 支持点赞、收藏，维护用户态和聚合计数。
- Seed 后至少 3 个示例游戏，其中包含 Agent 生成游戏。

### Play

已完成：

- 根据数据库 meta 动态获取 `manifestUrl` 和 `artifactBaseUrl`。
- 从 MinIO/S3 远端对象存储加载 `index.html`。
- 使用 iframe `sandbox="allow-scripts"` 隔离运行生成游戏。
- 展示 Runtime proof，包括 manifest、entry、artifact base URL 和加载状态。
- 前端记录 load start/success/failed，后端记录 play telemetry。
- `play_start` 增加游戏游玩次数。

### Create

已完成：

- 多模态输入：文本 prompt + 文件/图片/视频/PDF/JSON/文本上传。
- API 层要求 `assetIds` 至少包含 1 个已上传素材，与「上传至少一种多模态素材」验收要求一致。
- BullMQ 异步任务队列。
- Multi-Agent 生成链路。
- 任务进度、状态、当前步骤。
- Agent 执行日志。
- 失败重试。
- 生成任务历史。
- Remix：从历史任务恢复 prompt 和素材。
- 版本管理：`GameVersion` 持久化和详情页展示。
- 成本估算：根据 prompt、素材大小、输出代码体量估算。
- 安全审查：扫描危险浏览器能力。
- 产物地址展示与 Preview/Publish。

## 9. 核心接口摘要

- `POST /api/auth/register`：邮箱注册。
- `POST /api/auth/login`：邮箱登录。
- `POST /api/auth/logout`：退出。
- `GET /api/auth/session`：当前 session。
- `GET /api/auth/oauth/{github|google}/start`：OAuth 授权开始。
- `GET /api/auth/oauth/{github|google}/callback`：OAuth callback 和账号绑定。
- `POST /api/assets/upload`：上传多模态素材。
- `POST /api/jobs`：创建生成任务，`assetIds` 必须至少包含 1 个当前用户上传的素材。
- `GET /api/jobs`：任务历史。
- `GET /api/jobs/{jobId}`：任务状态。
- `GET /api/jobs/{jobId}/logs`：Agent logs。
- `GET /api/games`：游戏列表，支持 `search`、`tag`。
- `GET /api/games/{gameId}`：游戏详情。
- `POST /api/games/{gameId}/publish`：发布草稿。
- `GET /api/games/{gameId}/manifest`：Play manifest。
- `POST /api/games/{gameId}/like`：点赞/取消点赞。
- `POST /api/games/{gameId}/favorite`：收藏/取消收藏。
- `POST /api/telemetry/play`：游玩埋点。

## 10. 远端产物协议

生成产物上传到 MinIO：

```text
game-artifacts/
  games/{gameId}/v{version}/
    index.html
    game.js
    style.css
    cover.svg
    manifest.json
```

`manifest.json` 包含：

- game/version/title/description/tags。
- entry file。
- artifact base URL。
- files 列表、MIME type、size、sha256 hash。
- build status。

Play 页面不会运行本地写死组件，而是通过数据库中的 `manifestUrl` 拉取远端 manifest，再加载远端 `index.html`。

## 11. 安全设计

已实现：

- session cookie 使用 httpOnly。
- 密码使用 bcrypt hash。
- Create/API 需要登录。
- Job、Asset、Draft 只允许 owner 访问。
- 上传类型和大小限制。
- 生成代码安全扫描，阻断 `eval`、`new Function`、cookie、storage、外部脚本、外部 fetch、WebSocket、设备 API、`window.top` 等。
- Safety Review 阻断时，`GenerationJob` 和对应 `SafetyReviewAgent` 日志都会标记为 `failed`，便于排障。
- Play 使用 iframe sandbox，默认不允许 same-origin。
- `.env.example` 不包含真实密钥，真实 API key 未提交。

生产建议：

- 使用独立 sandbox 子域运行生成游戏。
- 增加 CSP hash、资源配额、执行超时和更严格的静态分析。
- OAuth token 如需持久化，应加密保存并定期轮换。

## 12. 测试与验证证据

已执行自动化检查：

```bash
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
docker compose config --quiet
pnpm test:e2e
```

测评后修复验证：

```bash
docker compose up --build -d web worker
pnpm test:e2e

# API 错误码不再暴露原始 Zod issues
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"bad","username":"qa","password":"password123"}'

curl -s -b "$COOKIE" -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{"prompt":"","assetIds":[]}'

curl -s -b "$COOKIE" -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{"prompt":"做一个足够长的测试游戏 prompt","assetIds":[]}'
```

预期错误码：

- 无效邮箱：`INVALID_EMAIL`
- 短密码：`PASSWORD_TOO_SHORT`
- 空 prompt：`PROMPT_TOO_SHORT`
- 未上传素材创建任务：`ASSET_REQUIRED`
- 恶意生成代码触发安全审查：job `failed`，`SafetyReviewAgent` log `failed`

本地 fallback prompt 分流已验证：

- 飞船/陨石/能量：`avoid-collect`
- 记忆/翻牌/配对：`memory-match`
- 花园/序列/花床：`garden-sequence`
- 跑酷/runner/横版：`runner`

Playwright 覆盖：

- OAuth 未配置时的错误提示。
- Home 至少 3 个游戏渲染。
- 搜索与标签筛选。
- 详情页 artifact 和版本信息。
- Play 远端 manifest 和 iframe 远端 entry 加载。
- 登录。
- 文件上传。
- Create 生成任务。
- Agent logs。
- 预览。
- 发布。
- 点赞和收藏。

截图路径：

- `test-results/screenshots/auth-oauth.png`
- `test-results/screenshots/home.png`
- `test-results/screenshots/details.png`
- `test-results/screenshots/play.png`
- `test-results/screenshots/create-published.png`
- `test-results/screenshots/social-details.png`

说明：`test-results` 和 `playwright-report` 已被 `.gitignore` 排除，不提交测试产物。

## 13. 完成度说明

已完成：

- 可运行 Demo。
- Docker Compose 一键启动。
- 登录/注册/退出/session。
- 受保护 Create 页面。
- Home 浏览、搜索、标签筛选、详情页。
- Play 远端 manifest 加载。
- 多模态素材上传。
- Multi-Agent 生成任务。
- MinIO 对象存储。
- PostgreSQL 元数据持久化。
- Redis/BullMQ 异步任务。
- Agent logs、历史、重试、Remix。
- 发布流程。
- 版本持久化和展示。
- 点赞/收藏/游玩次数。
- Play telemetry。
- 安全扫描和 iframe sandbox。
- OpenAI-compatible 模型入口和本地 fallback。
- 系统设计、API、数据模型、Agent、产物协议、安全、测试文档。
- 不少于 3 次清晰 commit 记录。

Mock / fallback：

- 默认使用本地 deterministic Agent fallback，保证无真实模型 key 也能完成端到端验收。
- OpenAI/DashScope-compatible provider 已实现；配置 `DASHSCOPE_API_KEY` 或 `OPENAI_API_KEY` 并关闭 fallback 后可接真实模型。
- 本地 fallback 已按 prompt intent 生成不同玩法循环，不再只替换标题、颜色和标签。
- OAuth GitHub/Google 代码路径已实现，但仓库不包含 provider client secret；需要部署环境注入。
- 成本为估算值，不是 provider billing export。

已知限制：

- 生成游戏 sandbox 仍与主站同域下 iframe 加载对象存储 URL，生产建议迁到独立 sandbox origin。
- 生成代码安全审查是静态规则扫描，生产需引入更强 AST/沙箱执行/资源限制。
- 版本管理已持久化和展示，但作者侧 rollback/edit UI 未做。
- OAuth token 未持久化；如果后续要调用 provider API，需要加密存储和刷新机制。
- 暂无线上部署地址，本交付为本地 Docker Compose Demo。

## 14. 如果再给一周的迭代计划

1. 部署到云环境，提供公网 Demo URL、独立 sandbox 域名和 HTTPS。
2. 接入真实 GitHub 或 Google OAuth app，完成第三方登录实测。
3. 强化 Agent 输出 schema validation、重试策略、prompt injection 防护和模型调用观测。
4. 增加生成代码 AST 分析、CSP hash、CPU/内存/时间资源限制。
5. 增加作者侧版本 rollback、编辑游戏 meta、重新生成版本。
6. 增加 play session、性能指标、留存指标和可视化后台。
7. 接入真实模型成本账单，替换估算成本。
8. 扩展 API integration tests 和 worker failure/retry tests。

## 15. AI 协作记录

- 使用 Codex 作为主要 AI 编程协作工具。
- AI 参与需求拆解、系统设计、代码生成、测试补齐、错误定位和文档整理。
- 人工主导验收标准、架构边界、提交拆分和安全审查。
- 典型人工修复：
  - 补齐 Playwright Chromium 和 Linux 依赖。
  - 修复 Docker build 中 Prisma generated client / `.next` symlink 相关问题。
  - 修复登录成功后客户端跳转问题。
  - 修复 OAuth API route 使用 Next `Link` 导致的额外 OPTIONS 请求。
  - 将 `next lint` 迁移到 ESLint flat config，避免交互式初始化导致 CI 失败。

## 16. 提交与复现检查清单

```bash
git log --oneline --decorate --max-count=8
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
docker compose up --build
pnpm test:e2e
```

远端仓库：

```bash
git remote -v
origin  git@github.com:adkeb/ai_arcade.git (fetch)
origin  git@github.com:adkeb/ai_arcade.git (push)
```
