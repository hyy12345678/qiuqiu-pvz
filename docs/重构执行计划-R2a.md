# 球球的植物大战僵尸 · R2a 执行计划（随机源分流）

> 依据：[重构方案 v0.2](重构方案-v0.2.md) §5.4、§6 R2。
> 日期：2026-10-28
> 起点：commit `af6b075`（R1b 收口）
> 本轮范围：**只做 R2a**——随机调用分类、战斗流 / 表现流分离、战斗投影矩阵、新轨迹基线。`ports`、`world.visual` 留给 R2b。
> 状态：见文末进度表；每完成一项就更新。

## 1. 决策记录

| 日期 | 决策 | 说明 |
|---|---|---|
| 2026-10-28 | 先做 R2a，不并 R2b | 随机分流是 R2 里唯一会改变轨迹的部分，单独一轮便于把“新基线为什么变”讲清楚。 |
| 2026-10-28 | 这是有意的轨迹变化 | 方案 §6 R2 明确不要求仍在第 14 发生成导弹；保留概率规则，换取表现独立性。新基线需单独批准。 |
| 2026-10-28 | `rand/randi` 改为显式 `rng` 首参 | 不保留默认 `Math.random`，避免“以为分流了、其实还在走全局源”。`waves/quiz` 已有的注入参数继续保留。 |
| 2026-10-28 | 种子派生规则固定 | `createWorld({seed})` 用固定常量异或派生 `fxRng`；不依赖创建顺序或调用次数。 |
| 2026-10-28 | 音频随机暂留局部 `Math.random` | 方案 §5.4 允许音频模块局部随机源；真正端口化属于 R2b，本轮只保证它不碰战斗流。 |
| 2026-10-28 | 本轮不改 `G` 字段结构 | `world.rng / world.fxRng / world.seed` 是新增字段；粒子数组、`shake` 等仍在原位置，R2b 再收进 `world.visual`。 |

## 2. 本轮明确不做

- 不做 SFX 同步端口、不做存档注入（R2b）。
- 不把粒子 / 震屏 / 闪光收进 `world.visual`（R2b）。
- 不改碰撞、时间步、随机分布区间、概率阈值、实体排序与阶段顺序。
- 不搬渲染、输入、循环；`main.js` 只增加装配种子与绘制流。
- 不改游戏数值、关卡数据、UI 与触屏行为。

## 3. 随机调用分类

分类原则来自方案 §5.4：影响实体、资源、计时、事件与胜负的进 `world.rng`；粒子、动画初相、表现计时进 `world.fxRng`；震屏等纯绘制抽样进装配层绘制流；音频噪声与音色扰动留在音频模块内部。

### 3.1 战斗流 `world.rng`

| 位置 | 调用 | 为什么是战斗 |
|---|---|---|
| `world.js beginPlay` | `buildSpawns(lv, world.rng)` | 出怪时刻、种类与批量 |
| `world.js startQuiz` | `makeQuiz(world.rng)` | 题目影响开局阳光 |
| `entities.js placePlant` | `fireT`、`sunT` 初值 | 首次射击 / 首次产阳光的时刻 |
| `entities.js spawnZombie` | 行、连续同行重掷、`x` 偏移、速度扰动 | 决定走向与到达时间 |
| `entities.js damageZombie` | 报纸狂暴后的速度 | 影响移动 |
| `sim.js` 天降阳光 | `skyTimer` 间隔 | 资源到账时刻 |
| `sim.js` 阳光落点 | 天降与向日葵 / 阳光菇的 `x/ty` | 落点决定落地时刻、可见位置与可点击目标 |
| `sim.js` 向日葵 / 阳光菇 | `p.sunT` 间隔 | 资源到账时刻 |
| `sim.js` 球球 | `Math.random() < 0.15` | 导弹概率 |
| `sim.js` 撑杆落地 | 落地后速度 | 影响移动 |

### 3.2 表现流 `world.fxRng`

| 位置 | 调用 |
|---|---|
| `entities.js placePlant` | 动画初相 `phase` |
| `entities.js spawnZombie` | `animT` 初相 |
| `entities.js explode / explodeMissile` | 全部粒子参数 |
| `sim.js` 火豌豆尾焰 | `0.6` 判定与粒子参数 |
| `sim.js` 僵尸脚步扬尘 | 粒子参数 |
| `sim.js` 小推车草屑 | `0.55` 判定与粒子参数 |
| `sim.js` 呻吟计时 | `groanTimer` 重排（表现计时，方案 §6 点 1 明列） |
| `particles.js` | 全部五个 `add*` |

> 阳光落点最初被划进表现流，矩阵测试第一轮就抓到了：落点改变下落时长，进而改变阳光进入 `idle` 与自然消失的时刻。它属于战斗可见状态，已归回 `world.rng`。

### 3.3 绘制流与音频局部源

