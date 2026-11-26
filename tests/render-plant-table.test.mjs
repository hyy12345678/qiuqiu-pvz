// 模型表与数值表必须一一对应。
//
// 漏登记一个模型时，实体「种下去不画」、图鉴「卡片空白」，而且不抛错——这笔债由这里兜住。
// 3D 版：PLANT_MODELS / ZOMBIE_MODELS 取代了原来的 2D 绘制表。
import test from 'node:test';
import assert from 'node:assert';
import { PLANTS, PLANT_ORDER } from '../src/core/data/plants.js';
import { ZTYPES } from '../src/core/data/zombies.js';
import { PLANT_MODELS } from '../src/render/scene3d/plants.js';
import { ZOMBIE_MODELS } from '../src/render/scene3d/zombies.js';
import { template } from '../src/render/scene3d/world-view.js';
import { portrait } from '../src/render/skin.js';
import { withTarget } from '../src/render/target.js';
import { makeContext } from './helpers/scenario.mjs';

test('每个植物都有 3D 模型与动画，且没有表外死条目', () => {
  for(const type of Object.keys(PLANTS)){
    assert.ok(PLANT_MODELS[type], type + ' 缺少 3D 模型');
    assert.strictEqual(typeof PLANT_MODELS[type].build, 'function');
    assert.strictEqual(typeof PLANT_MODELS[type].animate, 'function');
  }
  for(const type of Object.keys(PLANT_MODELS)) assert.ok(PLANTS[type], '模型表里出现了未知植物 ' + type);
});

test('每种僵尸都有 3D 模型，且没有表外死条目', () => {
  assert.deepStrictEqual(Object.keys(ZOMBIE_MODELS).sort(), Object.keys(ZTYPES).sort());
});

test('PLANT_ORDER 与植物表同集合', () => {
  assert.deepStrictEqual([...PLANT_ORDER].sort(), Object.keys(PLANTS).sort());
  assert.strictEqual(PLANT_ORDER.length, Object.keys(PLANTS).length);
});

test('每个模型都建得出网格，且按「节点 × 材质类」合并后绘制调用保持在少数', () => {
  for(const [kind, table] of [['plant', PLANTS], ['zombie', ZTYPES]]){
    for(const type of Object.keys(table)){
      const root = template(kind, type);
      let meshes = 0, verts = 0;
      root.traverse(o => { if(o.isMesh){ meshes++; verts += o.geometry.attributes.position.count; } });
      assert.ok(meshes >= 2, kind + ':' + type + ' 网格过少（' + meshes + '）');
      assert.ok(meshes <= 40, kind + ':' + type + ' 网格过多（' + meshes + '），合并失效会拖垮帧率');
      // 方块模型本来就是低多边形：一个长方体 36 个顶点，至少 4 个零件才算建出来了
      assert.ok(verts >= 36 * 4, kind + ':' + type + ' 顶点过少（' + verts + '），模型可能没建出来');
    }
  }
  // 没有 WebGL 时卡片肖像退回圆章，必须落笔，不能留白
  const paint = makeContext({ label: '肖像' });
  withTarget(paint.ctx, () => portrait(null, '豌豆射手', 0, 0, 60, 60));
  assert.ok(paint.counts.get('arc') >= 1 && paint.counts.get('fillText') >= 1, '无肖像时应画占位圆章');
});
