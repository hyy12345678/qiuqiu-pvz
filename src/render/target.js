// 渲染目标：ctx 以 live binding 导出，绘制模块继续写裸 ctx；
// 只有 bindCanvas 与 withTarget 改它，且 withTarget 必须同步使用。

import { W, H } from '../core/constants.js';

export let ctx = null;
export let DPR = 1;

// 设备能提供的像素密度，上限 2。超过 2 倍对这类程序化绘制没有可见收益，只增内存与填充率。
export const MAX_DPR = 2;

export function preferredDPR(windowLike = globalThis.window){
  const raw = (windowLike && windowLike.devicePixelRatio) || 1;
  return Math.min(MAX_DPR, raw);
}

// E26：绑定画布。注意 canvas.width 赋值不只是「改尺寸」——它会清空全部内容、重置 ctx 的
// 状态与变换矩阵（实测 fillStyle 回到 #000、scale 回到 1）。所以重新绑定之后任何
// 依赖 ctx 状态的缓存都必须失效，离屏位图也必须按新 DPR 重画。
export function bindCanvas(canvas, dpr = preferredDPR()){
  DPR = dpr;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

// 运行期把窗口拖到另一块屏幕时 devicePixelRatio 会变，但 resize 事件不会触发（尺寸没变），
// 于是背板仍是旧 DPR 的像素数，被浏览器放大显示——整幅画面发糊，且要等刷新才恢复。
// 每帧以 devicePixelRatio 为准比对一次：读一个已被引擎缓存的数字，开销可忽略；
// 相比 matchMedia 试探，它天然覆盖任何触发路径（换屏、浏览器缩放、系统改缩放比例），
// 也不会漏掉「忘了为新 DPR 重建监听器」这类边界。
// 返回 true 表示这一帧发生了重建，调用方据此跳过本帧绘制（内容已被清空）。
export function syncCanvasDPR(canvas, windowLike = globalThis.window){
  const want = preferredDPR(windowLike);
  if(want === DPR) return false;
  bindCanvas(canvas, want);
  return true;
}

export function withTarget(next, fn){
  const prev = ctx;
  ctx = next;
  try { return fn(); }
  finally { ctx = prev; }
}
