// 7 种僵尸的方块造型与动画。共用一具「头、身、两臂两腿」的方块人骨架，按类型换衣服贴图和道具。
//
// 尺寸单位是像素（32 像素 = 一格宽），比例接近方块游戏的人形：大头、方身、细长四肢。
// 局部坐标与植物相同：脚底在原点，+X 是面朝方向（僵尸朝左走，世界视图会把它整体转过去）。
// 护具（路障、铁桶、报纸、铁门）按剩余耐久分档变形，耗尽时由特效层生成一块飞出去的残骸。
import { Color } from 'three';
import { noise, ramp, layers, spots, sprite, hex, shade, tone } from './pixels.js';
import { ZTYPES } from '../../core/data/zombies.js';

const PI = Math.PI;
const SKIN = '#8fb57a', SKIN_D = '#6f9a5c';

const LOOKS = {
  normal:    { coat: '#6b4a2f', pants: '#3e4a6e', tie: '#c0262d', shirt: '#e9e3d0' },
  flag:      { coat: '#5f4632', pants: '#3a4568', tie: '#c0262d', shirt: '#e9e3d0' },
  cone:      { coat: '#6b4a2f', pants: '#3e4a6e', tie: '#2f6ec0', shirt: '#e9e3d0' },
  bucket:    { coat: '#4f5a40', pants: '#3a3a3a', tie: '#c0262d', shirt: '#e9e3d0' },
  vault:     { coat: '#c43a36', pants: '#c43a36', tie: null, shirt: '#f4f4f0', stripe: '#ffffff', band: '#ffd23e' },
  newspaper: { coat: '#7a6d5a', pants: '#4a4036', tie: '#7a2a6a', shirt: '#efe8d4', glasses: true, hair: '#d8d8d0' },
  screen:    { coat: '#55606e', pants: '#2f3540', tie: '#d8a020', shirt: '#e9e3d0' },
};

// ---- 贴图 ----
function faceTex(type, L){
  return { key: 'zface:' + type, paint: layers(noise(SKIN, 0.09), spots(SKIN_D, 5, 1), sprite([
    '.........',
    '.........',
    '.bbb..bb.',
    '.kwk..kw.',
    '.kkk..kk.',
    '.........',
    '....d....',
    '.........',
    '.........',
  ], { k: '#1e2a14', w: '#f3f0cf', b: '#3a3a28', d: SKIN_D }), L.glasses ? sprite([
    '.........', '.........', 'ggggggggg', 'g...gg..g', 'ggggggggg',
  ], { g: '#2a2a2a' }) : () => {}, (p, w) => {
    const hair = hex(L.hair || '#2e2a20');
    for(let x = 0; x < w; x++) if(x % 3 !== 1) p.px(x, 0, hair);
  }) };
}
function headSide(type, L, far){
  return { key: 'zside:' + type + (far ? ':f' : ''), paint: layers(noise(SKIN, 0.09), spots(SKIN_D, 4, 1), (p, w) => {
    const hair = hex(L.hair || '#2e2a20');
    for(let x = 0; x < w; x++) if((x + 1) % 3) p.px(x, 0, hair);
    p.rect(far ? 2 : w - 4, 4, 2, 2, SKIN_D);         // 耳朵
  }) };
}
function headTop(type, L){
  return { key: 'ztop:' + type, paint: layers(noise(SKIN, 0.09), spots(L.hair || '#2e2a20', 7, 1)) };
}
const JAW_FRONT = { key: 'zjaw', paint: layers(noise(SKIN, 0.09), sprite([
  '.kkkkkk.',
  '.wkwkwk.',
  '........',
], { k: '#3a1a14', w: '#f0ead0' })) };
function torsoFront(type, L){
  return { key: 'ztorso:' + type, paint: (p, w, h, R) => {
    const coat = hex(L.coat), shirt = hex(L.shirt);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const mid = Math.abs(x - (w - 1) / 2);
      const open = mid < 2 - y * 0.08 + 1 && y < h - 2;
      p.px(x, y, shade(open ? shirt : coat, 0.92 + R() * 0.14));
    }
    if(L.tie){ const t = hex(L.tie); const cx = Math.floor(w / 2); p.rect(cx - 1, 0, 2, 1, t); for(let y = 1; y < h * 0.6; y++) p.px(cx - (y > 4 ? 0 : 1), y, t); p.rect(cx - 1, Math.floor(h * 0.6), 2, 1, t); }
    if(L.stripe){ for(let y = 0; y < h; y++) p.px(Math.floor(w / 2), y, hex(L.stripe)); }
    p.px(1, Math.floor(h * 0.45), [40, 30, 20]); p.px(1, Math.floor(h * 0.7), [40, 30, 20]);
    // 衣服上的破洞
    if(type === 'normal' || type === 'flag') p.rect(w - 3, h - 4, 2, 2, hex(SKIN_D));
  } };
}
function cloth(c, id){ return { key: 'zcloth:' + id, paint: layers(noise(c, 0.1), spots(tone(c, 0.75), 4, 1)) }; }
const SLEEVE_HAND = (coat, id) => ({ key: 'zarm:' + id, paint: (p, w, h, R) => {
  const c = hex(coat), s = hex(SKIN);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(y < h * 0.55 ? c : s, 0.9 + R() * 0.16));
} });

