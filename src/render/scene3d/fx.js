// 特效层：点精灵粒子（核心层的粒子 + 渲染层自己的火花/烟/冰屑）、爆炸、残骸、点光源调度。
//
// 渲染层自己的特效只用本模块的确定性随机源，绝不碰 world.rng / world.fxRng——
// 画面再热闹，也不能反过来改变一局的结果。
import {
  AdditiveBlending, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, NormalBlending, Points, RingGeometry, ShaderMaterial, SphereGeometry, SRGBColorSpace,
} from 'three';
import { mulberry32 } from '../../core/rng.js';

const PI = Math.PI;

// ---- CSS 颜色解析（带缓存）：核心层的粒子颜色是 '#rrggbb' 或 'rgba(...)' 字符串 ----
const CSS_CACHE = new Map();
export function parseCss(s){
  let v = CSS_CACHE.get(s);
  if(v) return v;
  const c = new Color();
  let a = 1;
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  if(m){
    const p = m[1].split(',').map(x => parseFloat(x));
    c.setRGB(p[0] / 255, p[1] / 255, p[2] / 255, SRGBColorSpace);
    if(p.length > 3) a = p[3];
  } else {
    c.set(s);
  }
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  // 暖色高亮（火光、爆炸、光线）走加色混合，其余（泥土、叶片、纸屑、烟）走普通混合
  const hot = (c.r > 0.55 && c.g > 0.12 && c.b < 0.5 && lum > 0.3) || (c.b > 0.6 && c.r > 0.5 && c.g > 0.7) || lum > 0.85;
  v = { r: c.r, g: c.g, b: c.b, a, hot };
  CSS_CACHE.set(s, v);
  return v;
}

