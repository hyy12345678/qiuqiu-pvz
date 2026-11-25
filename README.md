# 球球的植物大战僵尸 · 网页同人复刻版

一个纯前端的植物大战僵尸同人小游戏。**交付物就一个文件** —— `dist/植物大战僵尸-网页版.html`，
完全离线自包含：没有外部资源、没有网络请求、没有运行时依赖，双击即玩。

## 怎么玩

双击 `dist/植物大战僵尸-网页版.html`（拷到U盘、发给自己都行）。

- 逻辑分辨率 1024×640，按窗口与 DPR 自适应（DPR 上限 2）。运行期换屏（把窗口拖到另一块像素密度不同的屏幕）会每帧比对 `devicePixelRatio` 并自动重建背板与背景缓存——`resize` 事件在这种场景下不会触发。
- 鼠标与触屏皆可；数字键 1–8 选卡，`P` 暂停，`Esc` 取消选择，`M` 切音乐。
- 进度与「解锁全关」开关存在浏览器 `localStorage`，无服务端、无在线存档。
- 玩法细节（蘑菇打盹与咖啡豆、报纸僵尸护盾与暴怒、夜关没有天降太阳、小推车）见游戏内「操作说明」。
- 第 13 种植物「迪迦奥特曼」（275 阳光）只登场 25 秒，蓄力后发射贯穿整行的哉佩利敖光线。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | esbuild watch + 本地服务（默认 `http://localhost:8787/`）。**会把 `/* dev build */` 写进 `dist/` 同名文件**，验收或提交前必须重新 `npm run build`。 |
| `npm run build` | 标准发布构建 → `dist/植物大战僵尸-网页版.html`（pretty，约 188 KiB / 192 KB）。 |
| `npm run build:min` | 等价验证构建 → `dist/植物大战僵尸-网页版.min.html`（约 103 KB）。只用于验证，`.gitignore` 已排除，不提交。 |
| `npm run verify` | 全链护栏，依次跑 `parity` → `fingerprint` → `test` → `test:inventory` → `parity:dist` → `build` → `test:smoke` → `test:browser`。注意 `parity:dist` 在 `build` **之前**：它检查的是仓库里已提交的那份 dist，不是刚构建出来的自己。 |
| `npm test` | `node --test tests/*.test.mjs`：规则单测 + A–I 场景迁移测试 + 2 条背景绘制轨迹（白天/夜间两张整幅战斗背景的唯一防护）+ `scripts/inline.js` 的转义测试。 |
| `npm run test:smoke` | `headless_test.js` 的 A–I 源码冒烟（打包后在 vm 里跑），保留为第二条独立验证路径。 |
| `npm run test:browser` | Playwright 打开真实 `dist` 产物：桌面 / 触屏 / DPR（分数启动 + 运行期换屏）三条冒烟 + 3 条受控绘制轨迹基线。`verify` 只用其中的轨迹基线（`test:browser:baselines`）。 |
| `npm run parity` / `parity:dist` | 源码规范化行快照 / 产物内联脚本与源码 bundle 逐字节比对。 |
| `npm run parity:legacy` | **考古工具，不是绿灯护栏**：与重构前基线的行级溯源对照，按设计非绿、不在 `verify` 链里。见文末「考古附录」。 |
| `npm run fingerprint` | 两份 SHA-256 清单：`src/**`（源码）与 `scripts/**`（护栏工具，排除 `*.txt` 基线）。任何未登记的变化都会变红——**包括改护栏工具本身**。 |
| `npm run test:inventory` | 测试清单下限：每个测试文件里 `test(` 声明的条数只允许增、不允许减，防「删测试换绿」。同时记录**单测套件实际吃到的文件集合**与**浏览器轨迹基线集合**，任何测试文件整个脱离执行链（用例数不变但不再被跑）同样会红。下限写在 `scripts/test-inventory.json`，因此它自己被护栏工具指纹保护。 |
| `npm run parity:rebase:dry` / `fingerprint:update:dry` | **先看**：只打印「这次会吸收哪些差异」，不写任何文件，退出码 1。 |
| `npm run parity:rebase` / `fingerprint:update` / `test:browser:update` | 重新盖章工具。**会先跑 `npm test`，全绿才写基线**（E1 D4）；绘制轨迹基线尤其需要单独批准。 |
| `npm run dist:fresh` | `git diff --exit-code -- dist/`：产物是否已随源码一并提交。**只进 CI**，不进 `verify`——提交前跑它必然红。 |

