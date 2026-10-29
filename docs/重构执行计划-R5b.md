# 球球的植物大战僵尸 · R5b 执行计划（两种交付形态、构建戳与 Node 制式收口）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R5 工作项 3、4、6。
> 日期：2026-10-29
> 起点：commit `281ef7a`（记录 R5a 提交号），测试与源码收口于 `ca636c7`。
> 终点：commit `9900c48`（R5b：两种交付形态、构建戳与 Node 制式收口）。
> 范围：构建/发布工具、文档入口与 Node 制式。**不改 `src/**` 的任何 JavaScript**，不改玩法与绘制。
> 上一轮的测试迁移见 [R5a 执行计划](重构执行计划-R5a.md)；根目录旧 HTML、`legacy/` 与历史工具的清理仍排在 R5 之后独立一轮。

## 1. 现状与本轮要收的口子

| 对象 | 现状 | 问题 |
|---|---|---|
| `npm run build` | 产出 `dist/植物大战僵尸-网页版.html`（pretty，162.0 KB），构建戳 `/* build: v0.1.0 pretty */` | 标准产物形态未写进文档，只在脚本注释里。 |
| `npm run build:min` | 同样写进 **同一个文件名**，只是把戳换成 `minified` | 一跑就覆盖标准发布产物；`parity:dist` 随后必红（它按非 minify 打包比对）。方案 §6 R5 项 3 要求两种形态分别验证后再「保留选定的标准产物」。 |
| `npm run dev` | watch 时把 `/* dev build */` 写进同一个 dist 文件 | 方案 §6 R5 项 4：验收前必须重新生成标准发布构建。目前只有人工记忆在挡，自动化链条里没有这道检查。 |
| `tests/browser/lib.mjs:9` | `DIST` 路径硬编码 | minified 产物无法走同一套浏览器冒烟与受控轨迹，验证只能靠人工换文件。 |
| `scripts/check-parity.js --dist` | 只按非 minify 的 bundle 比对 | 无法证明 min 产物对应同一份源码。 |
| `scripts/build.js:39` | `module.exports = { build, OUT_NAME }`，但 `OUT_NAME` 在本文件作用域内不存在 | 一旦被 `require` 就 `ReferenceError`；当前无人 require，属潜伏缺陷，本轮动 build 脚本时一并修正。 |
| `package.json` | `engines.node: ">=20"`，无 `type` | `node --test tests/*.test.mjs` 与冒烟每次都打印 `MODULE_TYPELESS_PACKAGE_JSON` 警告；`>=20` 只在单一本机版本验证过。 |
| 文档入口 | 根目录没有 README | 新人不知道「双击哪个文件、跑哪条命令、产物有几种形态」。 |

## 2. 本轮边界与已定决策

- **标准发布产物仍是 pretty**（用户 2026-10-29 决定）：minified 只做一轮等价验证，不留在仓库、不进 `verify` 链、不覆盖 pretty。
- **不改玩法与画面**：5 条受控绘制轨迹必须继续逐字节一致；若 min 产物导致轨迹变化，停下报告，不使用 `UPDATE_TRACE`。
- **不动测试架构**：A–I 场景迁移在 R5a 已收口；`headless_test.js` 继续保留并跑。
- **不清理历史文件**：根目录旧 HTML、`legacy/`、`test:smoke:legacy` 留待 R5 之后的清理轮。
- **Node 制式只加 `src/package.json`**：`{"type":"module"}` 让 `src/**` 显式按 ESM 解析，根包保持 CJS，`scripts/*.js` 的 `require` 不动（方案 §6 R5 项 6 明确禁止先加 `type: module` 再漏迁 `require`）。
- **engines 保持 `">=20"`**（用户决定），但要在文档写下本轮实测过的版本清单，不把未实测的小版本说成已验证。

## 3. 拆解

### 3.1 交付形态（方案 R5 项 3）

