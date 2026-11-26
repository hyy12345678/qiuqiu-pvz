// 3D 渲染器：WebGL 画到一张离屏画布上，再由 2D 主画布整幅贴上去，界面层画在它上面。
//
// 为什么不直接把 WebGL 画布当主画布：界面（卡片、按钮、文字）用 2D canvas 画最清楚，
// 输入、热点、DPR 也都已经按 2D 主画布组织好。离屏 → drawImage 在同一个任务里完成，
// 不需要 preserveDrawingBuffer。
//
// 没有 WebGL 时 createView3D 返回 null，由调用方显示提示；不再保留 2D 战场兜底。
import {
  Box3, Group, HalfFloatType, NeutralToneMapping, PCFShadowMap, PerspectiveCamera,
  Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget, HemisphereLight, DirectionalLight, PMREMGenerator,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H } from '../../core/constants.js';
import { PLANTS } from '../../core/data/plants.js';
import { DPR } from '../target.js';
import { createWorldView, template, plantYaw } from './world-view.js';
import { instantiate, resetPose } from './rig.js';
import { PLANT_MODELS } from './plants.js';
import { ZOMBIE_MODELS } from './zombies.js';
import { createPicker } from './picking.js';

// 画质档位：按设备像素比起步，持续掉帧就往下降一档，永不回升（避免来回抖动）
const QUALITY = [2, 1.5, 1.25, 1, 0.8, 0.65];

// 软件光栅（SwiftShader、llvmpipe、微软基础渲染）没有 GPU，全特效只有个位数帧率。
// 识别出来就直接用低配：关多重采样与泛光、缩小阴影贴图、从低分辨率起步。
// 页面地址带 ?gfx=low / ?gfx=high 可以手动指定（给跑不动的老平板留个口子）。
const SOFTWARE_GPU = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i;
function pickProfile(renderer, search){
  const forced = /[?&]gfx=(low|high)\b/.exec(search || '');
  if(forced) return forced[1];
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return SOFTWARE_GPU.test(name) ? 'low' : 'high';
  } catch(e){ return 'high'; }
}

export function createView3D({ document: doc = globalThis.document, search = globalThis.location && globalThis.location.search } = {}){
  let canvas, renderer;
  try {
    canvas = doc.createElement('canvas');
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance', stencil: false });
    if(!renderer.capabilities || !renderer.capabilities.isWebGL2) throw new Error('需要 WebGL2');
  } catch(e){
    return null;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const profile = pickProfile(renderer, search);
  const low = profile === 'low';

  const view = createWorldView();
  const { scene, camera } = view;
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  if(low){ view.env.sun.shadow.mapSize.set(1024, 1024); view.env.setDetail('low'); }
  let scale = 0, qi = low ? QUALITY.indexOf(0.65) : 0;
  const rt = new WebGLRenderTarget(W, H, { type: HalfFloatType, samples: low ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(W, H), 0.5, 0.42, 1.0);
  bloom.enabled = !low;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function wantScale(){
    while(qi < QUALITY.length - 1 && QUALITY[qi] > Math.max(1, DPR)) qi++;
    return QUALITY[qi];
  }
  function resize(){
    const s = wantScale();
    if(s === scale) return;
    scale = s;
    renderer.setPixelRatio(s);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(s);
    composer.setSize(W, H);
  }

  // 掉帧监测：最近 90 帧平均超过 26ms（约 38fps）就降一档
  let acc = 0, n = 0, lastNow = 0;
  function watch(now){
    if(lastNow){
      const d = now - lastNow;
      if(d < 250){ acc += d; n++; }
    }
    lastNow = now;
    if(n >= 90){
      if(acc / n > 26 && qi < QUALITY.length - 1){ qi++; scale = 0; }
      acc = 0; n = 0;
    }
  }

  // ---- 卡片与图鉴用的 3D 肖像：一次性渲染进 2D 画布 ----
  const icons = new Map();
  const iconScene = new Scene();
  iconScene.environment = scene.environment;
  iconScene.add(new HemisphereLight('#eaf4ff', '#6a5a40', 1.4));
  const key = new DirectionalLight('#fff4e0', 3.2); key.position.set(-2, 4, 5); iconScene.add(key);
  const rim = new DirectionalLight('#bfe0ff', 2.2); rim.position.set(3, 2, -4); iconScene.add(rim);
  const iconCam = new PerspectiveCamera(24, 1, 0.05, 50);
  const IW = 168, IH = 196;
  function renderIcon(kind, type){
    const inst = instantiate(template(kind === 'head' ? 'zombie' : 'plant', type));
    const holder = new Group(); holder.add(inst.root);
    holder.rotation.y = kind === 'head' ? -Math.PI / 2 + 0.55 : plantYaw(type) - 0.2;
    resetPose(inst);
    const e = { dt: 0, night: false, asleep: false };
    if(kind === 'plant'){
      PLANT_MODELS[type].animate(inst, { type, phase: 0, recoil: 0, flash: 0, hp: 1, maxHp: 1, armed: true, armT: 14, fuse: 1.05, sunT: 9, lifeT: 25, maxLifeT: 25 }, 0.4, e);
      inst.root.scale.set(1, 1, 1);
    } else {
      ZOMBIE_MODELS[type].animate(inst, { type, row: 0, x: 0, state: 'walk', animT: 0.3, acc: undefined, hp: undefined }, 0.4, e);
    }
    inst.mats.set(0, null, 1);
    iconScene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new Box3();
    if(kind === 'head') box.setFromObject(inst.pv.head); else box.setFromObject(inst.root);
    const c = box.getCenter(new Vector3()), sz = box.getSize(new Vector3());
    const aspect = IW / IH;
    const fitH = Math.max(sz.y, sz.x / aspect) * (kind === 'head' ? 1.12 : 1.08);
    const dist = fitH / 2 / Math.tan(iconCam.fov * Math.PI / 360);
    iconCam.aspect = aspect;
    iconCam.position.set(c.x + dist * 0.08, c.y + dist * 0.2, c.z + dist);
    iconCam.lookAt(c);
    iconCam.updateProjectionMatrix();
    const out = doc.createElement('canvas');
    out.width = IW; out.height = IH;
    renderer.setPixelRatio(1);
    renderer.setSize(IW, IH, false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(iconScene, iconCam);
    out.getContext('2d').drawImage(canvas, 0, 0);
    iconScene.remove(holder);
    inst.mats.dispose();
    return out;
  }
  function buildIcons(){
    const was = scale;
    for(const type of Object.keys(PLANTS)) icons.set('plant:' + type, renderIcon('plant', type));
    for(const type of Object.keys(ZOMBIE_MODELS)) icons.set('head:' + type, renderIcon('head', type));
    scale = 0;
    if(was) resize();
  }

  let iconsReady = false;
  function draw(mode, world, ui, t, now){
    if(!iconsReady){ buildIcons(); iconsReady = true; }
    if(now !== undefined) watch(now);
    resize();
    // 粒子的屏幕尺寸按渲染高度换算（gl_PointSize 以像素计）
    const pointScale = H * scale / (2 * Math.tan(camera.fov * Math.PI / 360));
    view.update(mode, world, ui, t, pointScale);
    composer.render();
    return canvas;
  }

  const picker = createPicker(view);

  return {
    canvas, draw, cellAt: picker.cellAt, sunAt: picker.sunAt, screenOf: picker.screenOf,
    icon: (kind, type) => icons.get(kind + ':' + type) || null,
    get scale(){ return scale; },
    profile,
    renderer, view,
  };
}

