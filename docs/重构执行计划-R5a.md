# 球球的植物大战僵尸 · R5a 执行计划（旧冒烟场景迁入稳定接口测试）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R5 工作项 1、2。
> 日期：2026-10-29
> 起点：commit `4d6df7d`（记录 R4 提交号），源码收口于 `7e89bb1`。
> 终点：commit `ca636c7`（R5a：旧冒烟场景迁入稳定接口测试）。
> 范围：只迁测试。R5 的另三类（两种交付形态、构建戳与文档入口、Node 制式与 engines）留 R5b；
> 根目录旧 HTML、`legacy/` 与历史工具的清理，按 2026-10-29 决定排在 R5 之后的独立一轮。

## 1. 本轮要解决的债

`headless_test.js`（376 行）用 esbuild 的 **esm** 形态打包 `src/main.js`，再在同一个 vm 上下文里跑驱动脚本，
靠的是「顶层 `const` 落在上下文词法域」这一实现细节。因此它直接读以下名字：

| 依赖 | 现稳定接口 | 备注 |
|---|---|---|
| `G` / `UI` | `createWorld()` / `createUI()` 实例 | 驱动只是恰好与游戏共用一个上下文，并非实例隔离。 |
| `pump()` + `requestAnimationFrame` + `performance.now` | `createGame({ now, requestFrame })` 的手动帧驱动 | 真实帧链与 `dt` 截断仍需覆盖。 |
| `press()` → `__canvasHandlers` | `game.handlePress(point)` | 热点/阳光/格子优先级已由 `tests/game.test.mjs` 覆盖。 |
| 顶层 `ctx = new Proxy(...)` 再恢复 | `withTarget(next, fn)` | 本轮必须去掉：直接写 `ctx` 绕过 R4a 的唯一写入口约定。 |
| `bgTheme` | `bgCache.theme` | R4a 已提供 getter。 |
| 战斗与实体函数 | `core/entities.js`、`core/sim.js`、`core/world.js` 导出 | 已是具名导出，无需新增出口。 |
| 绘制函数 | `render/plant.js`、`render/zombie.js`、`render/projectile.js` | 已是具名导出。 |

只要这些只在打包后的上下文里可见，测试就无法单跑某个场景、难以定位失败，也会随打包器行为漂移。

## 2. 本轮边界

- **不删除、不弱化旧断言**：A–I 逐条等价迁移并核对通过后，`headless_test.js` 原样保留，`test:smoke` 继续留在 `verify` 链里（用户 2026-10-29 决定）。
- **不改游戏源码**：不新增导出、不为测试开生产出口、不动数值与规则。若发现缺接口，先停下报告，不擅自改 `src/`。
- **不改受控轨迹基线**：5 条绘制轨迹与 `tests/browser/*` 不在本轮范围。
- **不动构建/发布工具**：`scripts/*`、`package.json` 的脚本与 engines 属 R5b。
- **不清理历史文件**：旧根 HTML、`legacy/`、`test:smoke:legacy` 一律保留。

## 3. 场景清点与去向

