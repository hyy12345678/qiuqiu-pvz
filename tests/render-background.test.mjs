import test from 'node:test';
import assert from 'node:assert';
import { W, H } from '../src/core/constants.js';
import { bindCanvas, ctx } from '../src/render/target.js';
import { createBackgroundCache } from '../src/render/background.js';

function makeCanvas(label){
  const c = { label, scaleArgs: [], scale(...a){ c.scaleArgs.push(a); } };
  return { canvas: { width: 0, height: 0, getContext: () => c }, c };
}

test('背景缓存：首次绘制后命中，换主题或 DPR 变化才重绘', () => {
  const main = makeCanvas('main');
  bindCanvas(main.canvas, 1);

  let builds = 0;
  const seen = [];
  const cache = createBackgroundCache({
    createCanvas: () => { builds++; return makeCanvas('bg' + builds).canvas; },
    dpr: 2,
  });

  const first = cache.ensure('day', () => seen.push(ctx.label));
  assert.strictEqual(builds, 1);
  assert.strictEqual(cache.theme, 'day');
  assert.strictEqual(first.width, W * 2);
  assert.strictEqual(first.height, H * 2);
  assert.deepStrictEqual(first.getContext('2d').scaleArgs, [[2, 2]]);
  assert.deepStrictEqual(seen, ['bg1'], '绘制时应临时指向离屏上下文');
  assert.strictEqual(ctx, main.c, '绘制结束应恢复主 target');

  const again = cache.ensure('day', () => seen.push(ctx.label));
  assert.strictEqual(again, first, '同主题应复用缓存画布');
  assert.strictEqual(builds, 1, '同主题不应重绘');
  assert.deepStrictEqual(seen, ['bg1']);

  const night = cache.ensure('night', () => seen.push(ctx.label));
  assert.strictEqual(builds, 2);
  assert.notStrictEqual(night, first);
  assert.deepStrictEqual(seen, ['bg1', 'bg2']);
  assert.strictEqual(cache.theme, 'night');
});

test('背景缓存：绘制抛错时不生效，target 恢复且下次重试', () => {
  const main = makeCanvas('main');
  bindCanvas(main.canvas, 1);

  let attempts = 0;
  const seen = [];
  const cache = createBackgroundCache({
    createCanvas: () => makeCanvas('fail').canvas,
    dpr: 1,
  });

  assert.throws(() => cache.ensure('day', () => {
    attempts++;
    seen.push(ctx.label);
    throw new Error('paint failed');
  }), /paint failed/);

  assert.strictEqual(attempts, 1);
  assert.deepStrictEqual(seen, ['fail']);
  assert.strictEqual(ctx, main.c, '异常后必须恢复主 target');
  assert.strictEqual(cache.canvas, null, '失败的绘制不应被标记为有效缓存');
  assert.strictEqual(cache.theme, null);

  const canvas = cache.ensure('day', () => { attempts++; });
  assert.strictEqual(attempts, 2, '下一次调用应重新尝试');
  assert.ok(canvas);
  assert.strictEqual(cache.theme, 'day');
  assert.strictEqual(ctx, main.c);
});

test('背景缓存：默认 DPR 在绘制时读取，而不是创建缓存时捕获', () => {
  bindCanvas(makeCanvas('initial').canvas, 1);
  const offscreen = makeCanvas('background');
  const cache = createBackgroundCache({ createCanvas: () => offscreen.canvas });
  const main = makeCanvas('retina');
  bindCanvas(main.canvas, 2);
  const canvas = cache.ensure('day', () => assert.strictEqual(ctx, offscreen.c));
  assert.strictEqual(canvas.width, W * 2);
  assert.strictEqual(canvas.height, H * 2);
  assert.deepStrictEqual(offscreen.c.scaleArgs, [[2, 2]]);
  assert.strictEqual(ctx, main.c);
});

test('背景缓存：DPR 变化必须重建，否则换屏后整幅背景按旧分辨率缩放发糊', () => {
  const main = makeCanvas('main');
  bindCanvas(main.canvas, 1);
  const cache = createBackgroundCache({ createCanvas: () => makeCanvas('bg').canvas });
  let painted = 0;
  const first = cache.ensure('day', () => { painted++; });
  assert.strictEqual(first.width, W * 1);
  assert.strictEqual(cache.scale, 1);

  // 同一主题、同一 DPR：命中缓存，不得重绘
  assert.strictEqual(cache.ensure('day', () => { painted++; }), first);
  assert.strictEqual(painted, 1);

  // 同一主题、DPR 变了：必须重建
  bindCanvas(main.canvas, 2);
  const second = cache.ensure('day', () => { painted++; });
  assert.notStrictEqual(second, first, 'DPR 变化后不应复用旧位图');
  assert.strictEqual(second.width, W * 2);
  assert.strictEqual(second.height, H * 2);
  assert.strictEqual(cache.scale, 2);
  assert.strictEqual(painted, 2);

  // DPR 变回来同样要重建（缓存只保存最近一份，不做多 DPR 常驻）
  bindCanvas(main.canvas, 1);
  assert.strictEqual(cache.ensure('day', () => { painted++; }).width, W * 1);
  assert.strictEqual(painted, 3);
});

test('背景缓存：换主题失败时保留旧缓存，重试成功后替换', () => {
  const main = makeCanvas('main');
  bindCanvas(main.canvas, 1);
  const cache = createBackgroundCache({ createCanvas: () => makeCanvas('bg').canvas });
  const day = cache.ensure('day', () => {});
  assert.throws(() => cache.ensure('night', () => { throw new Error('paint failed'); }), /paint failed/);
  assert.strictEqual(ctx, main.c);
  assert.strictEqual(cache.canvas, day);
  assert.strictEqual(cache.theme, 'day');
  assert.strictEqual(cache.ensure('day', () => assert.fail('已有主题不应重绘')), day);
  const night = cache.ensure('night', () => {});
  assert.notStrictEqual(night, day);
  assert.strictEqual(cache.theme, 'night');
});
