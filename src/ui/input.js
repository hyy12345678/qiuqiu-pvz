import { W, H } from '../core/constants.js';
import { setPointer, clearSelection, logicalPicker } from './state.js';
import { hitHotspot } from './hotspots.js';

export function toCanvas(canvas, e){
  const r = canvas.getBoundingClientRect();
  return { x:(e.clientX - r.left) * W / r.width, y:(e.clientY - r.top) * H / r.height };
}

export function bindInput({ canvas, document, window, world, ui, onPress, onKey, picker = logicalPicker }){
  // 光标是 ui.sel / ui.shovel 的派生显示，只在 mousemove 里算会漏掉三条不经过移动的清除路径：
  // 右键、点空地失败（pressCell 返回 no-selection）、以及种完/铲完/阳光不足后由动作自己清的选中。
  // 漏掉时指针停在上一次的 crosshair，玩家会以为还处在「待放置」状态。
  // 因此按「当前指针 + 当前 ui」重算，凡是能改 ui.sel / ui.shovel 的入口都要再调一次。
  function syncCursor(){
    const pointer = !!hitHotspot(ui, ui.mouse);
    canvas.style.cursor = pointer ? 'pointer' : ((ui.shovel || ui.sel>=0) ? 'crosshair' : 'default');
  }

  function handleMove(p){
    setPointer(ui, p, world.state, picker);
    syncCursor();
  }

  canvas.addEventListener('mousemove', e=> handleMove(toCanvas(canvas, e)));
  canvas.addEventListener('mousedown', e=>{
    if(e.button === 2) return;
    onPress(toCanvas(canvas, e));
    syncCursor();
  });
  canvas.addEventListener('touchstart', e=>{
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = toCanvas(canvas, t);
    handleMove(p);
    onPress(p);
  }, {passive:false});
  canvas.addEventListener('touchmove', e=>{
    e.preventDefault();
    handleMove(toCanvas(canvas, e.changedTouches[0]));
  }, {passive:false});
  canvas.addEventListener('touchend', e=> e.preventDefault(), {passive:false});
  document.addEventListener('gesturestart', e=> e.preventDefault());

  canvas.addEventListener('contextmenu', e=>{
    e.preventDefault();
    clearSelection(ui);
    syncCursor();
  });
  window.addEventListener('keydown', e=> onKey(e.key));
}
