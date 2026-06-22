# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

「犯罪现场」推理桌游的 PWA。pnpm monorepo：`server`（Express + Socket.IO）与 `client`（Vue 3 + Vite + Tailwind v4），界面为中文。

## 命令

用 `pnpm --filter server|client <script>` 跑各包脚本。

- `pnpm dev` — 并行启动两端（也可 `pnpm dev:server` / `pnpm dev:client` 单独起）
- 改动后默认跑这三项验证：
  - `pnpm --filter client build`（= `vue-tsc -b && vite build`，构建即做类型检查）
  - `pnpm --filter client test`（Vitest + jsdom）
  - `pnpm --filter server exec vitest run`（**server 没有 test 脚本，必须用 `exec`**）
- `pnpm story:dev` — Histoire 设计系统
- 视觉回归（可选，需本机 Docker）：`pnpm --filter client vrt`；首次需先 `pnpm --filter client vrt:update` 建立基线
- `pnpm lint`（ESLint）/ `pnpm format`（Prettier）—— 配置在根目录，覆盖 client+server，详见下方「坑」

## 端口

- client `:8030` — **开发时访问这个**
- server `:8040`
- Histoire `:8031`
- Vite 把 `/api`、`/socket.io` 代理到 `:8040`，前端无需手配跨域

## 环境变量（server）

`PORT` / `JWT_SECRET` / `GAME_PASSWORD`，代码内均有 fallback 默认值（不配也能跑，但用的是不安全的默认值）。`server/.env` 被 gitignore 且**没有 `.env.example`** —— 新克隆需手动创建以覆盖默认值。

## 坑

- **无 `@/` 路径别名** —— 用相对路径导入。
- **Lint / format / 构建 / 双端测试当前全绿**，改动后请保持。ESLint（flat config `eslint.config.mjs`，复用 `.gitignore` 并额外忽略 `e2e/`、`dist`；`_` 前缀变量豁免、测试文件豁免 `no-explicit-any`）、Prettier（`.prettierrc.json`：`semi:false` / `singleQuote` / `printWidth:100`）。
- 双端 TypeScript 均为 `strict`；client 经 `@vue/tsconfig` 还启用了 `noUncheckedIndexedAccess`，数组索引访问（`arr[0].x`）需判空或 `!`。
- 客户端测试经 `client/vitest.setup.ts` 注入内存版 localStorage（jsdom 28 在 vitest 4 下自带的 `localStorage` 方法缺失），新增测试无需自行 mock。
- **卡牌 ID 格式**（权威数据在 `server/src/data/cards.ts`）：手段 `M001`–`M090`、线索 `C001`–`C220`（均 3 位），效果 `E01`–`E10`（2 位），场景板 `B-<类型>-<名>`（如 `B-CAUSE`、`B-LOC-A`）。曾因用 2 位 ID 导致卡牌 PNG 404（commit `4e60a4a`）。PNG 资源在 `assets/cards/` 与 `client/public/assets/cards/`（按 means/clues/effects/boards 分目录，目前多为空，待 Stitch 生成）。
- Stitch / Playwright / Tavily 等 MCP 工具只能在 Claude 会话内调用；卡牌生成工作流见 `.claude/blog/20260423-stitch-card-workflow.md`。
