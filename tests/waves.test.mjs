// 波次生成不变量：出怪总数、开局节奏、末波旗帜、可复现性。
// 随机源用固定 seed 的 mulberry32 注入，任何失败都能原样复现。
import test from 'node:test';
import assert from 'node:assert';

const { buildSpawns } = await import('../src/core/waves.js');
const { mulberry32 } = await import('../src/core/rng.js');
const { LEVELS } = await import('../src/core/data/levels.js');
const { MAX_CARDS } = await import('../src/render/hud.js');

// 每个 seed 跑一遍全部关卡；断言只依赖不变量，不依赖具体随机数
function eachLevel(fn) {
  for (let seed = 1; seed <= 40; seed++) {
    LEVELS.forEach((lv, li) => fn(buildSpawns(lv, mulberry32(seed)), lv, li, seed));
  }
}

test('出怪事件总数守恒：等于关卡 count，不多发不漏发', () => {
  eachLevel((r, lv, li, seed) => {
    const spawned = r.events.filter(e => e.type);
    assert.strictEqual(r.total, lv.count, `第${li + 1}关 seed${seed} total 字段`);
    assert.strictEqual(spawned.length, lv.count, `第${li + 1}关 seed${seed} 实际出怪数`);
  });
});

test('末波必为旗帜僵尸领头，且总攻提示 announce 恰好一次', () => {
  eachLevel((r, lv, li, seed) => {
    const ev = r.events;
    assert.strictEqual(ev.filter(e => e.announce).length, 1, `第${li + 1}关 seed${seed} announce 次数`);
    const announceAt = ev.findIndex(e => e.announce);
    const after = ev.slice(announceAt + 1).filter(e => e.type);
    assert.ok(after.length >= 4, `第${li + 1}关 seed${seed} 末波人数 ${after.length}`);
    assert.strictEqual(after[0].type, 'flag', `第${li + 1}关 seed${seed} 末波领头应为旗帜僵尸`);
    assert.strictEqual(after.filter(e => e.type === 'flag').length, 1, '旗帜僵尸只应出现在末波领头');
  });
});

test('开局节奏：前 3 只必为普通僵尸，给玩家布阵时间', () => {
  eachLevel((r, lv, li, seed) => {
    const first3 = r.events.filter(e => e.type).slice(0, 3);
    assert.ok(first3.every(e => e.type === 'normal'), `第${li + 1}关 seed${seed} 前3只 = ${first3.map(e => e.type)}`);
  });
});

test('出怪时刻单调不减，且首只不早于 26 秒', () => {
  eachLevel((r, lv, li, seed) => {
    for (let i = 1; i < r.events.length; i++) {
      assert.ok(r.events[i].t >= r.events[i - 1].t, `第${li + 1}关 seed${seed} 第${i}个事件时刻倒退`);
    }
    assert.ok(r.events[0].t >= 26, `第${li + 1}关 seed${seed} 首只过早`);
  });
});

test('只出关卡表里登记的僵尸类型', () => {
  eachLevel((r, lv, li) => {
    const allowed = new Set(lv.types.map(([t]) => t).concat('flag'));
    for (const e of r.events) {
      if (e.type) assert.ok(allowed.has(e.type), `第${li + 1}关出现未登记的类型 ${e.type}`);
    }
  });
});

test('关卡卡数不超过 HUD 布局上限：slots 与 MAX_CARDS 是同一个数字的两份写法', () => {
  // HUD 只按 MAX_CARDS 预留卡槽宽度，铲子按钮固定在它右侧。关卡 slots 一旦超过它，
  // 多出来的卡会画到铲子上面并被铲子的热点压住——「有卡却点不到」。
  // 渲染层用 Math.min 兜底不画越界卡，但正确做法是让这个数字根本对不上就红。
  for (const [li, lv] of LEVELS.entries()){
    assert.ok(lv.slots <= MAX_CARDS,
      `第${li + 1}关 slots=${lv.slots} 超过 HUD 布局上限 MAX_CARDS=${MAX_CARDS}：` +
      '请同步修改 src/render/hud.js 的卡槽布局与铲子位置，而不是只改关卡表');
  }
});

test('同一 seed 必得同一张时刻表（可复现性是确定性重放的前提）', () => {
  for (const lv of LEVELS) {
    assert.deepStrictEqual(buildSpawns(lv, mulberry32(7)), buildSpawns(lv, mulberry32(7)));
  }
  assert.notDeepStrictEqual(buildSpawns(LEVELS[0], mulberry32(7)), buildSpawns(LEVELS[0], mulberry32(8)));
});
