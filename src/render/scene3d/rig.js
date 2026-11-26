// 方块模型拼装：每个零件是一个贴了像素图的长方体，按「骨骼节点 × 材质类」合并成少量网格。
//
// 尺寸单位是「像素」：PX 像素 = 1 个世界单位（= 一格宽）。一个零件 [w,h,d] 像素，
// 它的每个面就从图集里分到同样像素数的区域——纹素密度处处一致，这是方块风好看的前提。
//
// 朝向约定：模型面朝 +X（front），+Y 向上（top），+Z 朝镜头（near）。
// 模板只建一次（按类型缓存），实例 clone 共享几何体，只换材质。
import {
  BoxGeometry, BufferGeometry, Color, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterialSet } from './materials.js';
import { region } from './atlas.js';
import { noise } from './pixels.js';

export const PX = 32;                 // 每个世界单位多少像素
export const P = 1 / PX;              // 一个像素多少世界单位
export const px = (...v) => v.map(n => n * P);

// 纯白一像素：没有贴图的零件（发光核、光束）用它，颜色全靠顶点色
const WHITE = () => region('white', 2, 2, p => p.fill('#ffffff'));

// 面名 → BoxGeometry 的面序号（+x, -x, +y, -y, +z, -z）
const FACE_INDEX = { front: 0, back: 1, top: 2, bottom: 3, near: 4, far: 5 };
const FACE_ORDER = ['front', 'back', 'top', 'bottom', 'near', 'far'];

// 面贴图说明 → 图集区域。spec 可以是：
//   '#rrggbb'           带噪点的纯色
//   ['#rrggbb', amp]    指定噪点强度
//   { key, paint }      自定义画法（key 必须全局唯一，尺寸会自动拼进 key）
//   null                不画（共用白色，颜色由 tint 决定）

//   'clear'             全透明（薄片的侧边：配合镂空材质，侧边直接不见）
function faceUV(spec, w, h){
  if(!spec) return WHITE();
  if(spec === 'clear') return region('clear', 2, 2, p => p.clear());
  if(typeof spec === 'string') return region('n:' + spec + ':' + w + 'x' + h, w, h, noise(spec, 0.09));
  if(Array.isArray(spec)) return region('n:' + spec[0] + ':' + spec[1] + ':' + w + 'x' + h, w, h, noise(spec[0], spec[1]));
  return region(spec.key + ':' + w + 'x' + h, w, h, spec.paint);
}

// faces：单个 spec（六面相同），或 { all, sides, top, bottom, front, back, near, far }
function resolveFaces(faces){
  if(!faces || typeof faces === 'string' || Array.isArray(faces) || faces.paint) return FACE_ORDER.map(() => faces);
  return FACE_ORDER.map(f => {
    if(faces[f] !== undefined) return faces[f];
    if((f === 'front' || f === 'back' || f === 'near' || f === 'far') && faces.sides !== undefined) return faces.sides;
    return faces.all;
  });
}

