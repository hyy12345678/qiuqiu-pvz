# 球球的植物大战僵尸 · R1a 执行计划（显式 world 参数）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §6 R1 第 1 步、§11。
> 日期：2026-10-28
> 起点：commit `ffa172e`（R0 文档回填）
> 本轮范围：**只做 R1a**——实体、粒子与模拟显式接收 world；不引入世界工厂，不移除模块级 `G`。
> 状态：见文末进度表；每完成一项就更新。

## 1. 决策记录

| 日期 | 决策 | 说明 |
|---|---|---|
| 2026-10-28 | R1 拆两步，本轮只做 R1a | 用户确认：先把调用对象变成显式参数，机械、易审查；R1b（世界工厂）另行决定。 |
| 2026-10-28 | 不使用 `world = G` 默认参数 | 默认值会让漏传悄悄回落到全局单例，等于什么都没证明；所有调用点必须显式传 `G`。 |
| 2026-10-28 | 不在本轮加 `ports` | 方案把声音/存档端口写在 R1 整体里；R1a 只管调用对象，端口留给后续步骤，避免一次改两件事。 |

## 2. 本轮明确不做

- 不建世界工厂，不新增 `createWorld()`，不改 `G` 的字段、嵌套结构或初始化时机。
- 不移除 `G` 作为模块级单例：`world.js` 继续持有它，`main.js` 继续直接读写它。
- 不改随机调用顺序、概率阈值、敌人排序、实体数组增删顺序。
- 不改绘制调用顺序、坐标、配色、字体或 DOM/Canvas 行为。
- 不动音频与存档的调用方式，不把 SFX 变成端口。
- 不改任何游戏数值、关卡数据与 UI。
- 不为通过检查扩大任何忽略规则。

## 3. 工作项与验收

### W1 核心函数显式接收 world

改动面：

- `core/entities.js`：`placePlant / removePlant / spawnSun / explode / explodeMissile / damageZombie / spawnZombie / findEatTarget / triggerMower` 首参改为 `world`；`applyCoffee(p)` 不读世界状态，保持原签名。
- `core/particles.js`：五个 `add*` 首参改为 `world`；文件不再 import `world.js`。
- `core/sim.js`：`updatePlay(world, dt)`；内部所有 `G` 读取改为 `world`，对实体/粒子的调用透传 `world`；文件不再 import `G`。
- `core/world.js`：`isNight(world)`，不再隐式读 `G`。
- `placePlant` 的蘑菇打盹判定改为 `isNight(world)`，与显式世界一致。

**验收**：`grep -n "G" src/core/{entities,particles,sim}.js` 不再出现模块级 `G` 的引用（注释除外）；`particles.js` 与 `sim.js` 无 `world.js` 的 import。

### W2 调用点与单测迁移

- `src/main.js`：`placePlant / removePlant / addLeafBurst / updatePlay` 传 `G`；四处 `isNight()` 改为 `isNight(G)`。
- `headless_test.js`：A–I 驱动里的 `placePlant / spawnZombie / damageZombie` 传 `G`。
- `tests/sim-invariants.test.mjs`：辅助函数 `stepFrames / step / plant` 内传 `G`；直接调用的实体函数补首参。
- 所有调用点显式传参，不依赖默认值。

**验收**：`npm test` 37 条全绿；`test:smoke` A–I 原样通过。

### W3 重新盖章与证据

1. 先看 `npm run parity` 的差异，逐行审计：只允许出现签名行与 `G → world` 相关行；出现任何逻辑/数值变化就停下。
2. 审计通过后 `npm run parity:rebase` 重新盖章。
3. `npm run fingerprint:update` 重写源码指纹。
4. 全链 `npm run verify`。
5. **绘制轨迹基线不更新**：5 个场景必须与 R0 基线逐行一致；若出现差异，说明 R1a 不是纯机械改动，必须回查。

**验收**：`npm run verify` 全绿，且 `test:browser` 在未设置 `UPDATE_TRACE` 的情况下通过；`git diff` 审计结论写入验收记录。

### W4 文档收口

- 本文件进度表与验收记录。
- `docs/测试基线.md` 追加 R1a 记录：改了什么、轨迹为何必须零差异、哪些依赖还没解开。

## 4. 各类检查在 R1a 分别证明什么

