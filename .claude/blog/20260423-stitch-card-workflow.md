# 把 Stitch 从一次性导出变成可重放的卡牌管线

> TL;DR: 项目里 357 张卡牌 PNG 是一批已经被我加进 `.gitignore` 的临时脚本生出来的——事实上"只能生成一次"。我打算把卡牌图案开发改造成一条可重放的管线：server `cards.ts` 继续做 ID/名字的权威源，新增一个**设计意图 manifest**（`design/cards-stitch.ts`）保存每张卡的 prompt 与 Stitch screen name；两个 **Claude skill**（`/card-design`、`/card-fetch`）走 MCP 负责生成和导出，一个 **npm script**（`pnpm card:verify`）在 CI 里守一致性。整条链路 **纯 MCP + curl**，但有个现实约束：**MCP 工具只能在 Claude 会话里调用**——所以"管线主干"的执行者是 Claude 自己，不是裸 Node 进程。

## The situation

我今天刚帮你把根目录几十个 `player*-fullgame.mjs`、`export-stitch-designs.mjs`、`monitor-export-progress.mjs`、`verify-all-exports.mjs`、`stitch-export-config*.json`、一堆 `STITCH-EXPORT-*.md` 文档全部 gitignore 掉。这些是当时批量生成 357 张卡牌图案的"脚手架"——用完就扔，再也没人动过。然后我们一个小时前刚修过一个很能说明问题的 bug：客户端 mock 数据里写的是 `M01` / `C01`（2 位），图片实际命名是 `M001.png` / `C001.png`（3 位），`getMeansCardImage('M01')` 就全 404 了。

整个卡牌资源的状态是这样的：

- **权威清单**住在 `server/src/data/cards.ts`：`meansNames` 90 个中文词生成 `M001–M090`，`clueNames` 220 个生成 `C001–C220`，`ALL_EFFECT_CARDS` 10 个硬编码 `E01–E10`，`ALL_SCENE_BOARDS` 31 个硬编码 `B-CAUSE / B-LOC-A / B-SCN-01...`。
- **图片资源**住在 `client/public/assets/cards/{means,clues,effects,boards}/`，357 个 PNG。
- **两边怎么对上**靠 `client/src/types/stitch-cards.ts`：手段/线索/效果卡靠 ID 直接做文件名（`M001` → `M001.png`），场景板因为 ID 是 `B-XXX` 格式、文件是描述性命名（`board-cause-death.png`），所以多了一张 `BOARD_FILE_MAP` 手写映射表。
- **生成图片的过程**没有留下可跑的脚本——之前是"打开 Stitch 网站，一张一张设计，截图，改名，丢进 assets 目录"，以及一批 Playwright 脚本把这个半自动化了一阵子，但那些脚本已经被排除出仓库。我去 Stitch 上查过当时的项目结构：用的居然是"**每张卡 = 一个 Stitch project**"（`screenInstances: null`），反常——Stitch 正常的组织方式是一个 project 装很多 screens。大概是因为没摸清 screen 级别能怎么被程序拿到，索性一张卡就建一个 project，靠 `thumbnailScreenshot.downloadUrl` 下载。

有一件事我最开始是搞错了的。我以为 Stitch MCP **没有 PNG 导出能力**——因为工具列表里没有 `export_png` 这种名字。**实际调一次 `get_screen` 才发现根本不是这样**：

```json
{
  "name": "projects/.../screens/...",
  "screenshot": {
    "downloadUrl": "https://lh3.googleusercontent.com/aida/...",
    "name": "projects/.../files/..."
  },
  "htmlCode": {
    "downloadUrl": "https://contribution.usercontent.google.com/download?...",
    "mimeType": "text/html"
  }
}
```

每个 screen 都带 **Google CDN 上的 PNG 直链**，外加 HTML 源码直链。`curl -o <ID>.png "$downloadUrl"` 就能下。`get_project` 里也有同形状的 `thumbnailScreenshot.downloadUrl`。下文的方案是围绕这个事实建的。

另一件容易被我写错的事我也提一下，免得自己再绕弯：**`pnpm ...` 脚本调不了 MCP**。MCP 工具是 Claude Code / Claude Desktop 这类 MCP client 和 MCP server 之间的协议，普通 Node 进程没有这个 client，自然也拿不到 `mcp__stitch__*`。要调 MCP，要么绕回 Stitch 网站去爬（就是之前被删掉的 Playwright 方案），要么**让 Claude 来做调用者**——也就是把工作流主干装进 Claude skill 里。

## What I considered