改 Canvas 绘制时 `tests/helpers/scenario.mjs` 的 ctx 白名单会对外抛错，这是有意的：
新增绘制 API 必须显式登记，避免测试默默吞掉画面。

### 考古附录：重构前的基线与 `parity:legacy`

> 这一节描述的工具**不属于日常开发流程**。把它们放在附录而不是命令表，
> 是因为一个按设计就是红色的"护栏"如果被当成护栏，只会训练人对红灯麻木。

工作区不再保存重构前的单文件版本。`npm run parity:legacy` 和 `node headless_test.js`（不带参数）
需要它时，由 `scripts/legacy-source.js` 执行
`git show pre-refactor-baseline:植物大战僵尸-网页版.html` 现取到系统临时目录并缓存。
因此这两个入口要求带该 tag 的完整检出（浅克隆会明确报错），而**不是**绿灯护栏：
`parity:legacy` 的授权清单停在 P3c，R1 之后的结构迁移差异都会在这里显形，`verify` 链不包含它。

**它现在还值什么**：它是 R0–R6 十轮重构的最终取证能力——如果将来要回答"这次重构到底有没有改变行为"，
它是唯一能回到起点逐行对照的入口。日常零成本（不在 `verify` 里、不参与任何绿灯判断），
只在需要考古时花几秒钟。去留结论与理由见 [docs/护栏评估-E8](docs/护栏评估-E8-parity与legacy去留.md)。

## 两种交付形态

| 形态 | 文件 | 用途 | 是否提交 |
|---|---|---|---|
| pretty | `dist/植物大战僵尸-网页版.html` | **标准发布产物**，可读、可 diff，构建戳 `/* build: v<版本> pretty · src <8位摘要> */` | 是 |
| minified | `dist/植物大战僵尸-网页版.min.html` | 同一入口、同一 target，只多开 `minify`；用于证明压缩形态与 pretty 等价 | 否 |

min 的等价验证方式：`npm run parity:dist:min` 证明它对应同一份源码构建；
`PVZ_DIST=dist/植物大战僵尸-网页版.min.html npm run test:browser` 用同一套冒烟与 3 条绘制轨迹跑它。
浏览器套件还会断言产物首部是发布戳，dev 产物冒充发布页会直接判红。

## 构建戳与「产物是否最新」

构建戳形如 `/* build: v0.1.0 pretty · src a597fbd8 */`。后半段是 `src/**` 清单的摘要（与 `npm run fingerprint` 同一套哈希），
回答的是「这份产物是不是当前源码构建的」——**不用 git SHA**，因为 dist 先构建、后提交，提交后 SHA 会指向父提交。

两道门各管一段，别混用：

| 门 | 位置 | 回答 |
|---|---|---|
| `npm run parity:dist` | `verify` 链 **build 之前** | 仓库里**已提交的** dist 是不是当前源码构建的 |
| `npm run dist:fresh` | 只在 CI | 重新构建之后，dist 有没有「改了但忘了提交」 |

## CI

`.github/workflows/verify.yml` 在 push / PR 上跑：Node 22、按 lock 安装依赖与 Chromium，
然后**直接执行 `npm run verify`**，最后补一步 `dist:fresh`。

