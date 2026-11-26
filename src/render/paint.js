// 路径与描边的公共画法：只读当前 target，不接触世界状态。
import { ctx } from './target.js';

// 「圆角」矩形路径——方块风里改成切角：四个角各削掉一个小台阶，像像素画里的按钮和面板。
// 调用方仍按圆角半径传 r，这里换算成台阶大小（最多 4 像素），所有界面元素一起变成方块风。
export function rr(x, y, w, h, r){
  const n = Math.max(0, Math.min(4, Math.round(r * 0.35), w / 4, h / 4));
  ctx.beginPath();
  if(n < 1){ ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + n, y);
  ctx.lineTo(x + w - n, y); ctx.lineTo(x + w - n, y + n); ctx.lineTo(x + w, y + n);
  ctx.lineTo(x + w, y + h - n); ctx.lineTo(x + w - n, y + h - n); ctx.lineTo(x + w - n, y + h);
  ctx.lineTo(x + n, y + h); ctx.lineTo(x + n, y + h - n); ctx.lineTo(x, y + h - n);
  ctx.lineTo(x, y + n); ctx.lineTo(x + n, y + n);
  ctx.closePath();
}
export function O(fill, stroke, lw){ // 填充+描边当前路径
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw||2.5; ctx.lineJoin='miter'; ctx.lineCap='butt'; ctx.stroke(); }
}
export const UI_FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
export function drawText(text, x, y, size, fill, stroke, sw, align, weight){
  ctx.font = (weight||'900') + ' ' + size + 'px ' + UI_FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if(stroke){ ctx.lineWidth = sw||4; ctx.strokeStyle = stroke; ctx.lineJoin='round'; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