走过四条思路。

**A. 什么都不做，继续手工**。现有图片已经齐，短期能跑。问题是：下次加卡、改风格、或者你觉得某张图不满意想重画，我们又会开始造一次性脚本。这不是工作流，是坏习惯的循环。

**B. 走完全自动化**。写脚本枚举 `meansNames`，批量出图批量下载，全部一条命令跑完。我差点选这条——直到我想清楚 Stitch 的生成质量实际上很不稳，同一个提示词能给出一张很棒和一张不能看的两张图。批量自动化意味着**不可挑选**。而且 `generate_screen_from_text` 文档里明写"本调用可能需要几分钟"——357 张卡一张一张走就是几小时级别的挂机任务，挂完还要人工过一遍。

**C. manifest 驱动 + 单卡半自动**。每张卡都有"设计意图"（prompt、主题色、对应的 Stitch screen name、状态 draft/approved），图片的生成是一张一张点的命令，命名、归档、校验是自动的。

**D. 把执行者的问题想清楚**。C 的方向没问题，但我一开始打算把所有命令都做成 `pnpm card:*` 的 npm script——这里撞上了"Node 进程调不到 MCP"这堵墙。纠正下来得到的最终方案：**MCP 相关步骤交给 Claude skill**（它有 MCP client）、**纯文件操作交给 npm script**（CI 可以无人值守跑）。

决定树：想不想要可重放？（要。）一键批量？（不想。）管线主干在会话里还是在 npm 里？（必须在会话里，因为 MCP。）那校验呢？（留在 npm 里，CI 才能跑。）

## What I'm doing

把卡牌资源管线拆成三个稳定的部分：**两个 manifest、两个 Claude skill + 一个 npm script、一个校验关卡**。

![pipeline](./diagrams/stitch-card-workflow/pipeline.svg)

```d2
# diagrams/stitch-card-workflow/pipeline.d2
vars: { d2-config: { layout-engine: elk } }

source: 权威清单 {
  server_manifest: server/src/data/cards.ts { shape: document }
  design_manifest: design/cards-stitch.ts { shape: document }
}

runners: 执行者 {
  claude: Claude 会话 (/card-design, /card-fetch)
  verify: pnpm card:verify 脚本
}

external: 外部 {
  stitch: Stitch MCP
}

sink: 消费端 {
  assets: client/public/assets/cards/ { shape: cylinder }
  client: 客户端（app + Histoire）
}

source.server_manifest -> runners.claude: 读 id/name
source.design_manifest -> runners.claude: 读 prompt / screen name
runners.claude -> external.stitch: generate / get_screen
external.stitch -> runners.claude: screen name + downloadUrl
runners.claude -> sink.assets: 写 <ID>.png
runners.claude -> source.design_manifest: 写回 screen name

source.server_manifest -> runners.verify: 读 id 列表
sink.assets -> runners.verify: 扫 PNG 文件

source.server_manifest -> sink.client: 定义 ID / 名字（构建时）
sink.assets -> sink.client: 按 BASE_URL 加载
```

两个 manifest 的分工：

- `server/src/data/cards.ts` 保留现状，**继续管 ID 和名字**。这是游戏逻辑需要的信息，客户端/测试/引擎都靠它。
- 新建 `design/cards-stitch.ts` 专门管**图案相关的元信息**——每张卡一条记录：`id`, `stitchScreenName?`（`projects/X/screens/Y` 的完整资源名）, `prompt`, `themeColor`, `status: 'stub' | 'draft' | 'approved'`, `notes?`。这是"图长什么样"相关知识的家。

Stitch 项目结构我想改成**一类一个 project**（`Means Cards` / `Clue Cards` / `Effect Cards` / `Scene Boards`，4 个 project），每张卡是该 project 里的一个 screen。比之前"一张卡一个 project"省下 117 个 project 的心智负担，而且 `list_screens(projectId)` 能一次列出某一类全部卡的 screen，批量轮询/校验都方便。

三个入口，按执行者分成两类：

**在 Claude 会话里调用（有 MCP）：**

1. `/card-design <ID>` — Claude skill。读两个 manifest 拿到 name + prompt；**按 manifest 里这张卡是否已有 `stitchScreenName` 来判断走向**：没有就调 `mcp__stitch__generate_screen_from_text` 开新 screen、把 `screen.name` 写回 manifest；有就调 `mcp__stitch__edit_screens` 复用老 screen 重生成。两种情况 status 都置 `draft`，最后打印 Stitch 网站上的 screen URL 让我去挑变体。
2. `/card-fetch <ID>` — Claude skill。读 manifest 拿 `stitchScreenName`，调 `mcp__stitch__get_screen` 拿到当前的 `screenshot.downloadUrl`，`curl` 下载、按 `<ID>.png` 写到 `client/public/assets/cards/<type>/`。

