// 13 种植物的 3D 造型与动画。
//
// 局部坐标：脚底在原点，+X 是「面朝僵尸」的方向，+Y 向上，+Z 朝镜头。
// 1 单位 = 一格宽。植物整体由世界视图转 -0.45 rad，让脸朝镜头偏一点，炮口仍然朝右。
//
// 每个模型两段：build(rig) 只在第一次用到该类型时执行，生成可共享的模板；
// animate(inst, p, t, env) 每帧执行，只读植物实体，按姿态参数摆节点。
import { Color } from 'three';
import { GEO, eye } from './rig.js';

const PI = Math.PI;
const GREEN = '#4fb82e', GREEN_D = '#2f8a1f', GREEN_L = '#8fe055', STEM = '#3f9a2a';

// ---- 共用小件 ----
// 平铺在地上的一圈叶子：n 片，长 len，抬头角 lift
function leafRing(rig, pv, n, len, wid, color, lift = 0.35, y = 0.01, phase = 0){
  for(let i = 0; i < n; i++){
    const a = phase + i / n * PI * 2;
    rig.add(pv, 'g', GEO.leaf(len, wid), color, { p: [0, y, 0], r: [-PI / 2 + lift, a, 0], order: 'YXZ', shade: 0.7 });
  }
}
function smile(rig, pv, p, R, r, color, arc = PI * 0.75, o = {}){
  rig.add(pv, 'm', GEO.torus(R, r, 16, 6, arc), color, { p, r: [o.rx || 0, o.ry || 0, -PI / 2 - arc / 2] });
}
function blush(rig, pv, p, s = 0.035){
  rig.add(pv, 'm', GEO.sphere(s, 10, 8), '#ff8fa0', { p, s: [1, 0.6, 0.35] });
}
// 眉毛：face 'x' 表示脸朝 +X（眉毛沿 Z 横放），'z' 表示脸朝 +Z（眉毛沿 X 横放）。tilt 为正时内侧压低（怒）
function brow(rig, pv, p, len, tilt, color = '#1d2a10', face = 'x'){
  if(face === 'x') rig.add(pv, 'm', GEO.capsule(0.011, len, 6), color, { p, r: [PI / 2 + tilt, 0, 0] });
  else rig.add(pv, 'm', GEO.capsule(0.011, len, 6), color, { p, r: [0, 0, PI / 2 + tilt] });
}
function muzzleFlash(rig, pv, color){
  rig.add(pv, 'e', GEO.star(7, 0.1, 0.04, 0.01), color, { r: [0, PI / 2, 0] });
  rig.add(pv, 'e', GEO.sphere(0.05, 10, 8), '#fffbe0');
}
// 呼吸与摇摆：所有植物共用一套节奏，相位来自实体
function breathe(inst, t, ph, amp = 1){
  const s = 1 + Math.sin(t * 2.2 + ph) * 0.025 * amp;
  inst.root.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
}
function pulse(k){ return k * k * (3 - 2 * k); }

// ---- 豌豆家族 ----
function shooterBuild(o){
  return rig => {
    rig.pivot('head', 'root', [0, 0.56, 0]);
    rig.pivot('snout', 'head', [0.19, 0.01, 0]);
    rig.pivot('muzzle', 'snout', [0.15, 0, 0]);
    leafRing(rig, 'root', 5, 0.25, 0.075, o.leaf, 0.3);
    rig.add('root', 'm', GEO.tube([[0, 0, 0], [-0.03, 0.18, 0], [0.03, 0.36, 0], [0, 0.52, 0]], 0.036), o.stem, { shade: 0.6 });
    rig.add('root', 'g', GEO.leaf(0.17, 0.05), o.leaf, { p: [0, 0.28, 0], r: [-PI / 2 + 0.7, 2.4, 0], order: 'YXZ' });
    rig.add('head', 'g', GEO.sphere(0.2, 22, 16), o.head, { s: [1, 0.96, 0.96], shade: 0.75 });
    rig.add('head', 'g', GEO.sphere(0.07, 10, 8), o.headL, { p: [-0.06, 0.12, 0.08], s: [1.2, 0.6, 1] });   // 顶光斑
    rig.add('snout', 'g', GEO.cyl(0.075, 0.085, 0.2, 18), o.head, { p: [0.05, 0, 0], r: [0, 0, -PI / 2] });
    rig.add('snout', 'g', GEO.torus(0.08, 0.03, 18, 8), o.head, { p: [0.15, 0, 0], r: [0, PI / 2, 0] });
    rig.add('snout', 'm', GEO.cyl(0.07, 0.07, 0.012, 16), o.inner, { p: [0.158, 0, 0], r: [0, 0, -PI / 2] });
    eye(rig, 'head', [0.11, 0.07, 0.12], 0.058, { dir: [0.85, 0.05, 0.4] });
    eye(rig, 'head', [0.15, 0.075, -0.05], 0.05, { dir: [0.9, 0.05, 0.2] });
    if(o.crest){
      for(let i = 0; i < 3; i++){
        rig.add('head', 'g', GEO.leaf(0.2, 0.06), o.leaf, { p: [-0.12, 0.1, 0], r: [-PI / 2 + 0.2 + i * 0.25, PI + (i - 1) * 0.55, 0], order: 'YXZ' });
      }
      brow(rig, 'head', [0.12, 0.15, 0.13], 0.06, -0.45);
      brow(rig, 'head', [0.16, 0.15, -0.04], 0.05, 0.45);
    } else {
      rig.add('head', 'g', GEO.leaf(0.15, 0.05), o.leaf, { p: [-0.14, 0.1, 0], r: [0, 0, PI - 0.5] });
    }
    if(o.crystals){
      const pts = [[0.02, 0.19, 0.03, 0.2], [-0.08, 0.16, -0.06, -0.5], [-0.1, 0.15, 0.08, 0.6], [0.06, 0.17, -0.09, -0.3], [-0.15, 0.08, 0, 1.2]];
      for(const [x, y, z, a] of pts){
        rig.add('head', 'g', GEO.cone(0.03, 0.13, 6), '#e9fbff', { p: [x, y + 0.04, z], r: [a * 0.5, 0, -a] });
      }
      rig.add('head', 'e', GEO.ico(0.022, 0), '#9ff0ff', { p: [0.0, 0.25, 0.03] });
      rig.add('head', 'e', GEO.ico(0.018, 0), '#9ff0ff', { p: [-0.12, 0.2, 0.08] });
    }
    muzzleFlash(rig, 'muzzle', o.flash);
  };
}
function shooterAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  breathe(inst, t, ph);
  const k = pulse(Math.min(1, p.recoil || 0));
  const head = inst.pv.head, snout = inst.pv.snout;
  head.rotation.z += Math.sin(t * 1.8 + ph) * 0.06 + k * 0.18;
  head.position.x -= k * 0.06;
  head.position.y += Math.sin(t * 2.2 + ph) * 0.012;
  snout.scale.set(1 - k * 0.3, 1 + k * 0.35, 1 + k * 0.35);
  const f = Math.min(1, (p.flash || 0) / 0.09);
  inst.pv.muzzle.visible = f > 0.02;
  inst.pv.muzzle.scale.setScalar(0.4 + f);
  inst.pv.muzzle.rotation.x = t * 20;
}