| 位置 | 处理 |
|---|---|
| `main.js` 震屏 `ctx.translate` | 装配层 `drawRng`（`renderState.rng` 的前身），不碰 `world.fxRng` |
| `main.js` 背景缓存 | 已有固定种子 `mulberry32(20260814)`，不动 |
| `sfx.js` 噪声缓冲、呻吟音高 | 音频模块局部 `Math.random`；R2b 端口化时保持“只进音频” |

## 4. 工作项与验收

### W1 分流基础设施

- `core/util.js`：`rand(rng, a, b)`、`randi(rng, a, b)`，不设默认随机源。
- `core/world.js`：`createWorld({ seed, rng, fxRng, ... })`；缺省用 `Math.random` 取一次种子，`rng = mulberry32(seed)`、`fxRng = mulberry32(seed ^ 0x9E3779B9)`；`world.seed` 仅作溯源。
- `main.js`：装配层生成 `SEED` 并传入 `createWorld`；`drawRng = mulberry32(SEED ^ 0x51ED270B)`。

**验收**：`grep -rn "Math\.random" src/core` 只剩 `rng.js` 的种子辅助与 `quiz/waves` 的默认参数；`createWorld()` 不给 `rng` 时两条流也互不相同。

### W2 调用点迁移

- `sim.js / entities.js / particles.js / world.js` 按 §3 改传 `world.rng` 或 `world.fxRng`。
- `sfx.js` 改为 `rand(Math.random, ...)` 形式，明确它读的是音频局部源。
- `main.js` 震屏改用 `drawRng`。

**验收**：`npm test` 原 45 条全绿（含 11 条行为不变量 + 8 条隔离）。

### W3 战斗投影矩阵

新增 `tests/battle-projection.mjs`（辅助）与 `tests/random-streams.test.mjs`：

1. **投影定义**：实体数组顺序、生命/护甲/位置/状态、影响未来逻辑的计时（`fireT/sunT/armT/vt/eatT/deathT/life`）、弹丸、阳光到账、卡槽冷却、事件游标、资源与胜负；排除 `phase/animT/recoil/flash/dustT/shake/parts/decals`。
2. **矩阵**：同一 seed 与动作/dt 序列下，对比
   - 正常推进；
   - 每帧额外消耗表现流（模拟多画几次）；
   - 表现流换成常量 + 每帧清空粒子（模拟禁用表现）；
   - 音频路径不可用与 `Math.random` 被换成另一条流（模拟不同音频随机）；
   - A 单独运行 与 A/B 交错运行。
   战斗投影必须逐字段相等。
3. **概率边界**：把 `world.rng` 换成受控序列，`0.149` 出导弹、`0.151` 出子弹。
4. **分布与节奏**：固定多 seed 下导弹比例落在宽松区间；`buildSpawns` 在注入同一 `world.rng` 时逐事件相同。

**验收**：测试红灯可复现——临时让某一战斗调用改读 `fxRng`，矩阵必须失败。

### W4 重新盖章与全链验收

1. `npm run parity` 差异逐行审计：只允许 `rand/randi` 首参、流名、工厂种子派生、`beginPlay/startQuiz` 注入、震屏绘制流。
2. `parity:rebase` + `fingerprint:update`。
3. **轨迹基线需要更新**：先不设 `UPDATE_TRACE` 跑一次，记录哪些场景变化，再逐场景解释（题目文本、随机落点等）后更新。
4. `npm run verify` 全绿。

### W5 文档收口

- 本文件进度表与验收记录。
- `docs/测试基线.md` 追加 R2a 记录：分流分类、矩阵覆盖、基线变化原因。
- R1b 文档的“R2 见”指向本文件。

## 5. 各类检查在 R2a 分别证明什么

| 检查 | 证明 | 不证明 |
|---|---|---|
| `random-streams` 矩阵 | 绘制 / 粒子 / 音频不再改变战斗投影 | 真实浏览器里渲染路径没有副作用（轨迹基线补） |
| 15% 边界与多 seed | 概率规则未被顺手改掉 | 严格概率分布证明 |
| parity 差异审计 | 改动面只含随机调用 | 语义正确 |
| 绘制轨迹新基线 | 视觉变化被看见并批准 | 视觉更好 |
| 隔离测试 | A/B 内存与随机轨迹独立 | 外部副作用独立（R2b） |

## 6. 进度表

| 工作项 | 状态 | 证据 |
|---|---|---|
| W1 分流基础设施 | 完成 | `createWorld({seed/rng/fxRng})`；`rand/randi` 首参 rng |
| W2 调用点迁移 | 完成 | 8 个源码文件；`npm test` 45 条原样通过 |
| W3 战斗投影矩阵 | 完成 | 新增 8 条；两次突变均红灯 |
| W4 重新盖章与全链验收 | 完成 | parity 3020 行、指纹 16 文件、`verify` 全绿 |
| W5 文档收口 | 进行中 | 本节 |