**命令行直接跑（纯文件操作，CI 友好）：**

3. `pnpm card:verify` — npm script。扫 server manifest 和 assets 目录，列出：server 有但 PNG 缺失、PNG 有但 server 没定义（孤儿）、`BOARD_FILE_MAP` 覆盖不到的 board ID、design manifest 和 server manifest 名字不一致。退出码非零则 CI 失败。

为什么这样拆？**MCP 工具只能在 MCP client 里调用**。Claude Code 会话里有 MCP client，裸 Node 没有。所以涉及 `mcp__stitch__*` 的步骤必须由 Claude 执行；verify 只做 `fs.readdir` + string compare，不碰 MCP，放在 npm script 里就够了——而且这样 CI 能跑它，design/fetch 则只在开发者本地的 Claude 会话里发生。

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
claude: Claude 会话
stitch: Stitch MCP
assets: public/assets/
verify: pnpm card:verify

dev -> server: 在 meansNames 末尾加 "榴莲"
dev -> design: 给 M091 写 prompt + theme
dev -> claude: /card-design M091
claude -> stitch: generate_screen_from_text(meansProjectId, prompt)
stitch -> claude: screen name (projects/X/screens/Y)
claude -> design: 写回 screenName，status=draft
dev -> stitch: 在 Stitch 网站上审阅
dev -> design: 手动改 status=approved
dev -> claude: /card-fetch M091
claude -> stitch: get_screen(screenName)
stitch -> claude: screenshot.downloadUrl (Google CDN)
claude -> assets: 下载到 means/M091.png
dev -> verify: pnpm card:verify
verify -> dev: ✅ 一致
```

**更新一张卡的图案**（已经 approved 过，但我不满意）：

![flow-update](./diagrams/stitch-card-workflow/flow-update.svg)

```d2
# diagrams/stitch-card-workflow/flow-update.d2
shape: sequence_diagram

dev: 我
design: cards-stitch.ts
claude: Claude 会话
stitch: Stitch MCP
assets: public/assets/