// ---- 向日葵 ----
function sunflowerBuild(rig){
  rig.pivot('head', 'root', [0.02, 0.64, 0], [-0.42, 0.35, 0]);
  rig.pivot('petals', 'head');
  leafRing(rig, 'root', 4, 0.24, 0.08, GREEN, 0.3, 0.01, 0.4);
  rig.add('root', 'm', GEO.tube([[0, 0, 0], [0.04, 0.22, 0], [-0.03, 0.42, 0], [0.02, 0.62, -0.02]], 0.032), STEM, { shade: 0.6 });
  rig.add('root', 'g', GEO.leaf(0.2, 0.07), GREEN, { p: [0.02, 0.3, 0], r: [-PI / 2 + 0.6, -0.4, 0], order: 'YXZ' });
  rig.add('root', 'g', GEO.leaf(0.18, 0.065), GREEN, { p: [-0.02, 0.42, 0], r: [-PI / 2 + 0.7, 2.7, 0], order: 'YXZ' });
  // 花瓣：前后两层错开，前层亮黄、后层橙黄
  for(let i = 0; i < 16; i++){
    const a = i / 16 * PI * 2;
    rig.add('petals', 'g', GEO.sphere(1, 10, 8), '#f59f12', { p: [Math.cos(a + 0.2) * 0.25, Math.sin(a + 0.2) * 0.25, -0.03], r: [0, 0, a + 0.2 - PI / 2], s: [0.05, 0.12, 0.018] });
    rig.add('petals', 'g', GEO.sphere(1, 10, 8), '#ffd43a', { p: [Math.cos(a) * 0.23, Math.sin(a) * 0.23, -0.005], r: [0, 0, a - PI / 2], s: [0.048, 0.115, 0.02] });
  }
  // 花盘与种子
  rig.add('head', 'm', GEO.cyl(0.175, 0.17, 0.07, 28), '#7b4a1e', { r: [PI / 2, 0, 0] });
  rig.add('head', 'm', GEO.torus(0.172, 0.018, 28, 6), '#5d3514');
  for(let i = 0; i < 26; i++){
    const a = i * 2.399, rr = 0.035 + Math.sqrt(i / 26) * 0.12;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if(Math.abs(y + 0.04) < 0.035 && Math.abs(x) < 0.07) continue;     // 给嘴留位置
    if(Math.abs(y - 0.04) < 0.04 && Math.abs(Math.abs(x) - 0.06) < 0.04) continue;   // 给眼睛留位置
    rig.add('head', 'm', GEO.sphere(0.012, 6, 5), '#5a3210', { p: [x, y, 0.036] });
  }
  // 脸
  for(const sx of [-1, 1]){
    rig.add('head', 'g', GEO.sphere(0.032, 14, 10), '#1a0f06', { p: [sx * 0.058, 0.04, 0.04], s: [0.85, 1.25, 0.6] });
    rig.add('head', 'e', GEO.sphere(0.009, 6, 5), '#ffffff', { p: [sx * 0.058 - 0.008, 0.058, 0.06] });
    blush(rig, 'head', [sx * 0.105, -0.025, 0.04], 0.03);
  }
  smile(rig, 'head', [0, -0.025, 0.04], 0.05, 0.011, '#3a1a06', PI * 0.7);
}
function sunflowerAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  breathe(inst, t, ph);
  const h = inst.pv.head;
  h.rotation.z += Math.sin(t * 1.6 + ph) * 0.1;
  h.position.x += Math.sin(t * 1.6 + ph) * 0.02;
  h.position.y += Math.sin(t * 2.2 + ph) * 0.012;
  inst.pv.petals.rotation.z = Math.sin(t * 0.9 + ph) * 0.06;
  // 快要产阳光时花盘发亮：玩家能提前看见「这株马上要出太阳了」
  const st = p.sunT === undefined ? 9 : p.sunT;
  env.glow = st < 1.2 && !env.asleep ? (1.2 - st) / 1.2 * 0.35 * (0.7 + 0.3 * Math.sin(t * 14)) : 0;
}

