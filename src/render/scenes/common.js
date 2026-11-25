// 场景通用按钮：注册热点动作描述并绘制。

import { addHotspot } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';

// 点是否落在矩形内（含边界）。悬停高亮与热点命中必须用同一套判定：
// 两处各写一份时，只要有一处手滑（比如热点给选中态上浮留了 4px 余量、悬停没留），
// 就会出现「点得动但不高亮」或「高亮却点不动」的死区。
export function pointInRect(ui, x, y, w, h){
  const m = ui.mouse;
  return m.x>=x && m.x<=x+w && m.y>=y && m.y<=y+h;
}

// 注册热点并返回同一个矩形上的悬停状态。凡是「可点的矩形区域」都用它，
// 不要自己再写一遍 addHotspot + 悬停判断。
export function hotRect(ui, x, y, w, h, id, action){
  addHotspot(ui, x, y, w, h, id, action);
  return pointInRect(ui, x, y, w, h);
}

export function drawButton(ui, x, y, w, h, label, id, action, opts){
  opts = opts || {};
  const hover = hotRect(ui, x, y, w, h, id, action);
  const disabled = opts.disabled;
  let g = ctx.createLinearGradient(0,y,0,y+h);
  if(disabled){
    g.addColorStop(0,'#6b6b62'); g.addColorStop(1,'#4c4c44');
  } else if(opts.red){
    g.addColorStop(0, hover ? '#d8554a' : '#c04438'); g.addColorStop(1, hover ? '#a83428' : '#8a281e');
  } else {
    g.addColorStop(0, hover ? '#96c862' : '#7aa848'); g.addColorStop(1, hover ? '#649838' : '#4e7a2a');
  }
  ctx.save();
  // 按钮投影
  ctx.fillStyle = 'rgba(15,25,8,0.4)';
  ctx.beginPath(); rr(x+3, y+4, w, h, 11); ctx.fill();
  ctx.beginPath(); rr(x, y, w, h, 10);
  O(g, disabled ? '#3a3a34' : '#2e4a14', 3);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x+5, y+3, w-10, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x+5, y+h-7, w-10, 4);
  if(hover && !disabled){
    ctx.strokeStyle = 'rgba(255,240,160,0.75)'; ctx.lineWidth = 2;
    rr(x+2, y+2, w-4, h-4, 8); ctx.stroke();
  }
  ctx.restore();
  drawText(label, x+w/2, y+h/2+1, opts.size||20, disabled ? '#9a9a90' : '#fffbe8', '#2e3a10', 4, 'center', '800');
  return hover;
}

