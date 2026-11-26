// 13 种植物的方块造型与动画。
//
// 尺寸单位是像素（32 像素 = 一格宽），每个零件是一个贴像素图的长方体。
// 局部坐标：脚底在原点，+X 面朝僵尸（front），+Y 向上，+Z 朝镜头（near）。
//
// 每个模型两段：build(rig) 只在第一次用到该类型时执行，生成可共享的模板；
// animate(inst, p, t, env) 每帧执行，只读植物实体，按姿态参数摆节点。
import { Color } from 'three';
import { noise, ramp, layers, spots, sprite, centered, bark, rings, leaves, hex, shade, tone } from './pixels.js';

const PI = Math.PI;

// ---- 调色 ----
const GREEN = '#5cc23a', GREEN_D = '#3a8a24', LEAF = '#3f9a2a';

// 方块眼睛：白眼白 + 黑瞳孔 + 一颗高光
const EYES_2 = ['wwk', 'wkk'];
function eyesFace(base, o = {}){
  const pal = { w: '#ffffff', k: o.pupil || '#141414', b: o.brow || '#1d2a10', m: o.mouth || '#2a1206', r: '#ff8fa0', h: '#ffffff' };
  return { key: 'face:' + (o.id || base) , paint: layers(noise(base, 0.08), (p, w, h) => {
    const ey = o.y === undefined ? 1 : o.y;
    const gap = o.gap === undefined ? Math.max(1, Math.floor(w / 2) - 3) : o.gap;
    const lx = Math.floor((w - (6 + gap)) / 2);
    const rows = o.eyes || EYES_2;
    sprite(rows, pal, lx, ey)(p);
    sprite(rows.map(r => r.split('').reverse().join('')), pal, lx + 3 + gap, ey)(p);
    if(o.angry){ p.rect(lx, ey - 1, 2, 1, pal.b); p.rect(lx + 1, ey, 1, 1, pal.b); p.rect(lx + 4 + gap, ey - 1, 2, 1, pal.b); p.rect(lx + 4 + gap, ey, 1, 1, pal.b); }
    if(o.smile){ const my = ey + 4; p.rect(lx + 1, my, 1, 1, pal.m); p.rect(lx + 2, my + 1, gap + 2, 1, pal.m); p.rect(lx + 4 + gap, my, 1, 1, pal.m); }
    if(o.blush){ p.px(lx - 1 < 0 ? 0 : lx - 1, ey + 3, pal.r); p.px(Math.min(w - 1, lx + 6 + gap), ey + 3, pal.r); }
    if(o.frown){ const my = ey + 4; p.rect(lx + 2, my, gap + 2, 1, pal.m); p.px(lx + 1, my + 1, pal.m); p.px(lx + 4 + gap, my + 1, pal.m); }
  }) };
}
// 单只眼睛（侧面朝镜头那一面用，眼睛靠前沿）
function sideEye(base, id, atFront = true){
  return { key: 'side:' + id, paint: layers(noise(base, 0.08), (p, w, h) => {
    const x = atFront ? w - 4 : 1;
    sprite(atFront ? ['wwk', 'wkk'] : ['kww', 'kkw'], { w: '#ffffff', k: '#141414' }, x, 1)(p);
  }) };
}

// 一圈贴地的叶片
function leafPad(rig, pv, color, r = 6){
  rig.stand(pv, 'm', [12, 2, 12], [0, 0, 0], { top: { key: 'pad:' + color, paint: leaves(color, 0) }, sides: tone(color, 0.8), bottom: tone(color, 0.6) });
  for(const [x, z, a] of [[r, 0, 0], [-r, 0, PI], [0, r, PI / 2], [0, -r, -PI / 2]]){
    rig.box(pv, 'm', [6, 1, 3], [x, 1.5, z], color, { r: [0, a, -0.25] });
  }
}

// 枪口火光：一颗自发光方块，开火时显示
function muzzle(rig, pv, color){ rig.box(pv, 'e', [3, 3, 3], [0, 0, 0], null, { tint: color }); }

function breathe(inst, t, ph, amp = 1){
  const s = 1 + Math.sin(t * 2.2 + ph) * 0.025 * amp;
  inst.root.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
}
function pulse(k){ return k * k * (3 - 2 * k); }
function lerp(a, b, k){ return a + (b - a) * k; }

