// 小件模型：小推车、各类弹丸、阳光、铲子。
import { AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, CylinderGeometry } from 'three';
import { GEO } from './rig.js';

const PI = Math.PI;

export function mowerBuild(rig){
  rig.pivot('body', 'root', [0, 0, 0]);
  for(const [x, z] of [[0.14, 0.15], [0.14, -0.15], [-0.14, 0.15], [-0.14, -0.15]]){
    rig.pivot('w' + x + z, 'root', [x, 0.075, z]);
    rig.add('w' + x + z, 'g', GEO.cyl(0.075, 0.075, 0.05, 18), '#1e1e22', { r: [PI / 2, 0, 0] });
    rig.add('w' + x + z, 'x', GEO.cyl(0.04, 0.04, 0.055, 12), '#d8dce2', { r: [PI / 2, 0, 0] });
    rig.add('w' + x + z, 'x', GEO.box(0.012, 0.11, 0.056), '#9aa0a8');
  }
  rig.add('body', 'g', GEO.box(0.42, 0.13, 0.3), '#d8302a', { p: [0, 0.16, 0], shade: 0.7 });
  rig.add('body', 'g', GEO.cyl(0.13, 0.15, 0.08, 20), '#c02822', { p: [0.02, 0.26, 0] });
  rig.add('body', 'x', GEO.box(0.16, 0.1, 0.16), '#3a3d44', { p: [0.02, 0.33, 0] });
  rig.add('body', 'x', GEO.cyl(0.03, 0.03, 0.05, 10), '#8a9098', { p: [0.06, 0.41, 0.04] });
  rig.add('body', 'm', GEO.box(0.06, 0.05, 0.31), '#2a2a2a', { p: [0.22, 0.12, 0] });
  rig.add('body', 'e', GEO.box(0.02, 0.03, 0.06), '#ffd040', { p: [0.215, 0.2, 0.09] });
  rig.add('body', 'e', GEO.box(0.02, 0.03, 0.06), '#ffd040', { p: [0.215, 0.2, -0.09] });
  rig.add('body', 'x', GEO.tube([[-0.18, 0.2, 0.12], [-0.32, 0.42, 0.12], [-0.38, 0.55, 0.12]], 0.014, 8, 5), '#3a3d44');
  rig.add('body', 'x', GEO.tube([[-0.18, 0.2, -0.12], [-0.32, 0.42, -0.12], [-0.38, 0.55, -0.12]], 0.014, 8, 5), '#3a3d44');
  rig.add('body', 'm', GEO.cyl(0.02, 0.02, 0.28, 8), '#202020', { p: [-0.38, 0.55, 0], r: [PI / 2, 0, 0] });
}

export function shovelBuild(rig){
  rig.pivot('s', 'root', [0, 0, 0], [0, 0, -0.65]);
  rig.add('s', 'm', GEO.cyl(0.035, 0.035, 0.6, 12), '#a8743c', { p: [0, 0.45, 0] });
  rig.add('s', 'm', GEO.torus(0.06, 0.022, 14, 6), '#5f3c18', { p: [0, 0.8, 0] });
  rig.add('s', 'x', GEO.cyl(0.045, 0.04, 0.08, 12), '#8a929a', { p: [0, 0.13, 0] });
  rig.add('s', 'x', GEO.sphere(0.15, 20, 14), '#c8d0d8', { p: [0, -0.06, 0], s: [1, 1.35, 0.25] });
}

export function sunBuild(rig){
  rig.add('root', 'e', GEO.sphere(0.2, 24, 16), '#ffd84a');
  rig.add('root', 'e', GEO.star(12, 0.36, 0.22, 0.02), '#ffb020', { p: [0, 0, -0.03] });
  rig.add('root', 'e', GEO.star(12, 0.3, 0.2, 0.02), '#ffe070', { p: [0, 0, -0.01], r: [0, 0, PI / 12] });
}

// ---- 弹丸：每种类型一个原型，飞行中的每颗弹丸 clone 原型（共享几何与材质）----
function basic(hex, k = 1, add = false){
  const c = new Color(hex).multiplyScalar(k);
  return new MeshBasicMaterial({ color: c, transparent: add, blending: add ? AdditiveBlending : 1, depthWrite: !add });
}
export function buildPeaProtos(makeStd){
  const sphere = new SphereGeometry(1, 18, 14);
  const P = {};
  const mk = (...meshes) => { const g = new Group(); for(const m of meshes) g.add(m); return g; };
  const m = (geo, mat, s = 1, p = [0, 0, 0], sc) => {
    const o = new Mesh(geo, mat); o.scale.set(...(sc || [s, s, s])); o.position.set(...p); return o;
  };
  P.pea = mk(m(sphere, makeStd('#5fd22e', 0.3), 0.08), m(sphere, basic('#ffffff', 1.5), 0.02, [-0.02, 0.04, 0.04]));
  P.snow = mk(m(sphere, makeStd('#9fe6ff', 0.15), 0.08), m(sphere, basic('#7fd8ff', 1.4, true), 0.13), m(sphere, basic('#ffffff', 1.8), 0.022, [-0.02, 0.04, 0.04]));
  P.fire = mk(m(sphere, basic('#ffd040', 3)), m(sphere, basic('#ff6a10', 2.2, true), 1, [-0.05, 0, 0], [0.22, 0.14, 0.14]));
  P.fire.children[0].scale.setScalar(0.075);
  P.spore = mk(m(sphere, basic('#c890f0', 1.4, true), 0.09), m(sphere, basic('#f4e0ff', 2), 0.04));
  P.ball = mk(m(sphere, makeStd('#e8483c', 0.3), 0.09));
  P.bullet = mk(m(new CylinderGeometry(1, 1, 1, 8), basic('#fff0a0', 3.2), 1, [-0.06, 0, 0], [0.018, 0.2, 0.018]), m(sphere, basic('#ffffff', 3), 0.025));
  P.bullet.children[0].rotation.z = PI / 2;
  const body = m(new CylinderGeometry(1, 1, 1, 12), makeStd('#f2f2f0', 0.4), 1, [0, 0, 0], [0.045, 0.2, 0.045]);
  body.rotation.z = PI / 2;
  const nose = m(new CylinderGeometry(0, 1, 1, 12), makeStd('#e8302a', 0.4), 1, [0.13, 0, 0], [0.045, 0.07, 0.045]);
  nose.rotation.z = -PI / 2;
  const flame = m(sphere, basic('#ff8a20', 2.6, true), 1, [-0.14, 0, 0], [0.09, 0.04, 0.04]);
  const fins = m(new CylinderGeometry(1, 1, 1, 3), makeStd('#e8302a', 0.4), 1, [-0.09, 0, 0], [0.08, 0.05, 0.08]);
  fins.rotation.z = PI / 2;
  P.missile = mk(body, nose, flame, fins);
  return P;
}

// 发光光晕面片（总是朝向镜头）
export function haloMesh(tex, hex, k, size){
  const mat = new MeshBasicMaterial({ map: tex, color: new Color(hex).multiplyScalar(k), transparent: true, blending: AdditiveBlending, depthWrite: false });
  const m = new Mesh(new PlaneGeometry(size, size), mat);
  return m;
}
