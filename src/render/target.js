// 渲染目标：ctx 以 live binding 导出，绘制模块继续写裸 ctx；
// 只有 bindCanvas 与 withTarget 改它，且 withTarget 必须同步使用。

import { W, H } from '../core/constants.js';

export let ctx = null;
export let DPR = 1;

export function bindCanvas(canvas, dpr = Math.min(2, (globalThis.window && globalThis.window.devicePixelRatio) || 1)){
  DPR = dpr;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

export function withTarget(next, fn){
  const prev = ctx;
  ctx = next;
  try { return fn(); }
  finally { ctx = prev; }
}