// ---- 球球：五岁的小男孩，扛着加特林，背着导弹舱，披一条小斗篷 ----
function qiuqiuBuild(rig){
  const SKIN = '#ffd2ae', HAIR = '#2a1c12', SHIRT = '#ff7a1c', SHORTS = '#2f62c8', SHOE = '#e8463a';
  rig.pivot('body', 'root', [0, 0.3, 0]);
  rig.pivot('cape', 'body', [-0.1, 0.24, 0]);
  rig.pivot('head', 'body', [0.02, 0.38, 0]);
  rig.pivot('gun', 'body', [0.12, 0.1, 0.1]);
  rig.pivot('barrels', 'gun', [0.17, 0, 0]);
  rig.pivot('muzzle', 'barrels', [0.25, 0, 0]);
  rig.pivot('pod', 'body', [-0.13, 0.2, -0.02]);
  // 腿与鞋
  for(const sz of [-1, 1]){
    rig.add('root', 'm', GEO.capsule(0.045, 0.12), SKIN, { p: [0, 0.14, sz * 0.065] });
    rig.add('root', 'g', GEO.sphere(0.06, 14, 10), SHOE, { p: [0.03, 0.035, sz * 0.065], s: [1.5, 0.7, 1] });
    rig.add('root', 'm', GEO.box(0.17, 0.02, 0.09), '#fbfbf2', { p: [0.03, 0.008, sz * 0.065] });
  }
  rig.add('body', 'm', GEO.cyl(0.13, 0.15, 0.12, 20), SHORTS, { p: [0, -0.04, 0] });
  // T 恤 + 胸口星星
  rig.add('body', 'm', GEO.capsule(0.135, 0.12, 20), SHIRT, { p: [0, 0.14, 0], shade: 0.8 });
  rig.add('body', 'm', GEO.torus(0.08, 0.02, 18, 6), '#ffe9d4', { p: [0, 0.29, 0], r: [PI / 2, 0, 0] });
  rig.add('body', 'e', GEO.star(5, 0.06, 0.026, 0.012), '#ffd23e', { p: [0.06, 0.14, 0.12], r: [0, 0.5, 0] });
  // 斗篷
  rig.add('cape', 'm', GEO.box(0.03, 0.34, 0.26), '#d62a3a', { p: [-0.02, -0.15, 0], shade: 0.6 });
  // 头
  rig.add('head', 'm', GEO.sphere(0.2, 24, 18), SKIN, { p: [0, 0.16, 0] });
  rig.add('head', 'm', GEO.sphere(0.205, 22, 14), HAIR, { p: [-0.07, 0.23, 0], s: [0.92, 0.8, 1.04], r: [0, 0, 0.35] });
  const spikes = [[-0.05, 0.36, 0, 0.3], [0.04, 0.35, 0.05, -0.2], [-0.12, 0.31, 0.06, 0.9], [-0.1, 0.32, -0.07, 0.8], [0.06, 0.33, -0.06, -0.3], [-0.16, 0.24, 0, 1.4]];
  for(const [x, y, z, a] of spikes) rig.add('head', 'm', GEO.cone(0.05, 0.13, 8), HAIR, { p: [x, y, z], r: [z * 3, 0, a] });
  rig.add('head', 'm', GEO.cone(0.05, 0.1, 8), HAIR, { p: [0.15, 0.3, 0.02], r: [0, 0, -1.9] });   // 刘海
  for(const sz of [-1, 1]) rig.add('head', 'm', GEO.sphere(0.04, 10, 8), SKIN, { p: [-0.02, 0.15, sz * 0.2], s: [0.7, 1, 0.5] });
  eye(rig, 'head', [0.15, 0.18, 0.085], 0.052, { iris: '#3a2210', pupil: 0.62, dir: [0.8, 0, 0.5] });
  eye(rig, 'head', [0.17, 0.18, -0.05], 0.046, { iris: '#3a2210', pupil: 0.62, dir: [0.85, 0, 0.3] });
  brow(rig, 'head', [0.165, 0.255, 0.09], 0.05, 0.25, HAIR);
  brow(rig, 'head', [0.18, 0.255, -0.05], 0.045, -0.25, HAIR);
  smile(rig, 'head', [0.185, 0.08, 0.02], 0.045, 0.012, '#8a2a1a', PI * 0.8, { ry: PI / 2 - 0.3 });
  blush(rig, 'head', [0.16, 0.11, 0.13], 0.03);
  // 加特林：机匣、弹鼓、六管、护环
  rig.add('gun', 'x', GEO.box(0.22, 0.1, 0.1), '#4a5058', { p: [0.02, 0, 0] });
  rig.add('gun', 'x', GEO.cyl(0.07, 0.07, 0.07, 18), '#d9a521', { p: [-0.02, -0.08, 0], r: [PI / 2, 0, 0] });
  rig.add('gun', 'm', GEO.box(0.2, 0.025, 0.105), '#ff7a1c', { p: [0.02, 0.04, 0] });
  rig.add('gun', 'm', GEO.capsule(0.035, 0.08), SKIN, { p: [-0.02, 0.0, 0.09], r: [0, 0, 1.2] });   // 手
  for(let i = 0; i < 6; i++){
    const a = i / 6 * PI * 2;
    rig.add('barrels', 'x', GEO.cyl(0.016, 0.016, 0.26, 8), '#2c3036', { p: [0.12, Math.cos(a) * 0.035, Math.sin(a) * 0.035], r: [0, 0, -PI / 2] });
  }
  rig.add('barrels', 'x', GEO.torus(0.045, 0.012, 16, 6), '#8a929c', { p: [0.06, 0, 0], r: [0, PI / 2, 0] });
  rig.add('barrels', 'x', GEO.torus(0.045, 0.012, 16, 6), '#8a929c', { p: [0.23, 0, 0], r: [0, PI / 2, 0] });
  muzzleFlash(rig, 'muzzle', '#ffd84a');
  // 背后导弹舱
  rig.add('pod', 'm', GEO.box(0.1, 0.16, 0.16), '#3c6b2a', { shade: 0.7 });
  for(const sz of [-1, 1]) rig.add('pod', 'g', GEO.cone(0.03, 0.08, 10), '#e8483c', { p: [0, 0.11, sz * 0.04] });
}
function qiuqiuAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  const k = Math.min(1, p.recoil || 0);
  const st = inst.state;
  st.spin = (st.spin || 0) + env.dt * (k > 0.05 ? 28 : 1.5);
  inst.pv.barrels.rotation.x = st.spin;
  const b = inst.pv.body;
  b.position.y += Math.abs(Math.sin(t * 3 + ph)) * 0.012;
  b.position.x -= k * 0.015;
  b.rotation.z += Math.sin(t * 1.4 + ph) * 0.03 - k * 0.05;
  inst.pv.gun.position.x -= k * 0.035;
  inst.pv.gun.rotation.z += (Math.sin(t * 40) * 0.03) * k;
  inst.pv.head.rotation.z += Math.sin(t * 1.7 + ph) * 0.06;
  inst.pv.cape.rotation.x = Math.sin(t * 5 + ph) * 0.18;
  inst.pv.cape.rotation.z = -0.25 - Math.abs(Math.sin(t * 2.5 + ph)) * 0.15;
  const f = Math.min(1, (p.flash || 0) / 0.1);
  inst.pv.muzzle.visible = f > 0.02;
  inst.pv.muzzle.scale.setScalar(0.5 + f * 0.9);
  inst.pv.muzzle.rotation.x = t * 31;
}