| 旧场景 | 断言要点 | 迁往 | 迁移难点 |
|---|---|---|---|
| S0 | Canvas 桩未知 API 抛错、rAF 链中断可被检出 | `tests/scenario-harness.test.mjs` | 夹具自检必须能各自失败，否则整轮退化成「不报错即通过」。 |
| A | 无人防守 → 小推车出动 → 判负，且小推车有击杀 | `tests/scenario-outcome.test.mjs` | 需长时间模拟；结果由固定 seed 决定。 |
| B | 强防守通关、`killed === total` | 同上 | 同一 seed 下须与旧驱动结果一致。 |
| C1–C5 | 撑杆跳、土豆雷成长与爆炸、樱桃双杀、啃食、寒冰减速 | `tests/scenario-mechanics.test.mjs` | 旧驱动手工拼僵尸字段，需与 `spawnZombie` 的构造等价。 |
| D | help / menu / 解锁全关 / 夜关菜单等各界面绘制不抛错 | `tests/scenario-scenes.test.mjs` | 走真实 `render(world, ui, frame)`；夜间小月亮与 `unlockAll` 分支只在解锁满时命中。 |
| E | 球球造成伤害、出弹、8 秒内击杀 | `tests/scenario-mechanics.test.mjs` | 需确认子弹类型为 `bullet`/`missile`。 |
| F | 三题答对能量 400 开战；答错直接开战且能量 50 | `tests/scenario-flow.test.mjs` | 与 `tests/quiz.test.mjs` 重叠，只补「经帧驱动进入 play」这一段。 |
| G / G-b | 报纸护盾吸收、破报暴怒提速、击杀；看报与暴怒两姿态绘制 | `tests/scenario-mechanics.test.mjs`、`tests/scenario-scenes.test.mjs` | 绘制段改用 `withTarget`。 |
| H | 4 个关卡、夜关 50+100 起始阳光、夜战提示、28 秒无天降太阳、背景主题 night；白关主题 day 且产天降太阳 | `tests/scenario-flow.test.mjs` | 主题断言用 `bgCache.theme`。 |
| I | 白天蘑菇打盹、咖啡豆点错不消耗、点对唤醒并冷却、阳光菇产 25 阳光、夜战即开工 | `tests/scenario-plant-input.test.mjs` | 按下改走 `game.handlePress`，保留 `actions.test.mjs` 未覆盖的组合时序。 |
| I12–I13 | 孢子用自身配色、非孢子不用孢子配色 | `tests/scenario-scenes.test.mjs` | 去掉顶层 `ctx` 赋值，改 `withTarget(记录ctx, () => drawPea(...))`。 |

**等价判定**：同 seed、同初始阳光、同时间轴推进下，旧场景每条断言的**结果值**（状态、胜负、击杀数、冷却是否推进、是否打盹等）一致；不要求复刻驱动脚本写法。数值不一致先停下定位，不放宽断言、不改基线。

## 4. 工作项

| 工作项 | 内容 | 验收 |
|---|---|---|
| W1 计划与基点 | 记录起点提交、场景清点与等价判定口径；不动代码。 | 本文件与 §3 可核对；基点为 `4d6df7d`。 |
| W2 测试夹具 | 抽出 `tests/helpers/scenario.mjs`：记录型 ctx、`withTarget` 绑定、固定 seed 世界、手动帧驱动与 `press`。 | 夹具自检（S0）能因「未知绘制 API」「帧链中断」分别失败。 |
| W3 场景迁移 | 按 §3 分文件迁入 A–I 全部断言，逐条对照旧结果。 | 每条旧断言在新测试里有具名子测试；旧文件一字不改。 |
| W4 依赖去内部名 | 新测试只用 `src/` 具名导出与注入回调，不引用 `G`/`UI`/顶层 `ctx`/`bgTheme`。 | 静态检查：`tests/` 不出现顶层 `ctx =` 赋值与被打包的内部名。 |
| W5 全链验收 | `npm run verify` 全绿，轨迹零变化，逐条变异证明新测试可失败。 | 新增单测、既有 117 条、7 项浏览器与 A–I 冒烟同时通过。 |
| W6 文档收口 | 回填本文件、追加测试基线 R5a 记录。 | 证据与实际输出一致；人工项不代勾。 |

## 5. 风险

| 风险 | 处置 |
|---|---|
| 手动帧驱动与真实 rAF 时序不同导致战斗演化偏移 | 夹具沿用 `dt` 与 60fps 帧距，以固定 seed 复现；偏移即记录差异，不放宽断言。 |
| 记录型 ctx 吞掉未登记的绘制 API，使渲染场景退化为「不抛错」 | 沿用白名单 + 未知即抛错，并保留夹具自检。 |
| 与 `actions.test.mjs`、`game.test.mjs`、`quiz.test.mjs` 重复 | 允许场景级组合时序重复：新文件测「端到端一段玩法」，单测测「单条规则」；§3 标注重叠处。 |
| 双轨（旧冒烟 + 新测试）长期漂移 | 本轮把差异记入文档；去留由清理轮统一决定，不在 R5a 提前删除。 |

## 6. 进度

