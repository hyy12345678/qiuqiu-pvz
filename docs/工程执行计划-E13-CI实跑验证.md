# E13 执行计划（CI 首次实跑 + Actions 升 v7）

> 日期：2026-11-20
> 上游依据：[E11](工程执行计划-E11-CI去手抄.md) §5「CI 从未在 GitHub 上真跑过」。
> 本轮性质：**验证 + 一处依赖升级**。`src/**` 零改动。

## 1. 背景

E1 引入 CI、E11 把它改成「跑 `npm run verify`」之后，我一直明确写着**它从未在 GitHub 上真跑过**。
本轮把它验证掉了。

第一步是把之前 15 个提交推上 `origin/main`（`91421e7..dd3110d`），触发首次运行。

## 2. 首次运行：全部通过

```
✓ verify · 44684123232 · success · 1m35s
  ✓ 检出（保留 tag）
  ✓ Node 22
  ✓ 安装依赖（严格按 package-lock.json）
  ✓ 安装 Chromium
  ✓ 全链护栏（等于本地的 npm run verify）
  ✓ 产物必须已提交
  - 上传现场          ← 只在失败时跑，跳过是正确的
```

### 2.1 关键：浏览器轨迹在 Linux 上真的跑了

这是我在 E11 §5 里点名"最可能翻车"的一条。从 CI 日志里取到的证据：

```
绘制基线：menu              ← 出现 2 次（ok 行 + 子测试详情）
绘制基线：select-l3
绘制基线：quiz-l3
绘制基线：play-day-l1
绘制基线：play-night-l4

# tests 7    # pass 7    # fail 0      ← 浏览器套件
# tests 189  # pass 189  # fail 0      ← 单测
ALL TESTS PASSED                        ← A–I 冒烟
PASS —— 与基线逐行一致，无未登记的改动   ← parity
PASS —— 没有未登记的源码变化            ← fingerprint(源码)
PASS —— 没有未登记的护栏工具变化        ← fingerprint(工具)
PASS —— 没有测试被删除或减少            ← test:inventory
PASS —— 产物与当前源码的 …              ← parity:dist
```

**5 条绘制轨迹的基线逐行一致，跨越 macOS arm64 → ubuntu-latest 两个平台。**
这验证了 E7 里那句判断：轨迹记录的是 Canvas 调用与参数，与平台无关。

### 2.2 唯一的警告

```
! Node.js 20 is deprecated. actions/checkout@v4, actions/setup-node@v4
  are being forced to run on Node.js 24
```

## 3. Actions 升 v7

三个 action 的最新 major 都是 v7，且 `action.yml` 里是 `using: node24`：

| action | 原 | 新 | 用到的输入项是否仍在 |
|---|---|---|---|
| `actions/checkout` | v4 | **v7** | `fetch-depth` ✓（action.yml 里仍有定义） |
| `actions/setup-node` | v4 | **v7** | `node-version` / `cache` ✓ |
| `actions/upload-artifact` | v4 | **v7** | `if-no-files-found` / `retention-days` ✓ |

升级前逐个核对过 `action.yml`，不是照着版本号盲跳。

## 4. 升级后复跑

```
✓ verify · 44686715009 · success · 1m8s
  步骤同上全绿；ANNOTATIONS 段为空（警告消失）
```

对比：

| run | 提交 | 结果 | 耗时 | annotation |
|---|---|---|---|---|
| 44684123232 | `dd3110d` | success | 1m35s | Node 20 弃用警告 |
| 44686715009 | `64f0f9a` | success | **1m8s** | **无** |

## 5. 结论

E11 §5 里"仍然没有被验证的部分"三项，本轮全部确认：

| 待确认项 | 结论 |
|---|---|
| `npx playwright install --with-deps chromium` 的耗时与稳定性 | 稳定，整条 job 1~1.5 分钟 |
| 浏览器套件在 GitHub headless 环境是否与 macOS 一致 | **一致**，7/7 |
| 5 条绘制轨迹基线是否跨平台稳定 | **稳定**，逐行一致 |

**CI 不再是"配置好了但没跑过"的状态。**

## 6. 遗留

- `timeout-minutes: 25` 相对实际 1 分钟的耗时严重超配，但作为失控兜底是合理的，不建议收紧。
- 本轮只验证了 push 触发；`pull_request` 触发未实测（当前仓库无 PR 流程）。
