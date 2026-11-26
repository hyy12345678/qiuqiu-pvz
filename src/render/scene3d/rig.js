// 模型拼装工具：用基础几何体搭角色，按「骨骼节点 × 材质类」合并成少量网格。
//
// 一个角色可能由上百个小件组成（花瓣、牙齿、种子、纽扣），逐个做 Mesh 会让绘制调用爆炸。
// 这里把同一个节点、同一种材质的小件合并成一块几何体，颜色写进顶点色；
// 于是一株植物通常只有 3–6 次绘制调用，节点仍然可以独立做动画。
//
// 模板只建一次（按类型缓存），实例用 clone 共享几何体，只换材质。
import {
  BufferGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute,
  Group, IcosahedronGeometry, LatheGeometry, Matrix4, Mesh, Quaternion, SphereGeometry, TorusGeometry,
  TubeGeometry, CatmullRomCurve3, Vector2, Vector3, BoxGeometry, ExtrudeGeometry, Shape,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterialSet } from './materials.js';

const V = (a) => new Vector3(a[0], a[1], a[2]);

function scale3(s){
  if(s === undefined) return [1, 1, 1];
  if(typeof s === 'number') return [s, s, s];
  return s;
}

// ---- 基础几何（全部以原点为中心）----
export const GEO = {
  sphere: (r, ws = 18, hs = 12) => new SphereGeometry(r, ws, hs),
  hemi: (r, ws = 18, hs = 8) => new SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2),
  capsule: (r, len, rs = 12) => new CapsuleGeometry(r, len, 5, rs),
  cyl: (rt, rb, h, seg = 16, open = false) => new CylinderGeometry(rt, rb, h, seg, 1, open),
  cone: (r, h, seg = 14) => new ConeGeometry(r, h, seg),
  torus: (R, r, ts = 24, rs = 8, arc = Math.PI * 2) => new TorusGeometry(R, r, rs, ts, arc),
  box: (w, h, d) => new BoxGeometry(w, h, d),
  ico: (r, d = 0) => new IcosahedronGeometry(r, d),
  // 车削：points 为 [半径, 高度] 序列，自下而上
  lathe: (pts, seg = 22) => new LatheGeometry(pts.map(p => new Vector2(p[0], p[1])), seg),
  // 管：沿一串控制点的圆管，用于茎、头发、杆子
  tube: (pts, r, seg = 16, rs = 7) => new TubeGeometry(new CatmullRomCurve3(pts.map(V)), seg, r, rs, false),
  // 叶片：二维轮廓挤出薄片，带倒角才有软边
  leaf: (len, wid, th = 0.012) => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(len * 0.3, wid, len * 0.75, wid * 0.9, len, 0);
    s.bezierCurveTo(len * 0.75, -wid * 0.9, len * 0.3, -wid, 0, 0);
    return new ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th, bevelSize: th * 1.2, bevelSegments: 2, curveSegments: 8 });
  },
  // 星形薄片（阳光光冕、徽章）
  star: (n, ro, ri, th = 0.01) => {
    const s = new Shape();
    for(let i = 0; i < n * 2; i++){
      const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? ri : ro;
      if(i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
  },
  shape: (pts, th = 0.02, bevel = 0.008) => {
    const s = new Shape();
    pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
    return new ExtrudeGeometry(s, { depth: th, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  },
};

// 只保留位置与法线，统一成非索引几何，合并时才不会因属性集不同而失败。
function normalize(geo){
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for(const n of Object.keys(g.attributes)) if(n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  if(!g.attributes.normal) g.computeVertexNormals();
  geo.dispose();
  return g;
}

export function createRig(){
  const root = new Group(); root.name = 'root';
  const pivots = { root };
  const bins = new Map();
  const api = {
    pivots,
    // 动画节点：p 位置、r 欧拉角，都相对父节点
    pivot(name, parent = 'root', p = [0, 0, 0], r = [0, 0, 0]){
      const g = new Group(); g.name = name;
      g.position.set(p[0], p[1], p[2]); g.rotation.set(r[0], r[1], r[2]);
      pivots[parent].add(g); pivots[name] = g;
      return api;
    },
    // 往节点上加一个小件：key 材质类，color 固有色（sRGB 十六进制或 Color），o = { p, r, s }
    add(pv, key, geo, color, o = {}){
      const g = normalize(geo);
      const s = scale3(o.s);
      const r = o.r || [0, 0, 0];
      const m = new Matrix4().compose(V(o.p || [0, 0, 0]), new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], o.order || 'XYZ')), V(s));
      g.applyMatrix4(m);
      const c = color instanceof Color ? color : new Color(color);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      // 可选的竖向渐变：底部乘 o.shade（<1 更暗），模拟小件自身的环境光遮蔽
      const shade = o.shade;
      let y0 = 0, y1 = 1;
      if(shade !== undefined){
        g.computeBoundingBox(); y0 = g.boundingBox.min.y; y1 = g.boundingBox.max.y;
      }
      const pos = g.attributes.position.array;
      for(let i = 0; i < n; i++){
        let k = 1;
        if(shade !== undefined){
          const f = (pos[i * 3 + 1] - y0) / Math.max(1e-6, y1 - y0);
          k = shade + (1 - shade) * Math.min(1, f * 1.4);
        }
        col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      }
      g.setAttribute('color', new Float32BufferAttribute(col, 3));
      if(!bins.has(pv)) bins.set(pv, new Map());
      const bin = bins.get(pv);
      if(!bin.has(key)) bin.set(key, []);
      bin.get(key).push(g);
      return api;
    },
    // 合并并返回模板根节点。noShadow：不投影的材质类（自发光、半透明）
    finish(){
      for(const [pv, bin] of bins){
        for(const [key, geos] of bin){
          const merged = mergeGeometries(geos, false);
          for(const g of geos) g.dispose();
          merged.computeBoundingSphere();
          const mesh = new Mesh(merged);
          mesh.userData.key = key;
          mesh.castShadow = key !== 'e' && key !== 't';
          mesh.receiveShadow = key === 'm' || key === 'g';
          pivots[pv].add(mesh);
        }
      }
      return root;
    },
  };
  return api;
}

// 静态布景（房子、栅栏、树）不做逐个闪白，全场共用一套材质即可
let staticSet = null;
export function bakeStatic(root){
  if(!staticSet) staticSet = createMaterialSet();
  root.traverse(o => { if(o.isMesh && o.userData.key) o.material = staticSet.mats[o.userData.key]; });
  return root;
}

// 从模板克隆一个实例：几何体共享，材质按实例新建，节点按名字索引。
export function instantiate(template, opts = {}){
  const root = template.clone(true);
  const set = createMaterialSet(opts);
  const pv = {};
  root.traverse(o => {
    if(o.name) pv[o.name] = o;
    if(o.isMesh && o.userData.key){
      o.material = set.mats[o.userData.key];
      if(opts.ghost){ o.castShadow = false; o.receiveShadow = false; }
    }
  });
  // 记住每个节点的初始姿态：动画每帧从这里出发，而不是在上一帧基础上累加
  for(const name of Object.keys(pv)){
    const o = pv[name];
    o.userData.p0 = o.position.clone();
    o.userData.r0 = o.rotation.clone();
    o.userData.s0 = o.scale.clone();
  }
  return { root, pv, mats: set, state: {} };
}

// 把节点复位到初始姿态，再由调用方叠加本帧动画。
export function resetPose(inst){
  for(const name in inst.pv){
    const o = inst.pv[name];
    const u = o.userData;
    if(!u.p0) continue;
    o.position.copy(u.p0); o.rotation.copy(u.r0); o.scale.copy(u.s0);
  }
}

// 眼睛：白色釉面眼球 + 黑瞳 + 一颗自发光高光。dir 是瞳孔朝向（局部坐标），默认朝 +X 偏向镜头。
export function eye(rig, pv, p, r, o = {}){
  const dir = new Vector3(...(o.dir || [0.75, 0.1, 0.65])).normalize();
  const sx = o.sx || 1, sy = o.sy || 1.15;
  rig.add(pv, 'g', GEO.sphere(r, 16, 12), o.white || '#fbfbf4', { p, s: [sx, sy, sx] });
  const pr = r * (o.pupil || 0.55);
  const pp = [p[0] + dir.x * r * 0.62, p[1] + dir.y * r * 0.62 * sy, p[2] + dir.z * r * 0.62];
  rig.add(pv, 'g', GEO.sphere(pr, 14, 10), o.iris || '#141414', { p: pp, s: [1, sy, 1] });
  rig.add(pv, 'e', GEO.sphere(pr * 0.34, 8, 6), '#ffffff', { p: [pp[0] + dir.x * pr * 0.55 - 0.004, pp[1] + pr * 0.45, pp[2] + dir.z * pr * 0.55 + 0.006] });
  return rig;
}

export function emptyGeometry(){ return new BufferGeometry(); }