| 形态 | 命令 | 产物名 | 构建一致性 | 离线检查 | 浏览器冒烟 | 是否提交 |
|---|---|---|---|---|---|---|
| pretty（标准） | `npm run build` | `dist/植物大战僵尸-网页版.html` | `parity:dist`（非 minify bundle 逐字节） | 构建时 `assertOffline` | `test:browser`（默认路径） | 是 |
| minified（验证） | `npm run build:min` | `dist/植物大战僵尸-网页版.min.html` | `parity:dist` 的 min 分支（同一入口、minify 后逐字节） | 同上 | `PVZ_DIST=…min.html npm run test:browser` | 否，验证后删除并 gitignore |

min 的等价判据：与 pretty 同源同入口同 target（`es2019`），只有 `minify` 开关不同；浏览器冒烟与 5 条绘制轨迹结果一致。

### 3.2 构建戳与 dev 污染（方案 R5 项 4）

- 浏览器套件先断言 dist 首部是 **发布戳**（`/* build: v<semver> pretty */`），dev 产物或未盖戳产物直接判失败 —— 把「验收前必须重新生成标准发布构建」从人工记忆变成红灯。
- `verify` 链顺序保持「先 `build` 再 `parity:dist` 再 `test:browser`」，因此 dev 留下的产物会在同一条链里被覆盖并立刻比对。
- `dev` 的输出提示补上「这是 dev 产物，验收前须 `npm run build`」。

### 3.3 Node 制式（方案 R5 项 6）

- 新增 `src/package.json`（仅 `{"type":"module"}`），消除类型猜测警告。
- 影响护栏：`fingerprint` 扫 `src/**` 全部文件 → 由 38 增至 39，需按规则重新盖章；`parity` 行模式只走 `.js`，快照 3210 行应保持不变（若变了说明判断错，停下核对）。
- 多版本实测：v20.19.4 / v22.16.0 / v22.23.2 各跑 `npm test`、`npm run test:smoke`、`npm run build` + `parity:dist`，并确认警告消失、结果一致；Playwright 套件在本机最新一次全量跑，其余版本记录已跑项。
- README 写明 engines 声明与实测清单，不宣称覆盖整个 `>=20`。

### 3.4 文档入口

新增根 `README.md`：玩法与离线承诺、双击路径、命令表、两种产物形态与选择、目录与文档索引（方案 v0.2、R0–R5 执行计划、测试基线）、Node 要求。既有 `docs/*` 只追加，不改写已完成轮次的记录。

## 4. 工作项

| 工作项 | 内容 | 验收 |
|---|---|---|
| W1 计划与基点 | 本文件；记录起点 `281ef7a`、四项决策与现状清点。 | §1–§3 可核对，未动代码。 |
| W2 min 形态 | `build:min` 改写独立文件名；`lib.mjs` 支持 `PVZ_DIST`；`check-parity.js --dist` 支持 min 比对。 | min 产物构建一致性 PASS、离线检查通过、`PVZ_DIST` 下浏览器 7/7 且 5 条轨迹零变化。 |
| W3 发布戳护栏 | dist 戳校验进浏览器套件（或共享断言）；修 `build.js` 的 `OUT_NAME` 缺陷；dev 提示。 | 用 dev 产物冒充发布页时套件变红；还原 pretty 后转绿。 |
| W4 Node 制式 | 新增 `src/package.json`；重新盖章 `fingerprint`；三版本实测。 | 无 `MODULE_TYPELESS_PACKAGE_JSON` 警告；`parity` 行数不变；三版本结果一致。 |
| W5 README | 根目录唯一入口，含命令表、产物形态、Node 实测清单与文档索引。 | 与实际脚本一致，逐条可在仓库核对。 |
| W6 全链验收与收口 | 删除 min 临时产物、重建 pretty 标准构建、`npm run verify` 全绿；回填本文件与测试基线。 | 证据与实际输出一致；人工项不代勾。 |