const VS = `
  attribute float size; attribute float alpha; attribute vec3 color;
  uniform float scale;
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vColor = color; vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, size * scale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FS_NORMAL = `
  varying vec3 vColor; varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if(d > 1.0) discard;
    float a = smoothstep(1.0, 0.55, d);
    gl_FragColor = vec4(vColor * (1.05 - d * 0.25), a * vAlpha);
  }`;
const FS_ADD = `
  varying vec3 vColor; varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if(d > 1.0) discard;
    float a = pow(1.0 - d, 1.6);
    gl_FragColor = vec4(vColor * a * vAlpha * 2.2, 1.0);
  }`;

export function createCloud(max, additive){
  const g = new BufferGeometry();
  const mk = (n) => new Float32BufferAttribute(new Float32Array(max * n), n).setUsage(DynamicDrawUsage);
  g.setAttribute('position', mk(3)); g.setAttribute('color', mk(3));
  g.setAttribute('size', mk(1)); g.setAttribute('alpha', mk(1));
  g.setDrawRange(0, 0);
  const mat = new ShaderMaterial({
    uniforms: { scale: { value: 400 } }, vertexShader: VS, fragmentShader: additive ? FS_ADD : FS_NORMAL,
    transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending,
  });
  const pts = new Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = additive ? 5 : 4;
  let n = 0;
  return {
    points: pts,
    begin(){ n = 0; },
    push(x, y, z, r, gg, b, size, alpha){
      if(n >= max) return;
      g.attributes.position.setXYZ(n, x, y, z);
      g.attributes.color.setXYZ(n, r, gg, b);
      g.attributes.size.setX(n, size);
      g.attributes.alpha.setX(n, alpha);
      n++;
    },
    end(scale){
      g.setDrawRange(0, n);
      for(const k of ['position', 'color', 'size', 'alpha']){ g.attributes[k].needsUpdate = true; }
      mat.uniforms.scale.value = scale;
    },
    get count(){ return n; },
  };
}

export function createFx(scene){
  const rng = mulberry32(0xC0FFEE);
  const R = (a, b) => a + rng() * (b - a);
  const group = new Group();
  scene.add(group);
  const normal = createCloud(1500, false), add = createCloud(1500, true);
  group.add(normal.points, add.points);
  const parts = [];

  // kind：spark 火花（加色、受重力）、smoke 烟（普通、上升、变大）、ice 冰屑、ember 余烬、dust 尘土、bubble 睡觉泡泡
  function emit(kind, x, y, z, n, o = {}){
    for(let i = 0; i < n; i++){
      const a = R(0, PI * 2), el = R(o.elMin === undefined ? -0.2 : o.elMin, o.elMax === undefined ? 1.2 : o.elMax);
      const sp = R(o.spMin || 0.5, o.spMax || 2);
      const c = o.colors ? o.colors[i % o.colors.length] : [1, 0.8, 0.4];
      parts.push({
        kind, x: x + R(-1, 1) * (o.jitter || 0), y: y + R(-1, 1) * (o.jitter || 0) * 0.5, z: z + R(-1, 1) * (o.jitter || 0),
        vx: Math.cos(a) * Math.cos(el) * sp + (o.vx || 0), vy: Math.sin(el) * sp + (o.vy || 0), vz: Math.sin(a) * Math.cos(el) * sp * (o.flat || 1),
        g: o.g === undefined ? 6 : o.g, drag: o.drag || 0, life: R(o.lifeMin || 0.3, o.lifeMax || 0.7), max: 0,
        size: R(o.sizeMin || 0.04, o.sizeMax || 0.09), grow: o.grow || 0, r: c[0], gg: c[1], b: c[2],
        add: o.additive !== undefined ? o.additive : (kind === 'spark' || kind === 'ember' || kind === 'ice'),
      });
      parts[parts.length - 1].max = parts[parts.length - 1].life;
    }
  }

  // ---- 爆炸 ----
  const booms = [];
  const sphereGeo = new SphereGeometry(1, 24, 16);
  const ringGeo = new RingGeometry(0.7, 1, 48);
  function explosion(x, z, radius, big){
    const g = new Group();
    g.position.set(x, 0, z);
    // 火团由一簇会膨胀、变红、上浮的火焰粒子组成（见下方 emit('fire')）；
    // 单个大球体在这个镜头下只是一块扁平的色饼，读不出体积
    const core = new Mesh(sphereGeo, new MeshBasicMaterial({ color: new Color(3, 2.4, 1.2), transparent: true, depthWrite: false }));
    const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: new Color(1.3, 0.85, 0.45), transparent: true, blending: AdditiveBlending, depthWrite: false, side: 2 }));
    ring.rotation.x = -PI / 2; ring.position.y = 0.05;
    g.add(core, ring);
    group.add(g);
    booms.push({ g, core, ring, age: 0, radius, big });
    emit('fire', x, 0.35, z, big ? 40 : 22, { spMin: 1.5, spMax: big ? 4.5 : 3, elMin: 0.5, elMax: 1.5, g: -4.5, drag: 4, lifeMin: 0.3, lifeMax: 0.7,
      sizeMin: radius * 0.3, sizeMax: radius * 0.55, grow: radius * 1.2, jitter: radius * 0.2,
      colors: [[2.6, 1.5, 0.35], [2.4, 0.9, 0.18], [2.8, 2.0, 0.8]], additive: false });
    const n = big ? 110 : 60;
    emit('spark', x, 0.4, z, n, { spMin: 2, spMax: big ? 8 : 5, elMin: 0.1, elMax: 1.4, g: 9, lifeMin: 0.35, lifeMax: 0.9, sizeMin: 0.04, sizeMax: 0.1,
      colors: [[1, 0.85, 0.4], [1, 0.55, 0.15], [1, 0.95, 0.7]] });
    emit('smoke', x, 0.3, z, big ? 22 : 12, { spMin: 0.3, spMax: 1.4, elMin: 0.2, elMax: 1.4, g: -0.6, drag: 1.5, lifeMin: 0.9, lifeMax: 1.8,
      sizeMin: 0.35, sizeMax: 0.7, grow: 0.9, jitter: radius * 0.3, colors: [[0.18, 0.16, 0.15], [0.26, 0.23, 0.2], [0.12, 0.11, 0.1]], additive: false });
    emit('dust', x, 0.15, z, big ? 26 : 14, { spMin: 1.5, spMax: 4, elMin: 0.4, elMax: 1.3, g: 9, lifeMin: 0.5, lifeMax: 1.0, sizeMin: 0.05, sizeMax: 0.11,
      colors: [[0.36, 0.25, 0.14], [0.45, 0.33, 0.2]], additive: false });
  }

  // ---- 残骸：一块会飞、会弹、会转的实体 ----
  const debris = [];
  function addDebris(inst, x, y, z, o = {}){
    inst.root.position.set(x, y, z);
    group.add(inst.root);
    debris.push({ inst, vx: o.vx === undefined ? R(0.6, 1.6) : o.vx, vy: o.vy === undefined ? R(2.5, 4) : o.vy, vz: R(-0.5, 0.8),
      sx: R(-6, 6), sz: R(-8, 8), age: 0, bounce: 0 });
  }

  // ---- 光线残影：迪迦光线消失后的一瞬 ----
  const afterglows = [];
  function beamAfterglow(mesh){
    afterglows.push({ mesh, age: 0 });
  }

  // ---- 点光源请求：每帧收集，按亮度取前 N 盏 ----
  let lightReq = [];
  function light(x, y, z, color, intensity, dist = 4){ lightReq.push({ x, y, z, color, intensity, dist }); }

  function update(dt, pool, scale){
    // 粒子
    normal.begin(); add.begin();
    for(let i = parts.length - 1; i >= 0; i--){
      const p = parts[i];
      p.life -= dt;
      if(p.life <= 0){ parts.splice(i, 1); continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if(p.y < 0.02){ p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.size += p.grow * dt;
      const k = p.life / p.max;
      const alpha = p.kind === 'smoke' ? Math.min(1, k * 1.5) * 0.7 : Math.min(1, k * 2);
      if(p.kind === 'fire'){
        // 火焰从白黄烧到暗红：绿、蓝分量随寿命先掉
        const h = Math.pow(k, 0.7);
        normal.push(p.x, p.y, p.z, p.r * (0.45 + 0.55 * h), p.gg * h * h, p.b * h * h * h, p.size, Math.min(1, k * 2.5) * 0.92);
        continue;
      }
      (p.add ? add : normal).push(p.x, p.y, p.z, p.r, p.gg, p.b, p.size, alpha);
    }
    // 爆炸
    for(let i = booms.length - 1; i >= 0; i--){
      const b = booms[i];
      b.age += dt;
      const a = b.age, R0 = b.radius;
      b.core.scale.setScalar(Math.max(0.01, R0 * 0.32 * (1 - Math.min(1, a / 0.2))));
      b.core.position.y = R0 * 0.25;
      b.core.material.opacity = Math.max(0, 1 - a / 0.22);
      const rk = Math.min(1, a / 0.4);
      b.ring.scale.setScalar(0.1 + R0 * 1.9 * (1 - Math.pow(1 - rk, 2)));
      b.ring.material.opacity = Math.max(0, 1 - rk);
      if(a < 0.4) light(b.g.position.x, 1.2, b.g.position.z, '#ff7020', (b.big ? 18 : 12) * Math.max(0, 1 - a / 0.4), b.big ? 5 : 3.5);
      if(a > 0.7){
        group.remove(b.g);
        for(const m of [b.core, b.ring]) m.material.dispose();
        booms.splice(i, 1);
      }
    }
    // 残骸
    for(let i = debris.length - 1; i >= 0; i--){
      const d = debris[i];
      d.age += dt;
      const r = d.inst.root;
      d.vy -= 9.8 * dt;
      r.position.x += d.vx * dt; r.position.y += d.vy * dt; r.position.z += d.vz * dt;
      r.rotation.x += d.sx * dt; r.rotation.z += d.sz * dt;
      if(r.position.y < 0.05 && d.vy < 0){
        r.position.y = 0.05; d.vy = -d.vy * 0.35; d.vx *= 0.5; d.vz *= 0.5; d.sx *= 0.5; d.sz *= 0.5;
        if(d.bounce++ === 0) emit('dust', r.position.x, 0.08, r.position.z, 6, { spMin: 0.5, spMax: 1.2, elMin: 0.3, elMax: 1, g: 5, sizeMin: 0.04, sizeMax: 0.07, colors: [[0.45, 0.35, 0.22]], additive: false });
      }
      const fade = d.age > 1.3 ? Math.max(0, 1 - (d.age - 1.3) / 0.5) : 1;
      d.inst.mats.set(0, null, fade);
      if(d.age > 1.8){ group.remove(r); d.inst.mats.dispose(); debris.splice(i, 1); }
    }
    for(let i = afterglows.length - 1; i >= 0; i--){
      const g = afterglows[i];
      g.age += dt;
      const k = Math.max(0, 1 - g.age / 0.3);
      g.mesh.scale.y = g.mesh.scale.z = k;
      if(k <= 0){ g.mesh.parent && g.mesh.parent.remove(g.mesh); afterglows.splice(i, 1); }
    }
    normal.end(scale); add.end(scale);
    // 点光源调度
    lightReq.sort((a, b) => b.intensity - a.intensity);
    for(let i = 0; i < pool.length; i++){
      const l = pool[i], q = lightReq[i];
      if(q){ l.position.set(q.x, q.y, q.z); l.color.set(q.color); l.intensity = q.intensity; l.distance = q.dist; }
      else { l.intensity = 0; }
    }
    lightReq = [];
  }

  function clear(){
    parts.length = 0;
    for(const b of booms) group.remove(b.g);
    booms.length = 0;
    for(const d of debris){ group.remove(d.inst.root); d.inst.mats.dispose(); }
    debris.length = 0;
  }

  return { group, emit, explosion, addDebris, beamAfterglow, light, update, clear, rand: R, clouds: { normal, add } };
}