export function boxGeometry(size, faces){
  const [w, h, d] = size;
  const geo = new BoxGeometry(w * P, h * P, d * P);
  const specs = resolveFaces(faces);
  // 每个面的像素尺寸：front/back = d×h，top/bottom = w×d，near/far = w×h
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geo.attributes.uv;
  for(let f = 0; f < 6; f++){
    const [u0, v0, u1, v1] = faceUV(specs[f], Math.max(1, Math.round(dims[f][0])), Math.max(1, Math.round(dims[f][1])));
    for(let k = 0; k < 4; k++){
      const i = f * 4 + k;
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
  }
  return geo;
}

// 十字交叉的两片：高草、花、火焰（方块游戏里「不是方块的植物」都这么画）
export function crossGeometry(w, h, spec){
  const [u0, v0, u1, v1] = faceUV(spec, w, h);
  const parts = [];
  for(const a of [Math.PI / 4, -Math.PI / 4]){
    const g = new PlaneGeometry(w * P, h * P);
    g.translate(0, h * P / 2, 0);
    g.rotateY(a);
    const uv = g.attributes.uv;
    for(let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    parts.push(g.toNonIndexed());
  }
  const m = mergeGeometries(parts, false);
  parts.forEach(g => g.dispose());
  return m;
}

// 统一成「非索引 + position/normal/uv」，合并时属性集才一致
function normalize(geo){
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for(const n of Object.keys(g.attributes)) if(n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
  if(!g.attributes.normal) g.computeVertexNormals();
  if(!g.attributes.uv){
    const [u0, v0, u1, v1] = WHITE();
    const arr = new Float32Array(g.attributes.position.count * 2);
    for(let i = 0; i < arr.length; i += 2){ arr[i] = (u0 + u1) / 2; arr[i + 1] = (v0 + v1) / 2; }
    g.setAttribute('uv', new Float32BufferAttribute(arr, 2));
  }
  geo.dispose();
  return g;
}

export function createRig(){
  const root = new Group(); root.name = 'root';
  const pivots = { root };
  const bins = new Map();
  function push(pv, key, g){
    if(!pivots[pv]) throw new Error('未声明的节点 ' + pv);
    if(!bins.has(pv)) bins.set(pv, new Map());
    const bin = bins.get(pv);
    if(!bin.has(key)) bin.set(key, []);
    bin.get(key).push(g);
  }
  const api = {
    pivots,
    // 动画节点：p 位置（像素）、r 欧拉角，都相对父节点
    pivot(name, parent = 'root', p = [0, 0, 0], r = [0, 0, 0]){
      const g = new Group(); g.name = name;
      g.position.set(p[0] * P, p[1] * P, p[2] * P); g.rotation.set(r[0], r[1], r[2]);
      pivots[parent].add(g); pivots[name] = g;
      return api;
    },
    // 一个方块零件：size 像素，at 中心位置（像素，相对节点），faces 面贴图，o = { r, tint, shade }
    box(pv, key, size, at, faces, o = {}){
      return api.geo(pv, key, boxGeometry(size, faces), at, o);
    },
    // 底部贴着 y=at[1] 的方块（站在地上的零件更好写）
    stand(pv, key, size, at, faces, o = {}){
      return api.box(pv, key, size, [at[0], at[1] + size[1] / 2, at[2]], faces, o);
    },
    cross(pv, key, w, h, at, spec, o = {}){
      return api.geo(pv, key, crossGeometry(w, h, spec), at, o);
    },
    // 任意几何（已带 uv 的会保留；没有的用白色像素 + 顶点色）
    geo(pv, key, geometry, at = [0, 0, 0], o = {}){
      const g = normalize(geometry);
      const r = o.r || [0, 0, 0];
      const s = o.s === undefined ? [1, 1, 1] : (typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s);
      g.applyMatrix4(new Matrix4().compose(new Vector3(at[0] * P, at[1] * P, at[2] * P),
        new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], o.order || 'XYZ')), new Vector3(...s)));
      const c = o.tint instanceof Color ? o.tint : new Color(o.tint || '#ffffff');
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      // 可选的竖向明暗：底部乘 o.shade（<1 更暗），像方块游戏的平滑光照
      let y0 = 0, y1 = 1;
      if(o.shade !== undefined){ g.computeBoundingBox(); y0 = g.boundingBox.min.y; y1 = g.boundingBox.max.y; }
      const pos = g.attributes.position.array;
      for(let i = 0; i < n; i++){
        let k = 1;
        if(o.shade !== undefined){
          const f = (pos[i * 3 + 1] - y0) / Math.max(1e-6, y1 - y0);
          k = o.shade + (1 - o.shade) * f;
        }
        col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      }
      g.setAttribute('color', new Float32BufferAttribute(col, 3));
      push(pv, key, g);
      return api;
    },
    finish(){
      for(const [pv, bin] of bins){
        for(const [key, geos] of bin){
          const merged = mergeGeometries(geos, false);
          for(const g of geos) g.dispose();
          merged.computeBoundingSphere();
          const mesh = new Mesh(merged);
          mesh.userData.key = key;
          mesh.castShadow = key !== 'e' && key !== 't';
          mesh.receiveShadow = key !== 'e';
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

export function emptyGeometry(){ return new BufferGeometry(); }
