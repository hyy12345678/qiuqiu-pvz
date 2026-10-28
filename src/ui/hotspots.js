// 热点注册表：只保存矩形与动作描述，不携带修改世界的闭包。
// 命中必须从后往前扫：后注册的遮罩按钮要压住先前注册的场景卡片。

export function clearHotspots(ui){
  ui.hotspots.length = 0;
}

export function addHotspot(ui, x, y, w, h, id, action){
  ui.hotspots.push({ x, y, w, h, id, action });
}

export function hitHotspot(ui, p){
  for(let i=ui.hotspots.length-1;i>=0;i--){
    const h = ui.hotspots[i];
    if(p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h) return h;
  }
  return null;
}