dev -> design: 改 M005.prompt (风格调整)
dev -> claude: /card-design M005
claude -> stitch: edit_screens(existing screenName, prompt)
stitch -> claude: 更新后的 screen
dev -> stitch: 审阅
dev -> design: status=approved
dev -> claude: /card-fetch M005
claude -> stitch: get_screen(screenName)
stitch -> claude: 新的 screenshot.downloadUrl
claude -> assets: 覆盖 means/M005.png
```

更新和新增的区别只在第一步：新增是 `generate_screen_from_text` 开新 screen（存到对应类型的 project 下），更新是 `edit_screens` 复用老 screen——到底走哪条由 skill 读 manifest 里有没有 `stitchScreenName` 自动判断，不需要额外参数。

状态机很简单：`stub`（manifest 有记录但还没画）→ `draft`（已经开了 screen，在迭代）→ `approved`（已选定）。PNG 只在 `approved` 时才会被 `/card-fetch` 覆写。

## What worries me

**管线主干依赖 Claude 会话在场**。`/card-design` 和 `/card-fetch` 只能在开发者本地的 Claude Code 里跑——CI 跑不起来（没有 MCP client，也没有 Stitch 凭据）。所以 CI 能做的只有 `pnpm card:verify`：发现不一致就报错，但不能自愈。正因为如此，verify 必须足够严（见下面一条），否则"漂移"只能在本地被抓，PR 一旦合并就暴露给所有人。

**Stitch 的生成结果不一定是"干净的单张卡片"**。`generate_screen_from_text` 是为 UI 设计优化的——给它"刀"的提示词，它可能吐出一个带标题栏、按钮、卡片图案的"应用界面"，而不是一张裁切好的卡牌。**这比"有没有 PNG 导出"更重要**，因为导出本身是通了的，但导出的**内容**对不对口是另一回事。要靠 prompt 模板约束（"画布居中一张带边框的 {theme} 色系卡片，卡面一个 {name} 图标，无文字无 UI 元素"）——这里注定要花一轮迭代调 prompt。

**`screenshot.downloadUrl` 是短期 CDN 链接，不能缓存**。URL 带了签名参数（`lh3.googleusercontent.com/aida/...`），这类 Google CDN 直链通常签名+过期。design manifest 里只应该存**稳定的 screen name**，每次 fetch 时再调 `get_screen` 现拉 URL。如果把 URL 存进 manifest，几天后就全 404。

**双 manifest 漂移**。server 里加了 `M091` 但 `design/cards-stitch.ts` 忘了加条目——`card:verify` 能抓到（缺 PNG 或缺 design entry），但如果两边都加了、只是名字不一致（server 叫"榴莲"，design prompt 里写了"芒果"），verify 需要额外写一条"name 一致性"检查。

**生成质量的评审是线性瓶颈**。想整体风格刷新一次就是 357 次生成 + 357 次挑选，加上每次 2–5 分钟就是一整天以上。没有 Playwright 之后自动化余地确实比之前大了——但瓶颈从"导出脆弱"换成了"生成慢 + 人工审阅"。先不做"批量刷新"入口，等真的要整体换风格时再说。

**`BOARD_FILE_MAP` 这个手写映射表没解决**。场景板的 ID 和文件名不同构，仍然要靠它翻译。我不打算在这个管线里碰它——改场景板文件命名是独立的重构。当前 verify 只检查它覆盖了所有 board ID 即可。

## Where you can push back

**"管线放 Claude skill 里" vs "管线放 `pnpm` 脚本里、绕开 MCP 走 HTTP"**。我选前者是因为 MCP 已经在手、不用碰认证；后者要逆向 Stitch 网站的 REST API（`stitch.google.com` / `contribution.usercontent.google.com` 这些域）、自己处理 Google OAuth，稳定性全靠 Google 不改接口——这是 Playwright 方案换皮，看似更自动实则更脆。但如果你觉得"CI 也要能跑 design/fetch"比"实现简单"更重要，那值得走 HTTP 那条路。我现在假设 CI 只守一致性就够。

**双 manifest vs 合并进 `server/cards.ts`**。我拆开是因为 server 包本来没有"设计"这个职责，混进去会让 server 端多出一堆和游戏逻辑无关的字段（还会污染 tsc 输出和 tree-shake）。但如果你觉得"一份真相总比两份强"比打包清洁更重要，合进去也行——只是 `design/cards-stitch.ts` 就变成 `server/src/data/cards.ts` 里的额外字段。

**"一类一个 project" vs "一张卡一个 project"**。前者便于 `list_screens` 批量遍历、视觉上浏览一类所有卡，但 Stitch 一个 project 装 90/220 个 screen 可能卡顿。后者是之前的选择，每张卡独立但项目数量爆炸（最终会有 351 个 project）。折中是"每一类再按 ID 区间分 project"（`M001–M030`、`M031–M060`…），先从"一类一个"开始，真的卡了再拆。

## If you say "go"

会落地的东西：

- `.claude/skills/card-design.md` — 新 skill，定义 `/card-design <ID>` 的触发词和行为说明
- `.claude/skills/card-fetch.md` — 新 skill，定义 `/card-fetch <ID>` 的触发词和行为说明
- `design/cards-stitch.ts` — 设计意图 manifest，先用现有的 357 张 PNG 逆向填充成 `status: 'approved'` 的记录（`stitchScreenName` 暂空，因为旧数据是"一张卡一个 project"结构，screen name 得等下一次 regenerate 时才补回去）
- `scripts/card-verify.ts` — 实现 `card:verify`（只读文件系统，不依赖 MCP）
- `package.json` — 根 workspace 加 `"card:verify": "tsx scripts/card-verify.ts"`
- `.github/workflows/card-verify.yml` — PR 时跑 `card:verify`
- 不改 `server/src/data/cards.ts`，不改客户端的 `BOARD_FILE_MAP`，不动任何现有 PNG

测试计划：

- `pnpm card:verify` 在当前分支运行必须通过（357 张 PNG 已和 server manifest 对齐）
- 人工跑一次"加一张假卡 M999 → 看见 verify 失败 → 删除 → verify 恢复通过"的往返
- `/card-design <既有 ID>` 在会话里：能拿到 Stitch screen URL，`design/cards-stitch.ts` 被正确更新；`/card-fetch <同一个 ID>`：能下载 PNG 覆盖到正确位置
- 先选一张成本低的卡（比如新造的 M999）走完新增全流程，确认链路通；之后再考虑逆向填 `design/cards-stitch.ts`

---

Post 在 `.claude/blog/20260423-stitch-card-workflow.md`。说 "go" 开始实现，告诉我改哪里，或者 "sit on it" 先放着。