// ---- 豌豆家族 ----
function shooterBuild(o){
  return rig => {
    rig.pivot('head', 'root', [0, 17, 0]);
    rig.pivot('snout', 'head', [5, -1, 0]);
    rig.pivot('muzzle', 'snout', [7.5, 0, 0]);
    leafPad(rig, 'root', o.leaf);
    rig.stand('root', 'm', [3, 11, 3], [0, 2, 0], { key: 'stem:' + o.id, paint: ramp(o.stem, tone(o.stem, 0.6)) });
    rig.box('root', 'm', [5, 1, 3], [-2.5, 8, 0], o.leaf, { r: [0, 0, 0.5] });
    const skin = [o.head, 0.07];
    rig.box('head', 'g', [10, 9, 9], [0, 0, 0], {
      all: skin,
      front: eyesFace(o.head, { id: o.id + ':front', y: 1, gap: 1, angry: o.angry }),
      near: sideEye(o.head, o.id + ':n', true),
      far: sideEye(o.head, o.id + ':f', false),
      top: { key: 'peatop:' + o.id, paint: layers(noise(o.head, 0.07), spots(shade(hex(o.head), 1.18), 6)) },
    });
    rig.box('snout', 'g', [6, 5, 5], [3, 0, 0], skin);
    rig.box('snout', 'g', [2, 7, 7], [6.5, 0, 0], {
      all: [tone(o.head, 0.9), 0.06],
      front: { key: 'hole:' + o.id, paint: layers(noise(o.head, 0.06), centered(['.kkk.', 'kkkkk', 'kkkkk', 'kkkkk', '.kkk.'], { k: o.inner })) },
    });
    rig.box('head', 'm', [4, 1, 5], [-6, 3.5, 0], o.leaf, { r: [0, 0, 0.6] });
    if(o.crest){
      for(let i = 0; i < 3; i++) rig.box('head', 'm', [5, 1, 3], [-6, 2 + i * 1.6, (i - 1) * 2.5], o.leaf, { r: [0, (i - 1) * 0.5, 0.4 + i * 0.25] });
    }
    if(o.crystals){
      for(const [x, z, h] of [[0, 0, 4], [-3, 2.5, 3], [-2.5, -3, 3], [2.5, -2, 2], [-4.5, 0, 3]]){
        rig.stand('head', 'g', [2, h, 2], [x, 4.5, z], '#effcff');
      }
      rig.box('head', 'e', [1.5, 1.5, 1.5], [0, 9, 0], null, { tint: '#9ff0ff' });
    }
    muzzle(rig, 'muzzle', o.flash);
  };
}
function shooterAnimate(inst, p, t){
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
const SUNFACE = { key: 'sunface', paint: layers((p, w, h, R) => {
  const c1 = hex('#7b4a1e'), c2 = hex('#5d3514');
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, (x + y) % 2 ? shade(c1, 0.9 + R() * 0.2) : shade(c2, 0.9 + R() * 0.2));
}, centered([
  '.........',
  '.kk...kk.',
  '.kw...kw.',
  '.........',
  'r.......r',
  '..m...m..',
  '...mmm...',
], { k: '#140a04', w: '#ffffff', m: '#2a1004', r: '#ff8fa0' })) };
function petals(color, id){
  const c = hex(color);
  return { key: 'petal:' + id, paint: (p, w, h, R) => {
    p.clear();
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const lim = 8.5 + 4 * Math.pow(Math.abs(Math.cos(a * 5)), 0.6);
      if(r <= lim) p.px(x, y, shade(c, (r > lim - 1.2 ? 0.8 : 1) * (0.92 + R() * 0.14)));
    }
  } };
}
function sunflowerBuild(rig){
  rig.pivot('head', 'root', [0, 20, 1], [-0.3, 0, 0]);
  rig.pivot('petals', 'head');
  leafPad(rig, 'root', GREEN_D);
  rig.stand('root', 'm', [3, 15, 3], [0, 1, 0], { key: 'stem:sun', paint: ramp('#5fb83a', '#2f7a1f') });
  rig.box('root', 'm', [7, 1, 3], [3.5, 7, 0], LEAF, { r: [0, 0, -0.45] });
  rig.box('root', 'm', [7, 1, 3], [-3.5, 10, 0], LEAF, { r: [0, 0, 0.45] });
  rig.box('head', 'm', [11, 11, 3], [0, 0, 0], { all: ['#5d3514', 0.1], near: SUNFACE });
  rig.box('petals', 't', [27, 27, 1], [0, 0, -2], { near: petals('#ffd43a', 'a'), far: petals('#ffd43a', 'a'), sides: 'clear', top: 'clear', bottom: 'clear' });
  rig.box('petals', 't', [27, 27, 1], [0, 0, -3], { near: petals('#f59f12', 'b'), far: petals('#f59f12', 'b'), sides: 'clear', top: 'clear', bottom: 'clear' }, { r: [0, 0, PI / 10] });
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

// ---- 球球：方块小男孩，扛着加特林，背着导弹舱，披一条小斗篷 ----
const SKIN = '#ffcfa4', HAIR = '#2a1c12', SHIRT = '#ff7a1c', SHORTS = '#2f62c8', SHOE = '#e8463a';
const QQ_FACE = { key: 'qq:face', paint: layers(noise(SKIN, 0.04), sprite([
  'hhhhhhhh',
  'hhhhhhhh',
  'h.hhhh.h',
  '........',
  '.wk..kw.',
  '........',
  'r..mm..r',
  '........',
], { h: HAIR, w: '#ffffff', k: '#3a2210', m: '#b03a24', r: '#ffa0a0' })) };
const QQ_SIDE = { key: 'qq:side', paint: layers(noise(SKIN, 0.04), sprite([
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhh..',
  'hhhhh...',
  'hhhh.ss.',
  'hhh.....',
  'hh......',
], { h: HAIR, s: '#f0b088' })) };
const QQ_SIDE_F = { key: 'qq:sidef', paint: layers(noise(SKIN, 0.04), sprite([
  'hhhhhhhh',
  'hhhhhhhh',
  'hhhhhhhh',
  '..hhhhhh',
  '...hhhhh',
  '.ss.hhhh',
  '.....hhh',
  '......hh',
], { h: HAIR, s: '#f0b088' })) };
const QQ_SHIRT = { key: 'qq:shirt', paint: layers(noise(SHIRT, 0.06), centered(['..y..', '.yyy.', 'yyyyy', '.y.y.'], { y: '#ffe23a' }, -1)) };
function qiuqiuBuild(rig){
  rig.pivot('body', 'root', [0, 10, 0]);
  rig.pivot('cape', 'body', [-2.5, 7, 0]);
  rig.pivot('head', 'body', [0, 7, 0]);
  rig.pivot('gun', 'body', [3, 3, 3.5]);
  rig.pivot('barrels', 'gun', [5, 0, 0]);
  rig.pivot('muzzle', 'barrels', [5, 0, 0]);
  rig.pivot('pod', 'body', [-3.5, 4, 0]);
  for(const z of [-1.5, 1.5]){
    rig.stand('root', 'm', [2, 3, 2], [0, 2, z], { sides: { key: 'qq:leg', paint: ramp(SKIN, '#e8b08a') }, top: SKIN, bottom: SKIN });
    rig.stand('root', 'g', [4, 2, 3], [0.5, 0, z], { all: SHOE, top: '#fbfbf2' });
    rig.stand('root', 'm', [2.6, 3, 2.6], [0, 5, z], SHORTS);
  }
  rig.stand('body', 'm', [5, 7, 6], [0, 0, 0], { all: SHIRT, front: QQ_SHIRT });
  rig.box('cape', 'm', [1, 9, 7], [0, -4, 0], { key: 'qq:cape', paint: ramp('#e2323e', '#8a1420') });
  rig.stand('head', 'm', [8, 8, 8], [0, 0, 0], { front: QQ_FACE, near: QQ_SIDE, far: QQ_SIDE_F, back: HAIR, top: { key: 'qq:hairtop', paint: noise(HAIR, 0.15) }, bottom: SKIN });
  rig.box('head', 'm', [3, 2, 2], [-2, 8.5, 0], HAIR, { r: [0, 0, 0.4] });          // 翘起的一撮头发
  // 加特林：机匣、弹鼓、四根枪管、护环
  rig.box('gun', 'x', [7, 3, 3], [0, 0, 0], '#4a5058');
  rig.box('gun', 'x', [3, 3, 3], [-1, -2.5, 0], '#d9a521');
  rig.box('gun', 'm', [6, 1, 3.2], [0, 1.6, 0], SHIRT);
  rig.box('gun', 'm', [2, 2, 2], [-2, -0.5, -1.5], SKIN);
  for(const [y, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) rig.box('barrels', 'x', [8, 1, 1], [3, y, z], '#2c3036');
  rig.box('barrels', 'x', [1, 3.4, 3.4], [0.5, 0, 0], '#8a929c');
  rig.box('barrels', 'x', [1, 3.4, 3.4], [6, 0, 0], '#8a929c');
  muzzle(rig, 'muzzle', '#ffd84a');
  rig.box('pod', 'm', [3, 6, 5], [0, 0, 0], '#3c6b2a');
  for(const z of [-1.2, 1.2]) rig.stand('pod', 'g', [1.5, 2, 1.5], [0, 3, z], '#e8483c');
}
function qiuqiuAnimate(inst, p, t, env){
  const ph = p.phase || 0;
  const k = Math.min(1, p.recoil || 0);
  const st = inst.state;
  st.spin = (st.spin || 0) + (env.dt || 0) * (k > 0.05 ? 28 : 1.5);
  inst.pv.barrels.rotation.x = st.spin;
  const b = inst.pv.body;
  b.position.y += Math.abs(Math.sin(t * 3 + ph)) * 0.012;
  b.position.x -= k * 0.015;
  b.rotation.z += Math.sin(t * 1.4 + ph) * 0.03 - k * 0.05;
  inst.pv.gun.position.x -= k * 0.035;
  inst.pv.gun.rotation.z += Math.sin(t * 40) * 0.03 * k;
  inst.pv.head.rotation.z += Math.sin(t * 1.7 + ph) * 0.06;
  inst.pv.cape.rotation.x = Math.sin(t * 5 + ph) * 0.18;
  inst.pv.cape.rotation.z = -0.2 - Math.abs(Math.sin(t * 2.5 + ph)) * 0.15;
  const f = Math.min(1, (p.flash || 0) / 0.1);
  inst.pv.muzzle.visible = f > 0.02;
  inst.pv.muzzle.scale.setScalar(0.5 + f * 0.9);
  inst.pv.muzzle.rotation.x = t * 31;
}

// ---- 坚果墙 ----
const NUT = '#b87a38';
const NUT_SKIN = { key: 'nut:skin', paint: layers(noise(NUT, 0.08), spots('#8f5a26', 22, 1), spots('#d9a05a', 8, 1)) };
const NUT_FACE = { key: 'nut:face', paint: layers(noise(NUT, 0.08), spots('#8f5a26', 10, 1, [0, 10, 13, 7]), centered([
  'wwk...kww',
  'wkk...kkw',
  '.........',
  '.........',
  '....k....',
], { w: '#ffffff', k: '#141414' }, -2)) };
function crackPlate(id, seed){
  return { key: 'crack:' + id, paint: (p, w, h, R) => {
    p.clear();
    const c = hex('#3a2008');
    for(let n = 0; n < 2; n++){
      let x = Math.floor(R() * w), y = n ? h - 1 : 0;
      for(let i = 0; i < h * 0.6; i++){
        p.px(x, y, c);
        y += n ? -1 : 1;
        x = Math.max(0, Math.min(w - 1, x + Math.floor(R() * 3) - 1));
        if(R() < 0.2) p.px(Math.max(0, Math.min(w - 1, x + (R() < 0.5 ? -1 : 1))), y, c);
      }
    }
  } };
}
function wallnutBuild(rig){
  rig.pivot('body', 'root');
  rig.pivot('crack1', 'body'); rig.pivot('crack2', 'body');
  rig.pivot('worry', 'body'); rig.pivot('calm', 'body');
  rig.stand('body', 'g', [13, 17, 14], [0, 0, 0], { all: NUT_SKIN, front: NUT_FACE, top: { key: 'nut:top', paint: layers(noise('#d09a5a', 0.08), spots('#8f5a26', 6)) } });
  rig.stand('body', 'g', [9, 2, 10], [0, 17, 0], '#c08a48');
  for(const z of [-3.5, 3.5]){
    rig.box('calm', 'm', [0.6, 1, 3], [6.8, 13, z], '#4a2a10');
    rig.box('worry', 'm', [0.6, 1, 3], [6.8, 13.3, z], '#4a2a10', { r: [z > 0 ? 0.45 : -0.45, 0, 0] });
  }
  rig.box('crack1', 't', [0.4, 17, 14], [6.8, 8.5, 0], { front: crackPlate('a'), back: crackPlate('a'), sides: 'clear', top: 'clear', bottom: 'clear' });
  rig.box('crack1', 't', [13, 17, 0.4], [0, 8.5, 7.2], { near: crackPlate('b'), far: crackPlate('b'), sides: 'clear', top: 'clear', bottom: 'clear' });
  rig.box('crack2', 't', [0.4, 17, 14], [6.9, 8.5, 0], { front: crackPlate('c'), back: crackPlate('c'), sides: 'clear', top: 'clear', bottom: 'clear' });
  rig.box('crack2', 't', [13, 17, 0.4], [0, 8.5, 7.3], { near: crackPlate('d'), far: crackPlate('d'), sides: 'clear', top: 'clear', bottom: 'clear' });
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
  b.scale.set(1, 1 + Math.sin(t * 2 + ph) * 0.015, 1);
}

// ---- 土豆雷 ----
const DIRT = '#7a5634';
function potatoBuild(rig){
  rig.pivot('mound', 'root');
  rig.pivot('spud', 'root');
  rig.pivot('lamp', 'spud', [0, 12.5, 0]);
  rig.stand('mound', 'm', [14, 3, 13], [0, 0, 0], { all: [DIRT, 0.14], top: { key: 'mound:top', paint: layers(noise(DIRT, 0.14), spots('#5a3c20', 10)) } });
  rig.stand('spud', 'g', [10, 8, 9], [0, 1, 0], { all: { key: 'spud', paint: layers(noise('#d2a463', 0.07), spots('#9c7238', 7)) },
    front: { key: 'spud:face', paint: layers(noise('#d2a463', 0.07), centered(['wk..kw', '......', '.mmmm.'], { w: '#ffffff', k: '#141414', m: '#5a3812' }, -1)) } });
  rig.stand('spud', 'x', [1, 3, 1], [0, 9, 0], '#9aa0a8');
  rig.box('lamp', 'e', [2.4, 2.4, 2.4], [0, 0, 0], null, { tint: '#ff2a1a' });
  rig.box('spud', 'm', [3, 1, 2], [-2, 9.5, 0], LEAF, { r: [0, 0, 0.5] });
}
function potatoAnimate(inst, p, t, env){
  const armed = !!p.armed;
  const prog = armed ? 1 : Math.min(1, (p.armT || 0) / 14);
  const spud = inst.pv.spud;
  spud.position.y = -0.3 + prog * 0.3 + (armed ? Math.abs(Math.sin(t * 3 + (p.phase || 0))) * 0.015 : 0);
  spud.rotation.z = armed ? Math.sin(t * 2.5) * 0.05 : 0;
  inst.pv.mound.scale.setScalar(armed ? 0.85 : 1);
  const on = armed ? (Math.sin(t * 12) > 0 ? 1 : 0.15) : (Math.sin(t * 2) > 0.7 ? 0.5 : 0.1);
  inst.pv.lamp.scale.setScalar(0.5 + on * 0.8);
  env.lamp = armed ? on : 0;
}

// ---- 火炬树桩 ----
const STUMP_FACE = { key: 'stump:face', paint: layers(bark('#6e4322'), centered([
  'kk.....kk',
  '.kk...kk.',
  '.........',
  '..kkkkk..',
  '.kkkkkkk.',
], { k: '#1a0a02' }, -1)) };
function flame(c1, c2){ return { key: 'flame:' + c1, paint: (p, w, h, R) => {
  const a = hex(c1), b = hex(c2);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, R() < 0.3 ? b : shade(a, 0.9 + R() * 0.2));
} }; }
function torchBuild(rig){
  rig.pivot('fire', 'root', [0, 12, 0]);
  rig.pivot('f1', 'fire'); rig.pivot('f2', 'fire'); rig.pivot('f3', 'fire');
  rig.stand('root', 'm', [13, 12, 13], [0, 0, 0], { sides: { key: 'stump:bark', paint: bark('#6e4322') }, front: STUMP_FACE, top: { key: 'stump:top', paint: rings('#d19a5e', '#9c6a38') } });
  for(const [x, z] of [[6, 5], [-6, 5], [6, -5], [-6, -5]]) rig.stand('root', 'm', [3, 3, 3], [x, 0, z], { all: { key: 'stump:bark', paint: bark('#6e4322') } });
  // 雕出来的眼睛与嘴里透出火光
  for(const z of [-3, 3]) rig.box('root', 'e', [0.4, 1.4, 1.4], [6.6, 8.5, z], null, { tint: '#ffb030' });
  rig.box('root', 'e', [0.4, 1.4, 5], [6.6, 5, 0], null, { tint: '#ff8a1a' });
  rig.stand('f1', 'e', [10, 8, 10], [0, 0, 0], flame('#ff6a12', '#ffa020'));
  rig.stand('f2', 'e', [7, 10, 7], [0.5, 0, 0.5], flame('#ffb02a', '#ffe060'));
  rig.stand('f3', 'e', [4, 8, 4], [0, 1, 0.8], flame('#fff0a0', '#ffffff'));
  rig.box('f1', 'e', [2, 2, 2], [3, 11, -2], null, { tint: '#ff8a1a' });
  rig.box('f1', 'e', [1.5, 1.5, 1.5], [-3, 13, 2], null, { tint: '#ffb030' });
}
function torchAnimate(inst, p, t){
  const ph = p.phase || 0;
  const fl = (a, b) => 1 + Math.sin(t * a + ph) * 0.12 + Math.sin(t * b + ph * 2) * 0.08;
  inst.pv.f1.scale.set(fl(9, 17), fl(11, 23) * 1.05, fl(8, 15));
  inst.pv.f2.scale.set(fl(13, 19), fl(15, 27), fl(12, 21));
  inst.pv.f3.scale.set(fl(17, 29), fl(19, 31), fl(16, 23));
  inst.pv.f1.rotation.y = Math.sin(t * 5 + ph) * 0.2;
  inst.pv.f2.rotation.y = -t * 1.5;
  inst.pv.f3.rotation.x = Math.sin(t * 6 + ph) * 0.1;
}

// ---- 樱桃炸弹 ----
const CHERRY_FACE = { key: 'cherry:face', paint: layers(noise('#d4142a', 0.07), centered([
  'b.....b',
  '.bk.kb.',
  '.wk.kw.',
  '.......',
  '..kkk..',
], { b: '#3a0608', k: '#141414', w: '#ffffff' }, -1)) };
const CHERRY_SKIN = { key: 'cherry:skin', paint: layers(noise('#d4142a', 0.07), sprite(['ww', 'w.'], { w: '#ffd0d8' }, 1, 1)) };
function cherryBuild(rig){
  rig.pivot('c1', 'root', [-4, 5, 2]);
  rig.pivot('c2', 'root', [5, 4.5, -2]);
  rig.box('c1', 'g', [9, 9, 9], [0, 0, 0], { all: CHERRY_SKIN, front: CHERRY_FACE });
  rig.box('c2', 'g', [8, 8, 8], [0, 0, 0], { all: CHERRY_SKIN, front: CHERRY_FACE });
  rig.box('root', 'm', [1, 9, 1], [-2, 13, 1], '#3a7a1a', { r: [0.15, 0, -0.35] });
  rig.box('root', 'm', [1, 9, 1], [2.5, 12.5, -1], '#3a7a1a', { r: [-0.15, 0, 0.4] });
  rig.box('root', 'm', [7, 1, 3], [2, 17.5, 0], LEAF, { r: [0, 0.4, -0.2] });
}
const CHERRY_TINT = new Color();
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

// ---- 蘑菇：小喷菇、阳光菇 ----
function shroomBuild(o){
  return rig => {
    rig.pivot('cap', 'root', [0, o.stemH, 0]);
    rig.pivot('eyes', 'root'); rig.pivot('lids', 'root');
    rig.pivot('muzzle', 'root', [o.stemW / 2 + 4.5, o.stemH * 0.4, 0]);
    rig.stand('root', 'g', [o.stemW, o.stemH, o.stemW], [0, 0, 0], { key: 'stem:' + o.id, paint: ramp('#f6eedc', '#d8ccb4') });
    const capSkin = { key: 'cap:' + o.id, paint: layers(noise(o.cap, 0.07), spots(o.spot, 5, 1)) };
    rig.stand('cap', 'g', [o.capW, 3, o.capW], [0, 0, 0], capSkin);
    rig.stand('cap', 'g', [o.capW - 4, 2, o.capW - 4], [0, 3, 0], capSkin);
    // 眼睛画在贴着正面的薄片上：睁眼 / 闭眼两片，按睡醒切换
    const fx = o.stemW / 2 + 0.25, ey = o.stemH * 0.62;
    rig.box('eyes', 't', [0.4, 3, o.stemW], [fx, ey, 0], { front: { key: 'eyes:' + o.id, paint: (p, w, h) => { p.clear(); sprite(['wk.kw', 'kk.kk'], { w: '#ffffff', k: '#141414' }, Math.floor((w - 5) / 2), 0)(p); } }, back: 'clear', sides: 'clear', top: 'clear', bottom: 'clear' });
    rig.box('lids', 't', [0.4, 3, o.stemW], [fx, ey, 0], { front: { key: 'lids:' + o.id, paint: (p, w, h) => { p.clear(); sprite(['.....', 'kk.kk'], { k: '#3a2a40' }, Math.floor((w - 5) / 2), 0)(p); } }, back: 'clear', sides: 'clear', top: 'clear', bottom: 'clear' });
    if(o.snout){
      rig.box('root', 'g', [4, 2.4, 2.4], [o.stemW / 2 + 2, o.stemH * 0.4, 0], { all: '#e8d9c0', front: { key: 'puff:hole', paint: layers(noise('#e8d9c0', 0.05), centered(['kk', 'kk'], { k: '#5a3a6a' })) } });
      rig.box('muzzle', 'e', [2.5, 2.5, 2.5], [0, 0, 0], null, { tint: '#e9c8ff' });
    } else {
      rig.box('eyes', 't', [0.4, 2, o.stemW], [fx, ey - 2.2, 0], { front: { key: 'smile:' + o.id, paint: (p, w) => { p.clear(); sprite(['k...k', '.kkk.'], { k: '#6a3a10' }, Math.floor((w - 5) / 2), 0)(p); } }, back: 'clear', sides: 'clear', top: 'clear', bottom: 'clear' });
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
  rig.pivot('bean', 'root', [0, 6, 0]);
  rig.box('bean', 'g', [7, 10, 6], [0, 0, 0], {
    all: ['#6e3d1a', 0.08],
    front: { key: 'bean:face', paint: layers(noise('#6e3d1a', 0.08), centered(['wk.kw', '.....', '.kkk.'], { w: '#ffffff', k: '#141414' }, -1)) },
    near: { key: 'bean:crease', paint: layers(noise('#6e3d1a', 0.08), (p, w, h) => { for(let y = 0; y < h; y++) p.px(Math.floor(w / 2 + Math.sin(y * 0.8)), y, '#2a1004'); }) },
  });
  rig.box('bean', 'm', [4, 1, 2], [-1, 6, 0], LEAF, { r: [0, 0, 0.6] });
  for(let i = 0; i < 3; i++) rig.box('bean', 'e', [1.5 + i * 0.4, 1.5 + i * 0.4, 1.5 + i * 0.4], [-1 + i * 1.2, 8 + i * 2.2, 0], null, { tint: '#fff8e8' });
}
function coffeeAnimate(inst, p, t){ inst.pv.bean.rotation.z = Math.sin(t * 3) * 0.08; }

// ---- 迪迦奥特曼：方块光之巨人 ----
const T_SILVER = '#c8ced8', T_RED = '#d6262c', T_PURPLE = '#6a3cc0';
const TIGA_BODY = { key: 'tiga:body', paint: (p, w, h, R) => {
  const s = hex(T_SILVER), r = hex(T_RED), pu = hex(T_PURPLE);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let c = s;
    if(y > h * 0.45) c = (x + Math.floor(y / 2)) % 4 < 2 ? r : pu;
    if(y > h * 0.72) c = (x % 3 === 0) ? s : pu;
    p.px(x, y, shade(c, 0.92 + R() * 0.12));
  }
} };
const TIGA_CHEST = { key: 'tiga:chest', paint: layers(TIGA_BODY.paint, (p, w, h) => {
  const g = hex('#e7b94c');
  for(let x = 0; x < w; x++){ p.px(x, 1, g); p.px(x, Math.floor(h * 0.45), g); }
  for(let y = 1; y < h * 0.45; y++){ p.px(0, y, g); p.px(w - 1, y, g); }
}) };
const TIGA_LIMB = (c, id) => ({ key: 'tiga:limb:' + id, paint: (p, w, h, R) => {
  const s = hex(T_SILVER), k = hex(c);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(y > h * 0.3 && y < h * 0.7 ? k : s, 0.92 + R() * 0.12));
} });
const TIGA_FACE = { key: 'tiga:face', paint: layers(noise(T_SILVER, 0.05), sprite([
  '...pp...',
  '..pppp..',
  '........',
  '........',
  '........',
  '...ss...',
  '...ss...',
  '........',
], { p: T_PURPLE, s: '#8c949e' })) };
function tigaBuild(rig){
  rig.pivot('body', 'root', [0, 12, 0]);
  rig.pivot('head', 'body', [0, 12, 0]);
  rig.pivot('armF', 'body', [0, 11, 5.5]);
  rig.pivot('foreF', 'armF', [0, -5.5, 0]);
  rig.pivot('armB', 'body', [0, 11, -5.5]);
  rig.pivot('foreB', 'armB', [0, -5.5, 0]);
  rig.pivot('timer', 'body', [2.3, 8, 0]);
  rig.pivot('legF', 'body', [0, 0, 2]);
  rig.pivot('legB', 'body', [0, 0, -2]);
  for(const [pv, c] of [['legF', T_RED], ['legB', T_PURPLE]]){
    rig.box(pv, 'x', [3.6, 12, 3.6], [0, -6, 0], { sides: TIGA_LIMB(c, pv), top: T_SILVER, bottom: T_SILVER });
    rig.box(pv, 'x', [5, 1.5, 3.8], [0.8, -11.6, 0], T_SILVER);
  }
  rig.stand('body', 'x', [4.5, 12, 8], [0, 0, 0], { sides: TIGA_BODY, front: TIGA_CHEST, top: T_SILVER, bottom: T_SILVER });
  rig.box('timer', 'x', [0.6, 2.6, 2.6], [0, 0, 0], '#e7b94c');
  rig.box('timer', 'e', [0.8, 1.6, 1.6], [0.2, 0, 0], null);
  for(const [a, f, c] of [['armF', 'foreF', T_RED], ['armB', 'foreB', T_PURPLE]]){
    rig.box(a, 'x', [3, 6, 3], [0, -2.5, 0], { sides: TIGA_LIMB(c, a), top: T_SILVER, bottom: T_SILVER });
    rig.box(f, 'x', [2.8, 6, 2.8], [0, -3, 0], T_SILVER);
  }
  rig.stand('head', 'x', [6, 7, 6], [0, 0, 0], { all: T_SILVER, front: TIGA_FACE });
  rig.stand('head', 'g', [5, 2, 1.4], [-0.5, 7, 0], T_PURPLE);
  for(const z of [-1.6, 1.6]) rig.box('head', 'e', [0.5, 1.6, 2], [3.1, 4.2, z], null, { tint: '#fff3c4' });
}
const TIMER_BLUE = new Color(0.25, 0.8, 1.6), TIMER_RED = new Color(2.2, 0.2, 0.15);
function tigaAnimate(inst, p, t){
  const ph = p.phase || 0;
  const k = Math.min(1, p.recoil || 0);
  const pv = inst.pv;
  // 发射：L 字形的哉佩利敖光线姿势（前臂竖起、后臂横在胸前）
  const fire = pulse(Math.min(1, k * 1.6));
  pv.body.position.y += Math.sin(t * 2 + ph) * 0.012;
  pv.armF.rotation.z = lerp(0.1, 1.45, fire);
  pv.foreF.rotation.z = lerp(0.1, 1.6, fire);
  pv.armB.rotation.z = lerp(-0.1, 1.2, fire);
  pv.armB.rotation.x = lerp(0, -0.9, fire);
  pv.armF.rotation.x = lerp(0.1, 0.3, fire);
  pv.legF.rotation.z = 0.08; pv.legB.rotation.z = -0.1;
  pv.head.rotation.z = Math.sin(t * 1.3 + ph) * 0.04 - fire * 0.08;
  // 登场：刚放下时从天而降
  const age = (p.maxLifeT || 25) - (p.lifeT === undefined ? 25 : p.lifeT);
  const drop = Math.max(0, 1 - age / 0.7);
  inst.root.position.y += drop * drop * 2.6;
  // 计时器：剩 8 秒起变红闪烁，越到最后闪得越快。计时器单独一份材质，免得把眼睛一起染红
  let timerMat = inst.state.timerMat;
  if(!timerMat){
    timerMat = inst.state.timerMat = inst.mats.mats.e.clone();
    pv.timer.traverse(o => { if(o.isMesh && o.userData.key === 'e') o.material = timerMat; });
  }
  const left = p.lifeT === undefined ? 25 : p.lifeT;
  if(left < 8){
    const on = Math.sin(t * (4 + (8 - left) * 1.8)) > 0;
    timerMat.color.copy(on ? TIMER_RED : TIMER_BLUE).multiplyScalar(on ? 1 : 0.5);
  } else {
    timerMat.color.copy(TIMER_BLUE);
  }
}

// ---- 注册表 ----
export const PLANT_MODELS = {
  sunflower: { build: sunflowerBuild, animate: sunflowerAnimate },
  peashooter: {
    build: shooterBuild({ id: 'pea', head: '#62c93a', leaf: GREEN_D, stem: '#4fa82e', inner: '#123d0a', flash: '#c8ff7a' }),
    animate: shooterAnimate,
  },
  snowpea: {
    build: shooterBuild({ id: 'snow', head: '#8fd8fa', leaf: '#4fbfb6', stem: '#3aa58a', inner: '#1a4a6a', crystals: true, flash: '#bff4ff' }),
    animate: shooterAnimate,
  },
  repeater: {
    build: shooterBuild({ id: 'rep', head: '#47a82a', leaf: '#2f7a1e', stem: '#2f7f1e', inner: '#0f3008', crest: true, angry: true, flash: '#d8ff7a' }),
    animate: shooterAnimate,
  },
  qiuqiu: { build: qiuqiuBuild, animate: qiuqiuAnimate },
  wallnut: { build: wallnutBuild, animate: wallnutAnimate },
  potato: { build: potatoBuild, animate: potatoAnimate },
  torch: { build: torchBuild, animate: torchAnimate },
  cherry: { build: cherryBuild, animate: cherryAnimate },
  puff: {
    build: shroomBuild({ id: 'puff', stemH: 7, stemW: 5, capW: 11, cap: '#a45ed8', spot: '#f0c8ff', snout: true }),
    animate: shroomAnimate,
  },
  sunshroom: {
    build: shroomBuild({ id: 'sunshroom', stemH: 7, stemW: 6, capW: 12, cap: '#ffad2a', spot: '#fff2a0', snout: false }),
    animate: shroomAnimate,
  },
  coffee: { build: coffeeBuild, animate: coffeeAnimate },
  tiga: { build: tigaBuild, animate: tigaAnimate },
};