**已在 GitHub 上实测通过**。最近两次：E25（run [45556635542](https://github.com/hyy12345678/qiuqiu-pvz/actions/runs/45556635542)，轨迹收敛为 3 条后的首次跨平台复跑）与 E26（run [45557639183](https://github.com/hyy12345678/qiuqiu-pvz/actions/runs/45557639183)），均在 ubuntu-latest 上逐行一致，耗时约 54 秒。

「全新检出」也在 E25 验收里实测过：干净 clone + `npm ci` + `npm run verify` 一条命令跑通，不依赖开发机上已有的 `node_modules`。

这里坚持「一条命令」而不是手抄一份步骤序列，原因是漂移已经真的发生过一次：
E9 往 `verify` 里加了 `test:inventory`，而 CI 里手写的步骤列表不会自动跟着变，
于是 CI 漏掉了那条检查。手写一份永不漂移的副本是不存在的，所以让 CI 复用同一条命令。

## 环境与版本

`package.json` 声明 `engines.node: ">=20"`。历史上（2026-10-29）实测过的版本是
macOS arm64 上的 **Node 20.19.4 / 22.16.0 / 22.23.2**，各自跑通 `npm test`、`npm run test:smoke`、
`npm run build` + `npm run parity:dist`；其余 20.x/22.x 小版本未逐一验证，不作背书。

E1、E3–E12 这一系列工程轮次（共 11 轮）**只在 Node v22.23.2（macOS arm64）上实测过**，
未重复覆盖 20.19.4 与 22.16.0。

`src/**` 是 ESM（由 `src/package.json` 的 `"type": "module"` 声明），根包与 `scripts/*.js` 仍是 CommonJS，
两种制式在 esbuild 打包点汇合，因此不给根包整体加 `type: module`。

## 目录与文档

| 路径 | 内容 |
|---|---|
| `src/` | 源码：`core/`（世界、战斗、动作、数据）、`render/`（绘制与场景）、`ui/`（界面状态与设备输入）、`audio/`、`platform/`、`shell.html`、`main.js`（只做装配） |
| `dist/` | 发布产物（见上表） |
| `tests/` | 规则单测、`scenario-*.test.mjs` 场景测试、`inline.test.mjs`（产物内联转义）、`baselines/`（背景绘制轨迹）、`browser/`（真实产物冒烟与 3 条绘制轨迹基线）、`helpers/`、`fixtures/` |
| `scripts/` | 构建与护栏工具（CommonJS）：`build.js`/`dev.js`/`inline.js`/`esbuild-opts.js` 构建侧；`check-parity.js`/`check-fingerprint.js`/`check-test-inventory.js` 护栏侧；`legacy-source.js` 从 tag 现取历史基线。三份基线：`parity-baseline.txt`/`source-fingerprint.txt`/`tool-fingerprint.txt`，外加 `test-inventory.json` |
| `headless_test.js` | 历史 A–I 冒烟驱动，仍留在 `verify` 链里（目标固定 `src/main.js`） |
| `docs/项目分析-2026-11-20.md` | 接手时的项目分析：架构、领域模型、代码质量、护栏体系评估、风险与建议；§11 起是 E1–E12 的逐轮实施进展 |
| `docs/工程执行计划-E*.md` | 逐轮执行计划与验收记录：E1–E12（护栏收口、三层拆分、背景轨迹、测试清单下限、CI、inline 测试）、E13（CI 实跑）、E14–E19（画面精细度与性能）、E20–E24（玩法平衡与铁门僵尸）、E25（缺陷修复与测试基础设施护栏）、E26（运行期 DPR 重建） |
| `docs/护栏评估-E8-parity与legacy去留.md` | `parity` / `parity:legacy` 去留的结论与理由（结论：保留，但重新定位） |
| `docs/工程执行计划-E13-CI实跑验证.md` | CI 首次在 GitHub 上真跑的证据，含 Actions 升 v7 的前后对比 |
| `docs/工程执行计划-E25-缺陷修复与护栏补强.md` | 评审发现四处缺陷的修复记录，以及「测试清单对『没跑』和『一致』同样沉默」的结构性缺口与补法 |
| `docs/工程执行计划-E26-运行期DPR重建.md` | 换屏不发 resize 事件导致的发模糊问题、为什么选每帧比对而不是 matchMedia、以及 canvas.width 会重置 ctx 状态的隐患 |
| `docs/决策记录-画风取舍.md` | 为什么不做《旷野之息》风格：做过两个实验、失败在尺寸、以及贴图管线这条唯一可行的替代路 |
| `docs/重构方案-v0.2.md` | 重构总方案与分轮定义（R0–R5） |
| `docs/重构执行计划-R*.md` | 每轮的执行计划与验收记录（R0 … R5b） |
| `docs/功能执行计划-F1-迪迦奥特曼.md` | R6 之后的功能轮（新增植物角色），格式与重构轮一致 |
| `docs/测试基线.md` | 各轮验收证据汇总，含需由本人执行的人工验收清单（真机触屏、字体、音效、手感） |
