import test from 'node:test';
import assert from 'node:assert';
import { W, H } from '../src/core/constants.js';
import { bindCanvas, withTarget, syncCanvasDPR, ctx, DPR, MAX_DPR, preferredDPR } from '../src/render/target.js';

function fakeCanvas(label){
  const calls = [];
  const c = {
    label,
    scale(...a){ calls.push(a); },
    calls,
  };
  return { canvas: { width: 0, height: 0, getContext: () => c }, c };
}

test('target：bindCanvas 写入 DPR、画布尺寸并缩放上下文', () => {
  const { canvas, c } = fakeCanvas('main');
  const got = bindCanvas(canvas, 2);
  assert.strictEqual(got, c);
  assert.strictEqual(ctx, c, 'ctx 应是 live binding，指向刚绑定的上下文');
  assert.strictEqual(DPR, 2);
  assert.strictEqual(canvas.width, W * 2);
  assert.strictEqual(canvas.height, H * 2);
  assert.deepStrictEqual(c.calls, [[2, 2]]);
});

test('target：bindCanvas 默认按 window.devicePixelRatio 限制到 2', () => {
  const prev = globalThis.window;
  globalThis.window = { devicePixelRatio: 3 };
  try {
    const { canvas } = fakeCanvas('main');
    bindCanvas(canvas);
    assert.strictEqual(DPR, 2);
    assert.strictEqual(canvas.width, W * 2);
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});

test('target：withTarget 同步切换、返回结果并恢复', () => {
  const a = fakeCanvas('a'), b = fakeCanvas('b');
  bindCanvas(a.canvas, 1);
  const out = withTarget(b.c, () => ctx.label);
  assert.strictEqual(out, 'b');
  assert.strictEqual(ctx, a.c, '结束后应恢复原 target');
});

test('target：withTarget 支持嵌套，逐层恢复', () => {
  const a = fakeCanvas('a'), b = fakeCanvas('b'), c = fakeCanvas('c');
  bindCanvas(a.canvas, 1);
  const seen = [];
  withTarget(b.c, () => {
    seen.push(ctx.label);
    withTarget(c.c, () => seen.push(ctx.label));
    seen.push(ctx.label);
  });
  assert.deepStrictEqual(seen, ['b', 'c', 'b']);
  assert.strictEqual(ctx, a.c);
});

test('target：syncCanvasDPR 只在新 DPR 与当前不同时重建，并重设 ctx 缩放', () => {
  const { canvas, c } = fakeCanvas('main');
  bindCanvas(canvas, 1);
  assert.strictEqual(DPR, 1);

  // 同一 DPR：什么都不做（不得无谓重建——重建会清空画布）
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 1 }), false);
  assert.strictEqual(canvas.width, W);
  assert.deepStrictEqual(c.calls, [[1, 1]]);

  // 换到 2 倍屏：重建，背板翻倍，ctx 缩放重设为 2
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 2 }), true);
  assert.strictEqual(DPR, 2);
  assert.strictEqual(canvas.width, W * 2);
  assert.strictEqual(canvas.height, H * 2);
  assert.deepStrictEqual(c.calls, [[1, 1], [2, 2]], '重建后必须重新 ctx.scale，否则坐标系统错位');

  // 换回 1 倍屏：同样要重建
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 1 }), true);
  assert.strictEqual(canvas.width, W);
  assert.deepStrictEqual(c.calls, [[1, 1], [2, 2], [1, 1]]);
});

test('target：syncCanvasDPR 对超过 2 的 DPR 与缺失 window 一律夹取到上限', () => {
  const { canvas } = fakeCanvas('main');
  bindCanvas(canvas, 1);
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 3 }), true);
  assert.strictEqual(DPR, MAX_DPR, '3 倍屏应夹到 2');
  assert.strictEqual(canvas.width, W * 2);

  // 已在上限时，3 倍屏与 2 倍屏是同一个目标值：不应反复重建
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 2 }), false);
  assert.strictEqual(syncCanvasDPR(canvas, { devicePixelRatio: 4 }), false);

  // window 缺失（Node 环境）退回 1
  assert.strictEqual(syncCanvasDPR(canvas, undefined), true);
  assert.strictEqual(DPR, 1);
});

test('target：withTarget 在回调抛错后仍恢复 target', () => {
  const a = fakeCanvas('a'), b = fakeCanvas('b');
  bindCanvas(a.canvas, 1);
  assert.throws(() => withTarget(b.c, () => { throw new Error('paint failed'); }), /paint failed/);
  assert.strictEqual(ctx, a.c);
});