## 5. 风险

| 风险 | 处置 |
|---|---|
| minify 触发标识符改名，理论上不改 Canvas 调用序列，但可能影响字体度量无关的字符串常量 | 以 5 条受控轨迹 + 真实浏览器冒烟为判据；一旦不一致停下报告，不放宽基线。 |
| min 产物误留在工作区被提交 | 独立文件名 + `.gitignore` 明确排除；W6 收尾删除并核 `git status`。 |
| `src/package.json` 影响 esbuild 解析或浏览器产物内容 | 只加 `type`，不加 `main`/`exports`；以 `parity:dist` 逐字节比对证明产物文本不变。 |
| 重新盖章掩盖真实源码变化 | 盖章只针对新增的 `src/package.json` 一个文件；`parity` 与 `parity:dist` 同时绿灯，且 `src/**` 的 `.js` 未被触碰。 |
| 多 Node 版本共用 `node_modules` 的原生二进制差异 | 逐版本实际执行记录结果，不只凭 `engines` 声明下结论。 |

## 6. 进度

| 工作项 | 状态 | 证据 |
|---|---|---|
| W1 | 完成 | 本文件；起点 `281ef7a`。 |
| W2 | 完成 | `inline.js` 增加 `MIN_NAME` 与 `writeDist(html, name)`；`build:min` 写独立文件；`check-parity.js --dist --minify --file=`；`lib.mjs` 支持 `PVZ_DIST`。min 产物 93.8 KB 构建一致性 PASS，`PVZ_DIST` 下浏览器 7/7、5 条轨迹零变化。 |
| W3 | 完成 | `assertReleaseStamp()` 进 `openRelease()`；用 dev 产物污染 dist 后浏览器套件 7/7 变红，重建 pretty 后转绿；`build.js` 的 `OUT_NAME` 作用域缺陷修正；`dev` 打印重建提示。 |
| W4 | 完成 | 新增 `src/package.json`（仅 `{"type":"module"}`）；`MODULE_TYPELESS_PACKAGE_JSON` 警告在 `npm test` 与 `test:smoke` 中消失；`parity` 仍 3210 行，`fingerprint` 由 38 增至 39 并按规则重新盖章；20.19.4 / 22.16.0 / 22.23.2 三版本实测通过。 |
| W5 | 完成 | 根 `README.md`：玩法与离线承诺、命令表、两种交付形态、Node 实测清单、目录与文档索引。 |
| W6 | 完成 | min 临时产物已删除；`npm run verify` 全绿；`dist/` 内容在 git 中未变。 |

## 7. 验收记录（2026-10-29）

### 7.1 两种交付形态

| 形态 | 产物 | 大小 | 构建一致性 | 离线检查 | 浏览器冒烟 + 轨迹 | 提交 |
|---|---|---|---|---|---|---|
| pretty（标准） | `dist/植物大战僵尸-网页版.html` | 162.0 KB（内联脚本 158.9 KB） | `parity:dist` PASS，逐字节一致 | 构建期 `assertOffline` 通过 | 7/7（默认路径） | 是，且**内容未变**（`git status` 不列出 `dist/`） |
| minified（验证） | `dist/植物大战僵尸-网页版.min.html` | 96.6 KB（内联脚本 93.8 KB） | `parity:dist:min` PASS，逐字节一致 | 同一条 `assertOffline` 代码路径 | `PVZ_DIST=…min.html npm run test:browser` → 7/7，5 条绘制轨迹与 pretty 基线一致 | 否，`.gitignore` 排除，验收后已删除 |

min 与 pretty 只差 `minify` 开关：同一入口、同一 `esbuildOpts`、同一 `target: es2019`，构建戳分别写 `pretty` / `minified`。
轨迹在 min 下逐字节不变，说明压缩只改标识符与空白，没有改变任何 Canvas 调用。

### 7.2 构建戳与 dev 污染