| 检查 | 证明 | 不证明 |
|---|---|---|
| `parity` 差异审计 | 行级改动只发生在签名与 `G → world` 引用 | 语义确实没变 |
| `fingerprint` 重新盖章 | 改动范围已登记、可追溯 | 改动正确 |
| `test`（37 条） | 规则与边界未被破坏 | 渲染与完整交付流程 |
| `test:smoke` A–I | 模块源码上的交互与机制未变 | 真实发布页 |
| `test:browser` 绘制轨迹 | 固定条件下绘制调用与 R0 完全一致 | 音频、真机手感 |
| `test:browser` 发布冒烟 | 真实产物仍可启动、交互、持续运行 | 全关卡玩法 |

R1a 的“纯机械”主张由两组证据共同支撑：**轨迹零差异**（绘制没动）与 **A–I 全通过**（规则没动）；parity 只负责把改动面钉在签名上。

## 5. 进度表

| 项 | 内容 | 状态 |
|---|---|---|
| W0 | 计划落盘 | 完成（2026-10-28） |
| W1 | 核心函数显式接收 world | 完成（2026-10-28） |
| W2 | 调用点与单测迁移 | 完成（2026-10-28） |
| W3 | 重新盖章与证据 | 完成（2026-10-28） |
| W4 | 文档收口 | 完成（2026-10-28） |

**R1a 结论**：实体、粒子与模拟已显式接收 world，`particles.js` / `sim.js` 不再 import 世界单例；绘制轨迹与 R0 逐字节一致，A–I 原样通过。世界工厂当时未做（R1b 已补上），`ports` 留给 R2。

## 6. 验收记录

### 6.1 总览（2026-10-28）

`npm run verify` 全链通过：

| 步骤 | 命令 | 结果 |
|---|---|---|
| 行内容快照 | `parity` | 3008 行（重新盖章后逐行一致） |
| 严格指纹 | `fingerprint` | 16 文件；本次重写时记录「变化 5 / 新增 0 / 缺失 0」 |
| 单元测试 | `test` | 37 条全绿 |
| 构建 | `build` | 151.9 KB pretty（R0 为 151.1 KB，增量来自显式参数与调用） |
| 产物等价 | `parity:dist` | 内联脚本 149.0 KB 与当前源码 bundle 逐字节一致 |
| 模块冒烟 | `test:smoke` | A–I 全通过 |
| 浏览器验收 | `test:browser` | 7 条全绿；**5 个绘制场景未更新基线即通过** |

### 6.2 改动审计

`git diff` 覆盖 `src/`、`headless_test.js`、`tests/sim-invariants.test.mjs`，用逐行脚本比较「删除 `G` / `world` / 逗号 / 空白后两侧是否相同」：

- 130 个 hunk、179 对改动行，代码侧全部只是 `G ↔ world` 与首参插入。
- 白名单外的例外只有 5 处，且都是本轮意图：3 行头部/模块注释改写、`particles.js` 与 `sim.js` 各删除一行 `import { G } from './world.js'`。
- 行总数 3008 → 3008，没有新增或丢失语句。

`parity:rebase` 吸收的差异为「移除 144 / 新增 144」，与上述逐行审计一致。

### 6.3 关键证据：绘制轨迹零差异

`npm run build` 后直接 `npm run test:browser`，**没有**设置 `UPDATE_TRACE`：菜单、第 3 关选卡、答题、白天第 1 关、夜间第 4 关五个场景全部与 R0 基线逐行一致；发布冒烟（桌面 + 触屏）同样通过。这是「R1a 只改调用对象、没改行为」最直接的一条证据。

### 6.4 边界与遗留

- `core/world.js` 仍持有模块级 `G`，`isNight(world)` 是 `entities.js` 对世界模块仅剩的依赖（函数，不读状态）。
- 世界工厂、实例隔离（A/B 两世界）与 `ports` 都未做，`R1` 的「创建 A、B 两个世界」测试尚未具备前提。（工厂与隔离已由 R1b 补上，见 [R1b 执行计划](重构执行计划-R1b.md)；`ports` 仍留给 R2。）
- 单测直接传 `G`，为 R1b 迁成独立实例留好入口（R1b 已改为 `createWorld()` 实例）。
- `main.js` 仍直接读写 `G`；渲染与输入未动。
