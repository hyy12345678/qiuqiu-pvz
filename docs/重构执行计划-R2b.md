# 球球的植物大战僵尸 · R2b 执行计划（端口化与视觉状态收拢）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R2 第 3、4 条。
> 日期：2026-10-28
> 起点：commit `bcc93b7`（R2a 收口）
> 终点：commit `b9dc709`（R2b 收口）
> 本轮范围：**只做 R2b**——同步 `ports`、存档实现迁出核心、装配层注入初始进度、`world.visual` 收拢。随机分流已在 R2a 完成。
> 状态：见文末进度表；每完成一项就更新。

## 1. 决策记录

| 日期 | 决策 | 说明 |
|---|---|---|
| 2026-10-28 | 端口只有三个同步方法 | `sound(name)`、`saveProgress(value)`、`saveUnlockAll(on)`。够覆盖当前全部核心副作用，不预建异步 / 命令框架。 |
| 2026-10-28 | 默认端口是静默实现 | `createWorld()` 不传端口时不报错、不写存储；单测继续只测规则。发布页由装配层注入真实实现。 |
| 2026-10-28 | 装配层的 SFX 调用保留 | `main.js` 本身就是适配器所有者：菜单、暂停、静音等 UI 音效继续直接调 `SFX`；要迁的是 `core/**` 里的 26 处。 |
| 2026-10-28 | 音频随机仍留在音频模块 | R2a 已把它隔离在局部 `Math.random`；本轮不把它搬进世界，也不改变 `groan()` 消耗随机数的次数。 |
| 2026-10-28 | `applyCoffee` 改为 `(world, p)` | 唤醒要发 `select` 音效，必须能拿到端口。调用点只有 `main.js` 与单测。 |
| 2026-10-28 | 本轮的硬验收是**轨迹零变化** | R2b 是行为中性的结构调整：5 个受控绘制场景必须逐字节不变。任何轨迹变化都视为回归，先查原因而不是重盖章。 |
| 2026-10-28 | 存档文件迁到 `src/platform/persist.js` | 浏览器存储属于平台适配，不属于核心规则；文件名与导出不变，只换目录。 |

## 2. 本轮明确不做

- 不做 R3 的动作入口 / UI 状态分离：`mouse/hoverCell/sel/shovel/hotspots` 仍在 world。
- 不做 R4 的渲染 / 输入 / 循环拆分，`main.js` 仍直接持有 `G`。
- 不改碰撞、时间步、随机流、概率阈值、实体排序、阶段顺序与绘制代码。
- 不把 `parts/decals` 的更新从 `sim.js` 挪走；只换它们挂在哪个对象下。
- 不改 `localStorage` 键名、写回时机与失败吞掉策略。
- 不动音频合成、音量、音乐调度与音频局部随机。

## 3. 触点清点（动手前）

### 3.1 声音：核心 29 处调用（26 行）

| 文件 | 调用数 | 名称 |
|---|---|---|
| `core/world.js` | 6 | `click`×4、`select`、`error` |
| `core/entities.js` | 8 | `plant`、`select`、`boom`×2、`paperTear`、`angry`、`groan`、`mower` |
| `core/sim.js` | 15 | `horn`、`missile`、`gatling`、`shoot`×2、`snowShoot`、`bulletHit`、`splat`、`hop`、`chomp`×2、`lose`、`sun`、`groan`、`win` |

> `sim.js` 有两行写成 `if(...) SFX.a(); else SFX.b();`，所以按 `grep -c` 是 12 行、按调用是 15 处。

### 3.2 存档：核心 2 个写点 + 2 个读点

| 位置 | 现状 | R2b |
|---|---|---|
| `world.js createWorld` | `loadUnlocked()` / `loadUnlockAll()` 默认值 | 改为 `init` 注入，缺省 `1` / `false` |
| `world.js toggleUnlockAll` | `saveUnlockAll(...)` | `world.ports.saveUnlockAll(...)` |
| `sim.js` 胜利分支 | `saveUnlocked(...)` | `world.ports.saveProgress(...)` |

### 3.3 视觉字段：约 60 处引用

`parts`、`decals`、`shake`、`flash`、`waveText`、`nightHint`、`groanTimer`。
分布：`entities.js` 10、`particles.js` 7、`sim.js` 22、`world.js` 9、`main.js` 10、测试与冒烟约 19。

