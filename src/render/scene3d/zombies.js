// 7 种僵尸的 3D 造型与动画。共用一具「驼背、前伸双臂」的人形骨架，按类型换衣服和道具。
//
// 局部坐标与植物相同：脚底在原点，+X 是「面朝的方向」（僵尸朝左走，世界视图会把它整体转过去）。
// 护具（路障、铁桶、报纸、铁门）按剩余耐久分档变形，耗尽时由特效层生成一块飞出去的残骸。
import { Color } from 'three';
import { GEO, eye } from './rig.js';
import { ZTYPES } from '../../core/data/zombies.js';

const PI = Math.PI;
const SKIN = '#9fb98a', SKIN_D = '#7f9a6c';

const LOOKS = {
  normal:    { coat: '#6b4a2f', pants: '#3e4a5e', tie: '#c0262d', shirt: '#e9e3d0' },
  flag:      { coat: '#5f4632', pants: '#3a4558', tie: '#c0262d', shirt: '#e9e3d0' },
  cone:      { coat: '#6b4a2f', pants: '#3e4a5e', tie: '#2f6ec0', shirt: '#e9e3d0' },
  bucket:    { coat: '#4f5a40', pants: '#3a3a3a', tie: '#c0262d', shirt: '#e9e3d0' },
  vault:     { coat: '#c43a36', pants: '#c43a36', tie: null, shirt: '#f4f4f0', stripe: '#ffffff', band: '#ffd23e' },
  newspaper: { coat: '#7a6d5a', pants: '#4a4036', tie: '#7a2a6a', shirt: '#efe8d4', glasses: true, hair: '#d8d8d0' },
  screen:    { coat: '#55606e', pants: '#2f3540', tie: '#d8a020', shirt: '#e9e3d0' },
};

