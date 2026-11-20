# E11 执行计划（CI 去手抄：改跑 `npm run verify`）

> 日期：2026-11-20
> 上游依据：[项目分析](项目分析-2026-11-20.md) §7.3 硬伤 1（无 CI）、[E1](工程执行计划-E1-护栏收口.md) D5。
> 本轮性质：**CI 重构**。`src/**` 零改动。

## 1. 我犯的错

E1 写 CI 时，我把 `verify` 的步骤序列**手抄**进了 `verify.yml`，理由是想让 GitHub 的每个 step 显示独立绿标。

E9 往 `verify` 里加了 `test:inventory` 之后，这份手抄副本立刻过期——CI 不会跑那条检查。
发现它靠的是本轮做 YAML 结构复核时把 13 个 step 逐个列出来看，而不是任何自动检查。

**这就是"文档/配置漂移"的教科书样本：两个地方表达同一件事，迟早会不一致。**

## 2. 决策

**D1 · CI 只跑 `npm run verify` 一条命令，不再手抄步骤。**
手写一份永不漂移的副本是不存在的。代价是 GitHub 上只看到一个 step 的绿标，
但 `npm` 会打印每条子命令的头部，失败时日志仍能定位到具体哪一环。

**D2 · 只有真正 CI 独有的才单独成步。**
`dist:fresh`（要求 dist 已提交，放进本地 verify 会逼着人先提交再验收）与失败时上传现场。

**D3 · 保留 `fetch-depth: 0`。**
`parity:legacy` 不在 `verify` 链里，但保留完整检出深度可以让将来的考古工作不必重新 clone，
代价只是几十 MB 的 fetch。

## 3. 改动

| 文件 | 改动 |
|---|---|
| `.github/workflows/verify.yml` | 13 个手抄步骤 → 7 个（检出 / Node / 依赖 / Chromium / **verify** / dist:fresh / 上传现场） |
| `README.md` | 「CI」一节改写，说明为什么坚持一条命令，并记录这次漂移事故 |

## 4. 验收

### 4.1 结构复核（本轮实际做的）

用 Ruby 的 YAML 解析器读回来核对（本机 Python 无 PyYAML）：

```
steps=7
 1 检出（保留 tag）
 2 Node 22
 3 安装依赖          | npm ci
 4 安装 Chromium     | npx playwright install --with-deps chromium
 5 全链护栏          | npm run verify
 6 产物必须已提交    | npm run dist:fresh
 7 上传现场
```

无 tab（YAML 不允许），`jobs.verify` 结构与 `on/concurrency` 均解析正常。

### 4.2 依赖前提

| 检查 | 结果 |
|---|---|
| `npm ci --dry-run` | **exit 0**，lockfile 与 package.json 同步 |
| lock 里的 Playwright 版本 | **1.64.1**（`playwright install` 会装对应 Chromium） |
| 本地 Node 版本 | v22.23.2，与 workflow 的 `node-version: '22'` 一致 |

### 4.3 全链

| 项 | 结果 |
|---|---|
| `npm run verify` | **exit 0** |
| `npm test` | 180 / 180 |
| `test:inventory` | 182 / 182 PASS |
| 两份 fingerprint + parity + parity:dist | 全 PASS |
| `dist:fresh` | exit 0 |

## 5. 仍然没有被验证的部分

**CI 从未在 GitHub 上真正跑过。** 本轮能证明的只有：YAML 可解析、步骤结构与本地一致、
依赖安装的前置条件成立（lock 同步、Node 版本匹配）。以下三点只有第一次 push 才能确认：

1. `npx playwright install --with-deps chromium` 在 `ubuntu-latest` 上的实际耗时与稳定性；
2. 浏览器套件在 GitHub 的 headless 环境下是否与 macOS 表现一致（字体差异可能影响像素摘要）；
3. `npm run test:browser` 里 5 条绘制轨迹基线是否跨平台稳定——
   **这是最可能翻车的一条**：轨迹记录的是 Canvas 调用与参数，理论上与平台无关，
   但如果断言里隐含了字体/DPR 差异就会红。

第 3 条如果翻车，正确的修法是让轨迹与平台无关（它现在应该已经是），而不是放宽基线。