function humanoid(rig, type, L){
  rig.pivot('hips', 'root', [0, 10, 0]);
  rig.pivot('legF', 'hips', [0, 0, 2]);
  rig.pivot('kneeF', 'legF', [0, -5, 0]);
  rig.pivot('legB', 'hips', [0, 0, -2]);
  rig.pivot('kneeB', 'legB', [0, -5, 0]);
  rig.pivot('torso', 'hips', [0, 0, 0], [0, 0, -0.18]);
  rig.pivot('head', 'torso', [0.5, 11, 0], [0, 0, 0.25]);
  rig.pivot('jaw', 'head', [2.5, 0.5, 0]);
  rig.pivot('hat', 'head', [0, 9, 0]);
  rig.pivot('armF', 'torso', [0, 10, 5.6]);
  rig.pivot('foreF', 'armF', [0, -5, 0]);
  rig.pivot('armB', 'torso', [0, 10, -5.6]);
  rig.pivot('foreB', 'armB', [0, -5, 0]);
  const pants = cloth(L.pants, type + ':pants');
  for(const s of ['F', 'B']){
    rig.box('leg' + s, 'm', [3.6, 5, 3.6], [0, -2.5, 0], pants);
    rig.box('knee' + s, 'm', [3.4, 5, 3.4], [0, -2.5, 0], pants);
    rig.box('knee' + s, 'g', [5, 1.6, 3.8], [0.8, -4.4, 0], { all: '#3a2a1e', top: '#4a3626' });
  }
  rig.stand('torso', 'm', [5, 11, 8], [0, 0, 0], { all: cloth(L.coat, type + ':coat'), front: torsoFront(type, L) });
  for(const s of ['F', 'B']){
    rig.box('arm' + s, 'm', [3, 5.5, 3], [0, -2.5, 0], cloth(L.coat, type + ':coat'));
    rig.box('fore' + s, 'm', [2.8, 6, 2.8], [0, -3, 0], { sides: SLEEVE_HAND(L.coat, type), top: L.coat, bottom: SKIN });
  }
  rig.stand('head', 'm', [8, 9, 8], [0, 0, 0], { front: faceTex(type, L), near: headSide(type, L, false), far: headSide(type, L, true), top: headTop(type, L), back: headSide(type, L, true), bottom: SKIN });
  rig.box('jaw', 'm', [3.5, 2.6, 6.4], [0, -1, 0], { all: SKIN, front: JAW_FRONT });
  if(L.band) rig.box('head', 'm', [8.4, 1.5, 8.4], [0, 7, 0], L.band);
}

