# E12 执行计划（`scripts/inline.js` 单元测试）

> 日期：2026-11-20
> 上游依据：[护栏评估 E8](护栏评估-E8-parity与legacy去留.md) §3 的观察、
> 以及分析报告 §7.5「测试覆盖分布」里没被点到的空白。
> 本轮性质：**补测试**。`src/**` 与 `scripts/**` 的行为零改动。

## 1. 为什么盯上这一段

`scripts/inline.js` 决定**产物会不会被写坏**，而它此前**零测试覆盖**——
`grep -rln 'inline' tests/` 的结果是空。

它做的事情是：把 esbuild 的 bundle 文本塞进 `src/shell.html` 的 `__BUNDLE__` 占位符。
中间有三处极易出错的转义：

| 位置 | 不转义的后果 |
|---|---|
| `</script` → `<\/script` | 提前闭合标签，页面结构崩掉 |
| U+2028 / U+2029 → `\u2028` | 它们是合法 JS 行终止符，会截断字符串字面量 |
| 函数式 `replace` | 退化成字符串替换时，`$&` 会被展开成占位符本身 |

**失败模式特别恶心**：产物在浏览器里表现为「页面能打开但游戏不启动」，而 `npm run build`
照样报成功、退出码 0。之前唯一能发现它的是浏览器套件——但那要等 26 秒的 Playwright 起停。

## 2. 写了什么

`tests/inline.test.mjs`，9 条纯函数级测试（不起浏览器、不写 `dist/`）：

| # | 断言 |
|---|---|
| 1 | `</script` 大小写各种写法都被转义，且转义后 JS 取值不变 |
| 2 | U+2028 / U+2029 被转成转义序列，产物里不再含这两个字符 |
| 3 | 刁钻输入（含 `</script><script>alert(1)</script>`）转义后仍可编译 |
| 4 | `assertCompiles` 对坏语法报错，且消息里说明「产物未写出」 |
| 5 | `assertOffline` 拒绝 `src`/`href` 外部引用，放行 `href="#help"` |
| 6 | `assertOffline` 拒绝 `fetch` / `XMLHttpRequest` / `WebSocket` / `importScripts` |
| 7 | `inlineBundle` 注入戳与脚本，不残留占位符，canvas 存在 |
| 8 | bundle 内含 `</script>` 时，整个产物只有 shell 自己那一个闭合标签 |
| 9 | 注入走函数式替换，`$&` / `$1` / `$$` 不被展开 |

## 3. 变异验证（证明这些测试真的有效）

测试通过不代表测试有效。做了两次**真实变异**，每次都还原：

| 变异 | 结果 |
|---|---|
| 去掉 `escapeForInline` 里的 U+2028/U+2029 替换 | **9 条里挂 1 条** |
| 把 `assertOffline` 的 `if (net) throw` 改成 `if (false) throw` | **9 条里挂 1 条** |
| 还原后 | **9/9 通过**，`git status` 显示 `scripts/inline.js` 与 HEAD 一致 |

## 4. 验收

| 项 | 结果 |
|---|---|
| `npm test` | **189 / 189**（180 + 9） |
| `npm run verify` | **exit 0** |
| `test:inventory` | 下限 191 条 / 当前 191 条 / 31 个文件，**PASS** |
| `parity` | 3505 / 3505（`src/**` 未动） |
| `fingerprint` | 源码 39/39 无变化；护栏工具 9/9，**变化 1 个**（`test-inventory.json` 下限从 182 升到 191） |
| `dist` | 172.3 KB，**未变** |

## 5. 一个顺带观察

这一轮也顺带验证了 E9 的清单机制会不会误伤：新增一个测试文件后，
`test-inventory` 报的是「新增测试文件（未登记，不影响下限）」并**直接通过**，
只有我主动跑 `--update` 才把它登记进去。下限语义按设计工作。

## 6. 遗留

- `scripts/build.js` / `dev.js` / `esbuild-opts.js` 仍无直接测试。
  但它们要么是薄封装、要么已经被 `parity:dist`（用同一份 `esbuildOpts` 重新打包并与产物逐字节比对）
  间接覆盖，风险远低于 `inline.js` 的手写转义。
- `writeDist` 未测：它会往 `dist/` 写文件，测试里做这件事会污染工作区，
  而它本身只有 `mkdirSync` + `writeFileSync` 两行。判断为不测。
