# 把 Stitch 从一次性导出变成可重放的卡牌管线

> TL;DR: 今天项目里有 357 张用 Stitch 生成的卡牌 PNG，但把它们拼起来的是一堆已经被我加进 `.gitignore` 的临时脚本——也就是说这批资源事实上"只能生成一次"。我打算把卡牌图案的开发流程改造成一条可重放的管线：server `cards.ts` 继续做 ID/名字的权威源，新增一个**设计意图 manifest**（`design/cards-stitch.ts`）保存每张卡的提示词与 Stitch screen id，配套三条命令 `card:design / card:fetch / card:verify` 串起生成、导出、校验。最需要盯的：Stitch MCP 本身**不提供 PNG 导出 API**，这条管线里"从 Stitch 到磁盘"那一步只能靠 Playwright 脚本化下载，这是整条链路最脆的一环。

## The situation

我今天刚帮你把根目录几十个 `player*-fullgame.mjs`、`export-stitch-designs.mjs`、`monitor-export-progress.mjs`、`verify-all-exports.mjs`、`stitch-export-config*.json`、一堆 `STITCH-EXPORT-*.md` 文档全部 gitignore 掉。这些是当时批量生成 357 张卡牌图案的"脚手架"——用完就扔，再也没人动过。然后我们一个小时前刚修过一个很能说明问题的 bug：客户端 mock 数据里写的是 `M01` / `C01`（2 位），图片实际命名是 `M001.png` / `C001.png`（3 位），`getMeansCardImage('M01')` 就全 404 了。

整个卡牌资源的状态是这样的：

- **权威清单**住在 `server/src/data/cards.ts`：`meansNames` 90 个中文词生成 `M001–M090`，`clueNames` 220 个生成 `C001–C220`，`ALL_EFFECT_CARDS` 10 个硬编码 `E01–E10`，`ALL_SCENE_BOARDS` 31 个硬编码 `B-CAUSE / B-LOC-A / B-SCN-01...`。
- **图片资源**住在 `client/public/assets/cards/{means,clues,effects,boards}/`，357 个 PNG。
- **两边怎么对上**靠 `client/src/types/stitch-cards.ts`：手段卡/线索卡/效果卡靠 ID 直接做文件名（`M001` → `M001.png`），场景板因为 ID 是 `B-XXX` 格式、文件是描述性命名（`board-cause-death.png`），所以多了一张 `BOARD_FILE_MAP` 手写映射表。
- **生成图片的过程**没有留下可跑的脚本——之前的方式是"打开 Stitch 网站，一张一张设计，截图，改名，丢进 assets 目录"，以及一批 Playwright 脚本把这个半自动化了一阵子，但现在那些脚本已经被我排除出仓库。

所以如果你现在让我"加一张新手段卡 M091 = 榴莲"，我要做的是：在 `cards.ts` 加一个中文词（这步很顺），然后……对着空气挥手，因为**没有可复现的流程把这张图生出来、命名对、放对位置**。今天的 2/3 位 ID bug 本质是同类问题的症状：缺乏校验就会漂移。

一个额外的观察：Stitch MCP 能做的事我查过了——`generate_screen_from_text`、`generate_variants`、`edit_screens`、`get_screen`、`list_screens`——但**没有一个导出 PNG 的工具**。Stitch 的 PNG 下载能力只在它的网站 UI 上。这是整个设计里绕不开的制约。

## What I considered

我在脑子里走了三条路。

**A. 什么都不做，继续手工**。现有图片已经齐，短期能跑。问题是：下次加卡、改风格、或者你觉得某张图不满意想重画，我们又会开始造一次性脚本，两三个月后仓库里又会堆满 `regenerate-clue-*.mjs`。这不是一个工作流，是一个坏习惯的循环。

**B. 走完全自动化**。写脚本枚举 `meansNames`，对每一个名字拼提示词调 Stitch MCP 批量出图，Playwright 批量下载，全部一条命令跑完。我差点选这条——直到我想清楚 Stitch 的生成质量实际上很不稳，同一个提示词能给出一张很棒和一张不能看的两张图。批量自动化意味着**不可挑选**，最后要么接受大量糟糕的图，要么人工去挑，挑的时候缺一个"哪些已经看过、哪些已经通过"的记录。这条路其实是在把"质量门"从流程里删掉。

**C. 介于 A 和 B 之间：manifest 驱动 + 单卡半自动**。每张卡都有"设计意图"（提示词、主题色、当前用的 Stitch screen id、状态 draft/approved），图片的生成是一张一张点的命令，但命名、归档、校验是脚本做的。我选这条。