function humanoid(rig, L){
  rig.pivot('hips', 'root', [0, 0.58, 0]);
  rig.pivot('legF', 'hips', [0, -0.02, 0.085]);
  rig.pivot('kneeF', 'legF', [0, -0.27, 0]);
  rig.pivot('legB', 'hips', [0, -0.02, -0.085]);
  rig.pivot('kneeB', 'legB', [0, -0.27, 0]);
  rig.pivot('torso', 'hips', [0, 0.02, 0], [0, 0, -0.2]);
  rig.pivot('head', 'torso', [0.05, 0.45, 0], [0, 0, 0.42]);
  rig.pivot('jaw', 'head', [0.06, -0.06, 0]);
  rig.pivot('hat', 'head', [-0.01, 0.15, 0]);
  rig.pivot('armF', 'torso', [0.01, 0.36, 0.19]);
  rig.pivot('foreF', 'armF', [0, -0.2, 0]);
  rig.pivot('armB', 'torso', [0.01, 0.36, -0.19]);
  rig.pivot('foreB', 'armB', [0, -0.2, 0]);
  // 腿：裤管 + 小腿 + 大头皮鞋
  for(const s of ['F', 'B']){
    rig.add('leg' + s, 'm', GEO.capsule(0.062, 0.2, 12), L.pants, { p: [0, -0.13, 0] });
    rig.add('knee' + s, 'm', GEO.capsule(0.056, 0.18, 12), L.pants, { p: [0, -0.1, 0] });
    if(L.stripe) rig.add('knee' + s, 'm', GEO.box(0.012, 0.22, 0.02), L.stripe, { p: [0, -0.1, s === 'F' ? 0.055 : -0.055] });
    rig.add('knee' + s, 'm', GEO.capsule(0.03, 0.03, 8), SKIN_D, { p: [0, -0.23, 0] });
    rig.add('knee' + s, 'g', GEO.sphere(0.07, 14, 10), '#3a2a1e', { p: [0.04, -0.27, 0], s: [1.6, 0.6, 0.95] });
  }
  // 躯干：外套、白衬衫、领带
  rig.add('torso', 'm', GEO.capsule(0.165, 0.24, 18), L.coat, { p: [0, 0.2, 0], s: [1, 1, 1.12], shade: 0.75 });
  rig.add('torso', 'm', GEO.sphere(0.12, 14, 10), L.shirt, { p: [0.1, 0.27, 0], s: [0.55, 1.1, 0.75] });
  if(L.tie){
    rig.add('torso', 'm', GEO.box(0.02, 0.18, 0.05), L.tie, { p: [0.165, 0.22, 0], r: [0, 0, -0.18] });
    rig.add('torso', 'm', GEO.box(0.025, 0.04, 0.06), L.tie, { p: [0.165, 0.33, 0] });
  }
  for(const z of [0.075, -0.075]) rig.add('torso', 'm', GEO.box(0.03, 0.2, 0.05), shade(L.coat, 0.75), { p: [0.13, 0.25, z], r: [z > 0 ? 0.3 : -0.3, 0, -0.15] });
  for(const y of [0.08, 0.15]) rig.add('torso', 'g', GEO.sphere(0.014, 8, 6), '#2a2018', { p: [0.155, y, 0.05] });
  // 胳膊：袖子 + 前臂 + 手
  for(const s of ['F', 'B']){
    rig.add('arm' + s, 'm', GEO.capsule(0.052, 0.14, 12), L.coat, { p: [0, -0.1, 0] });
    rig.add('fore' + s, 'm', GEO.torus(0.045, 0.012, 14, 6), L.shirt, { p: [0, -0.01, 0], r: [PI / 2, 0, 0] });
    rig.add('fore' + s, 'm', GEO.capsule(0.038, 0.12, 10), SKIN, { p: [0, -0.08, 0] });
    rig.add('fore' + s, 'm', GEO.sphere(0.05, 12, 10), SKIN, { p: [0.01, -0.19, 0], s: [1, 1.1, 0.7] });
    for(let k = 0; k < 3; k++) rig.add('fore' + s, 'm', GEO.capsule(0.012, 0.04, 6), SKIN_D, { p: [0.02 + k * 0.006, -0.25, (k - 1) * 0.022] });
  }
  // 头：长脸、一大一小两只眼、稀疏的头发、下颌单独成节点（啃食时开合）
  rig.add('head', 'm', GEO.capsule(0.05, 0.08, 10), SKIN_D, { p: [-0.02, -0.12, 0] });
  rig.add('head', 'm', GEO.sphere(0.17, 22, 16), SKIN, { p: [0, 0.02, 0], s: [1.08, 1.12, 0.98], shade: 0.8 });
  rig.add('head', 'm', GEO.sphere(0.03, 8, 6), SKIN_D, { p: [0.17, 0.0, 0.02], s: [1.2, 0.9, 0.9] });   // 鼻子
  rig.add('head', 'm', GEO.sphere(0.045, 10, 8), SKIN_D, { p: [-0.03, 0.02, 0.165], s: [0.6, 1, 0.5] });   // 耳朵
  eye(rig, 'head', [0.13, 0.07, 0.085], 0.058, { white: '#f3f0cf', iris: '#2a2a20', pupil: 0.32, dir: [0.9, 0.05, 0.3] });
  eye(rig, 'head', [0.15, 0.06, -0.05], 0.04, { white: '#f3f0cf', iris: '#2a2a20', pupil: 0.36, dir: [1, 0, 0.1] });
  rig.add('head', 'm', GEO.capsule(0.012, 0.07, 6), '#3a3a28', { p: [0.155, 0.135, 0.09], r: [PI / 2 + 0.35, 0, 0] });
  rig.add('head', 'm', GEO.capsule(0.011, 0.05, 6), '#3a3a28', { p: [0.17, 0.12, -0.05], r: [PI / 2 - 0.3, 0, 0] });
  const hair = L.hair || '#2e2a20';
  for(let i = 0; i < 5; i++){
    const z = (i - 2) * 0.045, x = -0.03 + (i % 2) * 0.03;
    rig.add('head', 'm', GEO.tube([[x, 0.17, z], [x + 0.03, 0.23, z * 1.2], [x + 0.08, 0.25 + (i % 2) * 0.02, z * 1.4]], 0.008, 8, 4), hair);
  }
  // 下颌与牙齿
  rig.add('jaw', 'm', GEO.sphere(0.1, 16, 10), SKIN, { p: [0.02, -0.02, 0], s: [1.05, 0.55, 1.05] });
  rig.add('jaw', 'm', GEO.box(0.02, 0.03, 0.13), '#3a1a14', { p: [0.1, 0.02, 0] });
  for(let k = 0; k < 4; k++){
    rig.add('jaw', 'g', GEO.box(0.02, 0.028, 0.022), '#f0ead0', { p: [0.1, 0.035, -0.045 + k * 0.03], r: [0, 0, (k % 2) * 0.2] });
  }
  if(L.glasses){
    for(const z of [0.085, -0.05]) rig.add('head', 'x', GEO.torus(0.05, 0.007, 16, 5), '#2a2a2a', { p: [0.17, 0.065, z], r: [0, PI / 2, 0] });
    rig.add('head', 'x', GEO.box(0.008, 0.008, 0.06), '#2a2a2a', { p: [0.18, 0.07, 0.018] });
  }
  if(L.band){
    rig.add('head', 'm', GEO.torus(0.165, 0.022, 24, 6), L.band, { p: [0, 0.09, 0], r: [PI / 2, 0, 0.15] });
  }
}
function shade(hex, k){ const c = new Color(hex); c.multiplyScalar(k); return c; }