// ---- 坚果墙 ----
const NUT_PROFILE = [[0.001, 0], [0.16, 0.015], [0.245, 0.1], [0.275, 0.27], [0.255, 0.45], [0.18, 0.58], [0.06, 0.645], [0.001, 0.65]];
function wallnutBuild(rig){
  rig.pivot('body', 'root');
  rig.pivot('face', 'body', [0, 0, 0], [0, -0.7, 0]);
  rig.pivot('crack1', 'face'); rig.pivot('crack2', 'face');
  rig.pivot('worry', 'face'); rig.pivot('calm', 'face');
  rig.add('body', 'g', GEO.lathe(NUT_PROFILE, 28), '#b87a38', { shade: 0.65 });
  // 果壳纹理：一圈圈凹点
  for(let i = 0; i < 34; i++){
    const a = i * 2.39996, y = 0.06 + (i % 9) / 9 * 0.52;
    const r = 0.265 * Math.sin(Math.min(PI, (y + 0.02) / 0.67 * PI)) * 1.02;
    rig.add('body', 'm', GEO.sphere(0.025, 8, 6), '#8f5a26', { p: [Math.cos(a) * r, y, Math.sin(a) * r], s: [1, 0.5, 1], r: [0, -a, PI / 2] });
  }
  rig.add('body', 'g', GEO.sphere(0.06, 12, 8), '#d9a05a', { p: [0, 0.63, 0], s: [1, 0.35, 1] });
  // 脸（朝 +X 偏镜头）
  eye(rig, 'face', [0.235, 0.4, 0.07], 0.06, { dir: [1, 0, 0.2] });
  eye(rig, 'face', [0.24, 0.4, -0.08], 0.055, { dir: [1, 0, 0.1] });
  rig.add('calm', 'm', GEO.capsule(0.013, 0.07, 6), '#4a2a10', { p: [0.255, 0.48, 0.075], r: [PI / 2 - 0.15, 0, 0] });
  rig.add('calm', 'm', GEO.capsule(0.013, 0.065, 6), '#4a2a10', { p: [0.258, 0.48, -0.085], r: [PI / 2 + 0.15, 0, 0] });
  rig.add('worry', 'm', GEO.capsule(0.013, 0.07, 6), '#4a2a10', { p: [0.255, 0.49, 0.075], r: [PI / 2 + 0.5, 0, 0] });
  rig.add('worry', 'm', GEO.capsule(0.013, 0.065, 6), '#4a2a10', { p: [0.258, 0.49, -0.085], r: [PI / 2 - 0.5, 0, 0] });
  rig.add('face', 'm', GEO.capsule(0.012, 0.05, 6), '#4a2a10', { p: [0.268, 0.29, 0], r: [PI / 2, 0, 0] });
  // 裂纹：贴在正面的深色折线
  const crack = (pv, pts) => {
    for(let i = 1; i < pts.length; i++){
      const [y0, z0] = pts[i - 1], [y1, z1] = pts[i];
      const len = Math.hypot(y1 - y0, z1 - z0);
      rig.add(pv, 'm', GEO.box(0.02, len, 0.016), '#3a2008', { p: [0.268, (y0 + y1) / 2, (z0 + z1) / 2], r: [Math.atan2(z1 - z0, y1 - y0) * -1, 0, 0] });
    }
  };
  crack('crack1', [[0.6, -0.02], [0.53, 0.04], [0.47, 0.0], [0.42, 0.06]]);
  crack('crack1', [[0.2, 0.16], [0.15, 0.1], [0.1, 0.14]]);
  crack('crack2', [[0.36, -0.17], [0.3, -0.12], [0.24, -0.16], [0.17, -0.1], [0.12, -0.13]]);
  crack('crack2', [[0.55, 0.15], [0.5, 0.2], [0.42, 0.17]]);
}
function wallnutAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  const hp = p.maxHp ? p.hp / p.maxHp : 1;
  inst.pv.crack1.visible = hp < 0.67;
  inst.pv.crack2.visible = hp < 0.34;
  inst.pv.worry.visible = hp < 0.67;
  inst.pv.calm.visible = hp >= 0.67;
  const b = inst.pv.body;
  const wob = env.hurt || 0;
  b.rotation.z = Math.sin(t * 1.3 + ph) * 0.04 + Math.sin(t * 40) * 0.06 * wob;
  b.rotation.x = Math.sin(t * 1.1 + ph) * 0.03;
  const s = 1 + Math.sin(t * 2 + ph) * 0.015;
  b.scale.set(1, s, 1);
}

