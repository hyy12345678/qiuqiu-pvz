# 球球的植物大战僵尸 · R4a 执行计划（渲染层拆分）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R4 子步骤 1–5。
> 日期：2026-10-28
> 起点：commit `f823d57`（R3 记录）
> 终点：commit 待填（R4a 收口）
> 本轮范围：**只做渲染**——target、背景、实体绘制、HUD 与场景全部迁出 `main.js`；输入、流程调度与帧循环仍留在主入口，R4b 再收口。
> 状态：见文末进度表；每完成一项就更新。

## 1. 为什么拆成 R4a / R4b

方案 §6 R4 给出 6 个子步骤，并把它作为一轮。实际执行时按可独立验收的边界切成两轮：

- **R4a（本文件）**：子步骤 1–5，渲染与美术细节离开主入口。硬验收是 5 个受控绘制场景逐字节不变。
- **R4b**：子步骤 6，事件绑定、流程调度与帧循环迁出，`main.js` 只剩装配与启动。

这样切分的理由：渲染搬迁的验证手段是绘制轨迹，输入与循环搬迁的验证手段是事件与帧驱动，两者的失败定位互不干扰；先让渲染稳定，再在稳定的绘制入口上搬输入，避免一次失败同时指向两类原因。

## 2. 决策记录

| 日期 | 决策 | 说明 |
|---|---|---|
| 2026-10-28 | 新增 `src/render/target.js` 作为 `ctx` 与 `DPR` 的唯一写入口 | `ctx` 以 ESM live binding 导出，搬迁后的绘制函数继续写裸 `ctx`，不把 1157 处访问改成显式参数。 |
| 2026-10-28 | `withTarget(next, fn)` 用 `try/finally` 恢复 | 允许离屏绘制临时切换目标；不跨异步、不支持多实例并发绘制。 |
| 2026-10-28 | `DPR` 随 target 绑定 | `bindCanvas(canvas, dpr)` 设置尺寸、缩放并绑定上下文；背景缓存使用显式 dpr，未传入时在构建缓存时读取当前 DPR，避免模块初始化时提前捕获。 |
| 2026-10-28 | `AT` 改为显式 `t` 参数 | 由帧状态对象 `{ t, rng, musicOn }` 携带；`render(world, ui, frame)` 接收，场景与绘制函数逐层传参。音乐状态由装配层提供，渲染不直接访问音频模块。 |
| 2026-10-28 | 震屏随机从帧状态取 | `render` 用 `frame.rng`（即装配层派生的 `drawRng`），对应方案 §5.4 的 `renderState.rng`。 |
| 2026-10-28 | 背景缓存改为工厂 + 绘制成功后才生效 | `createBackgroundCache({ createCanvas, dpr })`；`withTarget` 绘制成功后才写入 `canvas/theme`。绘制抛错时 target 恢复、缓存仍为空，下次重试。这是本轮唯一的行为修正，只影响失败路径。 |
| 2026-10-28 | HUD 与场景显式接收 `world` / `ui` | 渲染函数从 `G` / `UI` 改为形参；`drawSeedBank` 等注册热点仍只写动作描述。 |
| 2026-10-28 | 模块按方案 §5.5 命名 | `render/plant.js`、`zombie.js`、`projectile.js`、`mower.js`、`hud.js`、`background.js`、`scenes/{common,menu,help,select,quiz,play,end,index}.js`。 |
| 2026-10-28 | 本轮仍是**轨迹零变化** | 除背景失败路径外，绘制调用顺序、坐标、样式、渐变 stop 与分支必须逐字节一致。 |

## 3. 本轮明确不做

- 不迁输入、`dispatch`、键盘 / 触屏绑定与帧循环（R4b）。
- 不把绘制函数改成显式 `ctx` 参数，不改 1024×640 逻辑坐标与 DPR 计算方式。
- 不新增植物、僵尸、粒子、美术、配色、层级或绘制顺序。
- 不调整 `save/restore` 的配对位置，不改渐变 stop 数量与顺序。
- 不做对象池、OffscreenCanvas、Worker 等性能改造。
- 不把 Canvas 热点改成 DOM，不改热点注册顺序与倒序命中。
- 不在本轮清理 `legacy/` 或根目录旧 HTML。

