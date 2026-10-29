import test from 'node:test';
import assert from 'node:assert';
import { W, H } from '../src/core/constants.js';
import { bindCanvas, withTarget, ctx, DPR } from '../src/render/target.js';

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

test('target：withTarget 在回调抛错后仍恢复 target', () => {
  const a = fakeCanvas('a'), b = fakeCanvas('b');
  bindCanvas(a.canvas, 1);
  assert.throws(() => withTarget(b.c, () => { throw new Error('paint failed'); }), /paint failed/);
  assert.strictEqual(ctx, a.c);
});