决定树大致是这样的：想不想要可重放？（要。）想不想要一键批量？（不想，质量不稳。）那就是 manifest + 每次一张的 CLI——也就是 C。

## What I'm doing

把卡牌资源管线拆成三个稳定的部分：**两个 manifest、三条命令、一个校验关卡**。

![pipeline](./diagrams/stitch-card-workflow/pipeline.svg)

```d2
# diagrams/stitch-card-workflow/pipeline.d2
vars: { d2-config: { layout-engine: elk } }

source: 权威清单 {
  server_manifest: server/src/data/cards.ts { shape: document }
  design_manifest: design/cards-stitch.ts { shape: document }
}

tools: 工具 {
  cli: pnpm card:* 命令
  stitch: Stitch (MCP + 网站)
  exporter: Playwright 导出器
}

sink: 消费端 {
  assets: client/public/assets/cards/ { shape: cylinder }
  client: 客户端（app + Histoire）
}

source.server_manifest -> tools.cli: 读 id/name
source.design_manifest -> tools.cli: 读 prompt / screen id
tools.cli -> tools.stitch: 生成或取 screen
tools.cli -> tools.exporter: 触发 PNG 下载
tools.exporter -> sink.assets: 写入 <ID>.png
sink.assets -> sink.client: 按 BASE_URL 加载

source.server_manifest -> sink.client: 定义 ID / 名字（构建时）
```

两个 manifest 的分工：

- `server/src/data/cards.ts` 保留现状，**继续管 ID 和名字**。这是游戏逻辑需要的信息，客户端/测试/引擎都靠它。
- 新建 `design/cards-stitch.ts` 专门管**图案相关的元信息**——每张卡一条记录：`id`, `stitchScreenId?`, `prompt`, `themeColor`, `status: 'stub' | 'draft' | 'approved'`, `notes?`。这是跟"图长什么样"相关的知识的家。之前这些信息散在那份 `stitch-export-config.json`（只到类型级，没到单卡级）、一堆 `.md` 指南、和"只在我脑子里"。

三条命令（跑在仓库根 `pnpm card:*`）：

1. `card:design <ID>` — 从两个 manifest 取到 name + prompt，调 `mcp__stitch__generate_screen_from_text`（新卡）或 `edit_screens`（已有卡），把生成的 screen id 写回 `cards-stitch.ts`，打印预览 URL 让我去 Stitch 网站上挑变体。
2. `card:fetch <ID>` — 假设 screen 已经 approved，调 Playwright 导出器打开 Stitch 网站，登录，定位到 screen，下载 PNG，按 `<ID>.png` 命名写到 `client/public/assets/cards/<type>/`。
3. `card:verify` — 扫 server manifest 和 assets 目录，列出：server 有但 PNG 缺失、PNG 有但 server 没定义（孤儿）、`BOARD_FILE_MAP` 覆盖不到的 board ID。退出码非零则 CI 失败。

校验关卡放在 CI 的构建前一步，保证"加了卡没画图"或"ID 格式不对齐"这类问题在 PR 里就被抓到——就是今天那个 2/3 位 bug 本应被拦下的位置。

## How it works

两个典型场景——新增和更新——走不同的路径。

**新增一张卡**（比如 M091 = 榴莲）：

![flow-add](./diagrams/stitch-card-workflow/flow-add.svg)

```d2
# diagrams/stitch-card-workflow/flow-add.d2
shape: sequence_diagram

dev: 我
server: server/cards.ts
design: cards-stitch.ts
cli: pnpm card:*
stitch: Stitch
assets: public/assets/

dev -> server: 在 meansNames 末尾加 "榴莲"
dev -> design: 给 M091 写 prompt + theme
dev -> cli: card:design M091
cli -> stitch: generate_screen_from_text(prompt)
stitch -> cli: screen id
cli -> dev: 预览 URL
dev -> stitch: 在网站上选/微调变体
dev -> design: 把选中的 screen id 写回 + status=approved
dev -> cli: card:fetch M091
cli -> stitch: get_screen(id)
cli -> assets: 下载并写 means/M091.png
dev -> cli: card:verify
cli -> dev: ✅ 一致
```

**更新一张卡的图案**（已经 approved 过，但我不满意）：

![flow-update](./diagrams/stitch-card-workflow/flow-update.svg)

