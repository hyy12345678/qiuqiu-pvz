// 小件模型：小推车、各类弹丸、阳光。全部是方块。
import { AdditiveBlending, BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { layers, noise, sprite, centered } from './pixels.js';

const PI = Math.PI;

const MOWER_SIDE = { key: 'mower:side', paint: layers(noise('#d8302a', 0.07), (p, w, h) => { p.rect(0, h - 2, w, 2, '#8a1a14'); p.rect(1, 1, w - 2, 1, '#ff6a5a'); }) };
const WHEEL = { key: 'wheel', paint: layers(noise('#1e1e22', 0.1), centered(['.ss.', 'sggs', 'sggs', '.ss.'], { s: '#5a5a60', g: '#d8dce2' })) };
export function mowerBuild(rig){
  rig.pivot('body', 'root', [0, 0, 0]);
  for(const [x, z] of [[4.5, 5], [4.5, -5], [-4.5, 5], [-4.5, -5]]){
    const name = 'w' + x + z;
    rig.pivot(name, 'root', [x, 2.5, z]);
    rig.box(name, 'g', [5, 5, 1.6], [0, 0, 0], { near: WHEEL, far: WHEEL, sides: '#1e1e22', top: '#1e1e22', bottom: '#1e1e22' });
  }
  rig.stand('body', 'g', [13, 4, 9], [0, 2.5, 0], { all: '#d8302a', near: MOWER_SIDE, far: MOWER_SIDE });
  rig.stand('body', 'g', [8, 2, 8], [0.5, 6.5, 0], '#c02822');
  rig.stand('body', 'x', [5, 3, 5], [0.5, 8.5, 0], '#3a3d44');
  rig.stand('body', 'x', [1.5, 1.5, 1.5], [2, 11.5, 1], '#8a9098');
  rig.box('body', 'm', [2, 1.6, 10], [7, 4, 0], '#2a2a2a');
  for(const z of [-3, 3]) rig.box('body', 'e', [0.6, 1, 1.8], [6.9, 6, z], null, { tint: '#ffd040' });
  // 推手：两根斜杆 + 横把
  for(const z of [-4, 4]) rig.box('body', 'x', [1, 1, 10], [-9, 11, z], '#3a3d44', { r: [PI / 2, 0, -0.9], order: 'ZXY' });
  rig.box('body', 'm', [1.4, 1.4, 10], [-12.5, 15, 0], '#202020');
}

const SUN_FACE = { key: 'sun:face', paint: layers(noise('#ffd84a', 0.12), sprite(['ww', 'w.'], { w: '#fffbe0' }, 1, 1), (p, w, h) => {
  for(let i = 0; i < w; i++){ p.px(i, 0, '#ffb020'); p.px(i, h - 1, '#ffb020'); p.px(0, i, '#ffb020'); p.px(w - 1, i, '#ffb020'); }
}) };
export function sunBuild(rig){
  rig.pivot('cube', 'root');
  rig.box('cube', 'e', [10, 10, 10], [0, 0, 0], SUN_FACE);
}

// ---- 弹丸：每种类型一个原型，飞行中的每颗弹丸 clone 原型（共享几何与材质）----
function basic(hex, k = 1, add = false){
  const c = new Color(hex).multiplyScalar(k);
  return new MeshBasicMaterial({ color: c, transparent: add, blending: add ? AdditiveBlending : 1, depthWrite: !add });
}
export function buildPeaProtos(makeStd){
  const cube = new BoxGeometry(1, 1, 1);
  const P = {};
  const mk = (...meshes) => { const g = new Group(); for(const m of meshes) g.add(m); return g; };
  const m = (mat, s, p = [0, 0, 0]) => {
    const o = new Mesh(cube, mat);
    if(typeof s === 'number') o.scale.setScalar(s); else o.scale.set(...s);
    o.position.set(...p); return o;
  };
  P.pea = mk(m(makeStd('#5fd22e', 0.5), 0.13), m(basic('#d8ffb0', 1.3), 0.04, [-0.02, 0.05, 0.05]));
  P.snow = mk(m(makeStd('#9fe6ff', 0.3), 0.13), m(basic('#7fd8ff', 1.2, true), 0.2), m(basic('#ffffff', 1.6), 0.04, [-0.02, 0.05, 0.05]));
  P.fire = mk(m(basic('#ffd040', 2.6), 0.12), m(basic('#ff6a10', 2.0, true), [0.26, 0.15, 0.15], [-0.07, 0, 0]));
  P.spore = mk(m(basic('#c890f0', 1.3, true), 0.14), m(basic('#f4e0ff', 1.8), 0.06));
  P.ball = mk(m(makeStd('#e8483c', 0.5), 0.14));
  // E30：射手的箭。细长箭杆朝左（-x），骨白箭头，尾羽两片——和 buildBow 里搭弦的那支同款。
  P.arrow = mk(
    m(makeStd('#c8a86a', 0.55), [0.34, 0.03, 0.03]),
    m(makeStd('#9aa0a8', 0.4), [0.07, 0.075, 0.075], [-0.19, 0, 0]),
    m(basic('#e8e2d2', 1.4), [0.08, 0.09, 0.05], [0.16, 0, 0]),
  );
  P.bullet = mk(m(basic('#fff0a0', 2.8), [0.22, 0.035, 0.035], [-0.06, 0, 0]), m(basic('#ffffff', 2.6), 0.05));
  P.missile = mk(
    m(makeStd('#f2f2f0', 0.5), [0.22, 0.08, 0.08]),
    m(makeStd('#e8302a', 0.5), [0.07, 0.07, 0.07], [0.14, 0, 0]),
    m(basic('#ff8a20', 2.4, true), [0.1, 0.06, 0.06], [-0.15, 0, 0]),
    m(makeStd('#e8302a', 0.5), [0.05, 0.16, 0.03], [-0.09, 0, 0]),
  );
  return P;
}

// 发光光晕面片（总是朝向镜头）
export function haloMesh(tex, hex, k, size){
  const mat = new MeshBasicMaterial({ map: tex, color: new Color(hex).multiplyScalar(k), transparent: true, blending: AdditiveBlending, depthWrite: false });
  return new Mesh(new PlaneGeometry(size, size), mat);
}