| 工作项 | 状态 | 证据 |
|---|---|---|
| W1 | 完成 | 本文件；起点 `4d6df7d`。 |
| W2 | 完成 | `tests/helpers/scenario.mjs`（记录型 ctx + 白名单、手动帧队列、`press`、`activate`）；`tests/scenario-harness.test.mjs` 7/7。 |
| W3 | 完成 | 6 个 `tests/scenario-*.test.mjs` 共 40 条，覆盖 S0/A/B/C/E/F/G/G-b/H/I/I12–I13；见 §7.1。 |
| W4 | 完成 | 静态检查通过：新测试无顶层 `ctx =` 赋值、不引用 `G`/`UI`/`bgTheme`、不碰 `vm`/打包内部名；见 §7.2。 |
| W5 | 完成 | 8 项变异全部被新测试捕获（§7.3）；`npm run verify` 全绿、5 条轨迹零变化、A–I 冒烟仍通过（§7.4）。 |
| W6 | 完成 | 本文件与 `docs/测试基线.md` 的 R5a 记录。 |

## 7. 验收记录（2026-10-29）

### 7.1 旧场景 → 新测试

| 旧场景 | 新文件 | 条数 | 迁移口径 |
|---|---|---|---|
| S0 夹具自检 | `tests/scenario-harness.test.mjs` | 7 | 未知绘制 API / 未知属性写入各自抛错；trace 顺序与渐变色标；菜单帧与战斗帧的绘制来源；`pump` 推进时钟、帧链断裂可检出；`withTarget` 正常返回、恢复与异常恢复；两个实例互不串味。 |
| A 无人防守判负 | `tests/scenario-outcome.test.mjs` | 4 | A0–A2 开局与铺卡；A3–A5 跑完该局 → `lost`、小推车出动且有击杀，再 pump 一帧失败面板不抛错。 |
| B 强防守通关 | 同上 | 含在上行 | B0 五行坚果/火炬/双发按价扣阳光并落位（旧驱动无此条，属补强）；B1–B2 `won` 且 `killed === total`，胜利面板不抛错。 |
| 流程1–3 开局重建 | `tests/scenario-progress.test.mjs` | 5 | `startLevel` 进 select、清卡、发 `click`；`beginPlay` 重置 `t=-3.2`、grid/容器/小推车/冷却/出怪表；倒计时跑完进 `t>0` 且不提前出怪。 |
| D1–D2 解锁开关 | 同上 | 含在上行 | `dispatch({type:'unlockAll'})` 写档、放开锁定关卡，`unlocked` 保持真实进度；关闭后锁定关卡被拒且状态/音效/存档不变。 |
| C1–C5 机制 | `tests/scenario-mechanics.test.mjs` | 7 | 撑杆跳墙落杆且在墙左、土豆雷 15 秒武装后炸死、樱桃一次炸死两只、啃食清空格子且僵尸不损血、寒冰豌豆减速或击杀。 |
| E 球球 | 同上 | 含在上行 | 2 秒内掉血、期间出现 `bullet`/`missile`、8 秒内 `dying`。 |
| G 报纸僵尸 | 同上 | 含在上行 | 出怪自带报纸、报纸吸收伤害、破报暴怒提速、溢出伤害与致死。 |
| F 算术热身 | `tests/scenario-flow.test.mjs` | 5 | 三题全对经帧驱动进 `play`、能量 50→100→200→400 落到阳光；首题答错立即开战且阳光 50。 |
| H 关卡表与夜战 | 同上 | 含在上行 | 4 关且仅第 4 关夜战；夜关 `50+100` 阳光、夜战提示、28 秒无天降太阳、`bgCache.theme==='night'`；白关有 `fromSky` 且主题回 `day`。 |
| I 蘑菇与咖啡豆 | `tests/scenario-plant-input.test.mjs` | 5 | 全经 `game.handlePress` 点格子：白天种喷菇即打盹且不扣阳光、咖啡豆点空格不进冷却不取消选卡只发一次 `error`、点对打盹蘑菇唤醒并进入冷却、阳光菇唤醒后 11 秒只产 25 阳光、夜关喷菇不打盹。 |
| D 各界面绘制 | `tests/scenario-scenes.test.mjs` | 7 | 真实 `render(world, ui, frame)` 各画一帧：菜单/说明/选关/算术/战斗/won/lost 的绘制量与热点表；夜关小月亮用 trace 精确断言（锁定 0 个、解锁 1 个、`unlockAll` 亦命中）；夜关选关与白关分叉。 |
| G-b 两姿态绘制 | 同上 | 含在上行 | `withTarget(记录ctx)` 下看报/暴怒/普通三种画法互不相同；图鉴头像按护盾类型分叉。 |
| I12–I13 弹道配色 | 同上 | 含在上行 | `spore` 含 `#b478e0`；`pea/snow/fire/bullet/missile/ball` 均不出现该配色。 |

