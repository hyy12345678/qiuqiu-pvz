// E4：绘制表与植物数值表必须一一对应。
//
// 拆分前 plant.js 里是两个必须手工同步的 switch：漏登记一个 case 时，实体「种下去不画」、
// 图标「图鉴/卡槽空白」，而且不抛错、不告警。合并成一张表之后，这笔债由这里兜住。

import test from 'node:test';
import assert from 'node:assert';
import { PLANTS, PLANT_ORDER } from '../src/core/data/plants.js';
import { PLANT_DRAWERS, ICON_POSE, drawPlantIcon } from '../src/render/plant.js';
import { bindCanvas } from '../src/render/target.js';

// E18：图标改成离屏精灵后，需要 document 来创建缓存画布。
if (!globalThis.document) {
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => makeCanvasCtx() }),
  };
}
function makeCanvasCtx(){
  const t = {};
  return new Proxy(t, {
    get(o, k){ if (typeof k !== 'string') return undefined; if (k in o) return o[k]; const f = () => (k === 'createLinearGradient' || k === 'createRadialGradient' ? { addColorStop(){} } : undefined); o[k] = f; return f; },
    set(o, k, v){ o[k] = v; return true; },
  });
}

function countingCanvas(){
  const counts = new Map();
  const target = {};
  const ctx = new Proxy(target, {
    get(t, k){
      if (typeof k !== 'string') return undefined;
      if (k in t) return t[k];
      const fn = (...args) => {
        counts.set(k, (counts.get(k) || 0) + 1);
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop(){} };
        return undefined;
      };
      t[k] = fn;
      return fn;
    },
    set(t, k, v){ t[k] = v; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, counts };
}

test('E4：每个植物都有绘制入口与图鉴姿态', () => {
  for(const type of Object.keys(PLANTS)){
    assert.strictEqual(typeof PLANT_DRAWERS[type], 'function', type + ' 缺少绘制入口');
    assert.ok(ICON_POSE[type], type + ' 缺少图鉴姿态');
  }
});

test('E4：绘制表里没有植物表之外的死条目', () => {
  for(const type of Object.keys(PLANT_DRAWERS)){
    assert.ok(PLANTS[type], '绘制表里出现了未知植物 ' + type);
  }
  for(const type of Object.keys(ICON_POSE)){
    assert.ok(PLANTS[type], '图鉴姿态里出现了未知植物 ' + type);
  }
});

test('E4：PLANT_ORDER 与植物表同集合', () => {
  assert.deepStrictEqual([...PLANT_ORDER].sort(), Object.keys(PLANTS).sort());
  assert.strictEqual(PLANT_ORDER.length, Object.keys(PLANTS).length);
});

test('E4：每个植物图标都真的落了笔', () => {
  for(const type of Object.keys(PLANTS)){
    const { canvas, counts } = countingCanvas();
    bindCanvas(canvas, 1);
    drawPlantIcon(1.7, type, 100, 100, 1);
    // E18 起图标走 drawImage 贴精灵；"有没有落笔"的语义改为"有没有贴出精灵"。
    const ink = counts.get('drawImage') || 0;
    assert.ok(ink > 0, type + ' 的图鉴图标没有贴出任何精灵');
  }
});