// ---- 护具与道具 ----
export function buildCone(rig, pv){
  rig.add(pv, 'g', GEO.lathe([[0.17, 0], [0.165, 0.02], [0.12, 0.12], [0.065, 0.26], [0.025, 0.33], [0.001, 0.335]], 24), '#ff7a18', { shade: 0.75 });
  rig.add(pv, 'g', GEO.cyl(0.115, 0.13, 0.04, 24, true), '#f6f2e8', { p: [0, 0.1, 0] });
  rig.add(pv, 'g', GEO.cyl(0.07, 0.085, 0.035, 24, true), '#f6f2e8', { p: [0, 0.21, 0] });
  rig.add(pv, 'g', GEO.box(0.36, 0.03, 0.36), '#e86a10', { p: [0, 0.0, 0] });
}
export function buildBucket(rig, pv){
  rig.add(pv, 'x', GEO.cyl(0.165, 0.185, 0.26, 26, true), '#a7b0ba', { p: [0, 0.1, 0], shade: 0.7 });
  rig.add(pv, 'x', GEO.cyl(0.165, 0.165, 0.01, 26), '#8e979f', { p: [0, 0.23, 0] });
  rig.add(pv, 'x', GEO.torus(0.185, 0.014, 28, 6), '#c8d0d8', { p: [0, -0.03, 0], r: [PI / 2, 0, 0] });
  for(const y of [0.04, 0.16]) rig.add(pv, 'x', GEO.torus(0.178 - y * 0.08, 0.006, 28, 4), '#7d868e', { p: [0, y, 0], r: [PI / 2, 0, 0] });
  rig.add(pv, 'x', GEO.torus(0.13, 0.007, 16, 4, PI), '#7d868e', { p: [0, 0.0, 0], r: [0, 0, PI] });
}
export function buildDoor(rig, pv){
  const F = '#3b4048';
  rig.add(pv, 'x', GEO.box(0.04, 0.98, 0.04), F, { p: [0, 0, 0.29] });
  rig.add(pv, 'x', GEO.box(0.04, 0.98, 0.04), F, { p: [0, 0, -0.29] });
  for(const y of [0.47, 0, -0.47]) rig.add(pv, 'x', GEO.box(0.04, 0.04, 0.6), F, { p: [0, y, 0] });
  rig.add(pv, 't', GEO.box(0.006, 0.92, 0.55), '#b8c4cc');
  for(let i = 1; i < 9; i++) rig.add(pv, 'x', GEO.box(0.008, 0.004, 0.55), '#6a737c', { p: [0.004, -0.46 + i * 0.102, 0] });
  for(let i = 1; i < 6; i++) rig.add(pv, 'x', GEO.box(0.008, 0.92, 0.004), '#6a737c', { p: [0.004, 0, -0.275 + i * 0.092] });
  rig.add(pv, 'x', GEO.sphere(0.025, 10, 8), '#e0b040', { p: [0.04, 0, -0.22] });
}
export function buildPaper(rig, pv){
  // 摊开的报纸：两页微微折成 V 形，朝外一面印着标题和栏线
  for(const sz of [1, -1]){
    rig.add(pv, 'm', GEO.box(0.012, 0.34, 0.25), '#efe9d6', { p: [0.02 * (1 - sz * 0), 0, sz * 0.125], r: [0, sz * 0.25, 0] });
    rig.add(pv, 'm', GEO.box(0.004, 0.05, 0.2), '#2a2a2a', { p: [0.034 + (sz > 0 ? -0.03 : 0.03), 0.12, sz * 0.12], r: [0, sz * 0.25, 0] });
    for(let k = 0; k < 6; k++){
      rig.add(pv, 'm', GEO.box(0.004, 0.012, 0.09), '#8a867a', { p: [0.034 + (sz > 0 ? -0.03 : 0.03), 0.05 - k * 0.035, sz * (0.07 + (k % 2) * 0.1)], r: [0, sz * 0.25, 0] });
    }
  }
}
export function buildFlag(rig, pv){
  rig.add(pv, 'm', GEO.cyl(0.012, 0.012, 0.8, 8), '#6a4a2a', { p: [0, 0.4, 0] });
  rig.add(pv, 'x', GEO.sphere(0.025, 10, 8), '#e0b040', { p: [0, 0.81, 0] });
}
export function buildPole(rig, pv){
  rig.add(pv, 'm', GEO.cyl(0.018, 0.018, 1.5, 10), '#d4a24e', { r: [0, 0, PI / 2] });
  rig.add(pv, 'm', GEO.cyl(0.022, 0.022, 0.08, 10), '#3a3a3a', { p: [0.72, 0, 0], r: [0, 0, PI / 2] });
}

