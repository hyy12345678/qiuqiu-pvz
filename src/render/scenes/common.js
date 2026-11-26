// 场景通用按钮：注册热点动作描述并绘制。
import { addHotspot } from '../../ui/hotspots.js';
import { candyButton } from '../skin.js';
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
// 界面动画时钟：按钮扫光等只读它。由 scenes/index.js 每帧写入。
let uiTime = 0;
export function setUITime(t){ uiTime = t; }
export function getUITime(){ return uiTime; }
// opts：color（PALETTE 键）、red（旧写法，等价 color:'red'）、disabled、size、icon
export function drawButton(ui, x, y, w, h, label, id, action, opts){
  opts = opts || {};
  const hover = hotRect(ui, x, y, w, h, id, action);
  candyButton(x, y, w, h, label, {
    hover, disabled: opts.disabled, size: opts.size, icon: opts.icon,
    color: opts.color || (opts.red ? 'red' : 'green'), t: uiTime,
  });
  return hover;
}