## 4. 工作项与验收

### W1 端口与存档迁移

- 新增 `core/ports.js`：`createPorts(overrides)`，三个空实现 + 覆盖合并。
- `createWorld({ ports, ... })` 把合并结果存到 `world.ports`。
- `core/**` 的 29 处 `SFX.x()` → `world.ports.sound('x')`；`applyCoffee(world, p)`。
- `git mv src/core/persist.js src/platform/persist.js`；核心不再 import 它。
- `main.js` 组装 `ports`（`SFX[name]()` / `saveUnlocked` / `saveUnlockAll`），并注入 `unlocked: loadUnlocked(), unlockAll: loadUnlockAll()`。

**验收**：

- `grep -rn "SFX\|persist" src/core` 为空。
- 发布页音效与存档行为不变（轨迹 + 冒烟 + 手工路径）。

### W2 `world.visual` 收拢

- `createWorld` 返回 `visual: { parts:[], decals:[], shake:0, flash:0, waveText:null, nightHint:0, groanTimer:4 }`。
- `beginPlay` 仍**原地**重置这些字段（数组换新容器、数值归零），不改变赋值顺序。
- `sim.js` 的粒子 / 焦痕 / 呻吟 / 波次文字 / 震屏 / 闪光更新仍在原位置，只换成 `world.visual.*`。
- `entities.js`、`particles.js`、`main.js` 与测试同步改读写路径。

**验收**：视觉效果与每帧更新次序不变；R2b 前后 5 个轨迹基线逐字节一致。

### W3 测试

新增 `tests/ports.test.mjs`：

1. 记录端口：`startLevel/beginPlay/startQuiz/answerQuiz`、种植、咖啡豆、爆炸、击杀、推车、胜利各自发出预期声音。
2. `applyCoffee` 无效目标不发声音、不返回成功。
3. 通关只调用一次 `saveProgress(2)`；`toggleUnlockAll` 调用 `saveUnlockAll(true/false)`。
4. 默认端口静默：`createWorld()` 跑一局不抛错、无副作用。
5. 两个世界的端口互不共享；A 的写回不改变 B。
6. 静态检查：`src/core/**` 不出现 `audio/sfx` 或 `persist` 导入。

更新 `sim-invariants`、`world-isolation`、`random-streams`、`headless_test.js` 的字段路径与 `applyCoffee` 签名。

**验收**：`npm test` 全绿（原 53 + 新增端口测试）。

### W4 重新盖章与全链验收

1. `npm run parity` 逐行审计：只允许 `ports.sound` 替换、`visual.*` 路径、存档注入 / 写回、`applyCoffee` 签名、文件迁移。
2. `parity:rebase` + `fingerprint:update`。
3. **先跑比较模式的 `test:browser`**：5 个场景必须零差异；有差异先定位，不直接 `UPDATE_TRACE`。
4. `npm run verify` 全绿。

### W5 文档收口

- 本文件进度表与验收记录。
- `docs/测试基线.md` 追加 R2b 记录（端口清单、静态检查、轨迹零变化）。
- R2a / R1b 文档的“R2b 见”指向本文件。

## 5. 各类检查在 R2b 分别证明什么

| 检查 | 证明 | 不证明 |
|---|---|---|
| 端口测试 | 核心只通过注入端口发声 / 存档，时机与次数不变 | 真实音频好听、存储真的持久（冒烟 + 手工兜底） |
| 静态导入检查 | 核心不再直接依赖 `audio/` 与 `persist` | 运行时没有其他隐藏副作用 |
| 轨迹零变化 | 本轮结构调整没有改变画面与帧序 | 声音与存档正确（无音频替身时听不见） |
| 隔离测试 | 端口和视觉容器也按实例分开 | 浏览器多个标签页间的存储竞争 |
| `verify` | 构建、快照、指纹、单测、冒烟、浏览器链一致 | 人耳 / 手感验收 |

## 6. 进度表