// ---- 土豆雷 ----
function potatoBuild(rig){
  rig.pivot('mound', 'root');
  rig.pivot('spud', 'root');
  rig.pivot('lamp', 'spud', [0.0, 0.33, 0]);
  rig.add('mound', 'm', GEO.sphere(0.24, 20, 10), '#7a5634', { p: [0, 0, 0], s: [1, 0.32, 0.9], shade: 0.6 });
  for(let i = 0; i < 7; i++){
    const a = i / 7 * PI * 2 + 0.3;
    rig.add('mound', 'm', GEO.ico(0.05, 0), '#8e6a42', { p: [Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.18], r: [a, a * 2, 0] });
  }
  rig.add('spud', 'g', GEO.sphere(0.19, 20, 14), '#d2a463', { p: [0, 0.14, 0], s: [1.1, 0.85, 0.95], shade: 0.7 });
  for(const [x, y, z] of [[-0.1, 0.22, 0.12], [0.05, 0.27, -0.12], [-0.15, 0.12, -0.1], [0.12, 0.08, 0.15]]){
    rig.add('spud', 'm', GEO.sphere(0.02, 8, 6), '#9c7238', { p: [x, y, z], s: [1, 0.5, 1] });
  }
  eye(rig, 'spud', [0.15, 0.19, 0.08], 0.042, { dir: [0.9, 0, 0.4] });
  eye(rig, 'spud', [0.17, 0.19, -0.05], 0.038, { dir: [0.9, 0, 0.2] });
  smile(rig, 'spud', [0.195, 0.12, 0.015], 0.03, 0.008, '#5a3812', PI * 0.7, { ry: PI / 2 - 0.3 });
  rig.add('spud', 'x', GEO.cyl(0.008, 0.008, 0.12, 6), '#9aa0a8', { p: [0, 0.27, 0] });
  rig.add('lamp', 'e', GEO.sphere(0.035, 12, 10), '#ff2a1a');
  rig.add('spud', 'g', GEO.leaf(0.1, 0.03), GREEN, { p: [-0.03, 0.3, 0], r: [0, 0, 2.2] });
}
function potatoAnimate(inst, p, t, env){
  const armed = !!p.armed;
  const prog = armed ? 1 : Math.min(1, (p.armT || 0) / 14);
  const spud = inst.pv.spud;
  spud.position.y = -0.24 + prog * 0.22 + (armed ? Math.abs(Math.sin(t * 3 + p.phase)) * 0.015 : 0);
  spud.rotation.z = armed ? Math.sin(t * 2.5) * 0.05 : 0;
  inst.pv.mound.scale.setScalar(armed ? 0.85 : 1);
  const on = armed ? (Math.sin(t * 12) > 0 ? 1 : 0.15) : (Math.sin(t * 2) > 0.7 ? 0.5 : 0.1);
  inst.pv.lamp.scale.setScalar(0.5 + on * 0.8);
  env.lamp = armed ? on : 0;
}

// ---- 火炬树桩 ----
function torchBuild(rig){
  rig.pivot('fire', 'root', [0, 0.44, 0]);
  rig.pivot('f1', 'fire'); rig.pivot('f2', 'fire'); rig.pivot('f3', 'fire');
  rig.add('root', 'm', GEO.cyl(0.22, 0.27, 0.42, 22), '#6e4322', { p: [0, 0.21, 0], shade: 0.55 });
  for(let i = 0; i < 14; i++){
    const a = i / 14 * PI * 2;
    rig.add('root', 'm', GEO.box(0.035, 0.4, 0.03), '#4f2e14', { p: [Math.cos(a) * 0.245, 0.2, Math.sin(a) * 0.245], r: [0, -a, 0.04] });
  }
  for(let i = 0; i < 5; i++){
    const a = i / 5 * PI * 2 + 0.4;
    rig.add('root', 'm', GEO.tube([[Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22], [Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3], [Math.cos(a) * 0.36, 0.0, Math.sin(a) * 0.36]], 0.035, 6, 6), '#5a3519');
  }
  rig.add('root', 'm', GEO.cyl(0.215, 0.215, 0.02, 22), '#d19a5e', { p: [0, 0.42, 0] });
  for(const r of [0.07, 0.13, 0.18]) rig.add('root', 'm', GEO.torus(r, 0.008, 22, 4), '#9c6a38', { p: [0, 0.43, 0], r: [PI / 2, 0, 0] });
  // 雕出来的怒脸：深色凹槽里透出火光
  for(const sz of [0.09, -0.08]){
    rig.add('root', 'm', GEO.box(0.03, 0.06, 0.07), '#2a1406', { p: [0.235, 0.3, sz], r: [sz > 0 ? 0.5 : -0.5, 0, 0] });
    rig.add('root', 'e', GEO.sphere(0.022, 8, 6), '#ffb030', { p: [0.245, 0.29, sz] });
  }
  rig.add('root', 'm', GEO.box(0.03, 0.05, 0.16), '#2a1406', { p: [0.245, 0.16, 0.005] });
  rig.add('root', 'e', GEO.box(0.012, 0.03, 0.13), '#ff8a1a', { p: [0.255, 0.16, 0.005] });
  // 火焰三层：外红、中橙、芯黄
  rig.add('f1', 'e', GEO.cone(0.19, 0.42, 14), '#ff6a12', { p: [0, 0.19, 0] });
  rig.add('f1', 'e', GEO.sphere(0.19, 14, 10), '#ff6a12', { p: [0, 0.02, 0], s: [1, 0.6, 1] });
  rig.add('f2', 'e', GEO.cone(0.13, 0.34, 12), '#ffb02a', { p: [0.03, 0.17, 0.02] });
  rig.add('f2', 'e', GEO.sphere(0.13, 12, 8), '#ffb02a', { p: [0.03, 0.03, 0.02], s: [1, 0.6, 1] });
  rig.add('f3', 'e', GEO.cone(0.075, 0.22, 10), '#fff0a0', { p: [0, 0.12, 0.03] });
  rig.add('f3', 'e', GEO.sphere(0.075, 10, 8), '#fff0a0', { p: [0, 0.03, 0.03], s: [1, 0.7, 1] });
}
function torchAnimate(inst, p, t){
  const ph = p.phase || 0;
  const fl = (a, b) => 1 + Math.sin(t * a + ph) * 0.12 + Math.sin(t * b + ph * 2) * 0.08;
  inst.pv.f1.scale.set(fl(9, 17), fl(11, 23) * 1.05, fl(8, 15));
  inst.pv.f2.scale.set(fl(13, 19), fl(15, 27), fl(12, 21));
  inst.pv.f3.scale.set(fl(17, 29), fl(19, 31), fl(16, 23));
  inst.pv.f1.rotation.z = Math.sin(t * 5 + ph) * 0.12;
  inst.pv.f2.rotation.z = Math.sin(t * 7 + ph) * 0.15;
  inst.pv.f3.rotation.x = Math.sin(t * 6 + ph) * 0.1;
}