## 7. 验收记录

### 7.1 总览（2026-10-28）

| 检查 | 命令 | 结果 |
|---|---|---|
| 快照 | `parity` | 3020 行 PASS |
| 源码指纹 | `fingerprint` | 16 文件 PASS（本轮变化 8） |
| 单元测试 | `test` | 53 条全绿（原 45 + 矩阵 8） |
| 构建 | `build` | 153.9 KB pretty |
| 产物等价 | `parity:dist` | 内联脚本 150.9 KB 逐字节一致 |
| 模块冒烟 | `test:smoke` | A–I 全通过 |
| 浏览器验收 | `test:browser` | 7 条全绿（3 个场景换新基线） |

### 7.2 改动面

`parity` 差异逐行读过：移除 46 / 新增 55，全部落在

- `rand/randi` 首参与流名（`world.rng` / `world.fxRng` / `Math.random` 音频局部源）；
- `createWorld` 的 `seed / rng / fxRng` 与装配层 `SEED / drawRng`；
- `beginPlay` 注入 `world.rng`、`startQuiz` 注入 `world.rng`；
- 震屏改读 `drawRng`。

指纹变化 8 个文件：`rng / util / world / entities / particles / sim / sfx / main`。

### 7.3 矩阵测试与两次红灯

新增 `tests/battle-projection.mjs`（投影定义）与 `tests/random-streams.test.mjs`（8 条）。矩阵场景在 1800 帧内跑天降阳光、射击、导弹、出怪、啃食与粒子，并钉一只打不死的僵尸保证球球每 0.4 秒做一次 15% 判定。

第一次跑矩阵时，**“额外消耗表现流”一项失败**：阳光落点原本划进 `fxRng`，落点改变下落时长，进而改变阳光进入 `idle` 与自然消失的时刻。这证明落点属于战斗可见状态，已改回 `world.rng`；该发现写在 §3.2 的注里。

红灯可复现（两次突变，恢复后 sha256 与突变前一致）：

| 突变 | 结果 |
|---|---|
| 导弹判定改读 `world.fxRng()` | 矩阵1、概率边界、分布抽查共 3 条失败 |
| 出怪 `x` 改读全局 `Math.random()` | 矩阵1、矩阵2、矩阵3 共 3 条失败 |

### 7.4 绘制轨迹新基线

| 场景 | 旧行数 | 新行数 | 原因 |
|---|---|---|---|
| menu | 4753 | 4753 | 逐字节未变 |
| select-l3 | 4311 | 4311 | 逐字节未变 |
| quiz-l3 | 3624 | 3624 | 题目改为读 `world.rng`：`38 + 35` → `33 + 45`，选项数值随之变化 |
| play-day-l1 | 2506 | 2647 | 首选项由“正确”变“错误”，战斗提前约 1 秒开始，追踪帧跨过首个天降阳光 |
| play-night-l4 | 2578 | 2579 | 同因提前进战；夜间无天降阳光，只有随机表现位置与渐变编号变化 |

题目的选项位移可用固定种子复算：旧题 `38 + 35` 的正确项在第 0 位，新题 `33 + 45` 的正确项在第 3 位；轨迹脚本点固定坐标，于是答题轮数改变。两张失败现场的截图（日间多出天降阳光、夜间提示条仍在）已人工核对，画面结构正常。

基线连续生成两次，5 个文件 sha256 完全一致；`test:browser` 在比较模式下 7/7 通过。

### 7.5 方案验收矩阵对照

| 方案要求 | 本轮的证明 |
|---|---|
| 绘制一次 / 多次 | 每帧额外消耗表现流，战斗投影一致 |
| 粒子正常 / 禁用 | 表现抽样退化为常量并清空粒子，战斗投影一致 |
| 音频可用 / 不可用 / 不同音频流 | 替换全局 `Math.random` 并消耗之，战斗投影一致 |
| 单独 A / A、B 交错 | A 的投影一致 |
| 15% 概率边界 | `0.149` 导弹、`0.151` 子弹 |
| 不换概率阈值与分布 | 600 发抽查比例落在 10%~21%；波次表同 seed 逐事件一致 |

### 7.6 仍未完成（R2b）

- **真实绘制未在矩阵里跑**：Node 侧按“绘制对世界唯一的随机接触面”建模（消耗 / 替换表现流），真实 Canvas 路径由轨迹基线与 A–I 冒烟兜底；R4 抽出 `render/renderState` 后可补真正的多绘制对比。
- `ports` 未做：SFX 仍是模块导入，存档仍直接读写 `localStorage`；音频随机仍是模块局部 `Math.random`。
- `world.visual` 未做：粒子、焦痕、震屏、闪光、波次文字、呻吟计时仍在原字段。
- 绘制流 `drawRng` 目前是 `main.js` 的模块级常量，尚未进入 `renderState`。
