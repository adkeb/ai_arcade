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

当前主要提交主题：

```bash
feat: build web flows for discovery creation and play
feat: analyze uploaded assets with DocMind
feat: call LLM from code generation agent
fix: persist encrypted OAuth provider tokens
fix: harden generated game sandboxing
feat: add author editing and version rollback
feat: regenerate game versions from author controls
test: cover model, asset, OAuth, safety, and external smoke paths
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

1. 打开 `http://localhost:3000`，确认 Home 最多展示四个玩法代表游戏。
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
- `Pattern Cards`：手工 seed 的记忆配对示例游戏。
- `Memory Garden`：手工 seed 的示例游戏。
- `Orbit Spark Dash`：模拟 Agent 生成并发布的示例游戏。
- `creator@example.com`：测试创作者账号。

这满足 PDF 要求：系统内至少 3 个示例游戏，且至少 1 个来自 Create/Agent 生成流程并发布。Home/API 会从 `avoid-collect`、`memory-match`、`runner`、`garden-sequence` 四个玩法 tag 中各展示最新一条。

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
- `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`：真实 Create/Regenerate 必需的 OpenAI-compatible 模型 key。
- `OPENAI_BASE_URL` / `DASHSCOPE_BASE_URL`：OpenAI-compatible endpoint。
- `OPENAI_MODEL` / `DASHSCOPE_MODEL`：模型名，默认 `qwen3.7-plus`。
- `OPENAI_ENABLE_THINKING` / `DASHSCOPE_ENABLE_THINKING`：是否启用 thinking 参数。
- `OPENAI_JSON_RESPONSE_FORMAT`：是否要求 JSON response format。
- `USE_LOCAL_AGENT_FALLBACK`：默认 `false`。仅离线 demo、seed 和测试需要本地模板时设为 `true`；关闭 fallback 且缺少模型 key 时，Create/Regenerate 会失败并提示未配置真实模型。
- `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET`：可选，阿里云 DocMind 文档解析 SDK 凭据。
- `DOCMIND_ENDPOINT`：DocMind endpoint，默认 `docmind-api.cn-hangzhou.aliyuncs.com`。
- `DOCMIND_ACCESS_KEY_ID` / `DOCMIND_ACCESS_KEY_SECRET`：可选，DocMind 专用 AK/SK；未设置时回退到 `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET`。
- `DOCMIND_REGION_ID`：DocMind region，默认 `cn-hangzhou`。
- `DOCMIND_LLM_ENHANCEMENT` / `DOCMIND_ENHANCEMENT_MODE`：是否启用 DocMind 大模型增强与 VLM 模式。
- `DOCMIND_POLL_ATTEMPTS` / `DOCMIND_POLL_INTERVAL_MS`：DocMind 异步任务轮询配置。
- `RUN_EXTERNAL_SMOKE`：默认 `false`；设为非 `false` 且配置真实凭据后，`pnpm test:external` 会调用真实 LLM/DocMind/OAuth 配置 smoke。

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
- 模型服务：OpenAI-compatible provider，可接 DashScope 内部 endpoint；Intent Planner、Game Design、Code Gen 默认要求远程 JSON 调用，CodeGen 带质量门槛和最多两次模型修复。
- Local fallback：仅在显式 `USE_LOCAL_AGENT_FALLBACK=true` 时用于离线 demo、seed 和测试；根据 prompt 分流到躲避收集、记忆配对、横版跑酷、花园序列等不同玩法模板。
- 安全隔离：Play iframe sandbox + no-referrer + feature policy deny-list，生成代码安全扫描，CSP 禁止内联脚本/样式、外部网络、表单、嵌入对象、cookie/storage、`eval` 等能力。
- 安全审查：SafetyReview 使用正则 + TypeScript AST 扫描，拦截无界循环、字符串定时器、高频定时器、危险构造器和敏感浏览器属性访问。
- 部署方式：Docker Compose 启动 web、worker、postgres、redis、minio、minio-init。
- 测试：TypeScript、ESLint、Next production build、Node test unit/integration/external smoke、Playwright E2E。

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
- 如果配置 GitHub/Google OAuth 凭据，可走授权 callback 并绑定到同一 `User`/`Session`，access/refresh token 会用 `SESSION_SECRET` 派生密钥加密后保存到 `Account`。

### Home

已完成：

