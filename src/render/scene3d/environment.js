// 战场环境（方块风）：草方块草坪、木板房与门廊、木栅栏、树叶方块的树、石砖人行道与碎石路、
// 方形的太阳月亮、一层层扁平的方块云。昼夜共用同一套几何，只切换灯光、雾、天空与发光件亮度。
//
// 小件（草坪格、栅栏、树）走像素图集 + 合并网格；大平面（地面、墙、屋顶、路）用可平铺的小纹理，
// 每 0.5 个世界单位重复一次（16 像素一块，与角色的纹素密度一致）。
import {
  AdditiveBlending, AmbientLight, BackSide, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight,
  DynamicDrawUsage, Float32BufferAttribute, Fog, Group, HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, PointLight, Points, ShaderMaterial, SphereGeometry, Vector3, DoubleSide,
} from 'three';
import { COLS, ROWS } from '../../core/constants.js';
import { mulberry32 } from '../../core/rng.js';
import { ROW_D, LAWN_D } from './coords.js';
import { createRig, bakeStatic, crossGeometry, PX } from './rig.js';
import { atlasTexture, tileTexture, hex, shade } from './atlas.js';
import { noise, layers, spots, planks, cobble, bricks, bark, rings, leaves, sprite } from './pixels.js';

const PI = Math.PI;
const BLOCK = 0.5;                 // 一个「方块」多大（世界单位）：16 像素
const DENS = 1 / BLOCK;            // 每世界单位重复几次贴图

// ---- 像素画：地面与建材 ----
const GRASS_TOP = (p, w, h, R) => { noise('#6cc23d', 0.1)(p, w, h, R); spots('#4f9e2c', Math.round(w * h / 9), 1)(p, w, h, R); spots('#8fe055', Math.round(w * h / 22), 1)(p, w, h, R); };
const GRASS_TOP_B = (p, w, h, R) => { noise('#5aae33', 0.1)(p, w, h, R); spots('#428a24', Math.round(w * h / 9), 1)(p, w, h, R); spots('#7fd04a', Math.round(w * h / 24), 1)(p, w, h, R); };
const DIRT = (p, w, h, R) => { noise('#866043', 0.12)(p, w, h, R); spots('#5e4028', Math.round(w * h / 10), 1)(p, w, h, R); spots('#a0785a', Math.round(w * h / 20), 1)(p, w, h, R); };
function grassSide(top){
  return (p, w, h, R) => {
    DIRT(p, w, h, R);
    const g = hex(top);
    for(let x = 0; x < w; x++){
      const d = 3 + (R() < 0.45 ? 1 : 0) + (R() < 0.2 ? 1 : 0);
      for(let y = 0; y < d; y++) p.px(x, y, shade(g, 0.85 + R() * 0.25));
    }
  };
}
const GRAVEL = (p, w, h, R) => { noise('#7c7a78', 0.14)(p, w, h, R); spots('#5a5856', 40, 1)(p, w, h, R); spots('#a8a6a2', 26, 1)(p, w, h, R); };
const STONE_BRICK = bricks('#8f8f8f', '#5c5c5c');
const GLOWSTONE = (p, w, h, R) => { for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) p.px(x, y, shade(hex(R() < 0.3 ? '#fff2a0' : '#e8b84a'), 0.85 + R() * 0.3)); };
const GLASS = (p, w, h) => {
  p.fill('#a8d8f0');
  for(let i = 0; i < w; i++){ p.px(i, 0, '#f4f8fa'); p.px(i, h - 1, '#f4f8fa'); p.px(0, i, '#f4f8fa'); p.px(w - 1, i, '#f4f8fa'); }
  for(let i = 3; i < 7; i++) p.px(i, i - 1, '#ffffff');
  for(let i = 4; i < 9; i++) p.px(i + 3, i - 2, '#ffffff');
};
const DOOR = (p, w, h, R) => {
  planks('#6a4a2e')(p, w, h, R);
  p.rect(3, 3, w - 6, Math.floor(h * 0.3), '#a8d8f0');
  p.rect(Math.floor(w / 2) - 1, 3, 1, Math.floor(h * 0.3), '#6a4a2e');
  p.rect(w - 4, Math.floor(h * 0.55), 2, 2, '#e0b040');
};

