# 球球的植物大战僵尸 · 网页同人复刻版

一个纯前端的植物大战僵尸同人小游戏。**交付物就一个文件** —— `dist/植物大战僵尸-网页版.html`，
完全离线自包含：没有外部资源、没有网络请求、没有运行时依赖，双击即玩。

## 怎么玩

双击 `dist/植物大战僵尸-网页版.html`（拷到U盘、发给自己都行）。

- 逻辑分辨率 1024×640，按窗口与 DPR 自适应（DPR 上限 2）。
- 鼠标与触屏皆可；数字键 1–8 选卡，`P` 暂停，`Esc` 取消选择，`M` 切音乐。
- 进度与「解锁全关」开关存在浏览器 `localStorage`，无服务端、无在线存档。
- 玩法细节（蘑菇打盹与咖啡豆、报纸僵尸护盾与暴怒、夜关没有天降太阳、小推车）见游戏内「操作说明」。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | esbuild watch + 本地服务（默认 `http://localhost:8787/`）。**会把 `/* dev build */` 写进 `dist/` 同名文件**，验收或提交前必须重新 `npm run build`。 |
| `npm run build` | 标准发布构建 → `dist/植物大战僵尸-网页版.html`（pretty，约 162 KB）。 |
| `npm run build:min` | 等价验证构建 → `dist/植物大战僵尸-网页版.min.html`（约 97 KB）。只用于验证，`.gitignore` 已排除，不提交。 |
| `npm run verify` | 全链护栏，依次跑 `parity` → `fingerprint` → `test` → `build` → `parity:dist` → `test:smoke` → `test:browser`。 |
| `npm test` | `node --test tests/*.test.mjs`：规则单测 + A–I 场景迁移测试。 |
| `npm run test:smoke` | `headless_test.js` 的 A–I 源码冒烟（打包后在 vm 里跑），保留为第二条独立验证路径。 |
| `npm run test:browser` | Playwright 打开真实 `dist` 产物：桌面与触屏冒烟 + 5 条受控绘制轨迹基线。 |
| `npm run parity` / `parity:dist` / `parity:legacy` | 源码规范化行快照 / 产物内联脚本与源码 bundle 逐字节比对 / 与重构前基线的行级**溯源对照**（预期非绿，见下）。 |
| `npm run fingerprint` | `src/**` 原始字节 SHA-256 清单，任何未登记的源码变化都会变红。 |
| `npm run parity:rebase` / `fingerprint:update` / `test:browser:update` | 重新盖章工具。**只在对应轮次完成人工审计后使用**；绘制轨迹基线尤其需要单独批准。 |

改 Canvas 绘制时 `tests/helpers/scenario.mjs` 的 ctx 白名单会对外抛错，这是有意的：
新增绘制 API 必须显式登记，避免测试默默吞掉画面。

### 重构前的基线在哪里

工作区不再保存重构前的单文件版本。`npm run parity:legacy` 和 `node headless_test.js`（不带参数）
需要它时，由 `scripts/legacy-source.js` 执行
`git show pre-refactor-baseline:植物大战僵尸-网页版.html` 现取到系统临时目录并缓存。
因此这两个入口要求带该 tag 的完整检出（浅克隆会明确报错），而**不是**绿灯护栏：
`parity:legacy` 的授权清单停在 P3c，R1 之后的结构迁移差异都会在这里显形，`verify` 链不包含它。

## 两种交付形态

| 形态 | 文件 | 用途 | 是否提交 |
|---|---|---|---|
| pretty | `dist/植物大战僵尸-网页版.html` | **标准发布产物**，可读、可 diff，构建戳 `/* build: v<版本> pretty */` | 是 |
| minified | `dist/植物大战僵尸-网页版.min.html` | 同一入口、同一 target，只多开 `minify`；用于证明压缩形态与 pretty 等价 | 否 |

min 的等价验证方式：`npm run parity:dist:min` 证明它对应同一份源码构建；
`PVZ_DIST=dist/植物大战僵尸-网页版.min.html npm run test:browser` 用同一套冒烟与 5 条绘制轨迹跑它。
浏览器套件还会断言产物首部是发布戳，dev 产物冒充发布页会直接判红。

## 环境与版本

`package.json` 声明 `engines.node: ">=20"`。本轮（2026-10-29）实际实测过的版本是
macOS arm64 上的 **Node 20.19.4 / 22.16.0 / 22.23.2**，各自跑通 `npm test`、`npm run test:smoke`、
`npm run build` + `npm run parity:dist`；其余 20.x/22.x 小版本未逐一验证，不作背书。

`src/**` 是 ESM（由 `src/package.json` 的 `"type": "module"` 声明），根包与 `scripts/*.js` 仍是 CommonJS，
两种制式在 esbuild 打包点汇合，因此不给根包整体加 `type: module`。

## 目录与文档

| 路径 | 内容 |
|---|---|
| `src/` | 源码：`core/`（世界、战斗、动作、数据）、`render/`（绘制与场景）、`ui/`（界面状态与设备输入）、`audio/`、`platform/`、`shell.html`、`main.js`（只做装配） |
| `dist/` | 发布产物（见上表） |
| `tests/` | 规则单测、`scenario-*.test.mjs` 场景测试、`browser/` 真实产物冒烟与绘制轨迹基线 |
| `scripts/` | 构建与护栏工具（CommonJS），含 `legacy-source.js`（从 tag 现取历史基线到临时目录） |
| `headless_test.js` | 历史 A–I 冒烟驱动，仍留在 `verify` 链里（目标固定 `src/main.js`） |
| `docs/重构方案-v0.2.md` | 重构总方案与分轮定义（R0–R5） |
| `docs/重构执行计划-R*.md` | 每轮的执行计划与验收记录（R0 … R5b） |
| `docs/测试基线.md` | 各轮验收证据汇总，含需由本人执行的人工验收清单（真机触屏、字体、音效、手感） |