- 从已发布且有 currentVersion 的游戏中，按 `avoid-collect`、`memory-match`、`runner`、`garden-sequence` 四个玩法 tag 各展示最新一条。
- 每个卡片包含封面、标题、作者、简介、标签、发布时间、游玩次数。
- 支持在这四个展示游戏内搜索和标签筛选。
- 支持进入详情页或直接 Play。
- 支持点赞、收藏，维护用户态和聚合计数。
- Seed 后至少 3 个示例游戏，其中包含 Agent 生成游戏；历史 published 游戏仍可通过详情/Play URL 访问。

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
- 可只输入创意 prompt 直接生成；上传素材为可选增强上下文。
- 上传素材优先调用阿里云 DocMind 文档解析（大模型版），把 Markdown/视频帧/ASR 等解析摘要写入 `Asset.analysis`；无凭据或解析失败时使用本地解析 fallback。
- BullMQ 异步任务队列。
- Multi-Agent 生成链路。
- 任务进度、状态、当前步骤。
- Agent 执行日志。
- 失败重试。
- 生成任务历史。
- Remix：从历史任务恢复 prompt 和素材。
- 版本管理：`GameVersion` 持久化、详情页展示、作者编辑 meta、作者回滚当前版本。
- 版本再生成：作者可在详情页基于现有游戏上下文提交新 prompt，生成链路会发布下一版 `GameVersion`。
- 版本比较：详情页展示每个版本相对上一版的新增、变更、删除文件 hash 差异。
- 成本估算：根据 prompt、素材大小、输出代码体量估算。
- 安全审查：扫描危险浏览器能力。
- 产物地址展示与 Preview/Publish。

## 9. 验证命令

常规本地验证：

```bash
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
pnpm test:unit
pnpm test:external
```

有本地 PostgreSQL 时运行 OAuth token 加密集成测试：

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_arcade SESSION_SECRET=test-secret pnpm test:integration
```

E2E 需要先启动 Docker Compose，并安装 Playwright Chromium：

```bash
pnpm test:e2e:install-deps
USE_LOCAL_AGENT_FALLBACK=true docker compose up --build
pnpm test:e2e
```

本地没有第三方凭据时，`pnpm test:external` 会明确跳过 LLM、DocMind、GitHub OAuth、Google OAuth 的真实外部调用；配置凭据后会自动执行可自动化的 smoke。完整 OAuth 授权仍需要交互式浏览器账号。

## 10. 核心接口摘要

- `POST /api/auth/register`：邮箱注册。
- `POST /api/auth/login`：邮箱登录。
- `POST /api/auth/logout`：退出。
- `GET /api/auth/session`：当前 session。
- `GET /api/auth/oauth/{github|google}/start`：OAuth 授权开始。
- `GET /api/auth/oauth/{github|google}/callback`：OAuth callback 和账号绑定。
- `POST /api/assets/upload`：上传多模态素材，并生成 `analysis` 内容摘要。
- `POST /api/jobs`：创建生成任务，`assetIds` 可选，用于附加当前用户上传的素材上下文。
- `GET /api/jobs`：任务历史。
- `GET /api/jobs/{jobId}`：任务状态。
- `GET /api/jobs/{jobId}/logs`：Agent logs。
- `GET /api/games`：游戏列表，支持 `search`、`tag`。
- `GET /api/games/{gameId}`：游戏详情。
- `PATCH /api/games/{gameId}`：作者更新标题、简介和标签。
- `POST /api/games/{gameId}/publish`：发布草稿。
- `GET /api/games/{gameId}/manifest`：Play manifest。
- `POST /api/games/{gameId}/versions/{versionId}/rollback`：作者恢复历史版本为当前版本。
- `POST /api/games/{gameId}/regenerate`：作者基于当前游戏上下文生成下一版。
- `POST /api/games/{gameId}/like`：点赞/取消点赞。
- `POST /api/games/{gameId}/favorite`：收藏/取消收藏。
- `POST /api/telemetry/play`：游玩埋点。

## 11. 远端产物协议

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

## 12. 安全设计

已实现：

- session cookie 使用 httpOnly。
- 密码使用 bcrypt hash。
- Create/API 需要登录。
- Job、Asset、Draft 只允许 owner 访问。
- 上传类型和大小限制。
- 生成代码安全扫描，阻断 `eval`、`new Function`、cookie、storage、外部脚本、外部 fetch、WebSocket、设备 API、`window.top`、无界循环和高频定时器等。
- Safety Review 阻断时，`GenerationJob` 和对应 `SafetyReviewAgent` 日志都会标记为 `failed`，便于排障。
- Play 使用 iframe sandbox，默认不允许 same-origin。
- `.env.example` 不包含真实密钥，真实 API key 未提交。

生产建议：

- 使用独立 sandbox 子域运行生成游戏。
- 增加 CSP hash、浏览器/容器级资源配额、执行超时和运行时监控。
- OAuth token 已加密持久化；生产环境继续补 provider refresh token 轮换、撤销和审计。

## 13. 测试与验证证据

已执行自动化检查：

```bash
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
pnpm test:unit
pnpm test:integration
pnpm test:external
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
- 无素材有效 prompt：应创建 `GenerationJob` 并返回 `{ jobId, status, currentStep }`
- 恶意生成代码触发安全审查：job `failed`，`SafetyReviewAgent` log `failed`