// ---- 樱桃炸弹 ----
function cherryBuild(rig){
  rig.pivot('c1', 'root', [-0.12, 0.17, 0.07]);
  rig.pivot('c2', 'root', [0.13, 0.15, -0.05]);
  for(const [pv, s] of [['c1', 1], ['c2', 0.93]]){
    rig.add(pv, 'g', GEO.sphere(0.16 * s, 22, 16), '#d4142a', { shade: 0.6 });
    rig.add(pv, 'e', GEO.sphere(0.03 * s, 8, 6), '#ffd0d8', { p: [-0.06 * s, 0.09 * s, 0.07 * s], s: [1.4, 0.8, 1] });
    eye(rig, pv, [0.1 * s, 0.03, 0.07 * s], 0.04 * s, { dir: [0.8, 0, 0.6], pupil: 0.65 });
    eye(rig, pv, [0.125 * s, 0.03, -0.03 * s], 0.036 * s, { dir: [0.9, 0, 0.3], pupil: 0.65 });
    brow(rig, pv, [0.115 * s, 0.085, 0.07 * s], 0.045 * s, -0.5, '#3a0608');
    brow(rig, pv, [0.14 * s, 0.085, -0.03 * s], 0.04 * s, 0.5, '#3a0608');
    rig.add(pv, 'm', GEO.box(0.012, 0.025, 0.07 * s), '#3a0608', { p: [0.155 * s, -0.04, 0.02] });
  }
  rig.add('root', 'm', GEO.tube([[-0.12, 0.32, 0.07], [-0.06, 0.48, 0.03], [0.0, 0.56, 0]], 0.014, 10, 5), '#3a7a1a');
  rig.add('root', 'm', GEO.tube([[0.13, 0.29, -0.05], [0.08, 0.46, -0.02], [0.0, 0.56, 0]], 0.014, 10, 5), '#3a7a1a');
  rig.add('root', 'g', GEO.leaf(0.2, 0.07), GREEN, { p: [0, 0.56, 0], r: [-PI / 2 + 0.5, 0.6, 0], order: 'YXZ' });
}
function cherryAnimate(inst, p, t, env){
  const k = 1 - Math.max(0, Math.min(1, (p.fuse === undefined ? 1.05 : p.fuse) / 1.05));
  const s = 1 + pulse(k) * 0.45;
  const sh = k * 0.03;
  for(const pv of [inst.pv.c1, inst.pv.c2]){
    pv.scale.setScalar(s);
    pv.position.x += Math.sin(t * 61 + pv.position.z * 9) * sh;
    pv.position.y += Math.cos(t * 53) * sh;
  }
  env.glow = k * k * 0.9;
  env.tint = k > 0.05 ? CHERRY_TINT.setRGB(1, 1 - k * 0.5, 1 - k * 0.6) : null;
}
const CHERRY_TINT = new Color();

// ---- 蘑菇：小喷菇、阳光菇 ----
function shroomBuild(o){
  return rig => {
    rig.pivot('cap', 'root', [-0.03, o.stemH, 0], [0, 0, 0.32]);
    rig.pivot('eyes', 'root'); rig.pivot('lids', 'root');
    rig.pivot('muzzle', 'root', [o.stemR + 0.12, o.stemH * 0.45, 0]);
    rig.add('root', 'g', GEO.cyl(o.stemR * 0.9, o.stemR, o.stemH, 18), '#f3ead6', { p: [0, o.stemH / 2, 0], shade: 0.75 });
    const R = o.capR;
    rig.add('cap', 'g', GEO.lathe([[0.001, 0.02 * R], [R * 0.55, 0.0], [R * 0.9, -0.1 * R], [R * 1.02, -0.06 * R], [R * 0.98, 0.02 * R], [R * 0.55, 0.22 * R], [0.001, 0.25 * R]], 26), o.cap, { s: [1, 2.6, 1], shade: 0.7 });
    for(let i = 0; i < o.spots; i++){
      const a = i * 2.4 + 0.5, rr = R * (0.35 + (i % 3) * 0.2);
      const y = Math.max(0.02, 0.6 * R * (1 - (rr / R) * (rr / R)));
      rig.add('cap', 'e', GEO.sphere(R * 0.14, 10, 6), o.spot, { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: [1, 0.35, 1] });
    }
    const ey = o.stemH * 0.62, ex = o.stemR * 0.82;
    eye(rig, 'eyes', [ex, ey, 0.045], o.eye, { dir: [0.8, 0, 0.6], pupil: 0.6 });
    eye(rig, 'eyes', [ex + 0.005, ey, -0.04], o.eye * 0.9, { dir: [0.9, 0, 0.3], pupil: 0.6 });
    for(const z of [0.045, -0.04]){
      rig.add('lids', 'm', GEO.torus(o.eye * 0.8, 0.006, 10, 4, PI), '#3a2a40', { p: [ex + 0.02, ey, z], r: [0, PI / 2, PI] });
    }
    if(o.snout){
      rig.add('root', 'g', GEO.cyl(0.035, 0.04, 0.09, 14), '#e8d9c0', { p: [o.stemR + 0.03, o.stemH * 0.45, 0], r: [0, 0, -PI / 2] });
      rig.add('root', 'm', GEO.cyl(0.028, 0.028, 0.01, 12), '#5a3a6a', { p: [o.stemR + 0.077, o.stemH * 0.45, 0], r: [0, 0, -PI / 2] });
      rig.add('muzzle', 'e', GEO.star(6, 0.06, 0.025, 0.01), '#e9c8ff', { r: [0, PI / 2, 0] });
    } else {
      smile(rig, 'eyes', [ex + 0.012, ey - 0.05, 0.0], 0.025, 0.007, '#6a3a10', PI * 0.75, { ry: PI / 2 });
    }
  };
}
function shroomAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  const asleep = !!env.asleep;
  inst.pv.eyes.visible = !asleep;
  inst.pv.lids.visible = asleep;
  const cap = inst.pv.cap;
  if(asleep){
    const b = Math.sin(t * 1.2 + ph);
    inst.root.scale.set(1 + b * 0.03, 1 - b * 0.04, 1 + b * 0.03);
    cap.rotation.z = -0.12 + b * 0.03;
  } else {
    breathe(inst, t, ph, 1.4);
    const k = pulse(Math.min(1, p.recoil || 0));
    cap.rotation.z = Math.sin(t * 2 + ph) * 0.05 + k * 0.15;
    cap.position.y -= k * 0.02;
  }
  if(inst.pv.muzzle){
    const f = Math.min(1, (p.flash || 0) / 0.09);
    inst.pv.muzzle.visible = f > 0.02 && !asleep;
    inst.pv.muzzle.scale.setScalar(0.4 + f);
  }
  if(p.type === 'sunshroom' && !asleep){
    const st = p.sunT === undefined ? 9 : p.sunT;
    env.glow = st < 1.2 ? (1.2 - st) / 1.2 * 0.35 : 0;
  }
}