`npm test` 由 R4b 的 117 条增至 **157 条全绿**（新增 40 条）。

### 7.2 去内部名依赖

对 `tests/scenario-*.test.mjs` 与夹具做正则检查（`\b(ctx|bgTheme|bgCache)\s*=`、`\bG\.`、`\bUI\.`、`runInThisContext`、`from 'vm'`）零命中；
绘制分支改用 `withTarget`，主题改用 `bgCache.theme`，按下改走 `game.handlePress`。
夹具新增 `activate()`：渲染 target 是进程级单例，同一文件里并存多个场景时需在断言绘制前重新绑定本场景画布。

### 7.3 红灯验证

每个变异先备份原文件、注入、跑目标文件、无论成败立即写回原文（不使用 `git checkout`）：

| 变异 | 命中测试 |
|---|---|
| M1 孢子配色改绿 | `scenario-scenes` I12–I13 失败 |
| M2 菜单夜关小月亮分支改为 `if(false)` | `scenario-scenes` D1 组失败 |
| M3 土豆雷武装阈值 14→140 | `scenario-mechanics` C2 失败 |
| M4 护盾吸收短路 | `scenario-mechanics` G 失败 |
| M5 夜战补偿 100→0 | `scenario-flow` H2–H5 失败 |
| M6 咖啡豆分支名改错 | `scenario-plant-input` I3–I4 失败 |
| M7 开场倒计时 −3.2→−3.0 | `scenario-progress` 流程2 失败 |
| M8 `total` 多加 1 | `scenario-outcome` B1–B2 失败 |

8/8 均为「注入即红」，`git status --short src/` 检查已完全还原。

### 7.4 全链验收

- `npm run parity`：基线 3210 / 当前 3210，逐行一致。
- `npm run fingerprint`：基线 38 / 当前 38，源码零改动（本轮只加测试）。
- `npm test`：157/157。
- `npm run build`：`dist/植物大战僵尸-网页版.html` 162.0 KB（pretty）。
- `npm run parity:dist`：产物内联脚本与源码 bundle 逐字节一致。
- `npm run test:smoke`：`headless_test.js src/main.js` → ALL TESTS PASSED（A–I 原样保留，一字未改）。
- `npm run test:browser`：7/7，含 2 条真实发布页冒烟与 5 条受控绘制轨迹，**轨迹零变化**（未使用 `UPDATE_TRACE`）。

### 7.5 与旧驱动的语义差异与缺口

- 旧驱动 `seed` 来自 `Math.random()`，A/B 共用同一个 `G` 且 B 继承 A 消耗后的随机流；新测试每场景独立实例、固定 seed。经多 seed 验证「A 判负 + 小推车有击杀」「B 通关且 `killed===total`」稳定复现，`killed` 绝对值随 seed 波动，故只断言 `>0`，与旧驱动口径一致。
- 新驱动出怪走真实 `spawnZombie` 再挪行列，僵尸 `speed` 带 ±8% 扰动并额外消耗 `world.rng`，因此 C2/C5 的时间窗有实测余量；断言只收紧不放宽。
- 夹具 `pump` 用 `Math.round`（旧驱动 `Math.ceil`），0.1 秒差 1 帧，不影响循环类断言。
- `toggleUnlockAll` 的真实语义只翻转 `world.unlockAll` 并写档，不改 `world.unlocked`；测试按代码事实断言。
- 缺口：旧驱动对结算面板只要求「不抛错」，新测试同样未断言面板绘制内容（由受控轨迹基线覆盖）；场景 D 的绘制只断言「画得出 + 分支分叉」，不复刻逐像素。

### 7.6 边界与后续

- 本轮未改 `src/`、`scripts/`、`package.json` 与受控轨迹基线；`headless_test.js` 与旧 `test:smoke` 保留。
- 双轨漂移的差异已记录，去留由 R5 之后的清理轮统一决定。
- R5b（两种交付形态、构建戳与文档入口/dev 命令、Node 制式与 engines 多版本实测）另开计划。
- 人工验收清单仍由用户自己执行。
- 提交：`ca636c7`，11 个文件、+1178 行，全部为测试与文档；`dist/` 产物内容未变。