本地 fallback prompt 分流已验证：

- 飞船/陨石/能量：`avoid-collect`
- 记忆/翻牌/配对：`memory-match`
- 花园/序列/花床：`garden-sequence`
- 跑酷/runner/横版：`runner`

Playwright 覆盖：

- OAuth 未配置时的错误提示。
- Home 最多 4 个玩法代表游戏渲染。
- 搜索与标签筛选。
- 详情页 artifact 和版本信息。
- Play 远端 manifest 和 iframe 远端 entry 加载。
- 登录。
- 文件上传。
- Create 生成任务。
- Agent logs。
- 预览。
- 发布。
- 作者编辑、版本再生成、版本比较和 rollback。
- 点赞和收藏。

截图路径：

- `test-results/screenshots/auth-oauth.png`
- `test-results/screenshots/home.png`
- `test-results/screenshots/details.png`
- `test-results/screenshots/play.png`
- `test-results/screenshots/create-published.png`
- `test-results/screenshots/social-details.png`

说明：`test-results` 和 `playwright-report` 已被 `.gitignore` 排除，不提交测试产物。

## 14. 完成度说明

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
- 版本持久化、展示、文件 hash 比较、再生成和 rollback。
- 点赞/收藏/游玩次数。
- Play telemetry。
- 安全扫描和 iframe sandbox。
- OpenAI-compatible 模型入口、CodeGen 修复循环和显式本地 fallback。
- 系统设计、API、数据模型、Agent、产物协议、安全、测试文档。
- 不少于 3 次清晰 commit 记录。

Mock / fallback：

- 默认要求真实 OpenAI/DashScope-compatible provider；无 `DASHSCOPE_API_KEY` 或 `OPENAI_API_KEY` 且 fallback 关闭时，Create/Regenerate 明确失败。
- 本地 deterministic Agent fallback 只在 `USE_LOCAL_AGENT_FALLBACK=true` 时启用，用于离线 demo、seed 和测试。
- 本地 fallback 已按 prompt intent 生成不同玩法循环，但不再被视为正式 AI 原创生成能力。
- OAuth GitHub/Google 代码路径已实现，但仓库不包含 provider client secret；需要部署环境注入。
- 成本为估算值，不是 provider billing export。

已知限制：

- 生成游戏仍依赖 iframe 加载对象存储 URL，生产建议迁到独立 sandbox origin。
- 生成代码安全审查已有静态规则和 AST 扫描，生产仍需补浏览器/容器级 CPU、内存、执行时长限制和运行时监控。
- 版本管理已支持再生成、比较和 rollback；生产可继续补视觉 diff、分支/fork 和审计记录。
- OAuth token 已加密持久化；生产环境仍建议补充 provider refresh token 轮换、撤销和审计。
- 暂无线上部署地址，本交付为本地 Docker Compose Demo。

## 15. 如果再给一周的迭代计划

1. 部署到云环境，提供公网 Demo URL、独立 sandbox 域名和 HTTPS。
2. 接入真实 GitHub 或 Google OAuth app，完成第三方登录实测。
3. 强化 Agent 输出 schema validation、重试策略、prompt injection 防护和模型调用观测。
4. 增加 CSP hash、CPU/内存/时间资源限制和运行时监控。
5. 增加视觉版本 diff、分支/fork 工作流和更细的创作者审计记录。
6. 增加 play session、性能指标、留存指标和可视化后台。
7. 接入真实模型成本账单，替换估算成本。
8. 扩展 API integration tests 和 worker failure/retry tests。

## 16. AI 协作记录

- 使用 Codex 作为主要 AI 编程协作工具。
- AI 参与需求拆解、系统设计、代码生成、测试补齐、错误定位和文档整理。
- 人工主导验收标准、架构边界、提交拆分和安全审查。
- 典型人工修复：
  - 补齐 Playwright Chromium 和 Linux 依赖。
  - 修复 Docker build 中 Prisma generated client / `.next` symlink 相关问题。
  - 修复登录成功后客户端跳转问题。
  - 修复 OAuth API route 使用 Next `Link` 导致的额外 OPTIONS 请求。
  - 将 `next lint` 迁移到 ESLint flat config，避免交互式初始化导致 CI 失败。

## 17. 提交与复现检查清单

```bash
git log --oneline --decorate --max-count=8
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
pnpm test:unit
pnpm test:external
docker compose up --build
pnpm test:e2e
```

远端仓库：

```bash
git remote -v
origin  git@github.com:adkeb/ai_arcade.git (fetch)
origin  git@github.com:adkeb/ai_arcade.git (push)
```
