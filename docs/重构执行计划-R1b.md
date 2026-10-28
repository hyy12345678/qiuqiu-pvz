# 球球的植物大战僵尸 · R1b 执行计划（世界工厂与实例隔离）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R1 第 2 步、§11。
> 日期：2026-10-28
> 起点：commit `c928bae`（R1a：显式 world 参数）
> 本轮范围：**完整 R1b**——引入 `createWorld()`，移除模块级 `G`，补 A/B 实例隔离测试。
> 状态：见文末进度表；每完成一项就更新。

## 1. 决策记录

| 日期 | 决策 | 说明 |
|---|---|---|
| 2026-10-28 | 完整 R1b（用户确认） | 工厂 + 移除单例 + A/B 隔离测试一起做，R1 到此收口。 |
| 2026-10-28 | `createWorld(init)` 支持注入初始进度 | `unlocked` / `unlockAll` 可由装配层或测试传入，缺省仍读 `persist`；R2 再把存档端口化。 |
| 2026-10-28 | 声音/存档 `ports` 不做 | 方案 R1 提到“预留”，但真正的端口调用属于 R2；本轮只做世界实例，避免一次改两件事。 |
| 2026-10-28 | 绘制与随机顺序保持原样 | 工厂只换持有方式，不改 `Math.random` 调用次序与绘制路径。 |

## 2. 本轮明确不做

- 不改 `G` 的字段、嵌套结构、初始化值（除 `unlocked/unlockAll` 可注入外）。
- 不改 `beginPlay` 的关卡推进、出怪、夜战补偿、蘑菇打盹等规则。
- 不拆随机流，不改 SFX 的调用方式与时机，不引入 `ports`。
- 不搬渲染、输入、循环；`main.js` 仍直接读写自己的实例。
- 不改任何游戏数值、关卡数据、UI 与触屏行为。
- 不为通过检查扩大忽略规则。

## 3. 工作项与验收

### W1 世界工厂

- `core/world.js` 新增 `createWorld(init = {})`，返回完整初始状态对象；`unlocked/unlockAll` 缺省仍读 `persist`。
- 删除 `export const G`。
- 状态机函数显式接收实例：`startLevel(world, li)`、`toggleUnlockAll(world)`、`beginPlay(world, startSun)`、`startQuiz(world)`、`answerQuiz(world, a)`、`updateQuiz(world, dt)`；`updateQuiz` 内部调用同样传实例。

**验收**：`src/core/**` 内不再存在模块级世界实例；`grep -n "export const G" src/core/world.js` 无结果。

### W2 装配层与测试迁移

- `main.js`：`const G = createWorld();` 由装配层持有；所有世界函数调用传 `G`。
- `headless_test.js`：A–I 驱动中 `startLevel / beginPlay / startQuiz / answerQuiz` 传 `G`。
- `tests/sim-invariants.test.mjs`：改用 `createWorld()` 创建实例，`beginPlay` 等调用传实例。
- 所有调用点显式传参，不保留 `world = G` 之类的默认值。

**验收**：`npm test` 全绿；`test:smoke` A–I 原样通过。

### W3 A/B 实例隔离测试

新增 `tests/world-isolation.test.mjs`，覆盖方案 R1 的四条：

1. 两个世界的 `grid / plants / zombies / peas / suns / mowers / parts / decals / events / slots / quiz` 互不共享（对象与行数组都不同一）。
2. 在 A 种植、扣阳光、伤害僵尸，B 的对应字段完全不变；`beginPlay` 只重建调用方。
3. A、B 交错推进：各自的僵尸只按自己的状态移动，粒子和击杀计数不串写。
4. A 重开关卡后不保留旧局实体引用（数组换新、旧植物不在新 `grid/plants` 里），B 不受影响；通关解锁只改自己的 `unlocked`。

**验收**：测试红灯可复现——临时让 `createWorld` 复用同一数组或让 `beginPlay` 写入另一个世界，测试必须失败。

### W4 重新盖章与全链验收

1. `npm run parity` 差异逐行审计：只允许签名、`G → world`、`export const G` 变 `createWorld` 相关行。
2. `parity:rebase` + `fingerprint:update`。
3. **绘制轨迹不更新**：5 个场景必须与 R1a 基线逐行一致。
4. `npm run verify` 全绿。

### W5 文档收口

- 本文件进度表与验收记录。
- `docs/测试基线.md` 追加 R1b 记录：R1 完成标准、隔离测试覆盖、仍未端口化的副作用。

## 4. 各类检查在 R1b 分别证明什么

| 检查 | 证明 | 不证明 |
|---|---|---|
| `world-isolation` 测试 | 核心操作可显式选择世界、内存状态不共享 | 随机轨迹与外部副作用独立（R2） |
| `parity` 差异审计 | 改动面只含工厂与传参 | 语义等价 |
| `test:browser` 绘制轨迹 | 装配层换持有方式后画面不变 | 音频、真机 |
| `test:smoke` A–I | 单实例玩法规则不变 | 多实例并发完整玩法 |
| `verify` | 上述检查串成一条命令 | 跑得快 |