// ---- 咖啡豆（只出现在卡片上）----
function coffeeBuild(rig){
  rig.pivot('bean', 'root', [0, 0.2, 0]);
  rig.add('bean', 'g', GEO.sphere(0.17, 22, 16), '#6e3d1a', { s: [1, 1.25, 0.85], shade: 0.6 });
  rig.add('bean', 'm', GEO.tube([[0.02, -0.17, 0.14], [0.06, -0.05, 0.15], [-0.02, 0.07, 0.15], [0.02, 0.19, 0.12]], 0.011, 14, 5), '#3a1c08');
  eye(rig, 'bean', [0.12, 0.05, 0.05], 0.045, { dir: [0.8, 0.1, 0.6], pupil: 0.5 });
  eye(rig, 'bean', [0.13, 0.05, -0.06], 0.04, { dir: [0.9, 0.1, 0.3], pupil: 0.5 });
  smile(rig, 'bean', [0.145, -0.04, 0], 0.035, 0.009, '#2a1004', PI, { ry: PI / 2 - 0.2 });
  rig.add('bean', 'g', GEO.leaf(0.13, 0.045), GREEN, { p: [-0.02, 0.2, 0], r: [0, 0, 1.2] });
  for(let i = 0; i < 3; i++) rig.add('bean', 'e', GEO.sphere(0.02 + i * 0.006, 8, 6), '#fff8e8', { p: [-0.03 + i * 0.03, 0.3 + i * 0.07, 0.0] });
}
function coffeeAnimate(inst, p, t){ inst.pv.bean.rotation.z = Math.sin(t * 3) * 0.08; }

// ---- 迪迦奥特曼 ----
const T_SILVER = '#c8ced8', T_RED = '#d6262c', T_PURPLE = '#6a3cc0', T_GOLD = '#e7b94c';
function tigaBuild(rig){
  rig.pivot('body', 'root', [0, 0.7, 0]);
  rig.pivot('head', 'body', [0.01, 0.42, 0]);
  rig.pivot('armF', 'body', [0.02, 0.33, 0.17]);   // 靠镜头的手臂
  rig.pivot('foreF', 'armF', [0, -0.21, 0]);
  rig.pivot('armB', 'body', [0.02, 0.33, -0.17]);
  rig.pivot('foreB', 'armB', [0, -0.21, 0]);
  rig.pivot('timer', 'body', [0.13, 0.24, 0.0]);
  rig.pivot('legF', 'body', [0, 0, 0.08]);
  rig.pivot('legB', 'body', [0, 0, -0.08]);
  // 腿：银色底，红紫交替的条纹
  for(const pv of ['legF', 'legB']){
    rig.add(pv, 'x', GEO.capsule(0.065, 0.28, 14), T_SILVER, { p: [0, -0.2, 0] });
    rig.add(pv, 'g', GEO.capsule(0.068, 0.12, 14), pv === 'legF' ? T_RED : T_PURPLE, { p: [0, -0.18, 0], s: [1.02, 1, 1.02] });
    rig.add(pv, 'x', GEO.sphere(0.075, 14, 10), T_SILVER, { p: [0.03, -0.66, 0], s: [1.5, 0.7, 1] });
  }
  // 躯干
  rig.add('body', 'x', GEO.capsule(0.15, 0.28, 20), T_SILVER, { p: [0, 0.18, 0] });
  rig.add('body', 'g', GEO.capsule(0.152, 0.12, 20), T_PURPLE, { p: [-0.01, 0.06, 0], s: [1, 1, 1.01] });
  rig.add('body', 'g', GEO.sphere(0.13, 18, 12), T_RED, { p: [-0.05, 0.22, 0], s: [0.9, 1.1, 1.18] });
  // 胸甲：金边银板
  rig.add('body', 'x', GEO.sphere(0.16, 22, 14), T_SILVER, { p: [0.03, 0.3, 0], s: [0.75, 0.55, 1.12] });
  rig.add('body', 'x', GEO.torus(0.15, 0.013, 26, 6, PI), T_GOLD, { p: [0.07, 0.25, 0], r: [0, PI / 2, PI] });
  rig.add('body', 'e', GEO.sphere(0.025, 10, 8), '#ffffff', { p: [0.17, 0.3, 0.07], s: [0.5, 1, 1.4] });
  rig.add('body', 'e', GEO.sphere(0.025, 10, 8), '#ffffff', { p: [0.17, 0.3, -0.07], s: [0.5, 1, 1.4] });
  // 彩色计时器
  rig.add('timer', 'x', GEO.torus(0.04, 0.012, 16, 6), T_GOLD, { r: [0, PI / 2, 0] });
  rig.add('timer', 'e', GEO.sphere(0.036, 14, 10), '#ffffff', { s: [0.6, 1, 1] });
  // 手臂
  for(const [a, f, c] of [['armF', 'foreF', T_RED], ['armB', 'foreB', T_PURPLE]]){
    rig.add(a, 'x', GEO.sphere(0.075, 14, 10), T_SILVER);
    rig.add(a, 'g', GEO.capsule(0.05, 0.15, 12), c, { p: [0, -0.1, 0] });
    rig.add(f, 'x', GEO.capsule(0.045, 0.15, 12), T_SILVER, { p: [0, -0.09, 0] });
    rig.add(f, 'x', GEO.sphere(0.055, 12, 10), T_SILVER, { p: [0, -0.2, 0] });
  }
  // 头：银色头盔、竖鳍、发光的眼睛
  rig.add('head', 'x', GEO.sphere(0.13, 22, 16), T_SILVER, { p: [0, 0.07, 0], s: [1.05, 1.2, 0.95] });
  rig.add('head', 'x', GEO.box(0.2, 0.05, 0.035), T_SILVER, { p: [-0.02, 0.2, 0], r: [0, 0, 0.1] });
  rig.add('head', 'g', GEO.box(0.13, 0.03, 0.04), T_PURPLE, { p: [-0.04, 0.17, 0] });
  for(const sz of [1, -1]){
    rig.add('head', 'e', GEO.sphere(0.042, 14, 10), '#fff3c4', { p: [0.1, 0.09, sz * 0.05], s: [0.6, 0.85, 1.2], r: [sz * 0.4, 0, 0.3] });
  }
  rig.add('head', 'x', GEO.capsule(0.006, 0.03, 4), '#7c838e', { p: [0.13, 0.0, 0], r: [PI / 2, 0, 0] });
}
const TIMER_BLUE = new Color(0.25, 0.8, 1.6), TIMER_RED = new Color(2.2, 0.2, 0.15);
function tigaAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  const k = Math.min(1, p.recoil || 0);
  const pv = inst.pv;
  // 发射：L 字形的哉佩利敖光线姿势（前臂竖起、后臂横在胸前）
  const fire = pulse(Math.min(1, k * 1.6));
  pv.body.position.y += Math.sin(t * 2 + ph) * 0.012;
  pv.armF.rotation.z = lerp(0.15, 1.35, fire);
  pv.foreF.rotation.z = lerp(0.1, 1.6, fire);
  pv.armB.rotation.z = lerp(-0.1, 1.1, fire);
  pv.armB.rotation.x = lerp(0, -0.9, fire);
  pv.foreB.rotation.z = lerp(0.2, 0.1, fire);
  pv.armF.rotation.x = lerp(0.12, 0.35, fire);
  pv.legF.rotation.z = 0.08; pv.legB.rotation.z = -0.1;
  pv.head.rotation.z = Math.sin(t * 1.3 + ph) * 0.04 - fire * 0.08;
  // 登场：刚放下时从天而降
  const age = (p.maxLifeT || 25) - (p.lifeT === undefined ? 25 : p.lifeT);
  const drop = Math.max(0, 1 - age / 0.7);
  inst.root.position.y += drop * drop * 2.6;
  // 计时器：剩 8 秒起变红闪烁，越到最后闪得越快
  const left = p.lifeT === undefined ? 25 : p.lifeT;
  // 计时器单独一份材质：共用 'e' 会把眼睛和胸灯一起染红
  let timerMat = inst.state.timerMat;
  if(!timerMat){
    timerMat = inst.state.timerMat = inst.mats.mats.e.clone();
    pv.timer.traverse(o => { if(o.isMesh && o.userData.key === 'e') o.material = timerMat; });
  }
  if(left < 8){
    const rate = 4 + (8 - left) * 1.8;
    const on = Math.sin(t * rate) > 0;
    timerMat.color.copy(on ? TIMER_RED : TIMER_BLUE).multiplyScalar(on ? 1 : 0.5);
  } else {
    timerMat.color.copy(TIMER_BLUE);
  }
  env.timerLeft = left;
}
function lerp(a, b, k){ return a + (b - a) * k; }

