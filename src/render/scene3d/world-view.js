// 世界视图：把核心层的 world / ui 映射成一棵 three.js 场景树。不持有渲染器，因此可以在 Node 里测试。
//
// 只读约定：这里从不写 world / ui / 实体的任何字段。需要跨帧记忆的东西（上一帧血量、
// 光线起点、粒子归属的行）一律存在视图自己的 Map / WeakMap 里。
import {
  Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, Vector3, BoxGeometry, AdditiveBlending,
} from 'three';
import { W, H } from '../../core/constants.js';
import { LEVELS } from '../../core/data/levels.js';
import { PLANTS } from '../../core/data/plants.js';
import { ZTYPES } from '../../core/data/zombies.js';
import { isNight } from '../../core/world.js';
import { inspectUseCard } from '../../core/actions.js';
import { toX, rowZ, heightIn, rowOfY, PX, ROW_D, LAWN_D } from './coords.js';
import { createRig, instantiate, resetPose } from './rig.js';
import { PLANT_MODELS } from './plants.js';
import { ZOMBIE_MODELS, DEBRIS_MODELS } from './zombies.js';
import { mowerBuild, sunBuild, buildPeaProtos, haloMesh } from './props.js';
import { createEnvironment } from './environment.js';
import { CAMERA } from './camera.js';
import { createCloud, createFx, parseCss } from './fx.js';
import { makeRadial } from './textures.js';
import { RIM } from './materials.js';

const PI = Math.PI;
export const PLANT_YAW = -0.55;
// 方块人（球球、迪迦）正面很窄：多转一些，让脸和胸口朝向镜头，而不是只露一条侧影
const HUMANOID_YAW = { qiuqiu: -0.85, tiga: -0.85 };
export function plantYaw(type){ return HUMANOID_YAW[type] === undefined ? PLANT_YAW : HUMANOID_YAW[type]; }
export const ZOMBIE_YAW = PI + 0.62;
const PEA_DZ = 0.08;
const SLEEP_TINT = new Color(0.62, 0.62, 0.78);
const SHOVEL_TINT = new Color(1.25, 0.55, 0.45);

export { CAMERA };

const templates = new Map();
export function template(kind, type){
  const key = kind + ':' + type;
  let t = templates.get(key);
  if(t) return t;
  const rig = createRig();
  const src = kind === 'plant' ? PLANT_MODELS[type] : kind === 'zombie' ? ZOMBIE_MODELS[type] : kind === 'debris' ? DEBRIS_MODELS[type] : null;
  if(kind === 'mower') mowerBuild(rig);
  else if(kind === 'sun') sunBuild(rig);
  else if(src) src.build(rig);
  else throw new Error('未知模型 ' + key);
  t = rig.finish();
  templates.set(key, t);
  return t;
}

function damp(cur, target, k, dt){ return cur + (target - cur) * (1 - Math.exp(-k * dt)); }
function smooth(k){ k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }

export function createWorldView(opts = {}){
  const scene = new Scene();
  const env = createEnvironment();
  scene.add(env.group);
  const camera = new PerspectiveCamera(CAMERA.battle.fov, W / H, 0.3, 400);
  const camState = { pos: new Vector3(...CAMERA.menu.pos), target: new Vector3(...CAMERA.menu.target), fov: CAMERA.menu.fov, init: false };
  const fx = createFx(scene);
  const battle = new Group(), menu = new Group(), preview = new Group();
  scene.add(battle, menu, preview);
  const coreNormal = createCloud(1200, false), coreAdd = createCloud(1200, true);
  battle.add(coreNormal.points, coreAdd.points);

  const shadowTex = makeRadial([[0, 'rgba(0,0,0,0.55)'], [0.55, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
  const haloTex = makeRadial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  const scorchTex = makeRadial([[0, 'rgba(20,12,6,0.95)'], [0.6, 'rgba(30,20,10,0.6)'], [1, 'rgba(30,20,10,0)']]);
  const blobGeo = new PlaneGeometry(1, 1);
  const blobMat = new MeshBasicMaterial({ map: shadowTex, color: '#000000', transparent: true, depthWrite: false, opacity: 0.75 });
  function blob(size){
    const m = new Mesh(blobGeo, blobMat);
    m.rotation.x = -PI / 2; m.position.y = 0.015; m.scale.set(size, size * 0.8, 1);
    m.renderOrder = 1;
    return m;
  }

  // 弹丸原型的标准材质
  const makeStd = (hex, rough) => new MeshStandardMaterial({ color: hex, roughness: rough });
  const peaProtos = buildPeaProtos(makeStd);

  // ---- 植物 ----
  const plantViews = new Map();
  function makePlant(p){
    const inst = instantiate(template('plant', p.type));
    const holder = new Group();
    holder.add(inst.root);
    holder.rotation.y = plantYaw(p.type);
    if(p.type === 'tiga') holder.scale.setScalar(1.22);   // 光之巨人：比其它植物高出一截
    const b = blob(p.type === 'tiga' ? 0.8 : 0.62);
    const g = new Group(); g.add(holder, b);
    battle.add(g);
    return { g, holder, inst, lastHp: p.hp, hurtT: 0, sleepT: 0, type: p.type };
  }
  function killPlant(v, p){
    battle.remove(v.g); v.inst.mats.dispose();
    if(p.type === 'tiga' && (p.lifeT || 0) <= 0.05){
      // 光之巨人离场：一道光柱冲天
      const x = v.g.position.x, z = v.g.position.z;
      fx.emit('spark', x, 0.6, z, 50, { spMin: 1, spMax: 3, elMin: 1.2, elMax: 1.55, g: -6, lifeMin: 0.5, lifeMax: 1.1, sizeMin: 0.04, sizeMax: 0.1, jitter: 0.15, colors: [[0.6, 0.9, 1], [1, 1, 1]] });
    }
  }
  function updatePlant(v, p, t, dt, night, flags){
    v.g.position.set(toX(p.cx), 0, rowZ(p.row));
    if(p.hp < v.lastHp - 0.01){
      if(v.hurtT <= 0) fx.emit('dust', v.g.position.x + 0.1, 0.4, v.g.position.z, 2, { spMin: 0.5, spMax: 1.2, g: 5, sizeMin: 0.03, sizeMax: 0.05, colors: [[0.4, 0.7, 0.2]], additive: false });
      v.hurtT = 0.3;
    }
    v.lastHp = p.hp;
    v.hurtT -= dt;
    resetPose(v.inst);
    const e = { dt, night, asleep: !!p.asleep, hurt: v.hurtT > 0 ? 1 : 0 };
    PLANT_MODELS[p.type].animate(v.inst, p, t, e);
    let flash = e.glow || 0, tint = e.tint || null;
    if(p.asleep){
      tint = SLEEP_TINT;
      v.sleepT -= dt;
      if(v.sleepT <= 0){
        v.sleepT = 0.9;
        fx.emit('bubble', v.g.position.x + 0.12, 0.42, v.g.position.z + 0.05, 1, { spMin: 0.15, spMax: 0.25, elMin: 1.3, elMax: 1.5, g: -0.15, lifeMin: 1.4, lifeMax: 1.8,
          sizeMin: 0.06, sizeMax: 0.09, grow: 0.05, colors: [[0.85, 0.92, 1]], additive: false });
      }
    }
    if(flags.shovel === p){ tint = SHOVEL_TINT; flash = Math.max(flash, 0.18 + Math.sin(t * 10) * 0.12); }
    if(flags.coffee === p){ flash = Math.max(flash, 0.25 + Math.sin(t * 9) * 0.15); }
    v.inst.mats.set(flash, tint, 1);
    if(p.type === 'torch') fx.light(v.g.position.x, 0.75, v.g.position.z, '#ff8a2a', 7 + Math.sin(t * 13) * 1.5, 2.6);
    if(p.type === 'potato' && e.lamp > 0.5) fx.light(v.g.position.x, 0.35, v.g.position.z, '#ff3020', 1.5, 1.2);
    if(p.type === 'tiga'){
      if((p.recoil || 0) > 0.05) fx.light(v.g.position.x + 0.4, 1.2, v.g.position.z + 0.3, '#9fdcff', p.recoil * 8, 2.5);
      const age = (p.maxLifeT || 25) - (p.lifeT || 0);
      if(age < 0.8) fx.emit('spark', v.g.position.x, 0.2 + (0.8 - age) * 2, v.g.position.z, 3, { spMin: 0.5, spMax: 1.5, g: 0, lifeMin: 0.2, lifeMax: 0.4, colors: [[0.6, 0.9, 1], [1, 1, 1]] });
    }
  }

  // ---- 僵尸 ----
  const zombieViews = new Map();
  const v3 = new Vector3();
  function makeZombie(z){
    const inst = instantiate(template('zombie', ZOMBIE_MODELS[z.type] ? z.type : 'normal'));
    const holder = new Group(); holder.add(inst.root);
    holder.rotation.y = ZOMBIE_YAW;
    const b = blob(0.7);
    const g = new Group(); g.add(holder, b);
    battle.add(g);
    return { g, holder, inst, last: (z.hp || 0) + (z.acc || 0), hitT: 0, accWas: true, armWas: false, dying: false, ash: false, fxT: 0 };
  }
  function killZombie(v){ battle.remove(v.g); v.inst.mats.dispose(); }
  const recentBooms = [];
  function updateZombie(v, z, t, dt){
    const X = toX(z.x), Z = rowZ(z.row);
    v.g.position.set(X, 0, Z);
    v.holder.position.y = Math.max(0, -(z.vy || 0) * PX);
    const health = (z.hp || 0) + (z.acc || 0);
    if(health < v.last - 0.5){
      v.hitT = 0.11;
      if(z.screen && (z.acc || 0) > 0 && (z.screenHitT || 0) > 0){
        fx.emit('spark', X - 0.3, 0.75, Z + 0.1, 5, { spMin: 1.2, spMax: 2.8, elMin: -0.2, elMax: 1, g: 6, lifeMin: 0.12, lifeMax: 0.3, sizeMin: 0.02, sizeMax: 0.04, colors: [[1, 0.9, 0.6], [1, 1, 1]] });
      }
    }
    v.last = health;
    v.hitT -= dt;
    if(z.state === 'dying' && !v.dying){
      v.dying = true;
      v.ash = recentBooms.some(b => Math.abs(b.x - X) < b.r + 0.35 && Math.abs(b.z - Z) < b.dz);
      if(v.ash) fx.emit('smoke', X, 0.6, Z, 6, { spMin: 0.1, spMax: 0.4, elMin: 1, elMax: 1.5, g: -0.4, lifeMin: 0.8, lifeMax: 1.4, sizeMin: 0.2, sizeMax: 0.35, grow: 0.4, colors: [[0.2, 0.18, 0.16]], additive: false });
    }
    resetPose(v.inst);
    const e = { dt, ash: v.ash };
    ZOMBIE_MODELS[z.type] ? ZOMBIE_MODELS[z.type].animate(v.inst, z, t, e) : ZOMBIE_MODELS.normal.animate(v.inst, z, t, e);
    const flash = v.hitT > 0 && !v.ash ? 0.38 * (v.hitT / 0.11) : 0;
    v.inst.mats.set(flash, e.tint || null, e.fade === undefined ? 1 : e.fade);
    v.g.children[1].visible = !(e.fade !== undefined && e.fade < 0.6);
    const pv = v.inst.pv;
    // 护具被打掉：生成一块飞出去的残骸
    if(pv.acc && z.type !== 'vault'){
      const now = pv.acc.visible;
      if(v.accWas && !now && DEBRIS_MODELS[z.type] && z.type !== 'newspaper'){
        v.holder.updateMatrixWorld(true);
        pv.acc.getWorldPosition(v3);
        fx.addDebris(instantiate(template('debris', z.type)), v3.x, v3.y, v3.z, { vx: 1.2 + fx.rand(0, 0.8), vy: 3.2 });
      }
      v.accWas = now;
    }
    if(e.armLost && !v.armWas && z.state !== 'dying'){
      v.holder.updateMatrixWorld(true);
      (pv.foreB || pv.root).getWorldPosition(v3);
      fx.addDebris(instantiate(template('debris', 'arm')), v3.x, v3.y, v3.z, { vx: 0.8, vy: 2 });
    }
    v.armWas = !!e.armLost;
    v.fxT -= dt;
    if(v.fxT <= 0 && z.state !== 'dying'){
      v.fxT = 0.12;
      if((z.slowT || 0) > 0) fx.emit('ice', X + fx.rand(-0.15, 0.15), 0.3 + fx.rand(0, 0.9), Z, 1, { spMin: 0.05, spMax: 0.2, g: 0.5, lifeMin: 0.4, lifeMax: 0.7, sizeMin: 0.03, sizeMax: 0.05, colors: [[0.7, 0.9, 1]] });
      if(z.angry) fx.emit('smoke', X - 0.05, 1.3, Z, 1, { spMin: 0.2, spMax: 0.4, elMin: 1.2, elMax: 1.5, g: -1, lifeMin: 0.4, lifeMax: 0.6, sizeMin: 0.08, sizeMax: 0.12, grow: 0.3, colors: [[1, 0.95, 0.95]], additive: false });
      if(z.state === 'walk' && z.x < W) fx.emit('dust', X + 0.1, 0.03, Z + fx.rand(-0.1, 0.1), 1, { spMin: 0.1, spMax: 0.3, elMin: 0.3, elMax: 0.8, g: 0.6, lifeMin: 0.3, lifeMax: 0.5, sizeMin: 0.04, sizeMax: 0.07, grow: 0.08, colors: [[0.55, 0.5, 0.38]], additive: false });
    }
  }

  // ---- 弹丸 ----
  const peaViews = new Map();
  const beamCore = new MeshBasicMaterial({ color: new Color(2.0, 2.3, 2.6) });
  const beamGlow = new MeshBasicMaterial({ color: new Color(0.15, 0.5, 1.1), transparent: true, blending: AdditiveBlending, depthWrite: false });
  const beamGeo = new BoxGeometry(1, 1, 1);   // 方块光束：一根发光的长方条
  function makePea(pea){
    if(pea.type === 'beam'){
      const g = new Group();
      const core = new Mesh(beamGeo, beamCore), glow = new Mesh(beamGeo, beamGlow);
      g.add(core, glow);
      battle.add(g);
      return { g, beam: true, startX: toX(pea.x), core, glow };
    }
    const proto = peaProtos[pea.type] || peaProtos.pea;
    const g = proto.clone(true);
    battle.add(g);
    return { g, fxT: 0 };
  }
  function killPea(v){
    if(v.beam){
      battle.remove(v.g);
      fx.group.add(v.g);
      fx.beamAfterglow(v.g);
    } else battle.remove(v.g);
  }
  function updatePea(v, pea, t, dt){
    const X = toX(pea.x), Y = heightIn(pea.row, pea.y), Z = rowZ(pea.row) + PEA_DZ;
    if(v.beam){
      const len = Math.max(0.05, X - v.startX);
      v.g.position.set(v.startX + len / 2, Y, Z);
      const fl = 1 + Math.sin(t * 60) * 0.12;
      v.core.scale.set(len, 0.05 * fl, 0.05 * fl);
      v.glow.scale.set(len, 0.13 * fl, 0.13 * fl);
      fx.light(X, Y, Z, '#a8e4ff', 4, 2.5);
      fx.emit('spark', X, Y, Z, 2, { spMin: 0.5, spMax: 2, g: 0, lifeMin: 0.15, lifeMax: 0.35, sizeMin: 0.03, sizeMax: 0.07, colors: [[0.7, 0.95, 1], [1, 1, 1]] });
      return;
    }
    v.g.position.set(X, Y, Z);
    if(pea.type === 'pea' || pea.type === 'snow' || pea.type === 'ball') v.g.rotation.z = -X * 3;
    if(pea.type === 'missile') v.g.rotation.x = t * 8;
    v.fxT -= dt;
    if(v.fxT <= 0){
      v.fxT = 0.03;
      if(pea.type === 'fire') fx.emit('ember', X - 0.06, Y, Z, 1, { spMin: 0.2, spMax: 0.6, g: -1, lifeMin: 0.15, lifeMax: 0.3, sizeMin: 0.04, sizeMax: 0.07, colors: [[1, 0.6, 0.15], [1, 0.85, 0.3]] });
      if(pea.type === 'snow') fx.emit('ice', X - 0.06, Y, Z, 1, { spMin: 0.1, spMax: 0.3, g: 0.5, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 0.02, sizeMax: 0.035, colors: [[0.75, 0.95, 1]] });
      if(pea.type === 'missile') fx.emit('smoke', X - 0.16, Y, Z, 1, { spMin: 0.05, spMax: 0.2, g: -0.3, lifeMin: 0.4, lifeMax: 0.7, sizeMin: 0.06, sizeMax: 0.1, grow: 0.3, colors: [[0.85, 0.85, 0.85]], additive: false });
    }
    if(pea.type === 'fire') fx.light(X, Y, Z, '#ff8a2a', 2.5, 1.6);
  }

  // ---- 阳光 ----
  const sunViews = new Map();
  const sunTpl = () => template('sun', 'sun');
  const flyTarget = new Vector3();
  function makeSun(s){
    const inst = instantiate(sunTpl());
    const g = new Group(); g.add(inst.root);
    if(haloTex){
      const h = haloMesh(haloTex, '#ffd060', 0.7, 1.1);
      h.position.z = -0.05;
      g.add(h);
    }
    battle.add(g);
    return { g, inst, pos: new Vector3() };
  }
  function killSun(v){ battle.remove(v.g); v.inst.mats.dispose(); }
  function updateSun(v, s, t){
    const tyZ = (s.ty - 112) / 96 * ROW_D;        // 落点所在的地面深度（LY=112, CH=96）
    const lift = 0.35;
    const X = toX(s.state === 'fly' ? s.x : s.x), groundY = (s.ty - s.y) * PX + lift;
    v.pos.set(X, Math.max(lift, groundY), Math.max(-0.5, Math.min(LAWN_D + 0.5, tyZ)));
    let scale = s.value && s.value < 50 ? 0.72 : 1, alpha = 1;
    if(s.state === 'fly'){
      const k = 1 - Math.pow(1 - Math.min(1, s.ft || 0), 2);
      screenPoint(46, 42, 5, flyTarget);   // 与 hud.js 的 SUN_TARGET 对齐（阳光盒里的太阳图标）
      v.pos.lerp(flyTarget, k);
      scale *= 1 - k * 0.55;
    }
    if(s.state === 'idle' && s.life < 2.5) alpha = Math.max(0, s.life / 2.5);
    v.g.position.copy(v.pos);
    v.g.quaternion.copy(camera.quaternion);
    const pulse = 1 + Math.sin(t * 4 + (s.t || 0)) * 0.05;
    v.g.scale.setScalar(scale * pulse);
    // 方块阳光：像掉落物一样斜着自转
    v.inst.root.rotation.set(0.45, t * 1.4, 0.25);
    v.inst.mats.set(0, null, alpha);
    if(v.g.children[1]) v.g.children[1].material.opacity = alpha;
  }
  function screenPoint(x, y, dist, out){
    out.set(x / W * 2 - 1, 1 - y / H * 2, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(dist).add(camera.position);
    return out;
  }

  // ---- 小推车 ----
  const mowerViews = new Map();
  function makeMower(){
    const inst = instantiate(template('mower', 'mower'));
    const g = new Group(); g.add(inst.root, blob(0.55));
    battle.add(g);
    return { g, inst };
  }
  function updateMower(v, m, t, dt){
    v.g.visible = m.state !== 'gone';
    v.g.position.set(toX(m.x) + 0.15, 0, rowZ(m.row));
    resetPose(v.inst);
    const run = m.state === 'run';
    for(const name in v.inst.pv) if(name[0] === 'w') v.inst.pv[name].rotation.z = -toX(m.x) * 5;
    v.inst.pv.body.position.y = run ? Math.abs(Math.sin(t * 40)) * 0.02 : 0;
    v.inst.pv.body.rotation.z = run ? Math.sin(t * 33) * 0.03 : 0;
    v.inst.mats.set(0, null, 1);
    if(run && dt > 0){
      fx.emit('dust', v.g.position.x - 0.25, 0.1, v.g.position.z, 2, { spMin: 0.5, spMax: 1.5, elMin: 0.4, elMax: 1.2, g: 5, lifeMin: 0.3, lifeMax: 0.5, sizeMin: 0.03, sizeMax: 0.06, colors: [[0.45, 0.75, 0.25], [0.35, 0.6, 0.2]], additive: false });
      fx.emit('smoke', v.g.position.x - 0.1, 0.45, v.g.position.z, 1, { spMin: 0.1, spMax: 0.3, elMin: 1.2, elMax: 1.5, g: -0.5, lifeMin: 0.4, lifeMax: 0.6, sizeMin: 0.06, sizeMax: 0.1, grow: 0.3, colors: [[0.5, 0.5, 0.5]], additive: false });
    }
  }

  // ---- 爆炸焦痕 ----
  const decalViews = new Map();
  const scorchMat = new MeshBasicMaterial({ map: scorchTex, color: '#ffffff', transparent: true, depthWrite: false });
  function makeDecal(d){
    const X = toX(d.x), Z = rowZ((d.fy - 112) / 96 - 0.5);
    const r = d.r * PX;
    fx.explosion(X, Z, r * 1.1, d.r > 80);
    recentBooms.push({ x: X, z: Z, r: d.r > 80 ? r * 1.4 : r, dz: d.r > 80 ? ROW_D * 1.5 : ROW_D * 0.5, age: 0 });
    const m = new Mesh(blobGeo, scorchMat.clone());
    m.rotation.x = -PI / 2; m.position.set(X, 0.012, Z); m.scale.set(r * 2.2, r * 1.6, 1);
    m.renderOrder = 1;
    battle.add(m);
    return { m };
  }
  function updateDecal(v, d){ v.m.material.opacity = Math.max(0, Math.min(1, d.ttl / d.max)) * 0.85; }
  function killDecal(v){ battle.remove(v.m); v.m.material.dispose(); }

  // ---- 悬停高亮与幽灵预览 ----
  const hl = new Mesh(new PlaneGeometry(0.96, ROW_D - 0.05), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }));
  hl.rotation.x = -PI / 2; hl.renderOrder = 2;
  battle.add(hl);
  const ghosts = new Map();
  let ghostShown = null;
  function ghostFor(type){
    let gh = ghosts.get(type);
    if(!gh){
      const inst = instantiate(template('plant', type), { ghost: true });
      const holder = new Group(); holder.add(inst.root); holder.rotation.y = plantYaw(type);
      battle.add(holder);
      gh = { holder, inst };
      ghosts.set(type, gh);
    }
    return gh;
  }

  // ---- 开场预告：街上排队的僵尸 ----
  let previewLevel = -1;
  const previewInsts = [];
  function buildPreview(level){
    for(const p of previewInsts){ preview.remove(p.g); p.inst.mats.dispose(); }
    previewInsts.length = 0;
    const types = LEVELS[level].types.map(t => t[0]);
    const spots = [[11.2, 1.0], [12.4, 2.2], [11.5, 3.6], [12.9, 4.6], [11.8, 6.0], [13.4, 0.4], [13.6, 6.6]];
    spots.forEach(([x, z], i) => {
      const type = types[i % types.length];
      const inst = instantiate(template('zombie', type));
      const holder = new Group(); holder.add(inst.root); holder.rotation.y = ZOMBIE_YAW + (i % 3 - 1) * 0.3;
      const g = new Group(); g.add(holder, blob(0.7)); g.position.set(x, 0, z);
      preview.add(g);
      previewInsts.push({ g, inst, type, ph: i * 1.7 });
    });
    previewLevel = level;
  }

  // ---- 主菜单：院子里摆一排角色 ----
  let menuBuilt = false;
  const menuCast = [];
  function buildMenu(){
    const cast = [
      ['plant', 'sunflower', 0.9, 6.3, 1.25], ['plant', 'peashooter', 1.75, 6.55, 1.2], ['plant', 'wallnut', 2.6, 6.2, 1.15],
      ['plant', 'qiuqiu', 3.6, 6.5, 1.35], ['plant', 'tiga', 0.4, 4.9, 1.1], ['plant', 'cherry', 2.25, 7.1, 1.0],
      // E30：射手站草坪中段（qiuqiu 与铁门之间的空地），E22 的教训：菜单阵容是写死的，新角色要记得登记
      ['zombie', 'archer', 4.7, 5.3, 1.05], ['zombie', 'screen', 5.6, 6.4, 1.05], ['zombie', 'newspaper', 6.6, 6.0, 1.05], ['zombie', 'bucket', 7.4, 6.6, 1.1],
      ['zombie', 'cone', 8.3, 6.1, 1.1], ['zombie', 'normal', 9.1, 6.7, 1.15], ['zombie', 'flag', 8.9, 5.0, 1.0],
    ];
    for(const [kind, type, x, z, s] of cast){
      const inst = instantiate(template(kind, type));
      const holder = new Group(); holder.add(inst.root);
      holder.rotation.y = kind === 'plant' ? plantYaw(type) - 0.25 : ZOMBIE_YAW + 0.25;
      holder.scale.setScalar(s);
      const g = new Group(); g.add(holder, blob(0.7 * s)); g.position.set(x, 0, z);
      menu.add(g);
      menuCast.push({ kind, type, inst, g, ph: x * 1.3 });
    }
    menuBuilt = true;
  }
  function fakePlant(type, t, ph){
    const cyc = (t + ph) % 2.2;
    return { type, phase: ph, recoil: cyc < 0.5 ? 1 - cyc / 0.5 : 0, flash: cyc < 0.09 ? 0.09 - cyc : 0, hp: 1, maxHp: 1,
      armed: true, armT: 14, fuse: 1.05, sunT: 5 + Math.sin(t) * 4, lifeT: 20, maxLifeT: 25, asleep: false };
  }
  function fakeZombie(type, t, ph, walk){
    const d = ZTYPES[type] || ZTYPES.normal;
    return { type, row: 0, x: 0, vy: 0, state: 'walk', animT: walk ? t * 0.9 + ph : ph + Math.sin(t * 0.5) * 0.2, eatT: 0, slowT: 0, deathT: 0,
      hp: d.hp, acc: d.acc, angry: false, poleLost: false };
  }

  let lastT = null, mode = null, lostAt = null, lastState = null, clock = 0;
  // 视图自己的时钟：暂停时停走，于是所有呼吸、摇摆、火焰都一起定格
  function update(m, world, ui, frameT, pointScale){
    let dt = lastT === null ? 0 : Math.max(0, Math.min(0.05, frameT - lastT));
    lastT = frameT;
    const paused = m === 'battle' && world.paused;
    if(!paused) clock += dt;
    const t = clock;
    if(m !== mode){ fx.clear(); mode = m; }
    const inBattle = m === 'battle';
    const night = inBattle && isNight(world);
    env.setTheme(night, scene);
    RIM.color.value.set(night ? '#9fb4ff' : '#fff1d0');
    RIM.strength.value = night ? 0.5 : 0.42;
    battle.visible = inBattle;
    menu.visible = !inBattle;
    preview.visible = false;
    const fdt = paused ? 0 : dt;

    if(world.state !== lastState){ if(world.state === 'lost') lostAt = t; lastState = world.state; }

    if(inBattle){
      const frameFlags = { shovel: null, coffee: null };
      const hc = ui.hoverCell;
      const canHover = world.state === 'play' && !world.paused && hc;
      if(canHover && world.grid){
        const target = world.grid[hc.row] && world.grid[hc.row][hc.col];
        if(ui.shovel && target) frameFlags.shovel = target;
        if(ui.sel >= 0 && world.slots[ui.sel] && world.slots[ui.sel].type === 'coffee' && target && target.asleep) frameFlags.coffee = target;
      }
      syncList(world.plants, plantViews, makePlant, (v, p) => updatePlant(v, p, t, fdt, night, frameFlags), killPlant);
      for(const b of recentBooms) b.age += fdt;
      while(recentBooms.length && recentBooms[0].age > 0.25) recentBooms.shift();
      syncList(world.visual.decals, decalViews, makeDecal, updateDecal, killDecal);
      syncList(world.zombies, zombieViews, makeZombie, (v, z) => updateZombie(v, z, t, fdt), killZombie);
      syncList(world.peas, peaViews, makePea, (v, p) => updatePea(v, p, t, fdt), killPea);
      syncList(world.mowers, mowerViews, makeMower, (v, mw) => updateMower(v, mw, t, fdt), (v) => battle.remove(v.g));
      // 核心层粒子：出生时按 y 归到某一行，之后只做坐标换算
      coreNormal.begin(); coreAdd.begin();
      for(const p of world.visual.parts){
        let meta = partMeta.get(p);
        if(!meta){ meta = { row: rowOfY(p.y), dz: fx.rand(-0.18, 0.22) }; partMeta.set(p, meta); }
        const c = parseCss(p.color);
        const k = Math.max(0, Math.min(1, p.life / p.max));
        const y = Math.max(0.03, heightIn(meta.row, p.y));
        (c.hot ? coreAdd : coreNormal).push(toX(p.x), y, rowZ(meta.row) + meta.dz, c.r, c.g, c.b, p.size * PX * 1.4, k * c.a);   // 方块风：方形粒子比圆点显大，缩一些
      }
      coreNormal.end(pointScale); coreAdd.end(pointScale);
      // 悬停
      hl.visible = false;
      let gshow = null;
      if(canHover && (ui.shovel || (ui.sel >= 0 && world.slots[ui.sel]))){
        hl.visible = true;
        hl.position.set(hc.col + 0.5, 0.02, rowZ(hc.row));
        const pulse = 0.22 + Math.sin(t * 6) * 0.06;
        if(ui.shovel){ hl.material.color.set('#ff6a3a'); hl.material.opacity = pulse + 0.1; }
        else {
          const r = inspectUseCard(world, ui.sel, hc.row, hc.col);
          const type = world.slots[ui.sel].type;
          hl.material.color.set(r.ok ? '#fffbd0' : '#ff3a2a');
          hl.material.opacity = pulse + (r.ok ? 0.08 : 0.06);
          if(r.ok && type !== 'coffee') gshow = type;
        }
      }
      if(ghostShown && ghostShown !== gshow) ghostFor(ghostShown).holder.visible = false;
      if(gshow){
        const gh = ghostFor(gshow);
        gh.holder.visible = true;
        gh.holder.position.set(hc.col + 0.5, 0, rowZ(hc.row));
        resetPose(gh.inst);
        const fp = fakePlant(gshow, t, 0);
        fp.recoil = 0; fp.flash = 0;
        fp.asleep = !!PLANTS[gshow].mushroom && !night;
        PLANT_MODELS[gshow].animate(gh.inst, fp, t, { dt, night, asleep: fp.asleep });
      }
      ghostShown = gshow;
      // 开场预告
      if(world.state === 'play' && world.t < 0){
        if(previewLevel !== world.level || !previewInsts.length) buildPreview(world.level);
        preview.visible = true;
        for(const p of previewInsts){
          resetPose(p.inst);
          ZOMBIE_MODELS[p.type].animate(p.inst, fakeZombie(p.type, t, p.ph, false), t, { dt });
          p.inst.mats.set(0, null, 1);
        }
      }
    } else {
      if(!menuBuilt) buildMenu();
      for(const c of menuCast){
        resetPose(c.inst);
        const e = { dt, night: false };
        if(c.kind === 'plant') PLANT_MODELS[c.type].animate(c.inst, fakePlant(c.type, t, c.ph), t, e);
        else ZOMBIE_MODELS[c.type].animate(c.inst, fakeZombie(c.type, t, c.ph, true), t, e);
        c.inst.mats.set(e.glow || 0, e.tint || null, 1);
        if(c.kind === 'zombie') c.inst.root.position.x = 0;
      }
    }
    fx.update(fdt, env.pool, pointScale);
    updateCamera(m, world, t, dt);
    env.update(t, camera, pointScale);
  }

  const partMeta = new WeakMap();
  let frameId = 0;
  function syncList(list, map, make, upd, kill){
    frameId++;
    for(const e of list){
      let v = map.get(e);
      if(!v){ v = make(e); map.set(e, v); }
      v.seen = frameId;
      upd(v, e);
    }
    for(const [e, v] of map){
      if(v.seen !== frameId){ kill(v, e); map.delete(e); }
    }
  }

  const want = { pos: new Vector3(), target: new Vector3() };
  function updateCamera(m, world, t, dt){
    const base = m === 'battle' ? CAMERA.battle : CAMERA.menu;
    want.pos.set(...base.pos); want.target.set(...base.target);
    let fov = base.fov;
    if(m === 'battle'){
      // 开场：先看街上的僵尸，再摇回草坪
      if(world.state === 'play' && world.t < 0){
        const k = smooth((world.t + 2.3) / 1.6);
        const off = (1 - k) * 7.2;
        want.pos.x += off; want.target.x += off;
        want.pos.y -= (1 - k) * 3; want.pos.z -= (1 - k) * 2;
      }
      // 失败：推近到冲进屋子的那只僵尸
      if(world.state === 'lost' && world.loseZombie && lostAt !== null){
        const k = smooth((t - lostAt) / 1.4);
        const zx = toX(world.loseZombie.x), zz = rowZ(world.loseZombie.row);
        want.target.lerp(v3.set(zx, 0.7, zz), k);
        want.pos.lerp(v3.set(zx + 1.2, 3.2, zz + 5.5), k);
      }
    } else {
      want.pos.x += Math.sin(t * 0.15) * 0.6;
      want.target.x += Math.sin(t * 0.15) * 0.3;
    }
    if(!camState.init){
      camState.pos.copy(want.pos); camState.target.copy(want.target); camState.fov = fov; camState.init = true;
    } else {
      const k = 1 - Math.exp(-5 * dt);
      camState.pos.lerp(want.pos, k); camState.target.lerp(want.target, k);
      camState.fov = damp(camState.fov, fov, 5, dt);
    }
    camera.position.copy(camState.pos);
    const sh = m === 'battle' && world.visual ? Math.max(0, world.visual.shake || 0) : 0;
    if(sh > 0){
      camera.position.x += Math.sin(t * 71) * sh * 0.35;
      camera.position.y += Math.sin(t * 53 + 1) * sh * 0.25;
    }
    camera.fov = camState.fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    camera.lookAt(camState.target.x + (sh > 0 ? Math.sin(t * 67) * sh * 0.2 : 0), camState.target.y, camState.target.z);
    camera.updateMatrixWorld();
  }

  // 拾取用：当前帧里阳光的世界坐标
  function sunAnchors(){
    const out = [];
    for(const [s, v] of sunViews) out.push({ sun: s, pos: v.pos });
    return out;
  }
  function syncSuns(world, t){ syncList(world.suns, sunViews, makeSun, (v, s) => updateSun(v, s, t), killSun); }

  // 阳光要在镜头更新之后再摆（飞向 HUD 的终点依赖镜头），所以单独一步
  function updateAll(m, world, ui, t, pointScale){
    update(m, world, ui, t, pointScale);
    if(m === 'battle') syncSuns(world, clock);
  }

  // 拾取：射线先打植物（点在植物身上就算点中它所在的格子），返回被打中的植物实体
  function raycastPlant(raycaster){
    let best = null, bestD = Infinity;
    for(const [p, v] of plantViews){
      const hits = raycaster.intersectObject(v.holder, true);
      if(hits.length && hits[0].distance < bestD){ bestD = hits[0].distance; best = p; }
    }
    return best;
  }

  return { scene, camera, env, fx, update: updateAll, sunAnchors, raycastPlant, get mode(){ return mode; } };
}