function tex(key, paint, size = 16){ return tileTexture(key, size, paint); }

// 每个面按世界尺寸缩放 UV：贴图每 BLOCK 重复一次，大小不同的面纹素密度也一致
function tiledBox(w, h, d, map, color = '#ffffff', o = {}){
  const g = new BoxGeometry(w, h, d);
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = g.attributes.uv;
  for(let f = 0; f < 6; f++) for(let k = 0; k < 4; k++){
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] * DENS, uv.getY(i) * dims[f][1] * DENS);
  }
  const m = new Mesh(g, o.material || new MeshStandardMaterial({ map, color: map ? '#ffffff' : color, roughness: 0.92 }));
  m.receiveShadow = true; m.castShadow = o.cast !== false;
  return m;
}
function tiledPlane(w, d, map, o = {}){
  const g = new PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for(let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * DENS, uv.getY(i) * d * DENS);
  const m = new Mesh(g, new MeshStandardMaterial({ map, roughness: 0.95, color: o.color || '#ffffff' }));
  m.rotation.x = -PI / 2; m.receiveShadow = true;
  return m;
}

// ---- 草坪：每一格是一块草方块；格子上散着随风摆的高草与小花 ----
function buildLawn(uniforms){
  const g = new Group();
  const rig = createRig();
  const cw = Math.round(0.985 * PX), cd = Math.round((ROW_D - 0.015) * PX), ch = 16;
  const A = { top: { key: 'lawn:a', paint: GRASS_TOP }, sides: { key: 'lawn:side:a', paint: grassSide('#6cc23d') }, bottom: { key: 'dirt', paint: DIRT } };
  const B = { top: { key: 'lawn:b', paint: GRASS_TOP_B }, sides: { key: 'lawn:side:b', paint: grassSide('#5aae33') }, bottom: { key: 'dirt', paint: DIRT } };
  for(let row = 0; row < ROWS; row++) for(let c = 0; c < COLS; c++){
    rig.box('root', 'm', [cw, ch, cd], [(c + 0.5) * PX, -ch / 2, (row + 0.5) * ROW_D * PX], (row + c) % 2 ? B : A);
  }
  // 草坪下面再垫一层泥土，前沿露出来像一截地层
  rig.box('root', 'm', [COLS * PX, 16, LAWN_D * PX], [COLS * PX / 2, -24, LAWN_D * PX / 2], { key: 'dirt', paint: DIRT });
  const lawn = bakeStatic(rig.finish());
  lawn.traverse(o => { if(o.isMesh) o.castShadow = false; });
  g.add(lawn);

  // 高草与花：十字交叉片，实例化；顶点着色器里按高度摆动
  const TALL = { key: 'tallgrass', paint: (p, w, h, R) => { p.clear(); for(let x = 1; x < w - 1; x += 2){ const hh = 4 + Math.floor(R() * (h - 5)); for(let y = h - hh; y < h; y++) p.px(x + (y < h - hh / 2 && R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0), y, shade(hex('#6cc23d'), 0.85 + R() * 0.4)); } } };
  const flower = (id, c, cc) => ({ key: 'flower:' + id, paint: (p, w, h) => { p.clear(); p.rect(7, 7, 2, 9, '#3a8a2a'); p.rect(5, 10, 2, 1, '#3a8a2a'); p.rect(9, 12, 2, 1, '#3a8a2a'); sprite(['.cc.', 'cxxc', 'cxxc', '.cc.'], { c, x: cc }, 6, 3)(p); } });
  const kinds = [
    { spec: TALL, n: 300, w: 16, h: 16, s: [0.5, 0.75] },
    { spec: flower('poppy', '#e03030', '#2a2a2a'), n: 26, w: 16, h: 16, s: [0.7, 0.85] },
    { spec: flower('dandelion', '#ffd23a', '#ffb020'), n: 26, w: 16, h: 16, s: [0.7, 0.85] },
    { spec: flower('corn', '#4a7aff', '#ffffff'), n: 14, w: 16, h: 16, s: [0.7, 0.85] },
  ];
  const r = mulberry32(42);
  const mat = new MeshStandardMaterial({ map: atlasTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uniforms.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float h = clamp(position.y * 2.0, 0.0, 1.0);
        transformed.x += sin(uTime * 1.9 + ip.x * 1.3 + ip.z * 0.8) * 0.06 * h;
        transformed.z += cos(uTime * 1.4 + ip.x * 0.7) * 0.04 * h;
      }`);
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 1.0, 0.0);');
  };
  mat.customProgramCacheKey = () => 'tallgrass';
  let grass = null;
  const o = new Object3D();
  for(const k of kinds){
    const im = new InstancedMesh(crossGeometry(k.w, k.h, k.spec), mat, k.n);
    for(let i = 0; i < k.n; i++){
      o.position.set(0.08 + r() * (COLS - 0.16), 0, 0.08 + r() * (LAWN_D - 0.16));
      o.rotation.set(0, r() * PI, 0);
      o.scale.setScalar(k.s[0] + r() * (k.s[1] - k.s[0]));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.receiveShadow = true;
    g.add(im);
    if(!grass) grass = im;
  }
  g.userData.grass = grass;
  return g;
}

// ---- 房子与门廊（左侧）：圆石地基、木板墙、原木立柱、玻璃窗、红砖屋顶 ----
function buildHouse(T, M){
  const g = new Group();
  const z0 = -2.2, z1 = LAWN_D + 1.6, zl = z1 - z0, zc = (z0 + z1) / 2;
  const deck = tiledBox(2.3, 0.25, zl, T.planks); deck.position.set(-2.35, 0.0, zc); g.add(deck);
  const step = tiledBox(0.5, 0.12, zl, T.planks); step.position.set(-1.0, -0.06, zc); g.add(step);
  const patio = tiledBox(1.0, 0.1, zl, T.stoneBrick); patio.position.set(-0.55, -0.05, zc); g.add(patio);
  const found = tiledBox(1.5, 0.5, zl, T.cobble); found.position.set(-4.2, 0.0, zc); g.add(found);
  const wall = tiledBox(1.4, 3.5, zl, T.planks); wall.position.set(-4.2, 2.0, zc); g.add(wall);
  // 原木立柱与横梁
  for(const pz of [z0 + 0.25, 2.9, LAWN_D + 1.35]){
    const post = tiledBox(0.5, 3.6, 0.5, T.log); post.position.set(-3.5, 1.95, pz); g.add(post);
  }
  const beam = tiledBox(0.5, 0.5, zl, T.log); beam.position.set(-3.5, 3.75, zc); g.add(beam);
  // 窗户：白框玻璃，夜里透出暖光
  for(const wz of [0.6, 4.4, 6.8]){
    const frame = tiledBox(0.16, 1.4, 1.4, null, '#f4efe4'); frame.position.set(-3.44, 1.9, wz); g.add(frame);
    const glass = new Mesh(new BoxGeometry(0.04, 1.2, 1.2), M.window); glass.position.set(-3.35, 1.9, wz); g.add(glass);
    const box = tiledBox(0.4, 0.3, 1.4, T.planksDark); box.position.set(-3.2, 1.05, wz); g.add(box);
  }
  const door = new Mesh(new BoxGeometry(0.08, 2.0, 1.0), new MeshStandardMaterial({ map: T.doorTex, roughness: 0.9 }));
  door.position.set(-3.42, 1.25, 2.3); door.castShadow = true; g.add(door);
  // 门廊柱：木栅栏柱
  for(const pz of [-1.8, 1.4, 3.3, 5.6, LAWN_D + 1.2]){
    const post = tiledBox(0.25, 2.8, 0.25, T.planks); post.position.set(-1.45, 1.5, pz); g.add(post);
  }
  const porchBeam = tiledBox(0.5, 0.25, zl, T.planks); porchBeam.position.set(-1.45, 2.95, zc); g.add(porchBeam);
  // 屋顶：一级级的红砖台阶
  for(let i = 0; i < 4; i++){
    const st = tiledBox(0.5, 0.5, zl + 0.6, T.bricks); st.position.set(-1.25 - i * 0.5, 3.3 + i * 0.5, zc); g.add(st);
  }
  for(let i = 0; i < 4; i++){
    const st = tiledBox(0.5, 0.5, zl + 1, T.bricks); st.position.set(-3.25 - i * 0.5, 4.0 + i * 0.5, zc); g.add(st);
  }
  // 门灯与门廊上的花盆
  const lamp = new Mesh(new BoxGeometry(0.22, 0.22, 0.22), M.lamp); lamp.position.set(-3.25, 2.5, 3.1); g.add(lamp);
  const rig = createRig();
  for(const pz of [-0.6, 4.7]){
    rig.stand('root', 'm', [10, 9, 10], [-1.8 * PX, 0.12 * PX, pz * PX], { sides: '#a8583a', top: { key: 'pot:top', paint: DIRT } });
    for(let k = 0; k < 4; k++) rig.stand('root', 'g', [3, 3, 3], [(-1.8 + Math.cos(k * 1.6) * 0.08) * PX, 0.12 * PX + 9 + (k % 2) * 2, (pz + Math.sin(k * 1.6) * 0.08) * PX], ['#ff5a7a', '#ffd23e', '#ff8a2e', '#ffffff'][k]);
  }
  g.add(bakeStatic(rig.finish()));
  return g;
}

// ---- 后院：木栅栏、树叶方块的树篱、方块树 ----
function buildBackyard(){
  const rig = createRig();
  const r = mulberry32(9);
  const fz = -0.75 * PX;
  const PLANK = { key: 'oak', paint: planks('#b8945a') };
  for(let x = -1.25; x < COLS + 1.3; x += 0.75){
    rig.stand('root', 'm', [8, 24, 8], [x * PX, 0, fz], PLANK);
  }
  for(const y of [8, 18]) rig.box('root', 'm', [(COLS + 2.5) * PX, 3, 4], [(COLS / 2) * PX, y, fz], PLANK);
  // 树篱：一排树叶方块
  const LEAF = { key: 'leaf', paint: leaves('#3f8a2c', 0.08) };
  for(let x = -1.25; x < COLS + 1.3; x += 0.5){
    rig.stand('root', 't', [16, 16, 16], [x * PX, 0, (-1.35 - (Math.floor(x * 2) % 2) * 0.1) * PX], LEAF);
    if(r() < 0.4) rig.stand('root', 't', [16, 16, 16], [x * PX, 16, -1.45 * PX], LEAF);
  }
  // 树：原木树干 + 层层叶子方块
  const LOG = { sides: { key: 'logside', paint: bark('#6a4a2a') }, top: { key: 'logtop', paint: rings() }, bottom: { key: 'logtop', paint: rings() } };
  const trees = [[-0.5, -3.2, 4], [2.5, -4.4, 5], [5.5, -3.4, 4], [8.5, -4.2, 5], [11.5, -2.8, 4]];
  for(const [x, z, hgt] of trees){
    for(let i = 0; i < hgt; i++) rig.stand('root', 'm', [16, 16, 16], [x * PX, i * 16, z * PX], LOG);
    const top = hgt * 16;
    for(let dy = -2; dy <= 1; dy++){
      const rad = dy >= 0 ? 1 : 2;
      for(let dx = -rad; dx <= rad; dx++) for(let dz = -rad; dz <= rad; dz++){
        if(Math.abs(dx) === rad && Math.abs(dz) === rad && (dy !== -1 || r() < 0.5)) continue;
        if(dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        if(dx === 0 && dz === 0 && dy < 0) continue;
        rig.stand('root', 't', [16, 16, 16], [(x + dx * BLOCK) * PX, top + dy * 16, (z + dz * BLOCK) * PX], LEAF);
      }
    }
  }
  return bakeStatic(rig.finish());
}

// ---- 右侧：石砖人行道、路缘、碎石路、路灯（萤石）、红色消防栓方块 ----
function buildStreet(T, M){
  const g = new Group();
  const z0 = -6, z1 = LAWN_D + 4, zl = z1 - z0, zc = (z0 + z1) / 2;
  const walk = tiledBox(1.5, 0.1, zl, T.stoneBrick); walk.position.set(COLS + 0.75, -0.05, zc); g.add(walk);
  const curb = tiledBox(0.25, 0.25, zl, T.cobble); curb.position.set(COLS + 1.62, 0.0, zc); g.add(curb);
  const road = tiledPlane(8, zl, T.gravel); road.position.set(COLS + 5.75, -0.06, zc); g.add(road);
  const rig = createRig();
  for(let z = z0; z < z1; z += 1.5) rig.box('root', 'm', [4, 1, 24], [(COLS + 4.2) * PX, -1.4, z * PX], '#f0d040');
  // 路灯：栅栏柱 + 萤石
  for(const lz of [-0.6, LAWN_D + 0.9]){
    rig.stand('root', 'm', [6, 80, 6], [(COLS + 1.25) * PX, 0, lz * PX], { key: 'oak', paint: planks('#b8945a') });
  }
  rig.stand('root', 'g', [8, 12, 8], [(COLS + 1.0) * PX, 0, 2.2 * PX], '#d82a2a');
  rig.stand('root', 'g', [6, 3, 6], [(COLS + 1.0) * PX, 12, 2.2 * PX], '#b01e1e');
  g.add(bakeStatic(rig.finish()));
  for(const lz of [-0.6, LAWN_D + 0.9]){
    const bulb = new Mesh(new BoxGeometry(0.42, 0.42, 0.42), M.glow); bulb.position.set(COLS + 1.25, 2.7, lz); g.add(bulb);
    const cone = new Mesh(new CylinderGeometry(0.15, 1.1, 2.5, 4, 1, true), M.beam);
    cone.rotation.y = PI / 4;
    cone.position.set(COLS + 1.25, 1.3, lz); g.add(cone);
    M.beamMeshes.push(cone);
  }
  return g;
}

// ---- 前景花坛：耕地方块 + 一排花 ----
function buildFront(){
  const rig = createRig();
  const r = mulberry32(17);
  const fz = (LAWN_D + 0.05) * PX;
  const FARM = (p, w, h, R) => { DIRT(p, w, h, R); for(let y = 1; y < h; y += 4) for(let x = 0; x < w; x++) p.px(x, y, shade(hex('#4a3020'), 0.9 + R() * 0.2)); };
  for(let x = -0.25; x < COLS + 0.25; x += 0.5) rig.stand('root', 'm', [16, 6, 16], [(x + 0.25) * PX, -6, fz + 8], { top: { key: 'stoneslab', paint: noise('#a8a294', 0.08) }, sides: { key: 'stoneslab:s', paint: noise('#9a9486', 0.08) } });
  for(let x = -0.25; x < COLS + 0.25; x += 0.5) for(let k = 0; k < 2; k++) rig.stand('root', 'm', [16, 14, 16], [(x + 0.25) * PX, -14, fz + 24 + k * 16], { top: { key: 'farmland', paint: FARM }, sides: { key: 'dirt', paint: DIRT } });
  const kinds = [['#e03030', '#2a2a2a'], ['#ffd23a', '#ffb020'], ['#4a7aff', '#ffffff'], ['#ffffff', '#ffd23a'], ['#c86aff', '#ffffff']];
  for(let i = 0; i < 40; i++){
    const [c, cc] = kinds[i % kinds.length];
    const x = (-0.2 + r() * (COLS + 0.4)) * PX, z = fz + 18 + r() * 26;
    rig.cross('root', 't', 16, 16, [x, 0, z], { key: 'bed:' + c, paint: (p) => { p.clear(); p.rect(7, 7, 2, 9, '#3a8a2a'); p.rect(5, 10, 2, 1, '#3a8a2a'); sprite(['.cc.', 'cxxc', 'cxxc', '.cc.'], { c, x: cc }, 6, 3)(p); } }, { s: 1.4 });
    if(i % 4 === 0) rig.stand('root', 't', [10, 10, 10], [x + 8, 0, z + 4], { key: 'leaf', paint: leaves('#3f8a2c', 0.08) });
  }
  return bakeStatic(rig.finish());
}

// ---- 天空穹顶：渐变（太阳与月亮是单独的方形面片）----
function buildSky(){
  const mat = new ShaderMaterial({
    uniforms: {
      top: { value: new Color('#3d8fe0') }, mid: { value: new Color('#bfe4ff') }, bottom: { value: new Color('#9ac870') },
      sunDir: { value: new Vector3(-0.4, 0.5, -0.75).normalize() }, sunColor: { value: new Color('#fff2c0') },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bottom, sunColor; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(mid, bottom, pow(clamp(-h * 4.0, 0.0, 1.0), 0.6));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * pow(s, 24.0) * 0.3;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: BackSide, depthWrite: false, fog: false,
  });
  const m = new Mesh(new SphereGeometry(150, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}
function buildSunMoon(){
  const sunTex = tex('sky:sun', (p, w, h, R) => { for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const e = Math.min(x, y, w - 1 - x, h - 1 - y); p.px(x, y, shade(hex(e < 2 ? '#ffd040' : '#fff6c0'), 0.95 + R() * 0.1)); } });
  const moonTex = tex('sky:moon', (p, w, h, R) => { noise('#e8e8f0', 0.06)(p, w, h, R); spots('#b8b8c8', 9, 2)(p, w, h, R); });
  const mk = (map, color) => new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map, color, fog: false, depthWrite: false, transparent: true }));
  const sun = mk(sunTex, new Color(3.2, 3.0, 2.2)), moon = mk(moonTex, new Color(1.6, 1.6, 1.8));
  sun.renderOrder = moon.renderOrder = -9;
  return { sun, moon };
}

// ---- 云：扁平的方块，一大片一大片 ----
function buildClouds(){
  const g = new Group();
  const r = mulberry32(31);
  const mat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.88, fog: false });
  for(let i = 0; i < 14; i++){
    const cx = -40 + r() * 80, cz = -40 - r() * 50, cy = 16 + r() * 4;
    const n = 2 + Math.floor(r() * 3);
    for(let k = 0; k < n; k++){
      const m = new Mesh(new BoxGeometry(3 + r() * 5, 1, 2 + r() * 3), mat);
      m.position.set(cx + (r() - 0.5) * 5, cy, cz + (r() - 0.5) * 3);
      g.add(m);
    }
  }
  return g;
}
function buildStars(){
  const r = mulberry32(77);
  const P = [];
  for(let i = 0; i < 700; i++){
    const a = r() * PI * 2, h = 0.08 + r() * 0.9, R = 140;
    P.push(Math.cos(a) * Math.sqrt(1 - h * h) * R, h * R, Math.sin(a) * Math.sqrt(1 - h * h) * R);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(P, 3));
  return new Points(g, new ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'uniform float t; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = 0.6 + 0.4 * sin(t * 2.0 + position.x * 0.37 + position.z); gl_PointSize = 2.0; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(1.6, 1.6, 1.9) * vA, 1.0); }',
    depthWrite: false, fog: false,
  }));
}
function buildFireflies(){
  const N = 60, r = mulberry32(55);
  const base = [];
  for(let i = 0; i < N; i++) base.push([r() * (COLS + 2) - 1, 0.3 + r() * 1.4, r() * (LAWN_D + 1) - 0.5, r() * 10]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(N * 3), 3).setUsage(DynamicDrawUsage));
  const pts = new Points(geo, new ShaderMaterial({
    uniforms: { scale: { value: 400 } },
    vertexShader: 'uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.06 * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'void main(){ vec2 q = abs(gl_PointCoord - 0.5) * 2.0; float d = max(q.x, q.y); float a = d > 0.5 ? 0.35 : 1.0; gl_FragColor = vec4(vec3(2.0, 2.6, 0.7) * a, a); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  }));
  pts.frustumCulled = false;
  pts.userData.base = base;
  return pts;
}

export function createEnvironment(){
  const T = {
    grass: tex('t:grass', GRASS_TOP), planks: tex('t:planks', planks('#b8945a')), planksDark: tex('t:planks2', planks('#7a5a3a')),
    cobble: tex('t:cobble', cobble('#8a8a8a')), stoneBrick: tex('t:stonebrick', STONE_BRICK), bricks: tex('t:bricks', bricks()),
    gravel: tex('t:gravel', GRAVEL), log: tex('t:log', bark('#6a4a2a')), glass: tex('t:glass', GLASS), doorTex: tex('t:door', DOOR, 16),
    glow: tex('t:glow', GLOWSTONE),
  };
  const uniforms = { time: { value: 0 } };
  const M = {
    window: new MeshBasicMaterial({ map: T.glass, color: new Color('#ffffff') }),
    lamp: new MeshBasicMaterial({ map: T.glow, color: new Color('#ffffff') }),
    glow: new MeshBasicMaterial({ map: T.glow, color: new Color('#ffffff') }),
    beam: new MeshBasicMaterial({ color: new Color('#ffd890'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: 2 }),
    beamMeshes: [],
  };
  const group = new Group();
  const ground = tiledPlane(80, 60, T.grass, { color: '#d8e8c8' });
  ground.position.set(COLS / 2, -0.52, LAWN_D / 2 - 8);
  group.add(ground);
  const lawn = buildLawn(uniforms);
  group.add(lawn);
  group.add(buildHouse(T, M));
  group.add(buildBackyard());
  group.add(buildStreet(T, M));
  group.add(buildFront());
  const sky = buildSky(); group.add(sky);
  const { sun: sunDisc, moon } = buildSunMoon(); group.add(sunDisc, moon);
  const clouds = buildClouds(); group.add(clouds);
  const stars = buildStars(); group.add(stars);
  const flies = buildFireflies(); group.add(flies);

  // ---- 灯光 ----
  const hemi = new HemisphereLight('#cfe6ff', '#4a6a2a', 0.85);
  const sun = new DirectionalLight('#fff0d4', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2;
  const sc = sun.shadow.camera;
  sc.left = -9; sc.right = 9; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 50;
  const sunTarget = new Object3D(); sunTarget.position.set(COLS / 2, 0, LAWN_D / 2);
  sun.target = sunTarget;
  const fill = new DirectionalLight('#bcd4ff', 0.45);
  fill.position.set(COLS + 10, 6, LAWN_D + 10);
  const amb = new AmbientLight('#ffffff', 0.05);
  group.add(hemi, sun, sunTarget, fill, amb);
  // 固定数量的点光源池：数量一变着色器就要重编译，所以永远是 4 盏，只改亮度
  const pool = [];
  for(let i = 0; i < 4; i++){
    const l = new PointLight('#ff9a40', 0, 5, 2);
    l.position.set(-100, -100, -100);
    group.add(l); pool.push(l);
  }

  let night = null;
  const skyDir = new Vector3();
  function setTheme(isNight, scene){
    if(night === isNight) return;
    night = isNight;
    const u = sky.material.uniforms;
    if(isNight){
      hemi.color.set('#4a5aa0'); hemi.groundColor.set('#10161c'); hemi.intensity = 0.42;
      sun.color.set('#9ab0ff'); sun.intensity = 0.95;
      sun.position.set(COLS / 2 + 7, 14, LAWN_D / 2 - 6);
      fill.color.set('#6a5aa8'); fill.intensity = 0.35;
      u.top.value.set('#060a1e'); u.mid.value.set('#1c2a58'); u.bottom.value.set('#101a20');
      u.sunDir.value.set(0.35, 0.42, -0.84).normalize(); u.sunColor.value.set('#8090c0');
      M.window.color.setRGB(2.2, 1.6, 0.8);
      M.lamp.color.setRGB(2.6, 2.3, 1.5); M.glow.color.setRGB(2.6, 2.3, 1.5);
      M.beam.opacity = 0.08;
      scene.fog = new Fog('#141c3a', 26, 62);
      scene.environmentIntensity = 0.1;
    } else {
      hemi.color.set('#cfe6ff'); hemi.groundColor.set('#4a6a2a'); hemi.intensity = 0.85;
      sun.color.set('#fff0d4'); sun.intensity = 2.5;
      sun.position.set(COLS / 2 - 7, 15, LAWN_D / 2 + 6);
      fill.color.set('#bcd4ff'); fill.intensity = 0.45;
      u.top.value.set('#3d8fe0'); u.mid.value.set('#c4e6ff'); u.bottom.value.set('#9ac870');
      u.sunDir.value.set(-0.4, 0.5, -0.75).normalize(); u.sunColor.value.set('#fff2c0');
      M.window.color.set('#ffffff');
      M.lamp.color.set('#ffffff'); M.glow.color.set('#ffffff');
      M.beam.opacity = 0;
      scene.fog = new Fog('#cfe6f5', 34, 80);
      scene.environmentIntensity = 0.28;
    }
    for(const b of M.beamMeshes) b.visible = isNight;
    stars.visible = isNight; flies.visible = isNight; clouds.visible = !isNight;
    sunDisc.visible = !isNight; moon.visible = isNight;
  }

  const tmp = new Vector3();
  function update(t, camera, pointScale){
    uniforms.time.value = t;
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    stars.material.uniforms.t.value = t;
    // 太阳 / 月亮：钉在天空方向上的方形面片，始终正对镜头
    skyDir.copy(sky.material.uniforms.sunDir.value);
    for(const [disc, size] of [[sunDisc, 16], [moon, 11]]){
      disc.position.copy(camera.position).addScaledVector(skyDir, 120);
      disc.scale.setScalar(size);
      disc.quaternion.copy(camera.quaternion);
    }
    clouds.position.x = (t * 0.6) % 30;
    if(flies.visible){
      flies.material.uniforms.scale.value = pointScale;
      const a = flies.geometry.attributes.position, b = flies.userData.base;
      for(let i = 0; i < b.length; i++){
        const [x, y, z, p] = b[i];
        tmp.set(x + Math.sin(t * 0.4 + p) * 0.6, y + Math.sin(t * 0.9 + p * 2) * 0.25, z + Math.cos(t * 0.35 + p) * 0.5);
        a.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      a.needsUpdate = true;
    }
  }
  // 低配：高草是软件光栅下最贵的一项（逐顶点摆动 × 数百实例），只留三分之一
  function setDetail(level){ const gr = lawn.userData.grass; gr.count = level === 'low' ? 100 : gr.instanceMatrix.count; }

  return { group, pool, setTheme, update, setDetail, sun, hemi, textures: T, get night(){ return night; } };
}
