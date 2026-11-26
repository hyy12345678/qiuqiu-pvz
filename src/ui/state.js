// 界面状态：鼠标、悬停格、当前选卡、铲子与热点表。每个游戏实例一份，由装配层创建。
// R3：这些字段从 world 移出；core/actions.js 只经参数读写，core 不 import 本模块。

import { CH, COLS, CW, LX, LY, ROWS } from '../core/constants.js';

export function createUI(){
  return {
    mouse:{ x:-99, y:-99 },
    hoverCell:null,
    sel:-1, shovel:false,
    hotspots:[],
  };
}

// 默认拾取：逻辑网格。3D 渲染层会注入按镜头反投影的版本（见 render/scene3d/renderer.js）。
export const logicalPicker = {
  cellAt(p){
    const c = Math.floor((p.x - LX)/CW), r = Math.floor((p.y - LY)/CH);
    return (c>=0 && c<COLS && r>=0 && r<ROWS) ? { row:r, col:c } : null;
  },
  sunAt(p){ return p; },
};
export function setPointer(ui, p, state, picker = logicalPicker){
  ui.mouse = p;
  ui.hoverCell = null;
  if(state === 'play') ui.hoverCell = picker.cellAt(p);
}

export function clearSelection(ui){
  ui.sel = -1;
  ui.shovel = false;
}
