import test from 'node:test';
import assert from 'node:assert/strict';
import { makeContext, scenario, withTarget } from './helpers/scenario.mjs';
import { startLevel, beginPlay } from '../src/core/world.js';
import { ctx, DPR } from '../src/render/target.js';
import { bgCache } from '../src/render/background.js';
import { H, W } from '../src/core/constants.js';

test('夹具1 记录型 ctx 统计真实绘制，未知 API 与未知属性写入均抛错', () => {
  const { ctx: c, counts } = makeContext({ label: '自检' });
  c.fillStyle = '#fff';
  c.fillRect(0, 0, 10, 10);
  c.fillRect(1, 2, 3, 4);
  assert.equal(counts.get('fillRect'), 2);
  assert.equal(c.fillStyle, '#fff');
  assert.throws(() => c.definitelyNotARealCanvasApi(), /Canvas 桩缺少 API/);
  assert.throws(() => { c.shadowBlur = 4; }, /不支持写入属性/);
  const gradient = c.createLinearGradient(0, 0, 1, 1);
  assert.equal(typeof gradient.addColorStop, 'function');
});

test('夹具2 记录模式留下绘制顺序、渐变停靠点与样式写入历史', () => {
  const plain = makeContext({ label: 'plain' });
  plain.ctx.beginPath();
  assert.equal(plain.trace, null);
  assert.equal(plain.writes, null);
  assert.equal(plain.counts.get('beginPath'), 1);

  const traced = makeContext({ label: 'traced', trace: [], writes: [] });
  traced.ctx.fillStyle = 'red';
  const gradient = traced.ctx.createLinearGradient(0, 0, 0, 10);
  gradient.addColorStop(0, 'a');
  gradient.addColorStop(1, 'b');
  traced.ctx.fill();
  assert.deepEqual(traced.trace.map(entry => entry.op || entry.prop),
    ['fillStyle', 'createLinearGradient', 'addColorStop', 'addColorStop', 'fill']);
  assert.deepEqual(traced.trace[1].stops, [[0, 'a'], [1, 'b']]);
  assert.deepEqual(traced.writes, [{ prop: 'fillStyle', value: 'red' }]);
});

test('夹具3 scenario 绑定主画布并启动帧链，菜单帧真实绘制天空渐变与底板', () => {
  assert.equal(ctx, null, '导入夹具前渲染目标未绑定');
  const h = scenario({ seed: 7, dpr: 2 });
  assert.equal(DPR, 2);
  assert.equal(ctx, h.paint.ctx);
  assert.equal(h.queue.length, 1, 'start 已排第一帧');
  h.frame();
  assert.ok(h.paint.counts.get('createLinearGradient') > 0, '菜单帧没有绘制天空渐变');
  assert.ok(h.paint.counts.get('fillRect') > 0, '菜单帧没有绘制底板/暗角');
  assert.ok(h.paint.counts.get('arc') > 0, '菜单帧没有绘制太阳与云');
  assert.equal(h.world.state, 'menu');
  assert.equal(h.clock, 1000 / 60);
});

test('夹具3b 战斗帧经背景缓存走 drawImage，主题切换后缓存重新生成', () => {
  const h = scenario({ seed: 7 });
  startLevel(h.world, 0);
  // 不带卡片：E18 起卡槽图标也走 drawImage，会干扰"每帧贴一次背景"的计数。
  h.world.slots = [];
  beginPlay(h.world);
  h.frame();
  assert.equal(h.paint.counts.get('drawImage'), 1, '首个战斗帧应生成并贴出背景缓存');
  h.frame();
  assert.equal(h.paint.counts.get('drawImage'), 2, '同主题第二帧应命中缓存后再次贴图');
  assert.equal(bgCache.theme, 'day');
});

test('夹具4 pump 推进世界时钟，帧链断裂与空队列均报错', () => {
  const h = scenario({ seed: 7 });
  startLevel(h.world, 0);
  h.world.slots = [{ type: 'sunflower', cool: 0 }];
  beginPlay(h.world);
  const t = h.world.t;
  h.pump(1);
  assert.ok(Math.abs(h.world.t - (t + 1)) < 1 / 30, `1 秒模拟后时钟偏移 ${h.world.t - t}`);
  h.queue.length = 0;
  assert.throws(() => h.frame(), /帧链中断/);
  assert.throws(() => h.pump(0.5), /帧链中断/);
});

test('夹具5 withTarget 把绘制导到记录替身后恢复原目标', () => {
  const h = scenario({ seed: 7 });
  const main = ctx;
  const probe = makeContext({ label: '探针' });
  const out = withTarget(probe.ctx, () => {
    probe.ctx.arc(1, 2, 3, 0, 1);
    return '返回值';
  });
  assert.equal(out, '返回值');
  assert.equal(probe.counts.get('arc'), 1);
  assert.equal(ctx, main, 'withTarget 未恢复主画布');
  assert.throws(() => withTarget(probe.ctx, () => { throw new Error('boom'); }), /boom/);
  assert.equal(ctx, main, '异常路径未恢复主画布');
});

test('夹具6 两个场景实例的世界、音频与帧队列互相隔离', () => {
  const a = scenario({ seed: 11 });
  const b = scenario({ seed: 12 });
  assert.notEqual(a.world, b.world);
  assert.notEqual(a.ui, b.ui);
  assert.notEqual(a.frameState.rng, b.frameState.rng);
  startLevel(a.world, 0);
  a.world.slots = [{ type: 'sunflower', cool: 0 }];
  beginPlay(a.world);
  a.pump(1);
  assert.equal(b.world.state, 'menu');
  assert.equal(b.world.t, 0);
  assert.equal(b.sounds.length, 0);
  assert.equal(a.sounds.length > 0, true);
  assert.ok(a.world.seed !== b.world.seed);
  assert.equal(W, 1024);
  assert.equal(H, 640);
});