## 4. 触点清点

`src/main.js` 当前 2498 行；本轮迁出约 2330 行绘制代码。

### 4.1 函数 → 模块

| 现位置 | 函数 | 迁往 | 形参变化 |
|---|---|---|---|
| 45–60 | `rr`、`O` | `render/paint.js` | 不变（只读 `ctx`） |
| 72–337 | `ensureBG`、`paintBattleBG`、`drawBackground` | `render/background.js` | `drawBackground(world, t)`；缓存改工厂 |
| 339–1041 | 植物与球球的全部绘制 | `render/plant.js` | `drawPlantEntity(t,p)`、`drawPlantIcon(t,type,x,y,s)` |
| 1043–1404 | `drawZombieEntity`、`drawZombieHeadIcon` | `render/zombie.js` | `drawZombieEntity(t,z,fyOverride)` |
| 1406–1524 | `drawSun`、`drawPea` | `render/projectile.js` | `drawSun(t,s)`、`drawPea(p)` |
| 1525–1568 | `drawMower` | `render/mower.js` | `drawMower(t,m)` |
| 1569–1795 | 种子栏、阳光盒、铲子、进度条、右上按钮、波次、开场白 | `render/hud.js` | 显式 `(t, world, ui)` |
| 1797–1915 | `renderPlay` | `render/scenes/play.js` | `renderPlay(t, world, ui, musicOn)` |
| 1916–1947 | `drawButton` | `render/scenes/common.js` | 首参新增 `ui`，其余参数不变 |
| 1948–2028 | `drawMenuScene` | `render/scenes/menu.js` | `drawMenuScene(t)` |
| 2029–2137 | `renderMenu` | `render/scenes/menu.js` | `renderMenu(t, world, ui, musicOn)` |
| 2138–2176 | `renderHelp` | `render/scenes/help.js` | `renderHelp(t, world, ui)` |
| 2177–2289 | `renderSelect` | `render/scenes/select.js` | `renderSelect(t, world, ui)` |
| 2290–2333 | `renderQuiz` | `render/scenes/quiz.js` | `renderQuiz(t, world, ui)` |
| 2334–2376 | `renderEndOverlay` | `render/scenes/end.js` | `renderEndOverlay(t, world, ui)` |
| 2378–2400 | `render` | `render/scenes/index.js` | `render(world, ui, frame)` |

### 4.2 全局依赖的替换规则

| 现用法 | R4a 之后 |
|---|---|
| `AT`（54 处） | 形参 `t`，由 `render(world, ui, frame)` 的 `frame.t` 逐层传入 |
| `G`（绘制层 40 余处） | 形参 `world` |
| `UI`（绘制层 30 余处） | 形参 `ui` |
| `drawRng`（仅 `render`） | `frame.rng` |
| `ctx` / `DPR` | 从 `render/target.js` 导入 live binding |
| `bgCanvas` / `bgTheme` | 收进 `createBackgroundCache` 实例 |

## 5. 工作项与验收

### W1 target 与背景

- 新增 `src/render/target.js`：`ctx`、`DPR`、`bindCanvas`、`withTarget`。
- 新增 `src/render/paint.js`：`rr`、`O`、`drawText`（避免 plant 与 HUD 互相导入）。
- 新增 `src/render/background.js`：`createBackgroundCache`、`bgCache`、`paintBattleBG`、`drawBackground`。
- `main.js` 去掉 `let ctx` / `DPR` 声明，改为绑定主画布。

**验收**：背景缓存命中 / 未命中 / 不同主题 / 绘制抛错四条路径有单测；抛错后 target 恢复且缓存仍为空。

### W2 实体绘制

- 新增 `render/plant.js`、`zombie.js`、`projectile.js`、`mower.js`；函数体原样搬迁，只做 `AT→t`、`G→world`、`UI→ui`。
- `render/paint.js` 提供共用的 `rr` / `O`。

**验收**：函数体除依赖改名外无重写；5 个轨迹场景逐字节不变。

### W3 HUD 与场景

