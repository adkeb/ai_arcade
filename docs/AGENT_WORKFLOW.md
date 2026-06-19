# Agent Workflow

The orchestrator is a lightweight state machine in `packages/agent/src/orchestrator.ts`. Every step updates `GenerationJob.currentStep`, progress, and an `AgentLog` row.

## Steps

1. `createJobContext`
   - Loads job, user, and assets.
   - Sets status to `running`.

2. `IntentPlannerAgent`
   - Input: prompt and asset summaries.
   - Output: genre, mechanics, style, controls, entities, win/loss conditions.

3. `GameDesignAgent`
   - Input: intent plan.
   - Output: title, description, tags, cover prompt, scoring, difficulty, runtime requirements.

4. `CodeGenAgent`
   - Input: design spec.
   - Output: `index.html`, `game.js`, `style.css`.
   - Produces dependency-free Canvas games with start, loop, controls, scoring, ending, restart, and `postMessage`.

5. `SafetyReviewAgent`
   - Scans generated code for `eval`, `new Function`, cookies, storage, external scripts, external fetch, WebSocket, credentials, `window.top`, and device APIs.
   - Fails the job if blocked behavior appears.

6. `BuildPackagerAgent`
   - Computes hashes and creates `manifest.json`.
   - Adds `cover.svg`.

7. `PublishAgent`
   - Uploads artifacts to MinIO.
   - Creates `Game` and `GameVersion`.
   - Marks job succeeded.

## Fallback vs Real LLM

By default, `USE_LOCAL_AGENT_FALLBACK=true` uses deterministic prompt-based generation. It changes title, palette, theme, entities, duration, and gameplay parameters based on the prompt and uploaded asset analysis. It also selects distinct local gameplay templates for avoid-and-collect arcade, memory matching, side-scrolling runner, and garden sequence prompts so offline generation is not limited to one game loop.

When `USE_LOCAL_AGENT_FALLBACK=false` and `OPENAI_API_KEY` or `DASHSCOPE_API_KEY` is configured, IntentPlannerAgent, GameDesignAgent, and CodeGenAgent first call the OpenAI-compatible provider for strict JSON outputs. CodeGenAgent validates that the model returned `indexHtml`, `gameJs`, and `styleCss` strings with a playable browser-game shape before SafetyReviewAgent scans the files; invalid or unavailable model responses fall back to the deterministic local generator.

`model-provider.ts` supports OpenAI-compatible chat completions via `OPENAI_API_KEY` or `DASHSCOPE_API_KEY`, plus `OPENAI_BASE_URL` and `OPENAI_MODEL`. The default documented provider is the internal DashScope-compatible endpoint with `qwen3.7-plus` and `enable_thinking`. Production should add stricter schema validation, retry policies, cost accounting, prompt injection defenses, and a sandbox build harness before letting model-generated code ship.

## Future Frameworks

The state-machine steps map cleanly to LangGraph, OpenClaw, Hermes, or Pi Agent nodes. The current implementation keeps the MVP small and auditable.
