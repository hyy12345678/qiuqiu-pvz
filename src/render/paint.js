// 路径与描边的公共画法：只读当前 target，不接触世界状态。

import { ctx } from './target.js';

export function rr(x,y,w,h,r){ // 圆角矩形路径
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
export function O(fill, stroke, lw){ // 填充+描边当前路径
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw||2.5; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke(); }
}
export function drawText(text, x, y, size, fill, stroke, sw, align, weight){
  ctx.font = (weight||'900') + ' ' + size + 'px "PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if(stroke){ ctx.lineWidth = sw||4; ctx.strokeStyle = stroke; ctx.lineJoin='round'; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