// ---- 护具与道具（也用作被打掉时飞出去的残骸）----
const CONE_TEX = { key: 'cone', paint: (p, w, h, R) => {
  const o = hex('#ff7a18'), wht = hex('#f6f2e8');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(y % 5 === 2 ? wht : o, 0.92 + R() * 0.12));
} };
export function buildCone(rig, pv){
  rig.stand(pv, 'g', [10, 1.5, 10], [0, 0, 0], '#e86a10');
  rig.stand(pv, 'g', [7, 4, 7], [0, 1.5, 0], CONE_TEX);
  rig.stand(pv, 'g', [5, 3, 5], [0, 5.5, 0], CONE_TEX);
  rig.stand(pv, 'g', [3, 3, 3], [0, 8.5, 0], '#ff7a18');
}
const BUCKET_TEX = { key: 'bucket', paint: (p, w, h, R) => {
  const m = hex('#a7b0ba');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(m, (y === 1 || y === h - 2 ? 0.72 : 1) * (x % 4 === 0 ? 1.08 : 1) * (0.94 + R() * 0.1)));
} };
export function buildBucket(rig, pv){
  rig.stand(pv, 'x', [9.4, 7, 9.4], [0, -1.5, 0], { sides: BUCKET_TEX, top: '#8e979f', bottom: '#5a6068' });
  rig.stand(pv, 'x', [10.4, 1, 10.4], [0, -2, 0], '#c8d0d8');
  rig.box(pv, 'x', [1, 1, 9], [4.9, 1, 0], '#7d868e');
}
const DOOR_MESH = { key: 'doormesh', paint: (p, w, h) => {
  p.clear();
  const c = hex('#9aa6b0');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) if(x % 3 === 0 || y % 3 === 0) p.px(x, y, shade(c, 0.85 + ((x + y) % 2) * 0.15));
} };
export function buildDoor(rig, pv){
  const F = '#3b4048';
  for(const z of [-9, 9]) rig.box(pv, 'x', [1.2, 30, 1.2], [0, 0, z], F);
  for(const y of [-14.4, 0, 14.4]) rig.box(pv, 'x', [1.2, 1.2, 19], [0, y, 0], F);
  rig.box(pv, 't', [0.4, 28, 17], [0, 0, 0], { front: DOOR_MESH, back: DOOR_MESH, sides: 'clear', top: 'clear', bottom: 'clear' });
  rig.box(pv, 'x', [1, 1.6, 1.6], [1, 0, -6.5], '#e0b040');
}
const PAPER_TEX = { key: 'paper', paint: (p, w, h, R) => {
  p.fill('#efe9d6');
  const k = hex('#3a3a3a'), g = hex('#8a867a');
  p.rect(1, 1, w - 2, 2, k);
  for(let y = 4; y < h - 1; y += 2) for(let x = 1; x < w - 1; x++) if(R() < 0.75 && (x + 1) % Math.max(4, Math.floor(w / 2)) !== 0) p.px(x, y, g);
  p.rect(Math.floor(w / 2) + 1, 5, Math.floor(w / 2) - 2, 3, [120, 120, 120]);
} };
export function buildPaper(rig, pv){
  for(const s of [1, -1]) rig.box(pv, 'm', [0.6, 11, 8], [0, 0, s * 4], { front: PAPER_TEX, back: PAPER_TEX, sides: '#e0d8c4', top: '#e0d8c4', bottom: '#e0d8c4' }, { r: [0, s * 0.25, 0] });
}
export function buildFlag(rig, pv){
  rig.stand(pv, 'm', [1, 26, 1], [0, 0, 0], '#6a4a2a');
  rig.box(pv, 'x', [1.6, 1.6, 1.6], [0, 26.5, 0], '#e0b040');
}
export function buildPole(rig, pv){
  rig.box(pv, 'm', [48, 1.2, 1.2], [0, 0, 0], { key: 'pole', paint: (p, w, h, R) => { for(let x = 0; x < w; x++) p.rect(x, 0, 1, h, x % 6 < 3 ? '#d4a24e' : '#e8c070'); } });
}
const FLAG_TEX = { key: 'flagcloth', paint: (p, w, h, R) => {
  const r = hex('#c82a30');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(r, 0.9 + R() * 0.15));
  sprite(['.ss.', 'skks', 'ssss', '.s.s'], { s: '#f0c8c8', k: '#3a0808' }, Math.max(0, Math.floor(w / 2) - 2), 2)(p);
} };