- 新增 `render/hud.js` 与 `render/scenes/*`。
- `drawSeedBank`、`drawTopRightButtons` 等显式读取 `world` / `ui`，热点仍用 `addHotspot(ui, ...)` 注册动作描述。
- 新增 `render/scenes/index.js` 的 `render(world, ui, frame)`：清热点、震屏平移、按状态分派、暗角。

**验收**：场景函数不写 `world` 的任何战斗字段（只读）；热点描述与 R3 完全一致。

### W4 主入口改接

- `main.js` 只保留装配：种子、ports、`G`、`UI`、`drawRng`、画布绑定、`frame` 状态对象、输入与循环（R4b 再搬）。
- 帧循环改为 `frame.t += dt; render(G, UI, frame);`。

**验收**：`src/main.js` 不再定义任何 `draw*` / `render*` 函数；冒烟 A–I 通过。

### W5 测试

新增：

| 文件 | 覆盖 |
|---|---|
| `tests/render-target.test.mjs` | `withTarget` 返回值、嵌套恢复、异常恢复、`bindCanvas` 写入 ctx/DPR |
| `tests/render-background.test.mjs` | 首次绘制、同主题命中、换主题重绘、首次失败不生效与重试、换主题失败保留旧缓存、离屏缩放、默认 DPR 延迟读取 |
| `tests/render-readonly.test.mjs` | 用记录型 ctx 调 `drawPlantEntity` / `drawZombieEntity` / `drawSun` / `drawPea` / `drawMower`，实体对象深度快照不变、不抛错 |
| `tests/render-boundaries.test.mjs` | 静态扫描：只有 `target.js` 给 `ctx/DPR` 赋值；render 禁止导入音频、存档、模拟推进、输入与装配；`core/actions` 只允许 `inspectUseCard`，`core/world` 只允许 `isNight`，`core/entities` 只允许 `cellCX/cellFY`；core 不反向依赖 render/ui。扫描器自测覆盖目录、别名、命名空间、转导出、字面量动态导入与行内赋值。 |

**验收**：`npm test` 全绿；新增测试能各自失败（逐条突变验证至少一条）。

### W6 重新盖章与全链验收

1. `npm run parity` 逐行审计：只允许显式参数与调用点改接（含 `musicOn/frame.rng`）、函数换文件、新增 import、target 绑定与已列明的背景缓存调整。
2. `parity:rebase` + `fingerprint:update`。
3. 构建后先跑比较模式的 `test:browser`：5 个场景必须零差异；有差异先定位，不直接 `UPDATE_TRACE`。
4. `npm run verify` 全绿。
5. 红灯可复现：故意改一处绘制坐标，确认轨迹失败；恢复后 sha256 一致。

## 6. 各类检查在 R4a 分别证明什么

| 检查 | 证明 | 不证明 |
|---|---|---|
| target 单测 | `ctx` 切换与恢复、嵌套与异常安全 | 真实 Canvas 的绘制结果 |
| 背景缓存单测 | 命中条件与失败重试 | 渐变与路径内容正确 |
| 只读测试 | 绘制函数不修改实体对象 | 绘制函数不修改 world 其它字段 |
| 依赖方向静态检查 | 渲染层没有反向依赖与多处 `ctx` 写入 | 运行时真的只读 |
| 5 个绘制轨迹 | 搬迁没有改变任何一次绘制调用 | 字体栅格化、合成与真实音频 |
| 发布冒烟 | 真实交付页可启动、交互、持续运行 | 所有场景分支 |
| `verify` | 构建、快照、指纹、单测、冒烟、浏览器链一致 | 手感与真机验收 |

## 7. 进度表

| 工作项 | 状态 | 证据 |
|---|---|---|
| W1 target 与背景 | 完成 | target 5 条、背景 4 条通过；覆盖嵌套/异常恢复、延迟 DPR、缩放与失败重试。 |
| W2 实体绘制 | 完成 | 植物、僵尸、阳光、弹丸、小车迁出；实体只读 3 条通过。 |
| W3 HUD 与场景 | 完成 | 显式 world/ui/t/musicOn；只读导入白名单与 5 个轨迹场景通过。 |
| W4 主入口改接 | 完成 | main 从 2498 行减至 141 行；不再定义绘制函数，冒烟 A–I 通过。 |
| W5 测试 | 完成 | 新增 19 条，全部单测 93/93；各组均有变异失败证据。 |
| W6 重新盖章与全链验收 | 完成 | 3191 行快照、36 文件指纹、verify 全绿；轨迹零变化与 1px 红灯验证。 |