- `assertReleaseStamp()` 只接受 `/* build: v<semver> pretty|minified */`；`openRelease()` 在打开页面前调用，因此冒烟与轨迹两条路径都受保护。
- **红灯实验**：跑一次 `npm run dev` 让 watch 把 dev 戳写进 `dist/植物大战僵尸-网页版.html`，`npm run test:browser` → `# pass 0 / # fail 7`，报错为「… 缺少发布构建戳，请先 npm run build」；`npm run build` 重建后 → 7/7 绿。
- `scripts/build.js` 原 `module.exports = { build, OUT_NAME }` 中 `OUT_NAME` 未在作用域内，被 `require` 时会 `ReferenceError`；现从 `inline.js` 正常取入并导出 `OUT_NAME`/`MIN_NAME`。
- `dev` 启动提示增加「dev 会写进发布文件，验收或提交前必须 `npm run build`」。

### 7.3 Node 制式与多版本实测

- `src/package.json` 只声明 `{"type":"module"}`，根包与 `scripts/*.js` 保持 CommonJS，未迁移任何 `require`（方案 §6 R5 项 6 的约束）。
- 警告消除：`npm test`、`npm run test:smoke` 输出中不再出现 `MODULE_TYPELESS_PACKAGE_JSON`。
- 护栏影响：`parity` 行模式只扫 `.js`，快照仍 **3210 行**不变；`fingerprint` 扫 `src/**` 全部文件，38 → **39**（新增 1 / 缺失 0 / 变化 0），已按规则重新盖章，`src/**` 的 JavaScript 一字未动。
- 产物不受影响：加入后 `npm run build` + `parity:dist` 仍逐字节一致，`dist/` 在 git 中无变化。

| Node 版本（macOS arm64） | `npm test` | `test:smoke` | `build` + `parity:dist` | 警告 |
|---|---|---|---|---|
| 20.19.4 | 157/157 | ALL TESTS PASSED | 162.0 KB / PASS | 无 |
| 22.16.0 | 157/157 | ALL TESTS PASSED | 162.0 KB / PASS | 无 |
| 22.23.2（本机默认） | 157/157 | ALL TESTS PASSED | 162.0 KB / PASS | 无 |

`engines.node` 保持 `">=20"`（用户决定），README 与本节只背书上述实测版本。

### 7.4 全链验收

`npm run verify`（Node 22.23.2）：`parity` 3210 行 PASS → `fingerprint` 39 文件 PASS → `test` 157/157 → `build` 162.0 KB → `parity:dist` PASS → `test:smoke` A–I ALL TESTS PASSED → `test:browser` 7/7（含 5 条受控绘制轨迹，**未使用 `UPDATE_TRACE`**）。

### 7.5 边界与后续

- 本轮改动全部落在 `scripts/`、`tests/browser/lib.mjs`、`.gitignore`、`package.json`、`src/package.json` 与文档；`src/**` 的 JavaScript、玩法、数值与绘制顺序未触碰，`dist/` 标准产物字节内容不变。
- min 形态只证明「同一源码可压出等价产物」，不参与 `verify` 链；标准发布产物始终是 pretty。
- 一个意外：多版本实测脚本里误带了一条 `git checkout HEAD -- package.json`，把本轮刚写的 `parity:dist:min` 一行冲掉，随即发现并重新加回、复跑 `build:min` + `parity:dist:min` 确认；丢失面仅限本轮自己新增的一行。教训是还原类命令不得出现在批处理里。
- 根目录旧 HTML、`legacy/`、`headless_test.js` 与 `test:smoke:legacy` 按既有决定留待 R5 之后的独立清理轮；本轮只在 README 里标明它们是历史溯源件而非交付物。
- 真机触屏、字体栅格化、真实音效与手感由用户人工验收，清单未代勾。
- 提交：`9900c48`，13 个文件、+283/−18；`dist/` 标准产物内容未变，故不在提交内。