```d2
# diagrams/stitch-card-workflow/flow-update.d2
shape: sequence_diagram

dev: 我
design: cards-stitch.ts
cli: pnpm card:*
stitch: Stitch
assets: public/assets/

dev -> design: 改 M005.prompt (风格调整)
dev -> cli: card:design M005 --regenerate
cli -> stitch: edit_screens(existing screen)
stitch -> cli: updated screen
dev -> stitch: 审阅
dev -> design: status=approved (或 draft 继续迭代)
dev -> cli: card:fetch M005
cli -> assets: 覆盖 means/M005.png
```

更新和新增的区别只在第一步：新增是 `generate_screen_from_text` 开新 screen，更新是 `edit_screens` 复用老 screen（这样 Stitch 项目不会越堆越多）。

状态机很简单：`stub`（manifest 有记录但还没画）→ `draft`（已经开了 screen，在迭代）→ `approved`（已选定）。PNG 只在 `approved` 时才会被 `card:fetch` 覆写。

## What worries me

**Stitch MCP 没有 PNG 导出 API**。这是最脆的一环。`card:fetch` 里那个"Playwright 导出器"要登录 Stitch、点 UI、下载文件——Stitch 任何一次前端改版都会让脚本挂掉。我们之前仓库里那一堆被删掉的 `export-stitch-designs.mjs` 就是这个事实的化石。可能需要接受：这一步**偶尔会坏**，修它的代价是工作流的一部分，不能假装它是稳定的。

**双 manifest 漂移**。server 里加了 `M091` 但 `design/cards-stitch.ts` 忘了加条目——`card:verify` 能抓到（缺 PNG 或缺 design entry），但如果两边都加了、只是名字不一致（server 叫"榴莲"，design prompt 里写了"芒果"），verify 抓不到。可以再加一条"name 一致性"检查，但这又是一块要维护的规则。

**生成质量的评审是线性瓶颈**。357 张卡里如果我想整体风格刷新一次，一张一张跑是 357 次命令 + 357 次挑选。这时 B 方案（完全自动化）反而更合理——可能需要给 `card:design` 加一个 `--batch` 入口，但那就回到了我一开始拒绝的方向。先不做，等真的要大面积刷新时再说。

**`BOARD_FILE_MAP` 这个手写映射表没解决**。场景板的 ID 和文件名不同构，仍然要靠它翻译。我不打算在这个管线里碰它——改场景板文件命名是独立的重构，可以放到以后。当前 verify 只检查它覆盖了所有 board ID 即可。

## Where you can push back

**你可能觉得不需要两个 manifest，在 `server/cards.ts` 上直接加几列 `prompt`/`stitchScreenId` 就行**。我选择拆开是因为 server 包本来没有"设计"这个职责，混进去会让 server 端多出一堆和游戏逻辑无关的字段（还会污染 tsc 输出体积和 tree-shake）。但如果你觉得"一份真相总比两份强"比打包清洁更重要，合进去也不是不行——只是 `design/cards-stitch.ts` 就变成 `server/src/data/cards.ts` 里的额外字段。

**你可能觉得根本不该用 Playwright 从 Stitch 下载 PNG**——手工下载更老实，脚本化是自找麻烦。我同意这是真实的权衡。如果你选手工，就把 `card:fetch` 改成"打开网址、提示把 PNG 拖到 `client/public/assets/cards/<type>/<ID>.png`，按回车继续"的半自动交互。丢掉了自动化，但去掉了最脆的那环。

## If you say "go"

会落地的东西：

- `design/cards-stitch.ts` — 新增的设计意图 manifest，先用现有的 357 张 PNG 逆向填充成 `status: 'approved'` 的记录（screen id 暂空，后续修过才补回去）
- `scripts/card-design.ts` — 实现 `card:design`
- `scripts/card-fetch.ts` — 实现 `card:fetch`（先做手工交互版，Playwright 导出器放第二步）
- `scripts/card-verify.ts` — 实现 `card:verify`
- `package.json` — 在根 workspace 加 `card:*` 脚本
- `.github/workflows/` — 在 histoire.yml 之外加一个 `card-verify.yml`，PR 时跑 `card:verify`
- 不改 `server/src/data/cards.ts`，不改客户端的 `BOARD_FILE_MAP`，不动任何现有 PNG

测试计划：

- `card:verify` 在当前分支运行必须通过（357 张 PNG 已和 server manifest 对齐）
- 人工跑一次"加一张假卡 M999 → 看见 verify 失败 → 删除 → verify 恢复通过"的往返
- `card:design <既有 ID>`：能拿到预览 URL，`cards-stitch.ts` 被正确更新

---

Post 在 `.claude/blog/20260423-stitch-card-workflow.md`。说 "go" 开始实现，告诉我改哪里，或者 "sit on it" 先放着。