## 8. 验收记录

- 验收日期：2026-10-29；起点 `f823d57`，本轮尚未提交。
- `parity`：3173 → 3191 行；移除 197 / 新增 215 行。差异为参数与调用点改接、导入、target/背景工厂和帧状态收拢；未改核心规则、数值、输入行为或绘制顺序。
- `fingerprint`：20 → 36 文件；新增 16 个 render 模块，变化仅 main。核心、UI、音频、存档模块未改。
- `npm test`：93/93，含 target 5、背景缓存 4、实体只读 3、依赖方向/扫描器自测 7，共新增 19 条。
- `build`：160.9 KB 单文件离线 HTML；`parity:dist` 内联脚本 157.8 KB 与源码构建逐字节一致。
- `test:smoke`：A–I 全绿；`test:browser`：7/7，含 2 条发布交互冒烟与 5 条轨迹比较。
- 5 个场景 `menu / select-l3 / quiz-l3 / play-day-l1 / play-night-l4` 全部逐字节一致；未使用 `UPDATE_TRACE`，轨迹基线未修改。
- `npm run verify` 全链通过。Node 的既有模块类型推断警告未影响执行，未为消除警告改动包模块制式。

### 8.1 红灯验证

在临时副本里实施变异，不污染当前工作区；原源码与轨迹文件的 SHA-256 在轨迹验证前后相同。

| 变异 | 失败证据 |
|---|---|
| 删除 `withTarget` 的 finally 恢复 | 同步返回/恢复、嵌套、异常三条 target 测试失败。 |
| 绘制前先标记缓存有效 | 首次绘制失败不得生效的断言失败。 |
| 删除离屏 `scale` | 显式 DPR 与延迟 DPR 两条缓存测试失败。 |
| 创建缓存时提前捕获 DPR | 先创建缓存、再绑定 DPR=2 的用例失败。 |
| 植物绘制写入 `p.flash = 0` | 植物快照不变断言失败。 |
| render 导入音频或命名空间 actions | 禁止依赖与只读白名单断言分别失败。 |
| 暗角 `fillRect` 横坐标 0 → 1 | 菜单轨迹第 4753 行失败：`fillRect(0,0,1024,640)` 与 `fillRect(1,0,1024,640)`。 |

此前已验证直接写入 `ctx = null` 会触发唯一写入口检查；恢复后测试通过。

### 8.2 浏览器与审查

- 启动 `npm run dev`，通过 Playwright 操作菜单、帮助、空队伍禁用开始、选卡、答题、种植、暂停/恢复、键盘取消，检查帮助/选卡/战斗截图；无页面错误、无外部请求。
- 内置浏览器连接超时，以上检查使用独立 Chromium；结束后停止开发服务器，重新生成无 dev 戳的正式产物，再通过全链校验。
- 独立代码审查未发现可证实的行为偏移或缺失依赖；补齐审查指出的 DPR/缩放与旗帜/撑杆/阳光分支覆盖。

### 8.3 验收边界与后续

- 依赖检查是面向当前语法的静态扫描，不是完整 JavaScript 语法分析或任意动态路径证明。
- 实体快照只证明覆盖输入下实体不被修改，不等于全部场景 world 字段的动态只读证明。
- 试验中修改植物坐标未使既有白天轨迹失败：该选定帧未包含植物，改用必经暗角完成轨迹红灯验证；实体只读测试与真实种植冒烟补足部分覆盖，不把五条轨迹当作所有实体分支的证明。
- 真机触屏、字体栅格化、音效与手感仍由用户人工验收，未代勾清单。
- 下一轮为 R4b（输入、调度、主循环）；未执行本轮提交，也未删除旧根 HTML 或 legacy。

> 后续：输入、调度与主循环已在 [R4b 执行计划](重构执行计划-R4b.md) 中独立验收；以上保留 R4a 收口时的历史记录。