| 工作项 | 状态 | 证据 |
|---|---|---|
| W1 端口与存档迁移 | 完成 | `core/ports.js`；核心 29 处声音走端口；`platform/persist.js`；装配层注入进度 |
| W2 `world.visual` 收拢 | 完成 | 7 个字段迁移，更新位置未动；5 个轨迹场景逐字节不变 |
| W3 测试 | 完成 | 新增 7 条；`test` 60 条全绿 |
| W4 重新盖章与全链验收 | 完成 | parity 3039 行、指纹 17 文件、`verify` 全绿 |
| W5 文档收口 | 完成 | 本节 + `测试基线.md` + R1b/R2a 交叉引用 |

## 7. 验收记录

### 7.1 总览（2026-10-28）

| 检查 | 命令 | 结果 |
|---|---|---|
| 快照 | `parity` | 3039 行 PASS |
| 源码指纹 | `fingerprint` | 17 文件 PASS（新增 2、迁移 1、变化 5） |
| 单元测试 | `test` | 60 条全绿（原 53 + 端口 7） |
| 构建 | `build` | 155.1 KB pretty |
| 产物等价 | `parity:dist` | 内联脚本 152.0 KB 逐字节一致 |
| 模块冒烟 | `test:smoke` | A–I 全通过 |
| 浏览器验收 | `test:browser` | 7 条全绿，**5 个场景与基线逐字节一致** |

### 7.2 改动面

`parity` 差异逐行读过：移除 85 / 新增 104，全部落在

- `SFX.x()` → `world.ports.sound('x')`（29 处调用）；
- `world.parts/decals/shake/flash/waveText/nightHint/groanTimer` → `world.visual.*`；
- `createWorld` 的 `ports / visual / unlocked / unlockAll` 初始值；
- `applyCoffee(world, p)` 与 `main.js` 的端口适配器、初始进度注入。

指纹变化：新增 `core/ports.js`、`platform/persist.js`；内容变化 `entities / particles / sim / world / main`。

静态检查已固化为测试：`src/core/**` 不出现 `SFX`、`audio/sfx`、`localStorage` 或 `persist` 导入；
核心发出的 21 个声音名全部能在 `SFX` 上找到同名方法。

### 7.3 端口测试与红灯

新增 `tests/ports.test.mjs` 7 条，覆盖发声时机、无效咖啡豆、存档次数与 A/B 端口隔离。
红灯验证：临时删掉胜利分支的 `world.ports.saveProgress(...)`，端口3 立刻失败（6 通过 / 1 失败）；
恢复后 `sim.js` 的 sha256 与突变前一致，7 条重新全绿。

### 7.4 轨迹零变化

本轮**没有更新任何轨迹文件**：`menu`、`select-l3`、`quiz-l3`、`play-day-l1`、`play-night-l4`
与既有基线逐字节一致。这证明把视觉字段收进 `world.visual`、把声音改走端口，没有改变一帧的
绘制调用顺序、参数、随机消耗或更新次序——包括 `groan()` 在无音频环境里仍消耗同样三次随机数。

### 7.5 方案验收矩阵对照

| 方案 §6 R2 要求 | 本轮的证明 |
|---|---|
| 将 SFX 调用改为同步端口调用 | 核心 29 处全部走 `world.ports.sound`；静态测试禁止回退到直接导入 |
| 浏览器存档迁出核心，装配层注入初始进度和写入回调 | `platform/persist.js` + `createWorld({ unlocked, unlockAll, ports })` |
| 粒子、震屏等收进 `world.visual`，保留一帧中的更新位置 | 7 个字段迁移；轨迹逐字节不变 |
| 不顺便换碰撞、时间步、随机分布、概率阈值或实体排序 | `random-streams` 8 条、`sim-invariants` 11 条原样通过 |

### 7.6 仍未完成（R3 及以后）

- ~~`mouse / hoverCell / sel / shovel / hotspots` 仍在 world，动作入口未拆（R3）。~~
  已在 [R3 执行计划](重构执行计划-R3.md) 完成：字段移入 `src/ui/state.js`，动作收进 `src/core/actions.js`。
- `main.js` 仍持有 `G` 并直接读写，渲染、输入与循环未搬（R4）。
- 绘制流 `drawRng` 仍是装配层模块常量，未进入 `renderState`（R4）。
- 音频噪声与呻吟音高仍是音频模块局部 `Math.random`（方案 §5.4 允许）。

