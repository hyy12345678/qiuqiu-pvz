// 战场环境：草坪、房子与门廊、后院栅栏与树、右侧人行道与街道、天空、灯光。
// 昼夜共用同一套几何，只切换灯光、雾、天空与发光件的亮度——夜晚是「同一个院子关了灯」。
import {
  AmbientLight, BackSide, BoxGeometry, Color, CylinderGeometry, DirectionalLight, DynamicDrawUsage, Float32BufferAttribute,
  Fog, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PlaneGeometry, PointLight, Points, BufferGeometry, ShaderMaterial, SphereGeometry, AdditiveBlending, Vector3,
} from 'three';
import { COLS, ROWS } from '../../core/constants.js';
import { mulberry32 } from '../../core/rng.js';
import { ROW_D, LAWN_D } from './coords.js';
import { createRig, GEO, bakeStatic } from './rig.js';
import { makeAsphalt, makeGrass, makeShingles, makeSiding, makeStone, makeWood } from './textures.js';

const PI = Math.PI;

function rep(t, rx, ry){
  if(!t) return null;
  const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true;
  return c;
}
function texturedBox(w, h, d, map, color, rough = 0.85){
  const m = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ map, color: map ? '#ffffff' : color, roughness: rough }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}
function texturedPlane(w, d, map, color, rough = 0.95){
  const m = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ map, color: map ? '#ffffff' : color, roughness: rough }));
  m.rotation.x = -PI / 2; m.receiveShadow = true;
  return m;
}

