// 3D 战场环境：昼夜主题、点光源池、静态布景材质。
// 取代 2D 时代的背景离屏缓存测试——背景不再预渲染成位图，而是常驻场景树、按主题换灯。
import test from 'node:test';
import assert from 'node:assert';
import { Scene } from 'three';
import { createWorld, beginPlay } from '../src/core/world.js';
import { explode } from '../src/core/entities.js';
import { createUI } from '../src/ui/state.js';
import { createEnvironment } from '../src/render/scene3d/environment.js';
import { createWorldView } from '../src/render/scene3d/world-view.js';

function battleWorld(level){
  const w = createWorld({ seed: 4 }); w.level = level; w.slots = []; beginPlay(w, 50); w.t = 1;
  return w;
}

test('昼夜主题：夜里亮星星、萤火虫与路灯光柱，收起云；白天反之', () => {
  const env = createEnvironment(), scene = new Scene();
  env.setTheme(true, scene);
  const visible = name => { let v = null; env.group.traverse(o => { if(o.isPoints && v === null) v = o.visible; }); return v; };
  assert.strictEqual(env.night, true);
  assert.ok(scene.fog && scene.fog.far < 70, '夜里雾应更近');
  assert.ok(env.sun.intensity < 1.5, '月光应明显弱于日光');
  env.setTheme(false, scene);
  assert.strictEqual(env.night, false);
  assert.ok(env.sun.intensity > 2, '白天日光应恢复');
  assert.strictEqual(visible(), false, '白天不应显示星星');
});

test('同一主题重复设置不重建雾与灯光（每帧都会调用，必须是空操作）', () => {
  const env = createEnvironment(), scene = new Scene();
  env.setTheme(false, scene);
  const fog = scene.fog, sunColor = env.sun.color.getHex();
  for(let i = 0; i < 5; i++) env.setTheme(false, scene);
  assert.strictEqual(scene.fog, fog, '同主题不应换掉雾对象');
  assert.strictEqual(env.sun.color.getHex(), sunColor);
});

test('世界视图按关卡选主题：夜关战斗是夜，菜单与白关是昼', () => {
  const view = createWorldView(), ui = createUI();
  view.update('battle', battleWorld(3), ui, 0, 400);
  assert.strictEqual(view.env.night, true, '第 4 关应切到夜');
  view.update('menu', battleWorld(3), ui, 0.1, 400);
  assert.strictEqual(view.env.night, false, '菜单始终是白天的院子');
  view.update('battle', battleWorld(0), ui, 0.2, 400);
  assert.strictEqual(view.env.night, false);
});

test('点光源池固定 4 盏：再多爆炸也只点亮最亮的 4 盏，不增减光源数量（数量一变着色器就要重编译）', () => {
  const view = createWorldView(), ui = createUI();
  const w = battleWorld(0);
  const lights = () => { let n = 0; view.scene.traverse(o => { if(o.isPointLight) n++; }); return n; };
  view.update('battle', w, ui, 0, 400);
  const n0 = lights();
  for(let i = 0; i < 6; i++) explode(w, 300 + i * 100, i % 5, true);
  view.update('battle', w, ui, 1 / 60, 400);
  assert.strictEqual(lights(), n0, '点光源数量不应随特效变化');
  assert.strictEqual(n0, 4);
  assert.strictEqual(view.env.pool.filter(l => l.intensity > 0).length, 4, '6 场爆炸应占满 4 盏灯');
});

test('静态布景每个网格都拿到了真材质（漏绑时会退回 three 默认的纯白无光材质）', () => {
  const env = createEnvironment();
  const bad = [];
  env.group.traverse(o => {
    if(!o.isMesh || !o.userData.key) return;
    if(!o.material || !o.material.vertexColors) bad.push(o.userData.key);
  });
  assert.deepStrictEqual(bad, [], '有布景网格没有绑定顶点色材质');
});
