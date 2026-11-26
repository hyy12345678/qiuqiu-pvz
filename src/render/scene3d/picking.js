// 拾取：逻辑坐标（1024×640）→ 镜头射线 → 植物或地面 / 阳光。只依赖世界视图的镜头与实体表，
// 不需要渲染器，所以 Node 测试可以直接验证「点在格子中心就能点中这个格子」。
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { W, H, COLS, ROWS, CW, CH, LX, LY } from '../../core/constants.js';
import { groundToLogical } from './coords.js';

// 阳光的点击半径（屏幕逻辑像素）。比核心层的 36px 略宽：3D 透视下阳光在近处更大。
export const SUN_PICK_RADIUS = 46;

export function createPicker(view){
  const ray = new Raycaster(), ndc = new Vector2(), ground = new Plane(new Vector3(0, 1, 0), 0), hit = new Vector3(), sp = new Vector3();
  function setRay(p){
    ndc.set(p.x / W * 2 - 1, 1 - p.y / H * 2);
    ray.setFromCamera(ndc, view.camera);
  }
  function screenOf(X, Y, Z){
    sp.set(X, Y, Z).project(view.camera);
    return { x: (sp.x + 1) / 2 * W, y: (1 - sp.y) / 2 * H };
  }
  // 先打植物：点在植物身上（哪怕超出它所在格子的地面范围）也算点中它的格子
  function cellAt(p){
    if(view.mode !== 'battle') return null;
    setRay(p);
    const plant = view.raycastPlant(ray);
    if(plant) return { row: plant.row, col: plant.col };
    if(!ray.ray.intersectPlane(ground, hit)) return null;
    const l = groundToLogical(hit.x, hit.z);
    const c = Math.floor((l.x - LX) / CW), r = Math.floor((l.y - LY) / CH);
    return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? { row: r, col: c } : null;
  }
  // 返回被点中的那颗阳光的逻辑坐标，交给核心层 collectSun 去结算
  function sunAt(p){
    if(view.mode !== 'battle') return null;
    let best = null, bestD = Infinity;
    for(const { sun, pos } of view.sunAnchors()){
      if(sun.state === 'fly') continue;
      const s = screenOf(pos.x, pos.y, pos.z);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if(d < SUN_PICK_RADIUS && d < bestD){ bestD = d; best = sun; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  return { cellAt, sunAt, screenOf };
}