// ---- 草坪：棋盘格草皮 + 实例化草叶（顶点着色器里随风摆）----
function buildLawn(uniforms){
  const g = new Group();
  const rig = createRig();
  const r = mulberry32(42);
  const A = new Color('#6cc23d'), B = new Color('#59ad33');
  for(let row = 0; row < ROWS; row++){
    for(let c = 0; c < COLS; c++){
      const base = ((row + c) % 2 ? B : A).clone().multiplyScalar(0.94 + r() * 0.1);
      rig.add('root', 'm', GEO.box(0.985, 0.14, ROW_D - 0.015), base, { p: [c + 0.5, -0.07, (row + 0.5) * ROW_D], shade: 0.55 });
    }
  }
  // 草皮底下的泥土侧边
  rig.add('root', 'm', GEO.box(COLS + 0.1, 0.12, LAWN_D + 0.1), '#5a3f24', { p: [COLS / 2, -0.15, LAWN_D / 2] });
  const lawn = rig.finish();
  lawn.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = true; o.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }); } });
  g.add(lawn);

  // 草叶：三段收尖的细条，底暗顶亮
  const blade = new BufferGeometry();
  const P = [], C = [];
  const seg = [[0, 0.5, 0.034], [0.45, 0.72, 0.026], [0.8, 0.9, 0.014], [1, 1.05, 0]];
  for(let i = 0; i < seg.length - 1; i++){
    const [y0, c0, w0] = seg[i], [y1, c1, w1] = seg[i + 1];
    const q = [[-w0, y0, c0], [w0, y0, c0], [w1, y1, c1], [-w0, y0, c0], [w1, y1, c1], [-w1, y1, c1]];
    for(const [x, y, k] of q){ P.push(x, y, x * 0.6); C.push(k, k, k); }
  }
  blade.setAttribute('position', new Float32BufferAttribute(P, 3));
  blade.setAttribute('color', new Float32BufferAttribute(C, 3));
  blade.computeVertexNormals();
  const N = 3400;
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: 2 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uniforms.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float h = position.y * position.y;
        transformed.x += sin(uTime * 1.9 + ip.x * 1.3 + ip.z * 0.8) * 0.32 * h;
        transformed.z += cos(uTime * 1.4 + ip.x * 0.7) * 0.18 * h;
      }`);
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 1.0, 0.0);');
  };
  mat.customProgramCacheKey = () => 'grass';
  const im = new InstancedMesh(blade, mat, N);
  const m4 = new Matrix4(), o = new Object3D(), col = new Color();
  for(let i = 0; i < N; i++){
    const x = r() * COLS, z = r() * LAWN_D;
    const c = Math.min(COLS - 1, Math.floor(x)), row = Math.min(ROWS - 1, Math.floor(z / ROW_D));
    o.position.set(x, 0, z);
    o.rotation.set((r() - 0.5) * 0.4, r() * PI, (r() - 0.5) * 0.4);
    const s = 0.09 + r() * 0.08;
    o.scale.set(s * 1.6, s, s * 1.6);
    o.updateMatrix(); m4.copy(o.matrix);
    im.setMatrixAt(i, m4);
    col.copy((row + c) % 2 ? B : A).multiplyScalar(0.9 + r() * 0.35);
    im.setColorAt(i, col);
  }
  im.receiveShadow = true;
  g.add(im);
  g.userData.grass = im;
  return g;
}

// ---- 房子与门廊（左侧）----
function buildHouse(T, M){
  const g = new Group();
  const z0 = -2.2, z1 = LAWN_D + 1.6, zl = z1 - z0, zc = (z0 + z1) / 2;
  const deck = texturedBox(2.3, 0.22, zl, rep(T.wood, 1, 14), '#a8764a');
  deck.position.set(-2.35, 0.08, zc); g.add(deck);
  const step = texturedBox(0.4, 0.1, zl, rep(T.wood, 0.3, 14), '#a8764a');
  step.position.set(-1.05, 0.0, zc); g.add(step);
  const patio = texturedPlane(1.15, zl, rep(T.stone, 1.2, 9), '#9a958a');
  patio.position.set(-0.6, 0.012, zc); g.add(patio);
  const wall = texturedBox(1.4, 3.6, zl, rep(T.siding, 6, 3), '#e8dcc0', 0.9);
  wall.position.set(-4.2, 1.75, zc); g.add(wall);
  const sill = texturedBox(0.12, 0.25, zl, null, '#f4efe4');
  sill.position.set(-3.45, 0.25, zc); g.add(sill);

  const rig = createRig();
  // 窗户：白框、十字格、玻璃（夜里亮起暖光）
  const wins = [0.4, 4.0, 6.9];
  for(const wz of wins){
    rig.add('root', 'm', GEO.box(0.1, 1.5, 1.5), '#fbf8f0', { p: [-3.45, 1.55, wz] });
    rig.add('root', 'm', GEO.box(0.14, 0.08, 1.7), '#f4efe4', { p: [-3.42, 0.78, wz] });
    rig.add('root', 'm', GEO.box(0.08, 1.3, 0.06), '#fbf8f0', { p: [-3.37, 1.55, wz] });
    rig.add('root', 'm', GEO.box(0.08, 0.06, 1.3), '#fbf8f0', { p: [-3.37, 1.55, wz] });
    for(const sz of [-1, 1]) rig.add('root', 'm', GEO.box(0.06, 1.5, 0.35), '#3f6a8a', { p: [-3.43, 1.55, wz + sz * 0.95] });   // 百叶窗
  }
  // 门与门灯
  rig.add('root', 'm', GEO.box(0.12, 2.2, 1.15), '#f4efe4', { p: [-3.44, 1.1, 2.3] });
  rig.add('root', 'g', GEO.box(0.1, 2.0, 0.95), '#8a3c2a', { p: [-3.4, 1.02, 2.3] });
  for(const y of [0.55, 1.5]) rig.add('root', 'g', GEO.box(0.04, 0.55, 0.7), '#7a3222', { p: [-3.34, y, 2.3] });
  rig.add('root', 'x', GEO.sphere(0.05, 10, 8), '#e0b040', { p: [-3.32, 1.0, 1.98] });
  rig.add('root', 'x', GEO.box(0.12, 0.3, 0.18), '#2a2a2a', { p: [-3.36, 2.2, 3.1] });
  // 门廊柱与廊顶
  for(const pz of [-1.8, 1.4, 3.3, 5.6, LAWN_D + 1.2]){
    rig.add('root', 'm', GEO.cyl(0.09, 0.11, 2.7, 14), '#fbf8f0', { p: [-1.45, 1.45, pz] });
    rig.add('root', 'm', GEO.box(0.3, 0.12, 0.3), '#f4efe4', { p: [-1.45, 0.24, pz] });
  }
  rig.add('root', 'm', GEO.box(0.25, 0.22, zl), '#f4efe4', { p: [-1.45, 2.85, zc] });
  // 门廊上的花盆
  for(const pz of [-0.6, 4.7]){
    rig.add('root', 'm', GEO.cyl(0.18, 0.13, 0.28, 16), '#c4673a', { p: [-1.8, 0.33, pz] });
    for(let k = 0; k < 6; k++) rig.add('root', 'g', GEO.sphere(0.08, 10, 8), ['#ff5a7a', '#ffd23e', '#ff8a2e'][k % 3], { p: [-1.8 + Math.cos(k) * 0.1, 0.55 + (k % 2) * 0.05, pz + Math.sin(k) * 0.1] });
    rig.add('root', 'g', GEO.sphere(0.16, 12, 10), '#3f8a2a', { p: [-1.8, 0.48, pz], s: [1, 0.6, 1] });
  }
  const props = bakeStatic(rig.finish());
  g.add(props);
  // 窗玻璃单独一个材质：白天反着天光，夜里透出室内的暖光
  const glassGeo = new BoxGeometry(0.02, 1.3, 1.3);
  for(const wz of wins){
    const glass = new Mesh(glassGeo, M.window);
    glass.position.set(-3.4, 1.55, wz);
    g.add(glass);
  }
  const lamp = new Mesh(new SphereGeometry(0.07, 12, 8), M.lamp);
  lamp.position.set(-3.3, 2.15, 3.1); g.add(lamp);
  // 廊顶与屋顶
  const porchRoof = texturedBox(2.6, 0.12, zl + 0.4, rep(T.shingles, 2, 16), '#9a3e30');
  porchRoof.position.set(-2.35, 3.05, zc); porchRoof.rotation.z = 0.18; g.add(porchRoof);
  const roof = texturedBox(3.2, 0.2, zl + 0.8, rep(T.shingles, 3, 18), '#9a3e30');
  roof.position.set(-4.4, 4.2, zc); roof.rotation.z = 0.55; g.add(roof);
  return g;
}

// ---- 后院：栅栏、树篱、树 ----
function buildBackyard(){
  const rig = createRig();
  const r = mulberry32(9);
  const fz = -0.75;
  for(let x = -1.15; x < COLS + 0.5; x += 0.2){
    rig.add('root', 'm', GEO.box(0.14, 0.82, 0.05), '#f3ecd8', { p: [x, 0.41, fz], shade: 0.7 });
    rig.add('root', 'm', GEO.cone(0.1, 0.12, 4), '#f3ecd8', { p: [x, 0.88, fz], r: [0, PI / 4, 0], s: [1, 1, 0.35] });
  }
  for(const y of [0.25, 0.62]) rig.add('root', 'm', GEO.box(COLS + 1.7, 0.07, 0.04), '#ddd3b8', { p: [COLS / 2 - 0.3, y, fz - 0.05] });
  // 树篱
  for(let x = -1.2; x < COLS + 1; x += 0.42){
    const s = 0.38 + r() * 0.12;
    rig.add('root', 'm', GEO.ico(s, 1), r() > 0.5 ? '#3f7f2c' : '#356f25', { p: [x, 0.38 + r() * 0.1, -1.35 - r() * 0.15], s: [1.2, 0.95, 0.9] });
  }
  // 树：粗干 + 三团低多边形树冠
  const trees = [[-0.4, -3.2, 1.2], [2.6, -4.2, 1.5], [5.6, -3.4, 1.3], [8.4, -4.0, 1.6], [11.6, -2.6, 1.2]];
  for(const [x, z, s] of trees){
    rig.add('root', 'm', GEO.cyl(0.13 * s, 0.2 * s, 1.6 * s, 10), '#6a4528', { p: [x, 0.8 * s, z] });
    rig.add('root', 'm', GEO.ico(0.85 * s, 1), '#3c8a2e', { p: [x, 2.0 * s, z] });
    rig.add('root', 'm', GEO.ico(0.6 * s, 1), '#4f9e36', { p: [x + 0.45 * s, 2.5 * s, z + 0.2] });
    rig.add('root', 'm', GEO.ico(0.55 * s, 1), '#347a28', { p: [x - 0.5 * s, 2.35 * s, z - 0.2] });
  }
  return bakeStatic(rig.finish());
}

// ---- 右侧：草坪石边、人行道、路缘、街道、路灯、消防栓、邮筒 ----
function buildStreet(T, M){
  const g = new Group();
  const z0 = -6, z1 = LAWN_D + 4, zl = z1 - z0, zc = (z0 + z1) / 2;
  const walk = texturedPlane(1.1, zl, rep(T.stone, 1, 14), '#b8b2a6');
  walk.position.set(COLS + 0.85, 0.03, zc); g.add(walk);
  const curb = texturedBox(0.16, 0.14, zl, null, '#c8c2b6');
  curb.position.set(COLS + 1.48, 0.0, zc); g.add(curb);
  const road = texturedPlane(8, zl, rep(T.asphalt, 4, 7), '#4a4c52');
  road.position.set(COLS + 5.55, -0.03, zc); g.add(road);
  const rig = createRig();
  for(let z = z0; z < z1; z += 1.6) rig.add('root', 'm', GEO.box(0.1, 0.01, 0.8), '#f0e6b0', { p: [COLS + 4.2, -0.015, z] });
  for(let z = -0.2; z < LAWN_D + 0.2; z += 0.36){
    rig.add('root', 'm', GEO.box(0.3, 0.1, 0.32), z % 0.72 < 0.36 ? '#a8a294' : '#9a9486', { p: [COLS + 0.15, 0.02, z + 0.16] });
  }
  // 路灯
  for(const lz of [-0.6, LAWN_D + 0.9]){
    rig.add('root', 'x', GEO.cyl(0.05, 0.07, 2.6, 10), '#2f3a34', { p: [COLS + 1.25, 1.3, lz] });
    rig.add('root', 'x', GEO.cyl(0.22, 0.12, 0.2, 12), '#2f3a34', { p: [COLS + 1.25, 2.7, lz] });
  }
  // 消防栓、邮筒
  rig.add('root', 'g', GEO.cyl(0.09, 0.1, 0.4, 14), '#d82a2a', { p: [COLS + 1.0, 0.24, 2.2] });
  rig.add('root', 'g', GEO.sphere(0.09, 12, 8), '#d82a2a', { p: [COLS + 1.0, 0.44, 2.2] });
  rig.add('root', 'g', GEO.cyl(0.04, 0.04, 0.3, 10), '#d82a2a', { p: [COLS + 1.0, 0.3, 2.2], r: [PI / 2, 0, 0] });
  rig.add('root', 'm', GEO.cyl(0.04, 0.04, 0.9, 8), '#5a4a3a', { p: [COLS + 0.55, 0.45, LAWN_D + 0.5] });
  rig.add('root', 'g', GEO.capsule(0.16, 0.28), '#3a70c8', { p: [COLS + 0.55, 1.0, LAWN_D + 0.5], r: [PI / 2, 0, 0] });
  rig.add('root', 'g', GEO.box(0.03, 0.18, 0.08), '#e83a3a', { p: [COLS + 0.55, 1.22, LAWN_D + 0.35] });
  g.add(bakeStatic(rig.finish()));
  for(const lz of [-0.6, LAWN_D + 0.9]){
    const bulb = new Mesh(new SphereGeometry(0.13, 12, 8), M.lamp);
    bulb.position.set(COLS + 1.25, 2.56, lz); g.add(bulb);
    const cone = new Mesh(new CylinderGeometry(0.12, 1.1, 2.5, 20, 1, true), M.beam);
    cone.position.set(COLS + 1.25, 1.3, lz); g.add(cone);
    M.beamMeshes.push(cone);
  }
  return g;
}

// ---- 前景花坛 ----
function buildFront(){
  const rig = createRig();
  const r = mulberry32(17);
  const fz = LAWN_D + 0.05;
  for(let x = -0.1; x < COLS + 0.2; x += 0.34){
    rig.add('root', 'm', GEO.box(0.32, 0.12, 0.2), r() > 0.5 ? '#a8a294' : '#b4ae9f', { p: [x + 0.17, 0.03, fz + 0.1] });
  }
  rig.add('root', 'm', GEO.box(COLS + 1, 0.06, 1.2), '#5a3d22', { p: [COLS / 2, 0.0, fz + 0.8] });
  for(let i = 0; i < 46; i++){
    const x = -0.3 + r() * (COLS + 0.6), z = fz + 0.35 + r() * 0.9;
    rig.add('root', 'm', GEO.cyl(0.012, 0.012, 0.25, 5), '#3a8a2a', { p: [x, 0.12, z] });
    const c = ['#ff5a7a', '#ffd23e', '#ff8a2e', '#ffffff', '#c86aff'][i % 5];
    for(let k = 0; k < 5; k++){
      const a = k / 5 * PI * 2;
      rig.add('root', 'g', GEO.sphere(0.04, 8, 6), c, { p: [x + Math.cos(a) * 0.045, 0.26, z + Math.sin(a) * 0.045], s: [1, 0.5, 1] });
    }
    rig.add('root', 'g', GEO.sphere(0.03, 8, 6), '#ffb020', { p: [x, 0.27, z] });
    if(i % 3 === 0) rig.add('root', 'm', GEO.ico(0.14, 1), '#3f8a2c', { p: [x + 0.12, 0.1, z + 0.1], s: [1, 0.7, 1] });
  }
  return bakeStatic(rig.finish());
}

// ---- 天空穹顶：三段渐变 + 太阳光晕 ----
function buildSky(){
  const mat = new ShaderMaterial({
    uniforms: {
      top: { value: new Color('#3d8fe0') }, mid: { value: new Color('#bfe4ff') }, bottom: { value: new Color('#9ac870') },
      sunDir: { value: new Vector3(-0.4, 0.5, -0.75).normalize() }, sunColor: { value: new Color('#fff2c0') }, sunSize: { value: 1 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bottom, sunColor; uniform vec3 sunDir; uniform float sunSize; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(mid, bottom, pow(clamp(-h * 4.0, 0.0, 1.0), 0.6));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (pow(s, 900.0 / sunSize) * 4.0 + pow(s, 24.0) * 0.35);
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

// ---- 云（白天）与星星、萤火虫（夜晚）----
function buildClouds(){
  const rig = createRig();
  const r = mulberry32(31);
  for(let i = 0; i < 9; i++){
    const cx = -30 + i * 9 + r() * 4, cy = 14 + r() * 8, cz = -60 - r() * 25;
    for(let k = 0; k < 5; k++) rig.add('root', 'm', GEO.ico(2.2 + r() * 1.8, 1), '#ffffff', { p: [cx + k * 2.2 - 4, cy + (k % 2) * 1.2, cz + r() * 2], s: [1.3, 0.8, 1] });
  }
  const g = rig.finish();
  g.traverse(o => { if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; o.material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: new Color('#9ab8d8'), emissiveIntensity: 0.55, fog: false }); } });
  return g;
}
function buildStars(){
  const r = mulberry32(77);
  const P = [];
  for(let i = 0; i < 700; i++){
    const a = r() * PI * 2, h = 0.08 + r() * 0.9;
    const R = 140;
    P.push(Math.cos(a) * Math.sqrt(1 - h * h) * R, h * R, Math.sin(a) * Math.sqrt(1 - h * h) * R);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(P, 3));
  return new Points(g, new ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'uniform float t; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = 0.6 + 0.4 * sin(t * 2.0 + position.x * 0.37 + position.z); gl_PointSize = 2.4; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if(d > 0.5) discard; gl_FragColor = vec4(vec3(1.6, 1.6, 1.9) * vA, 1.0); }',
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
    vertexShader: 'uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.09 * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(vec3(2.2, 2.6, 0.8) * a, a); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  }));
  pts.frustumCulled = false;
  pts.userData.base = base;
  return pts;
}

export function createEnvironment(){
  const T = {
    wood: makeWood(), siding: makeSiding(), shingles: makeShingles(), stone: makeStone(),
    asphalt: makeAsphalt(), grass: makeGrass([78, 140, 50]),
  };
  const uniforms = { time: { value: 0 } };
  const M = {
    window: new MeshBasicMaterial({ color: new Color('#9cc8e8') }),
    lamp: new MeshBasicMaterial({ color: new Color('#fff4d0') }),
    beam: new MeshBasicMaterial({ color: new Color('#ffd890'), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: 2 }),
    beamMeshes: [],
  };
  const group = new Group();
  const ground = texturedPlane(80, 60, rep(T.grass, 18, 14), '#4f8c32');
  ground.position.set(COLS / 2, -0.05, LAWN_D / 2 - 8);
  group.add(ground);
  const lawn = buildLawn(uniforms);
  group.add(lawn);
  group.add(buildHouse(T, M));
  const yard = buildBackyard(); group.add(yard);
  group.add(buildStreet(T, M));
  group.add(buildFront());
  const sky = buildSky(); group.add(sky);
  const clouds = buildClouds(); group.add(clouds);
  const stars = buildStars(); group.add(stars);
  const flies = buildFireflies(); group.add(flies);

  // ---- 灯光 ----
  const hemi = new HemisphereLight('#cfe6ff', '#4a6a2a', 0.85);
  const sun = new DirectionalLight('#fff0d4', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
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
      u.sunDir.value.set(0.35, 0.42, -0.84).normalize(); u.sunColor.value.set('#dfe6ff'); u.sunSize.value = 2.5;
      M.window.color.setRGB(2.4, 1.6, 0.7);
      M.lamp.color.setRGB(3.2, 2.7, 1.6);
      M.beam.opacity = 0.09;
      scene.fog = new Fog('#141c3a', 26, 62);
      scene.environmentIntensity = 0.1;
    } else {
      hemi.color.set('#cfe6ff'); hemi.groundColor.set('#4a6a2a'); hemi.intensity = 0.85;
      sun.color.set('#fff0d4'); sun.intensity = 2.5;
      sun.position.set(COLS / 2 - 7, 15, LAWN_D / 2 + 6);
      fill.color.set('#bcd4ff'); fill.intensity = 0.45;
      u.top.value.set('#3d8fe0'); u.mid.value.set('#c4e6ff'); u.bottom.value.set('#9ac870');
      u.sunDir.value.set(-0.4, 0.5, -0.75).normalize(); u.sunColor.value.set('#fff2c0'); u.sunSize.value = 1;
      M.window.color.set('#9cc8e8');
      M.lamp.color.set('#fff4d0');
      M.beam.opacity = 0;
      scene.fog = new Fog('#cfe6f5', 34, 80);
      scene.environmentIntensity = 0.28;
    }
    for(const b of M.beamMeshes) b.visible = isNight;
    stars.visible = isNight; flies.visible = isNight; clouds.visible = !isNight;
  }

  const tmp = new Vector3();
  function update(t, camera, pointScale){
    uniforms.time.value = t;
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    stars.material.uniforms.t.value = t;
    clouds.position.x = (t * 0.6) % 20;
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

  // 低配：草叶是软件光栅下最贵的一项（逐顶点摆动 × 数千实例），只留四分之一
  function setDetail(level){ lawn.userData.grass.count = level === 'low' ? 850 : lawn.userData.grass.instanceMatrix.count; }

  return { group, pool, setTheme, update, setDetail, sun, hemi, textures: T, get night(){ return night; } };
}