function zombieBuild(type){
  return rig => {
    const L = LOOKS[type];
    humanoid(rig, type, L);
    if(type === 'cone'){ rig.pivot('acc', 'hat'); buildCone(rig, 'acc'); }
    if(type === 'bucket'){ rig.pivot('acc', 'hat', [0, -1, 0]); buildBucket(rig, 'acc'); }
    if(type === 'newspaper'){ rig.pivot('acc', 'torso', [9, 11, 0], [0, 0, 0.1]); buildPaper(rig, 'acc'); }
    if(type === 'screen'){ rig.pivot('acc', 'torso', [10, 5, 0], [0, 0, 0.18]); buildDoor(rig, 'acc'); }
    if(type === 'flag'){
      rig.pivot('flagpole', 'foreB', [0.5, -6, 0], [0, 0, -1.25]);
      buildFlag(rig, 'flagpole');
      let parent = 'flagpole';
      for(let i = 0; i < 4; i++){
        const name = 'cloth' + i;
        rig.pivot(name, parent, i === 0 ? [0, 22, 0] : [0, 0, -3]);
        rig.box(name, 'm', [0.6, 8, 3], [0, 0, -1.5], { near: FLAG_TEX, far: FLAG_TEX, sides: '#b02228', top: '#b02228', bottom: '#b02228' });
        parent = name;
      }
    }
    if(type === 'vault'){ rig.pivot('acc', 'foreF', [0.5, -6, 0], [0, 0, 1.2]); buildPole(rig, 'acc'); }
    if(type === 'newspaper'){
      rig.pivot('rage', 'head');
      for(const z of [2.2, -2]) rig.box('rage', 'e', [0.6, 1.4, 1.6], [4.2, 5.2, z], null, { tint: '#ff3018' });
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
  // 走路：方块人式的大幅甩腿，双臂前伸
  let legA = 0.5, armBase = 1.45;
  if(z.type === 'newspaper' && !z.angry){ legA = 0.3; armBase = 1.0; }
  if(st === 'walk' || st === 'dying'){
    pv.legF.rotation.z = sw * legA; pv.legB.rotation.z = -sw * legA;
    pv.kneeF.rotation.z = -Math.max(0, -cw) * 0.5; pv.kneeB.rotation.z = -Math.max(0, cw) * 0.5;
    pv.hips.position.y += Math.abs(sw) * 0.02;
    pv.hips.rotation.y = sw * 0.06;
    pv.torso.rotation.x = sw * 0.05;
    pv.armF.rotation.z = armBase + Math.sin(ph + 0.6) * 0.1;
    pv.armB.rotation.z = armBase - 0.08 - Math.sin(ph + 0.6) * 0.1;
    pv.head.rotation.z += Math.sin(ph * 0.5) * 0.07;
    pv.head.rotation.x = Math.sin(ph * 0.5 + 1) * 0.08;
  }
  if(z.angry){
    pv.armF.rotation.z = 2.0 + Math.sin(ph * 2) * 0.5;
    pv.armB.rotation.z = 1.8 - Math.sin(ph * 2) * 0.5;
    pv.torso.rotation.z -= 0.15;
  }
  if(z.type === 'newspaper' && !z.angry){
    pv.foreF.rotation.z = 0.9; pv.foreB.rotation.z = 0.9;
    pv.head.rotation.z -= 0.15;
  }
  if(z.type === 'screen' && pv.acc && pv.acc.visible){
    pv.armF.rotation.z = 1.3; pv.foreF.rotation.z = 0.4;
    pv.armB.rotation.z = 1.15; pv.foreB.rotation.z = 0.5;
  }
  if(z.type === 'flag'){
    pv.armB.rotation.z = 2.5 + Math.sin(ph) * 0.06;
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
    pv.armF.rotation.z = 1.6 + Math.sin(e * 9) * 0.1;
    pv.armB.rotation.z = 1.5 + Math.cos(e * 9) * 0.1;
    pv.foreF.rotation.z = 0.35; pv.foreB.rotation.z = 0.35;
    pv.torso.rotation.z -= 0.18 + bite * 0.12;
    pv.head.rotation.z = -0.2 - bite * 0.3;
    pv.jaw.position.y -= bite * 0.06;
    pv.legF.rotation.z = 0.15; pv.legB.rotation.z = -0.25;
  } else {
    pv.jaw.position.y -= Math.abs(Math.sin(t * 1.7 + (z.row || 0))) * 0.025;
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
  arm: { build: rig => rig.box('root', 'm', [2.8, 6, 2.8], [0, -3, 0], { sides: SLEEVE_HAND('#6b4a2f', 'debris'), top: '#6b4a2f', bottom: SKIN }) },
};