function zombieBuild(type){
  return rig => {
    const L = LOOKS[type];
    humanoid(rig, L);
    if(type === 'cone'){ rig.pivot('acc', 'hat'); buildCone(rig, 'acc'); }
    if(type === 'bucket'){ rig.pivot('acc', 'hat', [0, -0.04, 0]); buildBucket(rig, 'acc'); }
    if(type === 'newspaper'){ rig.pivot('acc', 'torso', [0.36, 0.38, 0], [0, 0, 0.1]); buildPaper(rig, 'acc'); }
    if(type === 'screen'){ rig.pivot('acc', 'torso', [0.34, 0.12, 0], [0, 0, 0.2]); buildDoor(rig, 'acc'); }
    if(type === 'flag'){
      rig.pivot('flagpole', 'foreB', [0.02, -0.2, 0], [0, 0, -1.25]);
      buildFlag(rig, 'flagpole');
      let parent = 'flagpole';
      for(let i = 0; i < 4; i++){
        const name = 'cloth' + i;
        rig.pivot(name, parent, i === 0 ? [0, 0.68, 0] : [0, 0, -0.1]);
        rig.add(name, 'm', GEO.box(0.008, 0.26, 0.1), i % 2 ? '#c82a30' : '#b02228', { p: [0, 0, -0.05] });
        if(i === 1) rig.add(name, 'm', GEO.sphere(0.05, 12, 8), '#f0c8c8', { p: [0.008, 0.02, -0.05], s: [0.15, 1, 1] });
        parent = name;
      }
    }
    if(type === 'vault'){ rig.pivot('acc', 'foreF', [0.02, -0.19, 0], [0, 0, 1.2]); buildPole(rig, 'acc'); }
    if(type === 'newspaper'){
      rig.pivot('rage', 'head');
      for(const z of [0.085, -0.05]) rig.add('rage', 'e', GEO.sphere(0.022, 10, 8), '#ff3018', { p: [0.185, 0.065, z] });
    }
  };
}

