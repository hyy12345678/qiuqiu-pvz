import { W, H } from '../core/constants.js';
import { setPointer, clearSelection } from './state.js';
import { hitHotspot } from './hotspots.js';

export function toCanvas(canvas, e){
  const r = canvas.getBoundingClientRect();
  return { x:(e.clientX - r.left) * W / r.width, y:(e.clientY - r.top) * H / r.height };
}

export function bindInput({ canvas, document, window, world, ui, onPress, onKey }){
  function handleMove(p){
    setPointer(ui, p, world.state);
    const pointer = !!hitHotspot(ui, p);
    canvas.style.cursor = pointer ? 'pointer' : ((ui.shovel || ui.sel>=0) ? 'crosshair' : 'default');
  }

  canvas.addEventListener('mousemove', e=> handleMove(toCanvas(canvas, e)));
  canvas.addEventListener('mousedown', e=>{
    if(e.button === 2) return;
    onPress(toCanvas(canvas, e));
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
  });
  window.addEventListener('keydown', e=> onKey(e.key));
}