R1 完成标准「核心操作均能显式选择世界，原不变量与直接 import 测试通过」由 `world-isolation` + `sim-invariants` 共同覆盖。

## 5. 进度表

| 项 | 内容 | 状态 |
|---|---|---|
| W0 | 计划落盘 | 完成（2026-10-28） |
| W1 | 世界工厂 | 完成（2026-10-28） |
| W2 | 装配层与测试迁移 | 完成（2026-10-28） |
| W3 | A/B 隔离测试 | 完成（2026-10-28） |
| W4 | 重新盖章与全链验收 | 完成（2026-10-28） |
| W5 | 文档收口 | 完成（2026-10-28） |

**R1b 结论**：`createWorld()` 取代模块级 `G`，装配层持有实例，核心模块全部显式接收；A/B 隔离测试 8 条覆盖容器、种植、击杀、交错推进、重开引用与进度。R1 到此完成（`ports` 留给 R2）。

## 6. 验收记录

### 6.1 总览（2026-10-28）

`npm run verify` 全链通过：

| 步骤 | 命令 | 结果 |
|---|---|---|
| 行内容快照 | `parity` | 3011 行（重新盖章后逐行一致） |
| 严格指纹 | `fingerprint` | 16 文件；本次「变化 2 / 新增 0 / 缺失 0」——`world.js`、`main.js` |
| 单元测试 | `test` | **45 条**全绿（原 37 + 新增 8 条隔离） |
| 构建 | `build` | 152.4 KB pretty |
| 产物等价 | `parity:dist` | 内联脚本 149.4 KB 逐字节一致 |
| 模块冒烟 | `test:smoke` | A–I 全通过 |
| 浏览器验收 | `test:browser` | 7 条全绿；**5 个绘制场景未更新基线即通过** |

### 6.2 改动审计

逐行脚本（删除 `G` / `world` / 逗号 / 空白后比较）覆盖 `src/`、`headless_test.js`、`tests/sim-invariants.test.mjs`：

- 46 个 hunk、71 对改动行，代码侧全部只是 `G ↔ world` 与首参插入。
- 结构改动只有三处：`world.js` 的工厂块（对象字面量包进 `createWorld`）、`main.js` 与单测的 import、以及 `main.js` 新增的 `const G = createWorld()`。
- 注释改动 2 行（`world.js` 头部）。
- 快照行数 3008 → 3011（工厂多出 `return {` / `};` / `}` 三行），重新盖章记录「移除 45 / 新增 48」。

### 6.3 隔离测试与一次失败的方法论修正

新增 `tests/world-isolation.test.mjs`，8 条覆盖：

1. 工厂返回的初始容器互不共享（不依赖 `beginPlay` 重建）。
2. `beginPlay` 后 `grid` 顶层与每一行、全部数组、`mouse` 都不同一。
3. A 种植只扣 A 的阳光、只写 A 的格子与粒子。
4. A 击杀只改 A 的 `killed`。
5. A/B 交错推进：各按自身速度移动，扬尘粒子只进各自数组（用集合记录整个过程中出现过的粒子对象）。
6. 重开关卡换新容器，旧植物不残留，B 不受影响。
7. 卡槽、题目、关卡状态独立；答错只影响 A。
8. 通关解锁只改自己的 `unlocked`；`createWorld({unlocked, unlockAll})` 可注入初始进度。

**“红灯可复现”验证抓到了测试自身的漏洞**：第一次把 `plants` 改成两个世界共享的模块级数组，8 条测试全绿——因为所有断言都发生在 `beginPlay` 之后，而 `beginPlay` 会重建 `plants`。补上「隔离0：工厂返回的初始容器」后，同样的突变立刻失败；恢复源码（sha256 与突变前一致）后重新全绿。

### 6.4 关键证据：绘制轨迹零差异

构建新产物后不设 `UPDATE_TRACE` 直接跑浏览器测试：5 个绘制场景与 R1a 基线逐行一致，发布冒烟（桌面 + 触屏）通过。说明“换持有方式”没有触碰渲染路径。

### 6.5 R1 完成标准对照

| 方案要求 | 证据 |
|---|---|
| 核心操作显式选择世界 | `entities / particles / sim / world` 全部首参 `world`；`particles.js`、`sim.js` 不 import 世界模块 |
| 原不变量通过 | `tests/sim-invariants.test.mjs` 11 条全绿 |
| 直接 import 测试 | 隔离测试直接 `import` 工厂与实体函数，不经过打包 |
| A/B 两世界隔离 | `tests/world-isolation.test.mjs` 8 条 |
| 重开后不保留旧局引用 | 隔离5 |

### 6.6 仍未完成（R2 及以后）

- **`ports` 未做**：SFX 仍是模块导入，存档仍直接读写 `localStorage`；两个世界共享同一套外部副作用。方案 §6 R1 要求的“预留”留到 R2 一并端口化。
- 随机流未拆分：两个实例仍共用 `Math.random`，R1 只承诺内存隔离，不承诺随机轨迹独立。
- `main.js` 仍直接读写自己的 `G`，渲染与输入未搬。
- `beginPlay` 会在 `parts` 等字段上赋新数组，这是既有行为；隔离测试已把“重开换新容器”固定为预期。
