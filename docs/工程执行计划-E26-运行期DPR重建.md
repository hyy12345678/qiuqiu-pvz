# E26 执行计划（运行期换屏后按新 DPR 重建背板）

> 日期：2026-11-25
> 起因：E25 收尾时记下的已知边界——运行期 `devicePixelRatio` 变化后画布不会重建。
> 性质：**渲染正确性修复**——不改玩法、不改数值、不改画面内容。

## 1. 问题可以精确测量

| 状态 | 背板 | ctx 变换 | 结果 |
|---|---|---|---|
| DPR 1 → 2（改前） | 1024×640（不变） | 1（不变） | 1 倍图被放大一倍显示 |
| DPR 1 → 2（改后） | 2048×1280 | 2 | 按设备像素渲染 |

**不是某个元素糊，是全部。** 而且不会自己恢复，要等页面刷新。

## 2. 根因

`bindCanvas` 只在 document ready 时调一次，且没有任何监听。

这里有一个容易踩的坑：**换屏（把窗口拖到另一块像素密度不同的屏幕）不会触发 `resize` 事件**，
因为 CSS 尺寸没变。所以「监听 resize」这个直觉解法是无效的。

## 3. 选型：为什么不用 matchMedia

`matchMedia('(resolution: Xdppx)')` 是教科书解法，但它要为每个 DPR 值重建监听器，
奇数值和老浏览器都有边界，且「忘了为新 DPR 重建监听器」这类 bug 很难测。

选了更笨但**不可能漏**的路：每帧比对一次 `devicePixelRatio`，值变了才重建。

| 维度 | matchMedia | 每帧比对（采用） |
|---|---|---|
| 开销 | 零 | 读一个引擎已缓存的数字 |
| 触发覆盖 | 需正确重建监听器 | 任何路径都走同一条 |
| 测试难度 | 需要模拟监听器生命周期 | 直接调函数 |
| 漏判风险 | 边界情况多 | 几乎为零 |

## 4. 实现

```js
export function syncCanvasDPR(canvas, windowLike = globalThis.window){
  const want = preferredDPR(windowLike);
  if(want === DPR) return false;
  bindCanvas(canvas, want);
  return true;
}
```

嵌入 `game.js` 的帧循环，作为 `beforeFrame` 钩子，放在 `try` 的**第一行**。

### 一个必须处理的隐患

给 `canvas.width` 赋值不只是改尺寸——**它会清空内容并重置 ctx 的全部状态与变换**。
实测：`fillStyle` 回到 `#000`、`scale` 回到 `1`。

所以重建时必须同时重新 `ctx.scale`，否则坐标系统整体错位。测试里钉住了这一条。

### 为什么钩子放在 try 里而不是 finally

重建必须发生在绘制之前（否则这一帧画在旧背板上），但也要**独立于模拟是否出错**。
否则一次 `updatePlay` 异常会让画面永远停在旧 DPR 上。

测试用 `world.events = null` 制造了一个真实的模拟异常，断言：
`beforeFrame` 已执行、`render` 未执行、rAF 链未断。

## 5. 背景缓存

E25 已把缓存键改成 `(主题, DPR)`，所以重建后自动重画，不需要额外接线。

## 6. 验证分两层

DPR 变化在 Playwright 里无法通过「假装换屏」真实触发，所以：

| 层 | 覆盖 | 位置 |
|---|---|---|
| 单测 | 重建逻辑本身（含夹取到 2 倍上限、缺失 window 的退化） | `tests/render-target.test.mjs` |
| 浏览器冒烟 | CDP 改 DPR 后等下一帧，断言背板 2048×1280、变换 2、画面非空白 | `tests/browser/release-smoke.test.mjs` |

## 7. 验收

| 项 | 结果 |
|---|---|
| `npm run verify` | exit 0 |
| `npm test` | 209 条 / 0 fail |
| `npm run test:browser` | 6/6 |
| `parity` | 3820 行 |
| 产物 | 188.2 KB，戳 `src e551e4ae` |
| GitHub CI | run `45557639183` success |

## 8. 踩到的坑（记录给后来人）

第一次跑 `verify` 失败在「未登记的护栏工具变化」。原因是 `test:inventory:update` 会改写
`test-inventory.json`，而它排在 `fingerprint:update` **之后**——顺序错了，指纹没被更新。

这恰好证明 `tool-fingerprint` 那道门是有效的：**它拦住了护栏维护者自己**。
正确顺序是：先 `test:inventory:update`，再 `fingerprint:update`。

## 9. 仍未处理

`MAX_DPR = 2` 是全局硬编码，现已通过 `preferredDPR` 导出。
若将来要在 3 倍屏上提高清晰度，改一个常量即可，但需重新评估内存与填充率。
这个数字没有测试钉住，因为它是**产品取舍**，不是正确性问题。