// ---- 注册表 ----
export const PLANT_MODELS = {
  sunflower: { build: sunflowerBuild, animate: sunflowerAnimate },
  peashooter: {
    build: shooterBuild({ head: GREEN, headL: GREEN_L, leaf: GREEN, stem: STEM, inner: '#123d0a', flash: '#c8ff7a' }),
    animate: shooterAnimate,
  },
  snowpea: {
    build: shooterBuild({ head: '#7fd0f8', headL: '#d4f3ff', leaf: '#4fbfb6', stem: '#3aa58a', inner: '#1a4a6a', crystals: true, flash: '#bff4ff' }),
    animate: shooterAnimate,
  },
  repeater: {
    build: shooterBuild({ head: '#3f9f24', headL: '#7fd04a', leaf: GREEN_D, stem: '#2f7f1e', inner: '#0f3008', crest: true, flash: '#d8ff7a' }),
    animate: shooterAnimate,
  },
  qiuqiu: { build: qiuqiuBuild, animate: qiuqiuAnimate },
  wallnut: { build: wallnutBuild, animate: wallnutAnimate },
  potato: { build: potatoBuild, animate: potatoAnimate },
  torch: { build: torchBuild, animate: torchAnimate },
  cherry: { build: cherryBuild, animate: cherryAnimate },
  puff: {
    build: shroomBuild({ stemH: 0.24, stemR: 0.085, capR: 0.2, cap: '#a45ed8', spot: '#f0c8ff', spots: 6, eye: 0.034, snout: true }),
    animate: shroomAnimate,
  },
  sunshroom: {
    build: shroomBuild({ stemH: 0.22, stemR: 0.09, capR: 0.22, cap: '#ffad2a', spot: '#fff2a0', spots: 7, eye: 0.034, snout: false }),
    animate: shroomAnimate,
  },
  coffee: { build: coffeeBuild, animate: coffeeAnimate },
  tiga: { build: tigaBuild, animate: tigaAnimate },
};

// 图标取景：每种植物在卡片里的缩放与视点高度（按模型实际尺寸调）
export const PLANT_ICON_FRAME = {
  sunflower: { h: 0.95 }, peashooter: { h: 0.8 }, snowpea: { h: 0.82 }, repeater: { h: 0.82 },
  qiuqiu: { h: 1.0 }, wallnut: { h: 0.72 }, potato: { h: 0.5 }, torch: { h: 0.9 }, cherry: { h: 0.62 },
  puff: { h: 0.45 }, sunshroom: { h: 0.45 }, coffee: { h: 0.5 }, tiga: { h: 1.55 },
};