// ---- 动画 ----
const ANGRY = new Color(1.15, 0.62, 0.55), FROZEN = new Color(0.62, 0.85, 1.25), ASH = new Color(0.12, 0.11, 0.1);
function zombieAnimate(inst, z, t, env){
  const pv = inst.pv;
  const def = ZTYPES[z.type] || ZTYPES.normal;
  const ph = (z.animT || 0) * (z.angry ? 4.6 : 3.4);
  const st = z.state;
  const sw = Math.sin(ph), cw = Math.cos(ph);
  // 走路：大幅度甩腿、膝盖在后摆时弯曲、双臂前伸微晃
  let legA = 0.42, armBase = 1.3;
  if(z.type === 'newspaper' && !z.angry){ legA = 0.26; armBase = 1.0; }
  if(st === 'walk' || st === 'dying'){
    pv.legF.rotation.z = sw * legA; pv.legB.rotation.z = -sw * legA;
    pv.kneeF.rotation.z = -Math.max(0, -cw) * 0.6; pv.kneeB.rotation.z = -Math.max(0, cw) * 0.6;
    pv.hips.position.y += Math.abs(sw) * 0.025;
    pv.hips.rotation.y = sw * 0.08;
    pv.torso.rotation.x = sw * 0.05;
    pv.armF.rotation.z = armBase + Math.sin(ph + 0.6) * 0.12;
    pv.armB.rotation.z = armBase - 0.08 - Math.sin(ph + 0.6) * 0.12;
    pv.head.rotation.z = Math.sin(ph * 0.5) * 0.08;
    pv.head.rotation.x = Math.sin(ph * 0.5 + 1) * 0.08;
  }
  if(z.angry){
    pv.armF.rotation.z = 1.9 + Math.sin(ph * 2) * 0.5;
    pv.armB.rotation.z = 1.7 - Math.sin(ph * 2) * 0.5;
    pv.torso.rotation.z -= 0.15;
  }
  if(z.type === 'newspaper' && !z.angry){
    pv.foreF.rotation.z = 0.9; pv.foreB.rotation.z = 0.9;
    pv.head.rotation.z -= 0.15;
  }
  if(z.type === 'screen' && pv.acc && pv.acc.visible){
    pv.armF.rotation.z = 1.25; pv.foreF.rotation.z = 0.5;
    pv.armB.rotation.z = 1.1; pv.foreB.rotation.z = 0.6;
  }
  if(z.type === 'flag'){
    pv.armB.rotation.z = 2.4 + Math.sin(ph) * 0.06;
    pv.foreB.rotation.z = 0.2;
    for(let i = 0; i < 4; i++) pv['cloth' + i].rotation.y = Math.sin(t * 5 - i * 0.9) * 0.35;
  }
  if(z.type === 'vault' && !z.poleLost){
    pv.armF.rotation.z = 0.7; pv.foreF.rotation.z = 0.9;
    pv.armB.rotation.z = 0.8; pv.foreB.rotation.z = 0.9;
    pv.torso.rotation.z -= 0.15;
  }
  // 啃食：双臂抓住、头往前扑、下巴开合（与 0.62 秒一口的音效同拍）
  if(st === 'eat'){
    const e = z.eatT || 0;
    const bite = Math.abs(Math.sin(e / 0.62 * PI));
    pv.armF.rotation.z = 1.55 + Math.sin(e * 9) * 0.1;
    pv.armB.rotation.z = 1.45 + Math.cos(e * 9) * 0.1;
    pv.foreF.rotation.z = 0.35; pv.foreB.rotation.z = 0.35;
    pv.torso.rotation.z -= 0.18 + bite * 0.12;
    pv.head.rotation.z = -0.25 - bite * 0.3;
    pv.jaw.rotation.z = -bite * 0.5;
    pv.legF.rotation.z = 0.15; pv.legB.rotation.z = -0.25;
  } else {
    pv.jaw.rotation.z = -0.15 - Math.abs(Math.sin(t * 1.7 + z.row)) * 0.12;
  }
  // 撑杆跳：收腿、身体前倾，撑杆竖起
  if(st === 'vault'){
    const k = Math.min(1, z.vt || 0);
    pv.legF.rotation.z = 0.9; pv.legB.rotation.z = 0.5;
    pv.kneeF.rotation.z = -1.2; pv.kneeB.rotation.z = -1.0;
    pv.torso.rotation.z = -0.5 + k * 0.4;
    pv.armF.rotation.z = 2.6; pv.armB.rotation.z = 2.5;
    if(pv.acc) pv.acc.rotation.z = 1.2 + k * 1.6;
  }
  if(pv.acc && z.type === 'vault') pv.acc.visible = !z.poleLost;
  // 护具分档
  const accFrac = def.acc > 0 ? Math.max(0, z.acc === undefined ? def.acc : z.acc) / def.acc : 0;
  if(pv.acc && z.type !== 'vault'){
    const alive = accFrac > 0 && !(z.type === 'newspaper' && z.angry);
    pv.acc.visible = alive;
    if(alive){
      const dmg = accFrac > 0.66 ? 0 : accFrac > 0.33 ? 1 : 2;
      if(z.type === 'cone'){ pv.acc.rotation.z = -dmg * 0.18; pv.acc.scale.set(1, 1 - dmg * 0.12, 1); }
      if(z.type === 'bucket'){ pv.acc.rotation.x = dmg * 0.12; pv.acc.scale.set(1 + dmg * 0.04, 1 - dmg * 0.1, 1); }
      if(z.type === 'screen'){ pv.acc.rotation.x = dmg * 0.08; pv.acc.rotation.y = dmg * 0.06; }
      if(z.type === 'newspaper'){ pv.acc.scale.set(1, 1 - dmg * 0.15, 1 - dmg * 0.2); }
    }
  }
  if(pv.rage) pv.rage.visible = !!z.angry;
  // 掉胳膊：本体血量过半
  const bodyFrac = def.hp > 0 ? (z.hp === undefined ? def.hp : z.hp) / def.hp : 1;
  pv.foreB.visible = bodyFrac > 0.5 || z.type === 'flag';
  env.armLost = bodyFrac <= 0.5 && z.type !== 'flag';
  // 死亡：脑袋先飞出去，身子向后倒下，最后沉入地面淡出；被炸死则变成焦炭碎掉
  if(st === 'dying'){
    const k = Math.min(1, (z.deathT || 0) / 0.95);
    if(env.ash){
      inst.root.scale.set(1 + k * 0.1, Math.max(0.05, 1 - Math.max(0, k - 0.35) * 1.5), 1 + k * 0.1);
      env.tint = ASH;
    } else {
      const hk = Math.min(1, k * 2.2);
      pv.head.position.y += hk * 0.25 - hk * hk * 0.55;
      pv.head.position.x -= hk * 0.25;
      pv.head.rotation.z += hk * 2.2;
      const fall = pulse(Math.min(1, k * 1.6));
      inst.root.rotation.z = fall * 1.45;
      inst.root.position.x = -fall * 0.2;
      inst.root.position.y = -Math.max(0, k - 0.75) * 0.6;
      pv.armF.rotation.z = 1.3 - fall * 1.0; pv.armB.rotation.z = 1.2 - fall * 0.9;
    }
    env.fade = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
  }
  if(!env.tint){
    if(z.angry) env.tint = ANGRY;
    else if((z.slowT || 0) > 0) env.tint = FROZEN;
  }
}
function pulse(k){ return k * k * (3 - 2 * k); }

export const ZOMBIE_MODELS = {};
for(const type of Object.keys(LOOKS)) ZOMBIE_MODELS[type] = { build: zombieBuild(type), animate: zombieAnimate };

// 残骸：护具被打掉、胳膊被打断时飞出去的那一块
export const DEBRIS_MODELS = {
  cone: { build: rig => buildCone(rig, 'root') },
  bucket: { build: rig => buildBucket(rig, 'root') },
  screen: { build: rig => buildDoor(rig, 'root') },
  newspaper: { build: rig => buildPaper(rig, 'root') },
  arm: { build: rig => {
    rig.add('root', 'm', GEO.capsule(0.038, 0.12, 10), SKIN, { p: [0, -0.08, 0] });
    rig.add('root', 'm', GEO.sphere(0.05, 12, 10), SKIN, { p: [0.01, -0.19, 0] });
    rig.add('root', 'm', GEO.torus(0.045, 0.012, 14, 6), '#e9e3d0', { r: [PI / 2, 0, 0] });
  } },
};
